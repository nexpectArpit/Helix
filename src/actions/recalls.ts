"use server";

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { moss, safeCreateIndex, safeAddDocs, pollJobStatus } from "@/lib/moss";

export interface RecallActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Helper to check company admin authorization for a product.
 */
async function checkProductOwnership(productId: string) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user || session.user.role !== "COMPANY_ADMIN") {
    return { authorized: false, error: "Unauthorized. Admin access required." };
  }

  const product = await db.product.findUnique({
    where: { id: productId }
  });

  if (!product || product.companyId !== session.user.companyId) {
    return { authorized: false, error: "Product not found or access denied." };
  }

  return { authorized: true, session };
}

/**
 * Synchronizes recall notices to the global MOSS index so they automatically surface during customer chats.
 */
async function syncRecallAlertToMoss(recall: {
  id: string;
  productId: string;
  title: string;
  description: string;
  severity: string;
}) {
  try {
    const doc = {
      id: `recall-${recall.id}`,
      text: `SAFETY RECALL NOTICE: ${recall.title}\nSeverity Level: ${recall.severity.toUpperCase()}\nDetails: ${recall.description}`,
      metadata: {
        product_id: recall.productId,
        section_type: "recall",
        severity: recall.severity,
        doc_type: "recall"
      }
    };

    const indexList = await moss.listIndexes();
    const indexName = `product-${recall.productId}-kb`;
    const indexExists = indexList.some((idx: any) => idx.name === indexName);

    let result;
    if (indexExists) {
      result = await safeAddDocs(indexName, [doc]);
    } else {
      result = await safeCreateIndex(indexName, [doc]);
    }

    if (result.success && result.jobId) {
      pollJobStatus(result.jobId, 10, 1000).catch(err => {
        console.error(`[MOSS_RECALL_POLL_ERROR] Background poll failed for recall ${recall.id}:`, err);
      });
    }
  } catch (error) {
    console.error(`[MOSS_RECALL_SYNC_ERROR] Failed to sync recall ${recall.id} to Moss:`, error);
  }
}

/**
 * Creates a new recall alert for a product.
 */
export async function createRecallAlert(
  productId: string,
  title: string,
  description: string,
  severity: "info" | "warning" | "critical"
): Promise<RecallActionResult> {
  try {
    const authCheck = await checkProductOwnership(productId);
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

    if (!title || !description || !severity) {
      return { success: false, error: "Title, description, and severity are required." };
    }

    const alert = await db.recallAlert.create({
      data: {
        productId,
        title,
        description,
        severity,
        isActive: true
      }
    });

    // Index recall alert to MOSS
    await syncRecallAlertToMoss({
      id: alert.id,
      productId,
      title,
      description,
      severity
    });

    revalidatePath(`/dashboard/products/${productId}/recalls`);
    revalidatePath("/my-products");
    return { success: true, data: alert };
  } catch (error: any) {
    console.error("[CREATE_RECALL_ERROR]", error);
    return { success: false, error: error.message || "Failed to create recall alert." };
  }
}

/**
 * Updates an existing recall alert.
 */
export async function updateRecallAlert(
  alertId: string,
  data: {
    title?: string;
    description?: string;
    severity?: "info" | "warning" | "critical";
    isActive?: boolean;
  }
): Promise<RecallActionResult> {
  try {
    const alert = await db.recallAlert.findUnique({
      where: { id: alertId }
    });

    if (!alert) {
      return { success: false, error: "Recall alert not found." };
    }

    const authCheck = await checkProductOwnership(alert.productId);
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

    const updated = await db.recallAlert.update({
      where: { id: alertId },
      data
    });

    // If update makes it active/inactive, or updates text, re-sync to MOSS
    if (updated.isActive) {
      await syncRecallAlertToMoss({
        id: updated.id,
        productId: updated.productId,
        title: updated.title,
        description: updated.description,
        severity: updated.severity
      });
    } else {
      // Remove from Moss if deactivated
      try {
        await moss.deleteDocs(`product-${updated.productId}-kb`, [`recall-${updated.id}`]);
      } catch (err: any) {
        console.warn("[MOSS_RECALL_DELETE_WARN] Failed to delete deactivated recall from MOSS:", err.message);
      }
    }

    revalidatePath(`/dashboard/products/${updated.productId}/recalls`);
    revalidatePath("/my-products");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("[UPDATE_RECALL_ERROR]", error);
    return { success: false, error: error.message || "Failed to update recall alert." };
  }
}

/**
 * Deactivates a recall alert.
 */
export async function deactivateRecallAlert(alertId: string): Promise<RecallActionResult> {
  return updateRecallAlert(alertId, { isActive: false });
}
