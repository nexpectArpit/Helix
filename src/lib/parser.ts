import fs from "fs/promises";
import { PDFParse } from "pdf-parse";

/**
 * Extracts raw text from a PDF file using pdf-parse.
 */
export async function parsePDF(filePath: string): Promise<string> {
  try {
    const dataBuffer = await fs.readFile(filePath);
    const parser = new PDFParse({ data: dataBuffer });
    const data = await parser.getText();
    await parser.destroy();
    return data.text || "";
  } catch (error: any) {
    console.error(`[PARSE_PDF_ERROR] Failed to parse PDF at ${filePath}:`, error);
    throw new Error(`Failed to parse PDF document: ${error.message || String(error)}`);
  }
}

/**
 * Extracts raw text from a plain text file.
 */
export async function parseText(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf-8");
  } catch (error: any) {
    console.error(`[PARSE_TEXT_ERROR] Failed to read text file at ${filePath}:`, error);
    throw new Error(`Failed to read text file: ${error.message || String(error)}`);
  }
}

/**
 * Fetches HTML from a remote URL and strips out HTML tags to extract raw text.
 */
export async function parseLink(url: string): Promise<string> {
  try {
    // SSRF Validation (Priority 1D)
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error(`Forbidden protocol: ${parsedUrl.protocol}`);
    }
    const hostname = parsedUrl.hostname.toLowerCase();
    
    if (hostname === "localhost") {
      throw new Error("Access to localhost is forbidden");
    }
    if (
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.startsWith("169.254.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
    ) {
      throw new Error("Access to private/local IP ranges is forbidden");
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Helix Diagnostic Agent/1.0"
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const html = await response.text();
    
    // Simple regex-based HTML text extraction
    let text = html
      // Remove head, script, style tags and their contents
      .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      // Remove all other HTML tags
      .replace(/<[^>]+>/g, " ")
      // Replace multiple whitespaces and newlines
      .replace(/\s+/g, " ")
      .trim();

    return text;
  } catch (error: any) {
    console.error(`[PARSE_LINK_ERROR] Failed to fetch or parse URL ${url}:`, error);
    throw new Error(`Failed to fetch web resource: ${error.message || String(error)}`);
  }
}
