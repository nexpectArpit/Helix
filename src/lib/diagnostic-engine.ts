import { groq } from "./llm";

export interface CauseEvidence {
  sourceDocument: string;
  excerpt: string;
  citation?: string;
  retrievalReason?: string;
}

export interface CauseTest {
  testDescription: string;
  expectedResult?: string;
  actualResult?: string | null;
  status: "pending" | "passed" | "failed";
}

export interface PossibleCause {
  id: string;
  label: string;
  status: "possible" | "likely" | "highly_likely" | "confirmed" | "eliminated";
  evidence: CauseEvidence[];
  tests: CauseTest[];
}

export interface HistoryEntry {
  timestamp: string;
  action: string;
}

export interface DiagnosticState {
  symptom: string;
  phase: "intake" | "investigation" | "testing" | "diagnosis" | "resolution" | "insufficient_information";
  possibleCauses: PossibleCause[];
  currentQuestion: string | null;
  pendingInformation: string[];
  workingDiagnosis?: string;
  rootCauseHistory: HistoryEntry[];
}

/**
 * Programmatic Phase Transition Table (Priority 2A)
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  "intake":                  ["intake", "investigation", "insufficient_information"],
  "investigation":           ["investigation", "testing", "insufficient_information"],
  "testing":                 ["testing", "diagnosis", "insufficient_information"],
  "diagnosis":               ["diagnosis", "resolution", "testing"],
  "resolution":              ["resolution"],
  "insufficient_information": ["insufficient_information", "investigation", "intake"]
};

/**
 * Creates a default, blank diagnostic state.
 */
export function createDefaultState(): DiagnosticState {
  return {
    symptom: "",
    phase: "intake",
    possibleCauses: [],
    currentQuestion: null,
    pendingInformation: [],
    rootCauseHistory: []
  };
}

/**
 * Executes Phase A of the Diagnostic Engine: updates the state JSON based on previous state, user input, and retrieved docs.
 */
export async function runPhaseA(
  previousState: DiagnosticState,
  latestMessage: string,
  retrievedDocs: any[],
  similarCases?: any[]
): Promise<DiagnosticState> {
  const docsText = retrievedDocs && retrievedDocs.length > 0
    ? retrievedDocs.map((d, i) => `[Source ${i + 1}: ${d.metadata?.source_file || "Manual"}]\n${d.text}`).join("\n\n")
    : "No support manuals found.";

  // Add similar cases context to Phase A for community learning (Priority 2E)
  const similarCasesSection = similarCases && similarCases.length > 0
    ? `\n\nSIMILAR RESOLVED CASES FROM OTHER USERS:\n${similarCases.map((c, i) => `[Case ${i + 1}]: ${c.text}`).join("\n")}\nUse these similar cases to prioritize identifying and matching potential causes.`
    : "";

  const systemPrompt = `You are a Structured Diagnostic Analyzer.
Your objective is to analyze the latest user message, previous diagnostic state, and retrieved manuals.
You must update the structured state JSON representing the state of the diagnostic session.

PHASE DEFINITIONS AND TRANSITION RULES:
- "intake": Initial symptom reporting. Use this ONLY during the first user greeting or before a specific product symptom is defined.
- "investigation": Once a symptom is identified, and you are mapping potential causes from retrieved documents. Use this phase before any physical tests have been performed.
- "testing": Once possible causes have been identified, and you are actively recommending specific inspections, measurements, or checks for the user to perform.
- "diagnosis": Once some physical tests/checks have ACTUALLY been performed by the user (either confirming, narrowing down, or eliminating causes). Do NOT jump to diagnosis on the first symptom report.
- "resolution": Transition to this phase ONLY when a cause has been "confirmed" AND the repair step has been performed/verified (e.g., the user reports the symptom has disappeared and the product now works normally). Under this phase, summarize the resolution.
- "insufficient_information": When there is no relevant information in the manuals to diagnose the issue.

STRICT OPERATIONAL RULES:
1. Grounding Rule (No Evidence -> No Cause): You must only add or maintain causes that are explicitly documented in the retrieved manuals. If there is no retrieval hit supporting a cause, it must not be added.
2. Every possible cause must be backed by CauseEvidence. You MUST populate "retrievalReason" in CauseEvidence explaining exactly why this document excerpt is relevant to the cause.
3. Cause Labels: The "label" for a PossibleCause MUST be a noun phrase describing a component fault (e.g., "Blown Fuse", "Corroded Contacts"). It MUST NOT be a troubleshooting instruction or action (e.g., do NOT use "Check the fuse").
4. Replace numeric confidence with qualitative status: "possible" | "likely" | "highly_likely" | "confirmed" | "eliminated".
5. Handle the Cause -> Test -> Result chain. If the user reports the result of a physical check or inspection:
   - Match it to a test in the appropriate cause's tests list.
   - Update its actualResult and set status to "passed" (if normal/healthy) or "failed" (if a fault was found).
   - Update the cause's status accordingly (e.g. if fuse check is failed, cause blown fuse becomes "confirmed").
6. Incremental Updates: Maintain the list of possibleCauses from the previous state, only updating their status, evidence, or tests based on new information. Do not wipe out causes unless they are eliminated.
7. List active missing information in pendingInformation, map the last question or next question in currentQuestion.
8. Record significant diagnostic progressions in the rootCauseHistory log list.
9. Preserving Confirmed Causes: A cause that was "confirmed" in the PREVIOUS STATE must never be downgraded or set to "eliminated". Even if the repair is successful and the product works normally, keep its status as "confirmed" to indicate it was the identified root cause.

EXPECTED JSON SCHEMA:
Return a strictly valid JSON object matching the following TypeScript interface structure:

interface CauseEvidence {
  sourceDocument: string;
  excerpt: string;
  citation?: string;
  retrievalReason?: string;
}

interface CauseTest {
  testDescription: string; // MUST be named "testDescription" (not "test")
  expectedResult?: string;
  actualResult?: string | null;
  status: "pending" | "passed" | "failed";
}

interface PossibleCause {
  id: string; // unique lowercase snake_case ID, e.g. "blown_fuse" (MUST NOT be omitted)
  label: string; // MUST be named "label" (not "cause")
  status: "possible" | "likely" | "highly_likely" | "confirmed" | "eliminated";
  evidence: CauseEvidence[];
  tests: CauseTest[];
}

interface DiagnosticState {
  symptom: string; // Identified primary symptom
  phase: "intake" | "investigation" | "testing" | "diagnosis" | "resolution" | "insufficient_information";
  possibleCauses: PossibleCause[];
  currentQuestion: string | null;
  pendingInformation: string[];
  workingDiagnosis?: string;
  rootCauseHistory: { timestamp: string; action: string; }[];
}

Retrieved Support Documentation Context:
${docsText}${similarCasesSection}

Return a strictly valid JSON object matching the DiagnosticState interface schema. Do not write any conversational text. Return ONLY the JSON object.`;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `PREVIOUS STATE:\n${JSON.stringify(previousState)}\n\nLATEST USER MESSAGE:\n"${latestMessage}"` }
      ],
      temperature: 0.1
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      let parsed: DiagnosticState;
      try {
        parsed = JSON.parse(content) as DiagnosticState;
      } catch (parseErr) {
        console.error("[PHASE_A_ERROR] Failed to parse JSON from LLM content:", parseErr);
        return previousState;
      }

      // Schema Sanitization Pass (Priority 2D)
      const sanitizedCauses: PossibleCause[] = [];
      const validStatuses = ["possible", "likely", "highly_likely", "confirmed", "eliminated"];
      const validTestStatuses = ["pending", "passed", "failed"];

      if (parsed.possibleCauses && Array.isArray(parsed.possibleCauses)) {
        for (const rawCause of parsed.possibleCauses) {
          if (!rawCause.label) {
            continue; // Skip causes missing label
          }
          const id = rawCause.id || rawCause.label.toLowerCase().replace(/[^a-z0-9]+/g, "_");
          const status = validStatuses.includes(rawCause.status) ? rawCause.status : "possible";
          
          const evidenceList: CauseEvidence[] = [];
          if (rawCause.evidence && Array.isArray(rawCause.evidence)) {
            for (const ev of rawCause.evidence) {
              if (ev.excerpt) {
                evidenceList.push({
                  sourceDocument: ev.sourceDocument || "Manual",
                  excerpt: ev.excerpt,
                  citation: ev.citation || "",
                  retrievalReason: ev.retrievalReason || ""
                });
              }
            }
          }

          const testsList: CauseTest[] = [];
          if (rawCause.tests && Array.isArray(rawCause.tests)) {
            for (const t of rawCause.tests) {
              const desc = t.testDescription || (t as any).test || (t as any).description;
              if (desc) {
                testsList.push({
                  testDescription: desc,
                  expectedResult: t.expectedResult || "",
                  actualResult: t.actualResult !== undefined ? t.actualResult : null,
                  status: validTestStatuses.includes(t.status) ? t.status : "pending"
                });
              }
            }
          }

          sanitizedCauses.push({
            id,
            label: rawCause.label,
            status: status as any,
            evidence: evidenceList,
            tests: testsList
          });
        }
      }

      // Ensure basic structure safety
      return {
        symptom: parsed.symptom || previousState.symptom || "",
        phase: parsed.phase || previousState.phase || "intake",
        possibleCauses: sanitizedCauses,
        currentQuestion: parsed.currentQuestion !== undefined ? parsed.currentQuestion : previousState.currentQuestion,
        pendingInformation: parsed.pendingInformation || previousState.pendingInformation || [],
        workingDiagnosis: parsed.workingDiagnosis || previousState.workingDiagnosis,
        rootCauseHistory: parsed.rootCauseHistory || previousState.rootCauseHistory || []
      };
    }
  } catch (err) {
    console.error("[PHASE_A_ERROR] Failed to run structured analysis phase:", err);
  }
  return previousState;
}

/**
 * Enforces strict programmatic guardrails on the diagnostic state.
 */
export function enforceGuardrails(
  state: DiagnosticState, 
  retrievedDocs: any[],
  previousState?: DiagnosticState,
  latestMessage?: string
): DiagnosticState {
  const updated = { ...state };

  // 0. Programmatic Phase Transition Guardrail (Priority 2A)
  if (previousState && previousState.phase) {
    const allowed = ALLOWED_TRANSITIONS[previousState.phase] || [];
    if (!allowed.includes(updated.phase)) {
      console.warn(`[GUARDRAIL] Rejecting illegal phase transition from "${previousState.phase}" to "${updated.phase}". Reverting to "${previousState.phase}".`);
      updated.phase = previousState.phase;
    }
  }

  // 1. Preserve previously confirmed causes to prevent LLM from downgrading or eliminating them
  if (previousState && previousState.possibleCauses) {
    const previouslyConfirmed = previousState.possibleCauses.filter(c => c.status === "confirmed");
    for (const confCause of previouslyConfirmed) {
      const matchIndex = updated.possibleCauses.findIndex(c => (c.id && c.id === confCause.id) || c.label === confCause.label);
      if (matchIndex >= 0) {
        console.log(`[GUARDRAIL] Preserving confirmed status of cause "${updated.possibleCauses[matchIndex].label}"`);
        updated.possibleCauses[matchIndex].status = "confirmed";
      } else {
        console.log(`[GUARDRAIL] Restoring confirmed cause "${confCause.label}" that was omitted by the LLM.`);
        updated.possibleCauses.push(confCause);
      }
    }
  }

  // 2. Preserve eliminated causes (Priority 2C)
  if (previousState && previousState.possibleCauses) {
    const previouslyEliminated = previousState.possibleCauses.filter(c => c.status === "eliminated");
    for (const elimCause of previouslyEliminated) {
      const matchIndex = updated.possibleCauses.findIndex(c => (c.id && c.id === elimCause.id) || c.label === elimCause.label);
      if (matchIndex >= 0) {
        if (updated.possibleCauses[matchIndex].status !== "eliminated") {
          console.log(`[GUARDRAIL] Restoring eliminated status of cause "${updated.possibleCauses[matchIndex].label}"`);
          updated.possibleCauses[matchIndex].status = "eliminated";
        }
      } else {
        console.log(`[GUARDRAIL] Restoring eliminated cause "${elimCause.label}" that was omitted by the LLM.`);
        updated.possibleCauses.push(elimCause);
      }
    }
  }

  // 3. Grounding check: No Evidence -> No Cause
  updated.possibleCauses = updated.possibleCauses.filter(cause => {
    // A cause must have valid evidence. If the evidence array is empty, reject it.
    if (!cause.evidence || cause.evidence.length === 0) {
      console.log(`[GUARDRAIL] Rejecting cause "${cause.label}" because it has no retrieved evidence.`);
      return false;
    }
    return true;
  });

  // 4. Evidence Grounding Validation Against Retrieved Docs (Priority 2B)
  const normalizedDocs = retrievedDocs.map(d => (d.text || "").toLowerCase().replace(/\s+/g, " "));
  updated.possibleCauses = updated.possibleCauses.filter(cause => {
    if (cause.status === "confirmed") return true;

    const hasGroundedEvidence = cause.evidence.some(ev => {
      const excerpt = (ev.excerpt || "").trim().toLowerCase().replace(/\s+/g, " ");
      if (excerpt.length < 10) return false;
      const checkLength = Math.min(40, excerpt.length);
      const excerptPrefix = excerpt.substring(0, checkLength);
      return normalizedDocs.some(doc => doc.includes(excerptPrefix));
    });

    if (!hasGroundedEvidence) {
      console.log(`[GUARDRAIL] Rejecting cause "${cause.label}" because its evidence excerpt is not found in retrieved documents.`);
      return false;
    }
    return true;
  });

  // 5. Insufficient Information Path: If retrieval result is empty or extremely weak, set phase (only if we are out of the initial intake phase)
  const hasRetrievalDocs = retrievedDocs && retrievedDocs.length > 0;
  if (!hasRetrievalDocs && updated.phase !== "intake") {
    console.log(`[GUARDRAIL] Setting phase to insufficient_information due to empty manuals context.`);
    updated.phase = "insufficient_information";
    delete updated.workingDiagnosis;
    
    // Add insufficient info to history if not already present
    const lastHistory = updated.rootCauseHistory[updated.rootCauseHistory.length - 1];
    if (!lastHistory || !lastHistory.action.includes("insufficient information")) {
      updated.rootCauseHistory.push({
        timestamp: new Date().toISOString(),
        action: "Insufficient documentation available to isolate root cause."
      });
    }
  }

  // 6. Evidence-Based Progression: Do not allow confirmation unless tests are completed
  updated.possibleCauses = updated.possibleCauses.map(cause => {
    if (cause.status === "confirmed") {
      const hasFailedTest = cause.tests.some(t => t.status === "failed");
      const hasTestResults = cause.tests.some(t => t.actualResult);
      
      if (!hasFailedTest && !hasTestResults) {
        console.log(`[GUARDRAIL] Downgrading cause "${cause.label}" from confirmed because no tests were completed.`);
        return { ...cause, status: "highly_likely" as const };
      }
    }
    return cause;
  });

  // 7. Auto-Transition to Resolution via Regex (Priority 4D: runs after evidence-based progression)
  const hasConfirmedFinal = updated.possibleCauses.some(c => c.status === "confirmed");
  if (hasConfirmedFinal && latestMessage) {
    const cleanMsg = latestMessage.toLowerCase();
    const isFixed = /\b(works|fixed|resolved|repaired|normal|working|cleaned|replaced|solved|disappeared|ok)\b/.test(cleanMsg);
    if (isFixed) {
      console.log(`[GUARDRAIL] User message suggests issue is fixed and confirmed cause exists. Setting phase to resolution.`);
      updated.phase = "resolution";
    }
  }

  // 8. Force resolution block: prevent resolution phase unless there is a confirmed cause
  const hasConfirmedFinalCheck = updated.possibleCauses.some(c => c.status === "confirmed");
  if (updated.phase === "resolution" && !hasConfirmedFinalCheck) {
    console.log(`[GUARDRAIL] Overriding phase from resolution to diagnosis because no cause is officially confirmed.`);
    updated.phase = "diagnosis";
  }

  return updated;
}

/**
 * Builds the Phase B user-facing conversational response stream options.
 */
export function buildPhaseBPrompt(
  productName: string,
  state: DiagnosticState,
  retrievedDocs: any[],
  similarCases?: any[],
  language?: string,
  spareParts?: any[]
): string {
  const docsText = retrievedDocs && retrievedDocs.length > 0
    ? retrievedDocs.map((d, i) => `[Source ${i + 1}: ${d.metadata?.source_file || "Manual"}]\n${d.text}`).join("\n\n")
    : "No support manuals found.";

  // Add similar cases context
  const casesText = similarCases && similarCases.length > 0
    ? `\n\nSIMILAR RESOLVED CASES FROM OTHER USERS (use these to prioritize your investigation):
${similarCases.map((c, i) => `[Past Case ${i + 1}]: ${c.text}`).join("\n")}`
    : "";

  // Add spare parts context
  const partsText = spareParts && spareParts.length > 0
    ? `\n\nAVAILABLE SPARE PARTS IN DATABASE (If relevant to the user query, recommend these exact parts, including their part number and cost if present):
${spareParts.map((p, i) => `[Part ${i + 1}]: ${p.partName} ${p.partNumber ? `(P/N: ${p.partNumber})` : ""} ${p.cost !== null ? `- Cost: $${p.cost}` : ""} - Description: ${p.description || "No description"}`).join("\n")}`
    : "";

  // Add language instruction
  const langInstruction = language && language !== "en" && language !== "English"
    ? `\n\nLANGUAGE RULE: You MUST respond entirely in the requested language: ${language}. Translate all technical terms, diagnostic instructions, and questions. Do not mix languages.`
    : "";

  return `You are a professional, expert product diagnostic technician.
Your goal is to converse with the user and help systematically resolve an issue with their product: **${productName}**.

OPERATIONAL CONVERSATION RULES:
1. ALWAYS base your discussion on the updated diagnostic state.
2. DO NOT output, expose, or mention any internal state machine variables or headings to the user (do not list "Current Investigation Phase", "Pending Info Needed", "Next Recommended Question/Test", "Active Possible Causes", or "DiagnosticState" fields). These are system implementation details.
3. Converse in natural, conversational, technician-to-customer language.
4. If the state is in "insufficient_information" phase, explain politely that you need more info, request broader observations, or ask the user to check connections.
5. If testing or investigating, guide the user step-by-step to perform the next recommended test or question (marked in the state under currentQuestion). Suggest safe visual visual checks first.
6. If the state is in the "resolution" phase:
   - Provide a clear resolution summary in natural language.
   - Outline the root cause, the repair performed, and the verification result (e.g. horn works normally).
   - Offer optional preventative advice to help the user avoid the issue in the future.
7. ALWAYS cite the document you used for your information using brackets, like this: [Source: filename.pdf].
8. Keep your message brief, structured, and easy to read.

CURRENT DIAGNOSTIC STATE (FOR YOUR INTERNAL CONTEXT ONLY — DO NOT SERIALIZE OR SHOW THESE RAW KEYS TO THE USER):
- Identified Symptom: ${state.symptom}
- Current Investigation Phase: ${state.phase}
- Active Possible Causes:
${state.possibleCauses.map(c => `  * ${c.label} (Status: ${c.status})`).join("\n")}
- Next Recommended Question/Test: ${state.currentQuestion}
- Pending Info Needed: ${state.pendingInformation.join(", ")}
- Working Diagnosis: ${state.workingDiagnosis || "None yet"}

OFFICIAL MANUALS DOCUMENTATION:
${docsText}${casesText}${partsText}${langInstruction}`;
}
