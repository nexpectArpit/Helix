import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { safeQuery, moss } from "@/lib/moss";
import { groq } from "@/lib/llm";
import { createDefaultState, runPhaseA, enforceGuardrails, buildPhaseBPrompt } from "@/lib/diagnostic-engine";

function buildRetrievalQuery(state: any, latestMessage: string): string {
  if (!state || !state.symptom) {
    return latestMessage;
  }
  
  // Extract completed tests from possibleCauses[].tests (not a top-level field)
  const completedTests: string[] = [];
  if (state.possibleCauses && Array.isArray(state.possibleCauses)) {
    for (const cause of state.possibleCauses) {
      if (cause.tests && Array.isArray(cause.tests)) {
        for (const t of cause.tests) {
          if (t.actualResult) {
            completedTests.push(`${t.testDescription}: ${t.actualResult}`);
          }
        }
      }
    }
  }
  
  const testsText = completedTests.length > 0
    ? `Tests performed: ${completedTests.join(", ")}`
    : "";
    
  return `Symptom: ${state.symptom}. Context: ${latestMessage}. ${testsText}`.trim();
}

/**
 * Extracts inferred component keyword from diagnostic state for metadata-aware retrieval.
 */
function extractComponentFromState(state: any): string | null {
  if (!state) return null;
  
  // Check possibleCauses labels for component hints
  if (state.possibleCauses && Array.isArray(state.possibleCauses)) {
    const activeCauses = state.possibleCauses.filter((c: any) => c.status !== "eliminated");
    for (const cause of activeCauses) {
      const label = (cause.label || "").toLowerCase();
      if (label.includes("horn") || label.includes("buzzer") || label.includes("acoustic")) return "horn";
      if (label.includes("fuse")) return "fuse";
      if (label.includes("battery")) return "battery";
      if (label.includes("wiring") || label.includes("wire") || label.includes("harness")) return "wiring";
      if (label.includes("switch") || label.includes("button")) return "switch";
      if (label.includes("headlight") || label.includes("lamp") || label.includes("light")) return "headlights";
    }
  }
  
  // Fallback: check symptom text
  if (state.symptom) {
    const sym = state.symptom.toLowerCase();
    if (sym.includes("horn")) return "horn";
    if (sym.includes("fuse")) return "fuse";
    if (sym.includes("battery")) return "battery";
    if (sym.includes("light")) return "headlights";
  }
  
  return null;
}

// Disable body parsing limits for streaming routes if needed, not required by default in Next.js 15
export const dynamic = "force-dynamic";

/**
 * Saves conversation progress to SQLite and indexes the turn in the Moss session.
 */
async function saveDiagnosticsProgress(
  sessionId: string,
  userMessage: string,
  assistantResponse: string,
  retrievedDocs: any[],
  finalState: any
) {
  try {
    const sessionRecord = await db.diagnosticSession.findUnique({
      where: { id: sessionId }
    });

    if (!sessionRecord) {
      console.error(`[SAVE_PROGRESS_ERROR] Diagnostic session ${sessionId} not found.`);
      return;
    }

    const currentMessages = JSON.parse(sessionRecord.messages || "[]");

    // Compile document sources used in this turn
    // Filter docs with scores above 0.3 for quality, and deduplicate by source_file
    const uniqueSourcesMap = new Map<string, any>();
    retrievedDocs.forEach((doc) => {
      const score = doc.score || 0;
      const file = doc.metadata?.source_file;
      if (file && score > 0.25) {
        uniqueSourcesMap.set(file, {
          fileName: file,
          fileType: doc.metadata?.doc_type || "pdf",
          score
        });
      }
    });
    const sources = Array.from(uniqueSourcesMap.values());

    // Append user and assistant messages
    const updatedMessages = [
      ...currentMessages,
      { role: "user", content: userMessage, createdAt: new Date() },
      { role: "assistant", content: assistantResponse, sources, createdAt: new Date() }
    ];

    // Update database record
    await db.diagnosticSession.update({
      where: { id: sessionId },
      data: {
        messages: JSON.stringify(updatedMessages),
        diagnosticState: JSON.stringify(finalState)
      }
    });

    // Index the conversation turn in the Moss session for historical recall
    if (sessionRecord.mossSessionName) {
      try {
        const sessionObj = await moss.session(sessionRecord.mossSessionName);
        
        // Moss session document
        const turnDoc = {
          id: `turn-${Date.now()}`,
          text: `User: ${userMessage}\nAssistant: ${assistantResponse}`,
          metadata: {
            role: "assistant",
            turn_number: String(updatedMessages.length / 2)
          }
        };

        await sessionObj.addDocs([turnDoc]);
        console.log(`[MOSS_SESSION_INDEX] Indexed conversation turn in Moss session ${sessionRecord.mossSessionName}`);
      } catch (mossErr: any) {
        console.error(`[MOSS_SESSION_INDEX_ERROR] Failed to add turn to Moss session:`, mossErr.message);
      }
    }
  } catch (err) {
    console.error("[SAVE_PROGRESS_CRITICAL_ERROR] Failed to save dialogue progress:", err);
  }
}

import { autoCloseIfExpired } from "@/actions/diagnostic";

export async function POST(request: NextRequest) {
  try {
    // 1. Authorize session
    const authSession = await getServerSession(authOptions);
    if (!authSession) {
      return NextResponse.json({ error: "Unauthorized. Please sign in." }, { status: 401 });
    }

    // 2. Parse request payload
    const { productId, sessionId, message, language } = await request.json();

    if (!productId || !sessionId || !message) {
      return NextResponse.json({ error: "Product ID, Session ID, and Message are required." }, { status: 400 });
    }

    if (message.length > 4000) {
      return NextResponse.json({ error: "Message too long. Please keep your message under 4000 characters." }, { status: 400 });
    }

    // Fetch session details and product details
    const diagSession = await db.diagnosticSession.findUnique({
      where: { id: sessionId },
      include: { product: true }
    });

    if (!diagSession || diagSession.userId !== authSession.user.id) {
      return NextResponse.json({ error: "Diagnostic session not found or access denied." }, { status: 404 });
    }

    // Check if session has expired (inactive for more than 2 hours)
    const wasClosed = await autoCloseIfExpired(diagSession);
    if (wasClosed || diagSession.status !== "active") {
      return NextResponse.json({ error: "This diagnostic session is concluded." }, { status: 400 });
    }

    // 3. Retrieve prior state
    const previousState = diagSession.diagnosticState && diagSession.diagnosticState !== "{}"
      ? JSON.parse(diagSession.diagnosticState)
      : createDefaultState();

    // 4. Query Moss Product Knowledge Base index using context-aware retrieval
    let retrievedDocs: any[] = [];
    const indexName = diagSession.product.mossIndexName || `product-${productId}-kb`;
    const contextQuery = buildRetrievalQuery(previousState, message);

    try {
      const indexList = await moss.listIndexes();
      const indexExists = indexList.some((idx: any) => idx.name === indexName);

      if (indexExists) {
        // Build metadata-aware filter combining inferred component
        const inferredComponent = extractComponentFromState(previousState);
        
        // Construct filter: optionally filter by component
        let queryFilter: any;
        if (inferredComponent) {
          queryFilter = {
            field: "component",
            condition: { $eq: inferredComponent }
          };
        }

        // Primary query with metadata filter
        const searchResults = await safeQuery(indexName, contextQuery, {
          top_k: 6,
          alpha: 0.8,
          filter: queryFilter
        });
        if (searchResults && searchResults.docs) {
          retrievedDocs = searchResults.docs;
        }
        
        // Fallback: if metadata-filtered query returned too few results, broaden search
        if (retrievedDocs.length < 2 && inferredComponent) {
          console.log(`[RETRIEVAL_FALLBACK] Component filter "${inferredComponent}" returned ${retrievedDocs.length} docs, broadening...`);
          const broadResults = await safeQuery(indexName, contextQuery, {
            top_k: 6,
            alpha: 0.8
          });
          if (broadResults && broadResults.docs && broadResults.docs.length > retrievedDocs.length) {
            // Merge unique docs, preferring component-matched ones
            const existingIds = new Set(retrievedDocs.map((d: any) => d.id));
            for (const doc of broadResults.docs) {
              if (!existingIds.has(doc.id)) {
                retrievedDocs.push(doc);
              }
            }
            retrievedDocs = retrievedDocs.slice(0, 8); // Cap at 8
          }
        }
      }
    } catch (mossErr: any) {
      console.error(`[MOSS_KB_QUERY_ERROR] Failed to search index "${indexName}":`, mossErr.message);
    }

    // Query Similar Resolved Cases from Moss (Phase 3) - Moved before Phase A (Priority 2E)
    let similarCases: any[] = [];
    try {
      const indexList = await moss.listIndexes();
      const resolvedIndexExists = indexList.some((idx: any) => idx.name === "mantis-resolved-cases");
      
      if (resolvedIndexExists) {
        const caseResults = await safeQuery("mantis-resolved-cases", contextQuery, {
          top_k: 3,
          alpha: 0.7,
          filter: { field: "product_id", condition: { $eq: productId } }
        });
        if (caseResults?.docs?.length > 0) {
          similarCases = caseResults.docs.filter((d: any) => (d.score || 0) > 0.4);
        }
      }
    } catch (err: any) {
      console.warn("[SIMILAR_CASES_WARN]", err.message);
    }

    // 5. Run Phase A of Diagnostic Engine (State Updates) and Enforce Guardrails
    const rawUpdatedState = await runPhaseA(previousState, message, retrievedDocs, similarCases);
    const finalState = enforceGuardrails(rawUpdatedState, retrievedDocs, previousState, message);

    // 6. Query Moss session memory for historical context matching
    let sessionContext: string = "";
    if (diagSession.mossSessionName) {
      try {
        const sessionObj = await moss.session(diagSession.mossSessionName);
        const sessionHits = await sessionObj.query(message, { topK: 3 });
        
        if (sessionHits && sessionHits.docs && sessionHits.docs.length > 0) {
          sessionContext = sessionHits.docs
            .map((doc: any, i: number) => `[Prior conversation context reference ${i + 1}]:\n${doc.text}`)
            .join("\n\n");
        }
      } catch (sessionErr: any) {
        console.warn(`[MOSS_SESSION_QUERY_WARN] Failed to recall context from session:`, sessionErr.message);
      }
    }

    // Query Spare Parts (Phase 8)
    let spareParts: any[] = [];
    try {
      const allParts = await db.sparePart.findMany({
        where: { productId }
      });
      
      const confirmedOrLikelyLabels = finalState.possibleCauses
        .filter((c: any) => c.status === "confirmed" || c.status === "highly_likely" || c.status === "likely" || c.status === "possible")
        .map((c: any) => c.label.toLowerCase())
        .join(" ");

      const retrievedText = retrievedDocs.map((d: any) => d.text).join(" ").toLowerCase();
      const matchText = (message + " " + finalState.symptom + " " + confirmedOrLikelyLabels + " " + retrievedText).toLowerCase();
      
      spareParts = allParts.filter(part => {
        const name = (part.partName || "").toLowerCase();
        const number = (part.partNumber || "").toLowerCase();
        const category = (part.category || "").toLowerCase();
        const desc = (part.description || "").toLowerCase();
        
        const words = matchText.split(/[\s,.\-\/]+/);
        return words.some(word => {
          if (word.length < 3) return false;
          return name.includes(word) || number.includes(word) || category.includes(word) || desc.includes(word);
        });
      });

      // If we matched parts, query Moss KB for parts-specific documentation if any
      if (spareParts.length > 0) {
        try {
          await safeQuery(indexName, 
            spareParts.map((p: any) => p.partName).join(", "), 
            {
              top_k: 3,
              filter: { 
                field: "section_type",
                condition: { $eq: "parts" }
              }
            }
          );
        } catch {}
      }
    } catch (err: any) {
      console.warn("[PARTS_RETRIEVAL_WARN] Failed to query spare parts:", err.message);
    }

    // 7. Build Phase B Prompt incorporating documentation, similar cases, language rules and updated state
    const systemPrompt = buildPhaseBPrompt(diagSession.product.name, finalState, retrievedDocs, similarCases, language, spareParts);
    
    // Parse db messages history
    const dbHistory = JSON.parse(diagSession.messages || "[]");
    const formattedHistory = dbHistory.map((m: any) => ({
      role: m.role,
      content: m.content
    }));

    // Inject session retrieval memory as system hint if found
    const systemMemoryHint = sessionContext
      ? `\n\nRECALLED CONVERSATION HISTORY MEMORIES:\n${sessionContext}\nUse this history to recognize what the user has already stated or performed.`
      : "";

    // 8. Request streaming completion from Groq (Phase B Response Generation)
    const responseStream = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt + systemMemoryHint },
        ...formattedHistory,
        { role: "user", content: message }
      ],
      stream: true,
      temperature: 0.2 // Low temperature for deterministic diagnostic logic
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = "";
        
        try {
          for await (const chunk of responseStream) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) {
              fullResponse += text;
              controller.enqueue(encoder.encode(text));
            }
          }
          
          // After fullResponse is complete, append spare parts if any (Phase 8)
          if (spareParts.length > 0) {
            const partsBlock = `\n\n<!--SPARE_PARTS:${JSON.stringify(spareParts)}-->`;
            controller.enqueue(encoder.encode(partsBlock));
            fullResponse += partsBlock;
          }

          // Save dialogue turn to Database and Moss Session in the background
          await saveDiagnosticsProgress(sessionId, message, fullResponse, retrievedDocs, finalState);
        } catch (streamErr: any) {
          console.error("[STREAMING_ERROR] Completion stream interrupted:", streamErr);
          controller.enqueue(encoder.encode(`\n\n[System Notification: Troubleshooting stream interrupted. Error: ${streamErr.message || String(streamErr)}]`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      }
    });
  } catch (error: any) {
    console.error("[DIAGNOSE_API_CRITICAL_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to process diagnostics thread." }, { status: 500 });
  }
}
