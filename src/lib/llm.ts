import Groq from "groq-sdk";

const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.warn("WARNING: GROQ_API_KEY is missing from environment variables.");
}

// Export the Groq client instance
export const groq = new Groq({ apiKey: apiKey || "dummy" });

export interface RetrievedDoc {
  text: string;
  metadata?: {
    source_file?: string;
    doc_type?: string;
    product_id?: string;
  };
}

/**
 * Builds the comprehensive diagnostic system prompt.
 * Restricts the LLM to the retrieved context and forces systematic troubleshooting behaviors.
 */
export function buildSystemPrompt(productName: string, retrievedDocs: RetrievedDoc[]): string {
  const formattedDocs = retrievedDocs
    .map((doc, idx) => {
      const source = doc.metadata?.source_file || "Unknown Manual";
      return `[Document Reference ${idx + 1}] (Source: ${source})\n${doc.text}\n-------------------`;
    })
    .join("\n\n");

  return `You are a professional, expert product diagnostic technician. 
Your goal is to help a user systematically troubleshoot and resolve an issue with their product: **${productName}**.

YOU MUST STRICTLY FOLLOW THESE OPERATIONAL RULES:
1. NEVER guess or make up facts. Use ONLY the product documentation provided below. If the documentation does not contain the answer, state: "I cannot find troubleshooting instructions for this specific symptom in the official documentation."
2. DO NOT overwhelm the user with all possible causes or solutions at once.
3. INSTEAD, ask 1 or 2 targeted, brief follow-up questions to gather more details or symptoms to narrow down the issue (investigation phase).
4. Use a systematic process of elimination:
   - Identify the symptom.
   - Gather context/history of the issue.
   - Suggest a safe, simple test or visual inspection the user can perform.
   - Evaluate results to eliminate candidate causes.
   - Confirm the specific fault.
   - Provide the exact step-by-step resolution.
5. ALWAYS cite the document you used for your information using brackets, like this: [Source: filename.pdf]. If citing web links, use: [Source: domain.com].
6. Keep your messages concise, structured, and easy to read for a layperson. Use bolding and bullet points appropriately.

OFFICIAL PRODUCT SUPPORT DOCUMENTATION:
${formattedDocs || "No documentation manuals are currently loaded for this product."}

Remember: Be methodical. Investigate first, narrow down, and then diagnose. Always cite your sources.`;
}
