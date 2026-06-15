"use server";

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { moss } from "@/lib/moss";
import fs from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";

export interface UploadResult {
  success: boolean;
  error?: string;
}

/**
 * Safely deletes an uploaded file or link, cleaning up database records,
 * files on disk, and corresponding chunks in the Moss knowledge base index.
 */
export async function deleteUpload(uploadId: string): Promise<UploadResult> {
  try {
    // 1. Authorize session
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
      return { success: false, error: "Unauthorized. Admin access required." };
    }

    // 2. Fetch upload record from database
    const upload = await db.upload.findUnique({
      where: { id: uploadId },
      include: {
        product: true
      }
    });

    if (!upload) {
      return { success: false, error: "Upload record not found." };
    }

    // Verify ownership
    if (upload.product.companyId !== session.user.companyId) {
      return { success: false, error: "Access denied. Product ownership mismatch." };
    }

    // 3. Delete file from local disk (if it's a file upload)
    if (upload.fileType !== "LINK" && upload.filePath) {
      try {
        const absolutePath = path.resolve(upload.filePath);
        await fs.unlink(absolutePath);
        console.log(`[DELETE_UPLOAD_FS] Deleted file from disk: ${absolutePath}`);
      } catch (fsErr: any) {
        console.warn(`[DELETE_UPLOAD_FS_WARN] File could not be deleted from disk at ${upload.filePath}:`, fsErr.message);
      }
    }

    // 4. Delete chunks from Moss index
    const indexName = upload.product.mossIndexName || `product-${upload.productId}-kb`;
    try {
      const indexList = await moss.listIndexes();
      const indexExists = indexList.some((idx: any) => idx.name === indexName);

      if (indexExists) {
        // Fetch docs in the index to locate chunk IDs matching this upload
        const indexDocs = await moss.getDocs(indexName);
        if (indexDocs && Array.isArray(indexDocs)) {
          const docIdsToDelete = indexDocs
            .filter((d: any) => d.id.startsWith(uploadId))
            .map((d: any) => d.id);

          if (docIdsToDelete.length > 0) {
            console.log(`[DELETE_UPLOAD_MOSS] Deleting ${docIdsToDelete.length} chunks from index "${indexName}"...`);
            await moss.deleteDocs(indexName, docIdsToDelete);
          }
        }
      }
    } catch (mossErr: any) {
      console.error(`[DELETE_UPLOAD_MOSS_ERROR] Failed to delete chunks from Moss index "${indexName}":`, mossErr.message);
    }

    // 5. Delete database record
    await db.upload.delete({
      where: { id: uploadId }
    });

    // Check if product still has any uploads. If not, reset the mossIndexName to null
    const remainingUploadsCount = await db.upload.count({
      where: { productId: upload.productId }
    });

    if (remainingUploadsCount === 0) {
      await db.product.update({
        where: { id: upload.productId },
        data: { mossIndexName: null }
      });
    }

    revalidatePath(`/products/${upload.productId}`);
    revalidatePath(`/dashboard/products/${upload.productId}/uploads`);

    return { success: true };
  } catch (error: any) {
    console.error("[DELETE_UPLOAD_ERROR]", error);
    return { success: false, error: error.message || "Failed to delete upload." };
  }
}
