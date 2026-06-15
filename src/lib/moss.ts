import type { MossClient as MossClientType } from "@moss-dev/moss";
import { db } from "@/lib/db";
import fs from "fs/promises";
import path from "path";
import { PDFParse } from "pdf-parse";
import { chunkText } from "@/lib/chunker";

let mossInstance: any = null;

function getMossClient(): MossClientType {
  if (!mossInstance) {
    // Dynamically require the SDK to avoid native module load at build-time
    const { MossClient } = require("@moss-dev/moss");
    const projectId = process.env.MOSS_PROJECT_ID;
    const projectKey = process.env.MOSS_PROJECT_KEY;
    if (!projectId || !projectKey) {
      console.warn("WARNING: MOSS_PROJECT_ID or MOSS_PROJECT_KEY environment variables are missing.");
    }
    mossInstance = new MossClient(projectId || "dummy", projectKey || "dummy");
  }
  return mossInstance;
}

// Export the singleton proxy instance
export const moss = new Proxy({} as any, {
  get(target, prop, receiver) {
    const client = getMossClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
  set(target, prop, value, receiver) {
    const client = getMossClient();
    return Reflect.set(client, prop, value, receiver);
  }
}) as unknown as MossClientType;

/**
 * Polls the job status until it completes, fails, or times out.
 * Moss cloud mutations are asynchronous.
 */
export async function pollJobStatus(jobId: string, maxAttempts = 60, intervalMs = 1000): Promise<boolean> {
  console.log(`[MOSS_POLL] Starting poll for Job ID: ${jobId}`);
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const job = await moss.getJobStatus(jobId);
      const status = (job?.status || "").toUpperCase();
      console.log(`[MOSS_POLL] Attempt ${attempt}/${maxAttempts} - Job: ${jobId} - Status: ${status}`);

      if (status === "COMPLETED" || status === "SUCCESS" || status === "SUCCESSFUL") {
        return true;
      }

      if (status === "FAILED" || status === "FAILURE" || status === "ERROR") {
        console.error(`[MOSS_POLL] Job ${jobId} failed with error:`, job?.error);
        return false;
      }

      // If still pending or running, wait
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    } catch (error) {
      console.error(`[MOSS_POLL_ERROR] Error fetching job status for ${jobId} on attempt ${attempt}:`, error);
      // Wait anyway and retry
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }
  console.warn(`[MOSS_POLL_TIMEOUT] Job ${jobId} did not complete within the maximum attempts.`);
  return false;
}

/**
 * Safe wrapper for createIndex
 */
export async function safeCreateIndex(
  indexName: string,
  documents: Array<{ id: string; text: string; metadata?: Record<string, string> }>,
  modelId: "moss-minilm" | "moss-mediumlm" = "moss-minilm"
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    console.log(`[MOSS_CREATE] Creating index "${indexName}" with ${documents.length} documents...`);
    const jobResult = await moss.createIndex(indexName, documents, { modelId });
    
    if (jobResult && typeof jobResult === "object" && "job_id" in jobResult) {
      return { success: true, jobId: (jobResult as any).job_id };
    }
    
    // Some SDK versions return the job ID directly or differently
    if (typeof jobResult === "string") {
      return { success: true, jobId: jobResult };
    }

    return { success: true, jobId: (jobResult as any)?.jobId || (jobResult as any)?.id };
  } catch (error: any) {
    console.error(`[MOSS_CREATE_ERROR] Failed to create index "${indexName}":`, error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Safe wrapper for addDocs
 */
export async function safeAddDocs(
  indexName: string,
  documents: Array<{ id: string; text: string; metadata?: Record<string, string> }>,
  options = { upsert: true }
): Promise<{ success: boolean; jobId?: string; error?: string }> {
  try {
    console.log(`[MOSS_ADD_DOCS] Adding ${documents.length} documents to index "${indexName}"...`);
    const jobResult = await moss.addDocs(indexName, documents, options);
    
    if (jobResult && typeof jobResult === "object" && "job_id" in jobResult) {
      return { success: true, jobId: (jobResult as any).job_id };
    }

    if (typeof jobResult === "string") {
      return { success: true, jobId: jobResult };
    }

    return { success: true, jobId: (jobResult as any)?.jobId || (jobResult as any)?.id };
  } catch (error: any) {
    console.error(`[MOSS_ADD_DOCS_ERROR] Failed to add documents to index "${indexName}":`, error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Safe wrapper for loadIndex
 */
export async function safeLoadIndex(indexName: string, options = {}): Promise<boolean> {
  try {
    console.log(`[MOSS_LOAD] Loading index "${indexName}" into memory...`);
    await moss.loadIndex(indexName, options);
    return true;
  } catch (error) {
    console.error(`[MOSS_LOAD_ERROR] Failed to load index "${indexName}":`, error);
    // Usually means it is already loaded or being loaded
    return false;
  }
}

function localKeywordSearch(
  chunks: Array<{ text: string; sourceFile: string; docType: string }>,
  query: string,
  topK = 6
) {
  const queryTokens = query.toLowerCase().split(/[^a-zA-Z0-9\u0900-\u097F]+/g).filter(Boolean);
  if (queryTokens.length === 0) {
    return chunks.slice(0, topK).map(c => ({
      text: c.text,
      score: 1.0,
      metadata: { source_file: c.sourceFile, doc_type: c.docType }
    }));
  }

  const scored = chunks.map(chunk => {
    const chunkLower = chunk.text.toLowerCase();
    let score = 0;
    for (const token of queryTokens) {
      if (chunkLower.includes(token)) {
        score += 1;
        // Boost score for exact word matching
        const escapedToken = token.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedToken}\\b`, 'i');
        if (regex.test(chunk.text)) {
          score += 1.5;
        }
      }
    }
    return { chunk, score };
  });

  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(item => ({
      text: item.chunk.text,
      score: item.score,
      metadata: { source_file: item.chunk.sourceFile, doc_type: item.chunk.docType }
    }));
}

/**
 * Safe wrapper for query
 */
export async function safeQuery(
  indexName: string,
  queryText: string,
  options: { top_k?: number; topK?: number; alpha?: number; filter?: any } = {}
): Promise<any> {
  try {
    console.log(`[MOSS_QUERY] Querying index "${indexName}" with: "${queryText}"`, options);
    
    // Ensure index is loaded first
    await safeLoadIndex(indexName);

    // Map top_k to topK for JS SDK compatibility
    const sdkOptions: any = { ...options };
    if (options.top_k !== undefined) {
      sdkOptions.topK = options.top_k;
      delete sdkOptions.top_k;
    }

    const results = await moss.query(indexName, queryText, sdkOptions);
    if (results && results.docs) {
      return results;
    }
    throw new Error("Empty docs returned from Moss");
  } catch (error: any) {
    console.warn(`[MOSS_QUERY_FALLBACK] Moss query failed: ${error.message || String(error)}. Triggering local database fallback search.`);
    
    try {
      // 1. Extract productId from query filter
      let productId = "";
      if (options.filter) {
        if (options.filter.field === "product_id") {
          const cond = options.filter.condition;
          productId = typeof cond === "object" && cond !== null ? (cond.$eq || cond) : cond;
        } else if (Array.isArray(options.filter.$and)) {
          const prodFilter = options.filter.$and.find((f: any) => f.field === "product_id");
          if (prodFilter) {
            const cond = prodFilter.condition;
            productId = typeof cond === "object" && cond !== null ? (cond.$eq || cond) : cond;
          }
        }
      }

      if (!productId) {
        console.error("[MOSS_FALLBACK_ERROR] Could not extract product_id for local search fallback.");
        return { docs: [], error: error.message || String(error) };
      }

      // 2. Fetch all uploads for this product
      const uploads = await db.upload.findMany({
        where: { productId }
      });

      const allChunks: Array<{ text: string; sourceFile: string; docType: string }> = [];

      for (const upload of uploads) {
        const absolutePath = path.isAbsolute(upload.filePath)
          ? upload.filePath
          : (process.env.DATA_DIR 
              ? path.join(process.env.DATA_DIR, upload.filePath)
              : path.join(process.cwd(), upload.filePath));

        try {
          let content = "";
          let hasCache = false;
          try {
            await fs.access(`${absolutePath}.cache.txt`);
            hasCache = true;
          } catch {}

          if (hasCache) {
            content = await fs.readFile(`${absolutePath}.cache.txt`, "utf-8");
          } else if (upload.fileType === "PDF") {
            const dataBuffer = await fs.readFile(absolutePath);
            const parser = new PDFParse({ data: dataBuffer });
            const parseRes = await parser.getText();
            await parser.destroy();
            content = parseRes.text || "";
          } else if (upload.fileType === "TEXT") {
            content = await fs.readFile(absolutePath, "utf-8");
          } else if (upload.fileType === "LINK" && upload.externalUrl) {
            if (upload.filePath) {
              content = await fs.readFile(absolutePath, "utf-8");
            }
          }

          if (content.trim()) {
            const chunks = chunkText(content);
            for (const chunk of chunks) {
              allChunks.push({
                text: chunk.text,
                sourceFile: upload.fileName,
                docType: upload.fileType
              });
            }
          }
        } catch (readErr: any) {
          console.error(`[MOSS_FALLBACK_READ_WARN] Failed to read ${absolutePath}:`, readErr.message);
        }
      }

      // 3. Search local chunks
      const topK = options.top_k !== undefined ? options.top_k : 6;
      const matchedDocs = localKeywordSearch(allChunks, queryText, topK);

      console.log(`[MOSS_FALLBACK_SUCCESS] Found ${matchedDocs.length} matching local chunks for query: "${queryText.slice(0, 40)}..."`);
      return {
        docs: matchedDocs.map((doc, idx) => ({
          id: `local-fallback-${productId}-${idx}`,
          text: doc.text,
          score: doc.score,
          metadata: doc.metadata
        }))
      };
    } catch (fallbackErr: any) {
      console.error("[MOSS_FALLBACK_FATAL_ERROR] Local search failed:", fallbackErr);
      return { docs: [], error: error.message || String(error) };
    }
  }
}

/**
 * Safe wrapper to delete an index
 */
export async function safeDeleteIndex(indexName: string): Promise<boolean> {
  try {
    console.log(`[MOSS_DELETE] Deleting index "${indexName}"...`);
    await moss.deleteIndex(indexName);
    return true;
  } catch (error) {
    console.error(`[MOSS_DELETE_ERROR] Failed to delete index "${indexName}":`, error);
    return false;
  }
}
