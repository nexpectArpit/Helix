import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import fs from "fs/promises";
import path from "path";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // 1. Authenticate user
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const resolvedParams = await params;
    const documentId = resolvedParams.id;

    if (!documentId) {
      return new NextResponse("Document ID required", { status: 400 });
    }

    const upload = await db.upload.findUnique({
      where: { id: documentId }
    });

    if (!upload) {
      return new NextResponse("Document record not found", { status: 404 });
    }

    // Redirect for link uploads (Priority 1B)
    if (upload.fileType === "LINK") {
      if (!upload.externalUrl) {
        return new NextResponse("External URL not found", { status: 404 });
      }
      return NextResponse.redirect(upload.externalUrl);
    }

    try {
      // Resolve path safely relative to the workspace directory or DATA_DIR
      const absolutePath = path.isAbsolute(upload.filePath)
        ? upload.filePath
        : (process.env.DATA_DIR
            ? path.resolve(path.join(process.env.DATA_DIR, upload.filePath))
            : path.resolve(upload.filePath));
      
      // Enforce path jail (Priority 1B)
      const baseUploadDir = process.env.DATA_DIR
        ? path.resolve(path.join(process.env.DATA_DIR, "uploads"))
        : path.resolve(path.join(process.cwd(), "uploads"));
      if (!absolutePath.startsWith(baseUploadDir)) {
        console.error(`[DOCUMENT_API_TRAVERSAL_WARN] Attempted path traversal escape: ${absolutePath}`);
        return new NextResponse("Forbidden - Access Denied", { status: 403 });
      }

      const fileBuffer = await fs.readFile(absolutePath);

      const response = new NextResponse(fileBuffer);
      response.headers.set("Content-Type", upload.mimeType || "application/octet-stream");
      response.headers.set("Content-Disposition", `inline; filename="${upload.fileName}"`);
      return response;
    } catch (fsError) {
      console.error("[DOCUMENT_FS_ERROR] File could not be read from disk:", fsError);
      return new NextResponse("File data not found on disk", { status: 404 });
    }
  } catch (error) {
    console.error("[DOCUMENT_API_ERROR]", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
