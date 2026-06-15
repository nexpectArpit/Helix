"use server";

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface SparePartData {
  partName: string;
  partNumber?: string | null;
  category?: string | null;
  cost?: number | null;
  description?: string | null;
}

export interface SparePartResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Helper to check admin authorization for product ownership.
 */
async function checkProductAdmin(productId: string): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
    return false;
  }

  const product = await db.product.findUnique({
    where: { id: productId }
  });

  return !!product && product.companyId === session.user.companyId;
}

/**
 * Creates a new spare part for a product.
 */
export async function createSparePart(
  productId: string,
  data: SparePartData
): Promise<SparePartResult> {
  try {
    const isAuthorized = await checkProductAdmin(productId);
    if (!isAuthorized) {
      return { success: false, error: "Unauthorized access." };
    }

    if (!data.partName.trim()) {
      return { success: false, error: "Part name is required." };
    }

    const sparePart = await db.sparePart.create({
      data: {
        productId,
        partName: data.partName.trim(),
        partNumber: data.partNumber?.trim() || null,
        category: data.category?.trim() || "general",
        cost: data.cost !== undefined ? data.cost : null,
        description: data.description?.trim() || null,
        sourceDocument: "Manually Added"
      }
    });

    revalidatePath(`/dashboard/products/${productId}`);
    return { success: true, data: sparePart };
  } catch (error: any) {
    console.error("[CREATE_SPARE_PART_ERROR]", error);
    return { success: false, error: error.message || "Failed to create spare part." };
  }
}

/**
 * Updates an existing spare part.
 */
export async function updateSparePart(
  partId: string,
  data: SparePartData
): Promise<SparePartResult> {
  try {
    const sparePart = await db.sparePart.findUnique({
      where: { id: partId }
    });

    if (!sparePart) {
      return { success: false, error: "Spare part not found." };
    }

    const isAuthorized = await checkProductAdmin(sparePart.productId);
    if (!isAuthorized) {
      return { success: false, error: "Unauthorized access." };
    }

    if (!data.partName.trim()) {
      return { success: false, error: "Part name is required." };
    }

    const updated = await db.sparePart.update({
      where: { id: partId },
      data: {
        partName: data.partName.trim(),
        partNumber: data.partNumber?.trim() || null,
        category: data.category?.trim() || "general",
        cost: data.cost !== undefined ? data.cost : null,
        description: data.description?.trim() || null
      }
    });

    revalidatePath(`/dashboard/products/${sparePart.productId}`);
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("[UPDATE_SPARE_PART_ERROR]", error);
    return { success: false, error: error.message || "Failed to update spare part." };
  }
}

/**
 * Deletes a spare part.
 */
export async function deleteSparePart(partId: string): Promise<SparePartResult> {
  try {
    const sparePart = await db.sparePart.findUnique({
      where: { id: partId }
    });

    if (!sparePart) {
      return { success: false, error: "Spare part not found." };
    }

    const isAuthorized = await checkProductAdmin(sparePart.productId);
    if (!isAuthorized) {
      return { success: false, error: "Unauthorized access." };
    }

    await db.sparePart.delete({
      where: { id: partId }
    });

    revalidatePath(`/dashboard/products/${sparePart.productId}`);
    return { success: true };
  } catch (error: any) {
    console.error("[DELETE_SPARE_PART_ERROR]", error);
    return { success: false, error: error.message || "Failed to delete spare part." };
  }
}
