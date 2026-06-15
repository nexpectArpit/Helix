import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { ingestUpload } from "@/lib/ingestion";
import fs from "fs/promises";
import path from "path";

// Set upload directory base path
const UPLOAD_BASE_DIR = process.env.DATA_DIR ? path.join(process.env.DATA_DIR, "uploads") : path.join(process.cwd(), "uploads");

export async function POST(request: NextRequest) {
  try {
    // 1. Authorize session
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
      return NextResponse.json({ error: "Unauthorized. Admin access required." }, { status: 401 });
    }

    // 2. Parse form data
    const formData = await request.formData();
    const productId = formData.get("productId")?.toString();
    const fileType = formData.get("fileType")?.toString(); // "PDF", "TEXT", "LINK"
    const externalUrl = formData.get("externalUrl")?.toString() || null;

    if (!productId || !fileType) {
      return NextResponse.json({ error: "Product ID and File Type are required." }, { status: 400 });
    }

    // Verify product ownership
    const product = await db.product.findUnique({
      where: { id: productId }
    });

    if (!product || product.companyId !== session.user.companyId) {
      return NextResponse.json({ error: "Product not found or access denied." }, { status: 403 });
    }

    let uploadRecord;

    if (fileType === "LINK") {
      if (!externalUrl) {
        return NextResponse.json({ error: "External URL is required for link uploads." }, { status: 400 });
      }

      // Create link record
      uploadRecord = await db.upload.create({
        data: {
          fileName: new URL(externalUrl).hostname || "External Link",
          fileType: "LINK",
          filePath: "",
          externalUrl,
          mimeType: "text/html",
          productId,
          indexed: false
        }
      });
    } else {
      // Handle file uploads (PDF, TEXT)
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "File payload is missing." }, { status: 400 });
      }

      const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "File too large. Maximum size is 25 MB." }, { status: 413 });
      }

      const fileName = file.name;
      const buffer = Buffer.from(await file.arrayBuffer());
      
      // Ensure product directory exists
      const productDir = path.join(UPLOAD_BASE_DIR, productId);
      await fs.mkdir(productDir, { recursive: true });

      // Save file to disk
      const filePath = path.join(productDir, `${Date.now()}-${fileName}`);
      await fs.writeFile(filePath, buffer);

      // Create database record
      uploadRecord = await db.upload.create({
        data: {
          fileName,
          fileType: fileType as any,
          filePath: filePath, // Save absolute path to disk
          mimeType: file.type || (fileType === "PDF" ? "application/pdf" : "text/plain"),
          sizeBytes: file.size,
          productId,
          indexed: false
        }
      });
    }

    // 3. Trigger Moss ingestion asynchronously in the background so the upload returns instantly
    // The UI will poll the status via router.refresh()
    ingestUpload(uploadRecord.id).catch((err) => {
      console.error(`[BACKGROUND_INGESTION_FAILED] Ingestion failed for record ${uploadRecord?.id}:`, err);
    });

    return NextResponse.json({
      success: true,
      uploadId: uploadRecord.id,
      fileName: uploadRecord.fileName,
      indexed: false
    });
  } catch (error: any) {
    console.error("[UPLOAD_API_ERROR]", error);
    return NextResponse.json({ error: error.message || "Failed to process upload." }, { status: 500 });
  }
}
