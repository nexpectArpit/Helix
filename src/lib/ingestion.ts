import { db } from "@/lib/db";
import { parsePDF, parseText, parseLink } from "./parser";
import { chunkText } from "./chunker";
import { safeCreateIndex, safeAddDocs, moss, pollJobStatus } from "./moss";
import { groq } from "./llm";
import fs from "fs";
import path from "path";

function scanKeywords(text: string) {
  const lowercase = text.toLowerCase();
  
  let component = "general";
  if (lowercase.includes("horn") || lowercase.includes("acoustic") || lowercase.includes("audible") || lowercase.includes("buzzer") || lowercase.includes("siren")) {
    component = "horn";
  } else if (lowercase.includes("fuse") || lowercase.includes("f3") || lowercase.includes("f1") || lowercase.includes("f2")) {
    component = "fuse";
  } else if (lowercase.includes("light") || lowercase.includes("headlight") || lowercase.includes("lamp") || lowercase.includes("bulb")) {
    component = "headlights";
  } else if (lowercase.includes("battery") || lowercase.includes("cell") || lowercase.includes("charge") || lowercase.includes("power supply")) {
    component = "battery";
  } else if (lowercase.includes("wiring") || lowercase.includes("wire") || lowercase.includes("harness") || lowercase.includes("cable") || lowercase.includes("connector")) {
    component = "wiring";
  } else if (lowercase.includes("switch") || lowercase.includes("button") || lowercase.includes("trigger") || lowercase.includes("lever")) {
    component = "switch";
  }

  let subsystem = "general";
  if (lowercase.includes("electrical") || lowercase.includes("circuit") || lowercase.includes("voltage") || lowercase.includes("wire") || lowercase.includes("fuse") || lowercase.includes("battery") || lowercase.includes("horn")) {
    subsystem = "electrical";
  } else if (lowercase.includes("mechanical") || lowercase.includes("brake") || lowercase.includes("tire") || lowercase.includes("wheel") || lowercase.includes("frame")) {
    subsystem = "mechanical";
  }

  let section_type = "general";
  if (lowercase.includes("troubleshoot") || lowercase.includes("symptom") || lowercase.includes("fault") || lowercase.includes("problem") || lowercase.includes("issue") || lowercase.includes("fail")) {
    section_type = "troubleshooting";
  } else if (lowercase.includes("maintenance") || lowercase.includes("service") || lowercase.includes("check") || lowercase.includes("adjust")) {
    section_type = "maintenance";
  } else if (lowercase.includes("spec") || lowercase.includes("dimension") || lowercase.includes("limit") || lowercase.includes("detail")) {
    section_type = "specifications";
  } else if (lowercase.includes("part number") || lowercase.includes("spare") || lowercase.includes("replacement part") || lowercase.includes("consumable")) {
    section_type = "parts";
  } else if (lowercase.includes("recall") || lowercase.includes("safety notice") || lowercase.includes("service campaign")) {
    section_type = "recall";
  }

  let procedure_type = "general";
  if (lowercase.includes("inspect") || lowercase.includes("look") || lowercase.includes("check") || lowercase.includes("visual")) {
    procedure_type = "inspection";
  } else if (lowercase.includes("test") || lowercase.includes("measure") || lowercase.includes("probe") || lowercase.includes("multimeter") || lowercase.includes("meter")) {
    procedure_type = "testing";
  } else if (lowercase.includes("repair") || lowercase.includes("replace") || lowercase.includes("fix") || lowercase.includes("swap") || lowercase.includes("install")) {
    procedure_type = "repair";
  }

  return { component, subsystem, section_type, procedure_type };
}

async function enrichMetadataWithLLM(text: string, fallback: { component: string; subsystem: string; section_type: string; procedure_type: string }) {
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Analyze the provided manual page chunk and extract technical metadata variables. 
Return a strictly valid JSON object matching the following structure:
{
  "component": "horn" | "fuse" | "headlights" | "battery" | "wiring" | "switch" | "general",
  "subsystem": "electrical" | "mechanical" | "general",
  "section_type": "troubleshooting" | "maintenance" | "specifications" | "parts" | "recall" | "general",
  "procedure_type": "inspection" | "testing" | "repair" | "general"
}

OPERATIONAL MAPPING RULES:
- Map "Acoustic Warning Unit", "Audible Alert Assembly", "Warning Buzzer", "Signal Horn", "siren" to component: "horn".
- Map "fuse assembly", "fusible link", "fuses", "F1/F2/F3" to component: "fuse".
- Map "lamps", "warning flashers", "headlamps", "bulbs", "leds" to component: "headlights".
- If the chunk describes diagnosing, testing steps, or visual fault identification, map section_type to "troubleshooting" and procedure_type to "testing" or "inspection".
- If no clear mapping is found, use the fallback values:
${JSON.stringify(fallback)}`
        },
        {
          role: "user",
          content: `TEXT CHUNK:\n${text}`
        }
      ],
      temperature: 0.1,
      max_tokens: 1024
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      const parsed = JSON.parse(content);
      return {
        component: parsed.component || fallback.component,
        subsystem: parsed.subsystem || fallback.subsystem,
        section_type: parsed.section_type || fallback.section_type,
        procedure_type: parsed.procedure_type || fallback.procedure_type
      };
    }
  } catch (err) {
    console.warn("[MOSS_LLM_ENRICH_WARN] Fallback keyword used due to LLM error:", err);
  }
  return fallback;
}

export interface IngestionResult {
  success: boolean;
  error?: string;
  chunksIndexed?: number;
}

/**
 * Ingests a single uploaded support file or link, parses it, chunks it,
 * indexes it in Moss, and updates SQLite.
 */
export async function ingestUpload(uploadId: string): Promise<IngestionResult> {
  console.log(`[INGESTION_START] Starting ingestion for upload ID: ${uploadId}`);
  try {
    // 1. Fetch upload metadata from database
    const upload = await db.upload.findUnique({
      where: { id: uploadId },
      include: { product: true }
    });

    if (!upload) {
      return { success: false, error: "Upload record not found in database." };
    }

    // 2. Parse the content based on file type
    let rawText = "";
    if (upload.fileType === "PDF") {
      rawText = await parsePDF(upload.filePath);
    } else if (upload.fileType === "TEXT") {
      rawText = await parseText(upload.filePath);
    } else if (upload.fileType === "LINK") {
      if (!upload.externalUrl) {
        return { success: false, error: "External URL is required for link uploads." };
      }
      rawText = await parseLink(upload.externalUrl);
    } else {
      return { success: false, error: `File type ${upload.fileType} is not supported for text index ingestion.` };
    }

    if (!rawText.trim()) {
      return { success: false, error: "No readable text content could be extracted from the document." };
    }

    // Write text to cache file (Priority 3C)
    let finalFilePath = upload.filePath;
    if (upload.fileType === "LINK") {
      const baseDir = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, "uploads") : path.join(process.cwd(), "uploads");
      const uploadDir = path.join(baseDir, upload.productId);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const cacheFilename = `${Date.now()}-link-cache.txt`;
      finalFilePath = path.join(uploadDir, cacheFilename);
      fs.writeFileSync(finalFilePath, rawText, "utf-8");
      
      await db.upload.update({
        where: { id: uploadId },
        data: { filePath: finalFilePath }
      });
    } else {
      if (upload.filePath) {
        const absPath = path.isAbsolute(upload.filePath)
          ? upload.filePath
          : (process.env.DATA_DIR 
              ? path.join(process.env.DATA_DIR, upload.filePath)
              : path.join(process.cwd(), upload.filePath));
        fs.writeFileSync(`${absPath}.cache.txt`, rawText, "utf-8");
      }
    }

    // 3. Chunk the extracted text
    const textChunks = chunkText(rawText);
    console.log(`[INGESTION_CHUNKS] Generated ${textChunks.length} chunks for "${upload.fileName}"`);

    if (textChunks.length === 0) {
      return { success: false, error: "Text chunker did not generate any chunks." };
    }

    // 4. Map chunks to Moss documents and enrich metadata in batches to avoid LLM rate limits
    const indexName = `product-${upload.productId}-kb`;
    const mossDocs = [];
    
    // Groq rate limits are extremely tight (6,000 TPM). For large documents,
    // making hundreds of LLM calls will trigger rate limits (429s) and slow down ingestion.
    // We bypass LLM metadata enrichment for documents with > 30 chunks.
    const bypassLLM = textChunks.length > 30;
    
    if (bypassLLM) {
      console.log(`[INGESTION_INFO] Document is large (${textChunks.length} chunks). Bypassing LLM metadata enrichment to prevent Groq API rate limits (6000 TPM). Using rule-based keyword extraction instead.`);
      for (const chunk of textChunks) {
        const fallback = scanKeywords(chunk.text);
        mossDocs.push({
          id: `${upload.id}-chunk-${chunk.index}`,
          text: chunk.text,
          metadata: {
            product_id: upload.productId,
            source_file: upload.fileName,
            doc_type: upload.fileType.toLowerCase(),
            component: fallback.component,
            subsystem: fallback.subsystem,
            section_type: fallback.section_type,
            procedure_type: fallback.procedure_type
          }
        });
      }
    } else {
      console.log(`[INGESTION_INFO] Processing small document (${textChunks.length} chunks). Applying LLM metadata enrichment.`);
      const LLM_BATCH_SIZE = 5;
      for (let i = 0; i < textChunks.length; i += LLM_BATCH_SIZE) {
        const batch = textChunks.slice(i, i + LLM_BATCH_SIZE);
        const batchDocs = await Promise.all(
          batch.map(async (chunk) => {
            const fallback = scanKeywords(chunk.text);
            const enriched = await enrichMetadataWithLLM(chunk.text, fallback);
            return {
              id: `${upload.id}-chunk-${chunk.index}`,
              text: chunk.text,
              metadata: {
                product_id: upload.productId,
                source_file: upload.fileName,
                doc_type: upload.fileType.toLowerCase(),
                component: enriched.component,
                subsystem: enriched.subsystem,
                section_type: enriched.section_type,
                procedure_type: enriched.procedure_type
              }
            };
          })
        );
        mossDocs.push(...batchDocs);
        
        // Delay slightly between batches to ease LLM TPM usage
        if (i + LLM_BATCH_SIZE < textChunks.length) {
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    }

    // 5. Index into Moss in batches (Create index if not exists, otherwise Add docs)
    const indexList = await moss.listIndexes();
    const indexExists = indexList.some((idx: any) => idx.name === indexName);

    const MOSS_BATCH_SIZE = 50;
    let isFirstBatch = true;
    let mossIndexingSucceeded = true;

    for (let i = 0; i < mossDocs.length; i += MOSS_BATCH_SIZE) {
      const batchDocs = mossDocs.slice(i, i + MOSS_BATCH_SIZE);
      let result;
      
      if (indexExists || !isFirstBatch) {
        result = await safeAddDocs(indexName, batchDocs);
      } else {
        result = await safeCreateIndex(indexName, batchDocs);
        isFirstBatch = false; // Next batches must be added to the newly created index
      }

      if (!result.success) {
        console.warn(`[INGESTION_MOSS_LIMIT_WARN] Moss indexing returned a failure (likely 429 quota exhaustion): ${result.error}. Continuing upload successfully to run on local search fallback.`);
        mossIndexingSucceeded = false;
        break;
      }

      // 6. Poll job status until complete (since Moss build is async)
      if (result.jobId) {
        const isComplete = await pollJobStatus(result.jobId);
        if (!isComplete) {
          mossIndexingSucceeded = false;
          return { success: false, error: "Moss indexing job failed or timed out." };
        }
      }
    }

    // 7. Update DB: Mark upload as indexed & set product index name
    // Even if Moss cloud indexing failed/rate-limited, the document is fully cached on disk and ready for local search fallback.
    await db.$transaction([
      db.upload.update({
        where: { id: uploadId },
        data: { indexed: true }
      }),
      db.product.update({
        where: { id: upload.productId },
        data: { mossIndexName: indexName }
      })
    ]);

    // 8. Extract maintenance schedules and spare parts from the document (non-blocking, best-effort)
    try {
      await extractMaintenanceAndParts(rawText, upload.productId, upload.fileName);
      console.log(`[EXTRACTION_SUCCESS] Maintenance/parts extraction complete for "${upload.fileName}"`);
    } catch (extractErr: any) {
      console.warn(`[EXTRACTION_WARN] Failed to extract maintenance/parts:`, extractErr.message);
    }

    console.log(`[INGESTION_SUCCESS] Upload ${uploadId} successfully indexed. ${mossDocs.length} chunks committed.`);
    return { success: true, chunksIndexed: mossDocs.length };
  } catch (error: any) {
    console.error(`[INGESTION_FAILURE] Ingestion failed for upload ${uploadId}:`, error);
    return { success: false, error: error.message || String(error) };
  }
}

/**
 * Auto-extracts maintenance tasks and spare parts from the full raw text of manuals.
 */
async function extractMaintenanceAndParts(
  rawText: string,
  productId: string,
  sourceFileName: string
): Promise<void> {
  // Guard: skip if text is too short to contain useful schedules
  if (rawText.length < 200) return;

  // Truncate to ~3000 words to stay within Groq's token limits
  const words = rawText.split(/\s+/);
  const truncated = words.slice(0, 3000).join(" ");

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Extract maintenance schedules and spare parts from this product manual.
Return a JSON object with:
{
  "maintenanceTasks": [
    { "title": "short name", "description": "full instruction", "intervalMonths": 12, "excerpt": "exact source text" }
  ],
  "spareParts": [
    { "partName": "name", "partNumber": "OEM number or null", "category": "fuse|filter|belt|battery|general", "cost": 15.0 or null, "description": "brief desc" }
  ]
}
If no maintenance schedules or spare parts are found, return empty arrays.
Do NOT invent items. Only extract what is explicitly stated in the text.`
        },
        { role: "user", content: truncated }
      ],
      temperature: 0.1,
      max_tokens: 2048
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return;
    
    const parsed = JSON.parse(content);

    // Insert maintenance tasks (unapproved, pending company review)
    for (const task of parsed.maintenanceTasks || []) {
      const existing = await db.maintenanceTask.findFirst({
        where: { productId, title: task.title }
      });
      if (existing) {
        console.log(`[EXTRACTION_INFO] Maintenance task "${task.title}" already exists for product ${productId}. Skipping.`);
        continue;
      }
      await db.maintenanceTask.create({
        data: {
          productId,
          title: task.title,
          description: task.description || null,
          intervalMonths: task.intervalMonths || 12,
          sourceDocument: sourceFileName,
          sourceExcerpt: task.excerpt || null,
          isApproved: false
        }
      });
    }

    // Insert spare parts
    for (const part of parsed.spareParts || []) {
      const existing = await db.sparePart.findFirst({
        where: { productId, partName: part.partName }
      });
      if (existing) {
        console.log(`[EXTRACTION_INFO] Spare part "${part.partName}" already exists for product ${productId}. Skipping.`);
        continue;
      }
      const parsedCost = part.cost !== undefined && part.cost !== null ? parseFloat(part.cost) : null;
      await db.sparePart.create({
        data: {
          productId,
          partName: part.partName,
          partNumber: part.partNumber || null,
          category: part.category || "general",
          cost: parsedCost && !isNaN(parsedCost) ? parsedCost : null,
          description: part.description || null,
          sourceDocument: sourceFileName
        }
      });
    }
  } catch (err: any) {
    console.error(`[EXTRACT_MAINTENANCE_PARTS_ERROR] Failed to perform auto-extraction:`, err);
  }
}
