"use server";

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { moss, safeCreateIndex, safeAddDocs, pollJobStatus } from "@/lib/moss";
import { revalidatePath } from "next/cache";
import { groq } from "@/lib/llm";

export interface SessionResult {
  success: boolean;
  error?: string;
  sessionId?: string;
  history?: any[];
  diagnosticState?: any;
}

/**
 * Starts a new diagnostic troubleshooting session.
 */
export async function startSession(productId: string): Promise<SessionResult> {
  try {
    const userSession = await getServerSession(authOptions);
    if (!userSession || !userSession.user) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    const product = await db.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return { success: false, error: "Product not found." };
    }

    // Create session in database
    const diagSession = await db.diagnosticSession.create({
      data: {
        productId,
        userId: userSession.user.id,
        messages: JSON.stringify([]),
        status: "active"
      }
    });

    // Construct unique Moss session name
    const mossSessionName = `diag-${diagSession.id}`;

    // Initialize/warm up the Moss session
    try {
      await moss.session(mossSessionName);
    } catch (mossErr: any) {
      console.warn("[MOSS_SESSION_INIT_WARN] Failed to initialize Moss session in cloud, will retry during query:", mossErr.message);
    }

    // Update SQLite with the session name
    await db.diagnosticSession.update({
      where: { id: diagSession.id },
      data: { mossSessionName }
    });

    return { success: true, sessionId: diagSession.id };
  } catch (error: any) {
    console.error("[START_SESSION_ERROR]", error);
    return { success: false, error: error.message || "Failed to start diagnostics session." };
  }
}

/**
 * Retrieves the diagnostic chat history from SQLite.
 */
export async function getSessionHistory(sessionId: string): Promise<SessionResult> {
  try {
    const userSession = await getServerSession(authOptions);
    if (!userSession) {
      return { success: false, error: "Unauthorized." };
    }

    const diagSession = await db.diagnosticSession.findUnique({
      where: { id: sessionId },
      include: { product: true }
    });

    if (!diagSession) {
      return { success: false, error: "Diagnostic session not found." };
    }

    // Check ownership (Priority 1C - prevent cross-tenant COMPANY_ADMIN reading others' products)
    const isOwner = diagSession.userId === userSession.user.id;
    const isCompanyAdmin = userSession.user.role === "COMPANY_ADMIN" 
      && diagSession.product.companyId === userSession.user.companyId;
    if (!isOwner && !isCompanyAdmin) {
      return { success: false, error: "Access denied." };
    }

    const history = JSON.parse(diagSession.messages || "[]");
    const state = diagSession.diagnosticState && diagSession.diagnosticState !== "{}"
      ? JSON.parse(diagSession.diagnosticState)
      : null;
    return { success: true, history, diagnosticState: state };
  } catch (error: any) {
    console.error("[GET_HISTORY_ERROR]", error);
    return { success: false, error: error.message || "Failed to retrieve history." };
  }
}

/**
 * Concludes a diagnostic session, locking it and uploading history to the Moss cloud.
 */
export async function endSession(sessionId: string): Promise<SessionResult> {
  try {
    const userSession = await getServerSession(authOptions);
    if (!userSession) {
      return { success: false, error: "Unauthorized." };
    }

    const diagSession = await db.diagnosticSession.findUnique({
      where: { id: sessionId }
    });

    if (!diagSession) {
      return { success: false, error: "Session not found." };
    }

    if (diagSession.userId !== userSession.user.id) {
      return { success: false, error: "Access denied." };
    }

    // Persist the Moss session index permanently to the cloud
    if (diagSession.mossSessionName) {
      try {
        const sessionObj = await moss.session(diagSession.mossSessionName);
        await sessionObj.pushIndex();
        console.log(`[MOSS_SESSION_PUSH] Persisted Moss session ${diagSession.mossSessionName} to cloud.`);
      } catch (mossErr: any) {
        console.warn(`[MOSS_SESSION_PUSH_WARN] Failed to push Moss session ${diagSession.mossSessionName}:`, mossErr.message);
      }
    }

    // Close session in SQLite
    const updatedSession = await db.diagnosticSession.update({
      where: { id: sessionId },
      data: { status: "completed" }
    });

    // Index the resolved case into similar cases index
    try {
      await indexResolvedCase(updatedSession);
    } catch (indexErr: any) {
      console.warn("[INDEX_RESOLVED_CASE_WARN] Failed to index resolved session:", indexErr.message);
    }

    revalidatePath(`/products/${diagSession.productId}/diagnose`);

    return { success: true };
  } catch (error: any) {
    console.error("[END_SESSION_ERROR]", error);
    return { success: false, error: error.message || "Failed to end diagnostics session." };
  }
}

/**
 * Escalates a diagnostic session to company support.
 */
export async function escalateSession(sessionId: string): Promise<SessionResult> {
  try {
    const userSession = await getServerSession(authOptions);
    if (!userSession) {
      return { success: false, error: "Unauthorized." };
    }

    const diagSession = await db.diagnosticSession.findUnique({
      where: { id: sessionId }
    });

    if (!diagSession) {
      return { success: false, error: "Session not found." };
    }

    if (diagSession.userId !== userSession.user.id) {
      return { success: false, error: "Access denied." };
    }

    // Lock session in SQLite by marking as escalated
    const updated = await db.diagnosticSession.update({
      where: { id: sessionId },
      data: { status: "escalated" }
    });

    try {
      const messages = JSON.parse(updated.messages || "[]");
      const state = JSON.parse(updated.diagnosticState || "{}");

      const summaryResponse = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: `Generate a concise handoff brief for a human support agent.
Format:
**Reported Symptom:** ...
**Tests Performed:** (list each test and result)
**Eliminated Causes:** (list)
**Remaining Suspects:** (list with status)
**Recommended Next Step:** ...
Keep it under 200 words. Be factual, no conversational tone.`
          },
          {
            role: "user",
            content: `Chat transcript: ${messages.map((m: any) => `${m.role}: ${m.content}`).join("\n")}
Diagnostic State: ${JSON.stringify(state)}`
          }
        ],
        temperature: 0.1
      });

      const summary = summaryResponse.choices[0]?.message?.content || "";
      
      // Store summary in the resolution field
      await db.diagnosticSession.update({
        where: { id: sessionId },
        data: { resolution: `[AUTO-GENERATED HANDOFF BRIEF]\n${summary}` }
      });
    } catch (err: any) {
      console.warn("[HANDOFF_SUMMARY_WARN]", err.message);
    }

    revalidatePath(`/products/${diagSession.productId}/diagnose`);

    return { success: true };
  } catch (error: any) {
    console.error("[ESCALATE_SESSION_ERROR]", error);
    return { success: false, error: error.message || "Failed to escalate diagnostic session." };
  }
}

/**
 * Checks if a session has been inactive for more than 2 hours. If so, concludes it and indexes logs to MOSS.
 */
export async function autoCloseIfExpired(diagSession: any): Promise<boolean> {
  if (diagSession && diagSession.status === "active") {
    const inactiveLimit = 2 * 60 * 60 * 1000; // 2 hours
    const lastActive = new Date(diagSession.updatedAt).getTime();
    const now = Date.now();
    if (now - lastActive > inactiveLimit) {
      console.log(`[AUTO_CLOSE] Diagnostic session ${diagSession.id} is inactive for > 2 hours. Concluding automatically.`);
      
      // Index to Moss if session name exists
      if (diagSession.mossSessionName) {
        try {
          const sessionObj = await moss.session(diagSession.mossSessionName);
          await sessionObj.pushIndex();
          console.log(`[AUTO_CLOSE_MOSS] Persisted session ${diagSession.mossSessionName} to cloud.`);
        } catch (mossErr: any) {
          console.warn(`[AUTO_CLOSE_MOSS_WARN] Failed to push Moss session:`, mossErr.message);
        }
      }

      // Update in SQLite
      await db.diagnosticSession.update({
        where: { id: diagSession.id },
        data: { status: "completed" }
      });

      return true; // was closed
    }
  }
  return false;
}

/**
 * Resolves a ticket by storing a resolution message and marking the status as "resolved".
 */
export async function resolveSession(sessionId: string, resolutionText: string): Promise<SessionResult> {
  try {
    const userSession = await getServerSession(authOptions);
    if (!userSession || userSession.user.role !== "COMPANY_ADMIN" || !userSession.user.companyId) {
      return { success: false, error: "Unauthorized. Admin access required." };
    }

    const diagSession = await db.diagnosticSession.findUnique({
      where: { id: sessionId },
      include: { product: true }
    });

    if (!diagSession) {
      return { success: false, error: "Session not found." };
    }

    if (diagSession.product.companyId !== userSession.user.companyId) {
      return { success: false, error: "Access denied." };
    }

    // Update session in SQLite: mark status as "resolved", add resolution message, and set resolvedAt
    const updatedSession = await db.diagnosticSession.update({
      where: { id: sessionId },
      data: {
        status: "resolved",
        resolution: resolutionText,
        resolvedAt: new Date()
      }
    });

    // Index the resolved case into similar cases index
    try {
      await indexResolvedCase(updatedSession);
    } catch (indexErr: any) {
      console.warn("[INDEX_RESOLVED_CASE_WARN] Failed to index resolved session:", indexErr.message);
    }

    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/sessions/${sessionId}`);
    revalidatePath(`/products/${diagSession.productId}/diagnose`);

    return { success: true };
  } catch (error: any) {
    console.error("[RESOLVE_SESSION_ERROR]", error);
    return { success: false, error: error.message || "Failed to resolve session." };
  }
}

/**
 * Deletes a troubleshooting session.
 */
export async function deleteSession(sessionId: string): Promise<SessionResult> {
  try {
    const userSession = await getServerSession(authOptions);
    if (!userSession || userSession.user.role !== "COMPANY_ADMIN" || !userSession.user.companyId) {
      return { success: false, error: "Unauthorized. Admin access required." };
    }

    const diagSession = await db.diagnosticSession.findUnique({
      where: { id: sessionId },
      include: { product: true }
    });

    if (!diagSession) {
      return { success: false, error: "Session not found." };
    }

    if (diagSession.product.companyId !== userSession.user.companyId) {
      return { success: false, error: "Access denied." };
    }

    // Delete session in SQLite
    await db.diagnosticSession.delete({
      where: { id: sessionId }
    });

    // Clean up Moss cloud session if it exists
    if (diagSession.mossSessionName) {
      try {
        // Just warm up session or check it, but no deleteIndex method exists
        console.log(`[DELETE_SESSION] Session deleted locally. Moss session index: ${diagSession.mossSessionName}`);
      } catch (mossErr: any) {
        console.warn(`[MOSS_SESSION_DELETE_WARN] Failed to delete Moss session index:`, mossErr.message);
      }
    }

    revalidatePath("/dashboard");

    return { success: true };
  } catch (error: any) {
    console.error("[DELETE_SESSION_ERROR]", error);
    return { success: false, error: error.message || "Failed to delete session." };
  }
}

/**
 * Indexes a concluded/resolved session into the global MOSS index "mantis-resolved-cases" for future matching.
 */
async function indexResolvedCase(diagSession: any) {
  const state = JSON.parse(diagSession.diagnosticState || "{}");
  const confirmedList = (state.possibleCauses || []).filter((c: any) => c.status === "confirmed");
  if (!state.symptom || confirmedList.length === 0) {
    console.log(`[RESOLVED_CASE_INDEX] Skipping session ${diagSession.id} because it has no confirmed root cause.`);
    return;
  }

  // Build a structured summary document
  const confirmedCauses = confirmedList.map((c: any) => c.label);
  const eliminatedCauses = (state.possibleCauses || [])
    .filter((c: any) => c.status === "eliminated")
    .map((c: any) => c.label);

  const summaryText = [
    `Symptom: ${state.symptom}`,
    confirmedCauses.length > 0 ? `Root Cause: ${confirmedCauses.join(", ")}` : "",
    eliminatedCauses.length > 0 ? `Eliminated: ${eliminatedCauses.join(", ")}` : "",
    state.workingDiagnosis ? `Diagnosis: ${state.workingDiagnosis}` : "",
    diagSession.resolution ? `Resolution: ${diagSession.resolution}` : ""
  ].filter(Boolean).join(". ");

  const doc = {
    id: `resolved-${diagSession.id}`,
    text: summaryText,
    metadata: {
      product_id: diagSession.productId,
      session_id: diagSession.id,
      symptom: state.symptom,
      root_cause: confirmedCauses.join(", ") || "unknown",
      phase: state.phase
    }
  };

  const indexName = "mantis-resolved-cases";
  const indexList = await moss.listIndexes();
  const exists = indexList.some((idx: any) => idx.name === indexName);

  let result;
  if (exists) {
    result = await safeAddDocs(indexName, [doc]);
  } else {
    result = await safeCreateIndex(indexName, [doc]);
  }

  if (result.success && result.jobId) {
    pollJobStatus(result.jobId, 10, 1000).catch(err => {
      console.error(`[MOSS_RESOLVED_CASE_POLL_ERROR] Background poll failed for case ${diagSession.id}:`, err);
    });
  }
}
