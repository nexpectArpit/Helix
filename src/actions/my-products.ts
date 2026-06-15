"use server";

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface MyProductResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Adds a product to the user's personal inventory.
 */
export async function addProductToInventory(
  productId: string,
  purchaseDate?: string | null,
  serialNumber?: string | null
): Promise<MyProductResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { success: false, error: "Unauthorized. Please sign in." };
    }

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      return { success: false, error: "Product not found." };
    }

    let computedWarrantyExpiry: Date | null = null;
    if (purchaseDate && product.warrantyDays) {
      const pDate = new Date(purchaseDate);
      pDate.setDate(pDate.getDate() + product.warrantyDays);
      computedWarrantyExpiry = pDate;
    }

    // Use upsert to gracefully handle duplicates (@@unique constraint)
    const userProduct = await db.userProduct.upsert({
      where: {
        userId_productId: {
          userId: session.user.id,
          productId
        }
      },
      update: {
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        serialNumber: serialNumber || undefined,
        warrantyExpiry: computedWarrantyExpiry || undefined,
      },
      create: {
        userId: session.user.id,
        productId,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        serialNumber: serialNumber || null,
        warrantyExpiry: computedWarrantyExpiry,
      }
    });

    revalidatePath("/my-products");
    return { success: true, data: userProduct };
  } catch (error: any) {
    console.error("[ADD_PRODUCT_ERROR]", error);
    return { success: false, error: error.message || "Failed to add product." };
  }
}

/**
 * Removes a product from the user's inventory.
 * Cascading deletes handle MaintenanceLog cleanup.
 */
export async function removeProductFromInventory(
  userProductId: string
): Promise<MyProductResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { success: false, error: "Unauthorized." };
    }

    const userProduct = await db.userProduct.findUnique({
      where: { id: userProductId }
    });

    if (!userProduct || userProduct.userId !== session.user.id) {
      return { success: false, error: "Product not found or access denied." };
    }

    // Delete maintenance logs first (cascade), then the user product
    await db.maintenanceLog.deleteMany({
      where: { userProductId }
    });

    await db.userProduct.delete({
      where: { id: userProductId }
    });

    revalidatePath("/my-products");
    return { success: true };
  } catch (error: any) {
    console.error("[REMOVE_PRODUCT_ERROR]", error);
    return { success: false, error: error.message || "Failed to remove product." };
  }
}

/**
 * Updates ownership details (purchase date, serial number, warranty).
 */
export async function updateProductOwnership(
  userProductId: string,
  data: {
    purchaseDate?: string | null;
    serialNumber?: string | null;
    notes?: string | null;
  }
): Promise<MyProductResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { success: false, error: "Unauthorized." };
    }

    const userProduct = await db.userProduct.findUnique({
      where: { id: userProductId },
      include: { product: true }
    });

    if (!userProduct || userProduct.userId !== session.user.id) {
      return { success: false, error: "Product not found or access denied." };
    }

    const updateData: any = {};
    if (data.purchaseDate !== undefined) {
      updateData.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : null;
      
      if (data.purchaseDate && userProduct.product.warrantyDays) {
        const pDate = new Date(data.purchaseDate);
        pDate.setDate(pDate.getDate() + userProduct.product.warrantyDays);
        updateData.warrantyExpiry = pDate;
      } else if (!data.purchaseDate) {
        updateData.warrantyExpiry = null;
      }
    }
    if (data.serialNumber !== undefined) {
      updateData.serialNumber = data.serialNumber;
    }
    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    await db.userProduct.update({
      where: { id: userProductId },
      data: updateData
    });

    revalidatePath("/my-products");
    revalidatePath(`/my-products/${userProductId}`);
    return { success: true };
  } catch (error: any) {
    console.error("[UPDATE_OWNERSHIP_ERROR]", error);
    return { success: false, error: error.message || "Failed to update." };
  }
}

/**
 * Computes the maintenance schedule for a user's owned product.
 * Returns approved tasks with computed due dates.
 */
export async function getMaintenanceSchedule(
  userProductId: string
): Promise<MyProductResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { success: false, error: "Unauthorized." };
    }

    const userProduct = await db.userProduct.findUnique({
      where: { id: userProductId },
      include: {
        product: {
          include: {
            maintenanceTasks: {
              where: { isApproved: true },
              orderBy: { createdAt: "asc" }
            }
          }
        },
        maintenanceLogs: {
          orderBy: { completedAt: "desc" }
        }
      }
    });

    if (!userProduct || userProduct.userId !== session.user.id) {
      return { success: false, error: "Product not found or access denied." };
    }

    const now = new Date();
    const purchaseDate = userProduct.purchaseDate;

    const schedule = userProduct.product.maintenanceTasks.map((task) => {
      // Find the most recent completion log for this task
      const lastLog = userProduct.maintenanceLogs.find(
        (log) => log.maintenanceTaskId === task.id
      );
      const completionCount = userProduct.maintenanceLogs.filter(
        (log) => log.maintenanceTaskId === task.id
      ).length;

      let nextDueDate: Date | null = null;
      let isOverdue = false;
      let daysUntilDue: number | null = null;

      if (lastLog) {
        // Next due = last completion + interval
        nextDueDate = new Date(lastLog.completedAt);
        nextDueDate.setMonth(nextDueDate.getMonth() + task.intervalMonths);
      } else if (purchaseDate) {
        // Never completed: first due = purchase date + interval
        nextDueDate = new Date(purchaseDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + task.intervalMonths);
      }

      if (nextDueDate) {
        const diffMs = nextDueDate.getTime() - now.getTime();
        daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        isOverdue = daysUntilDue < 0;
      }

      return {
        taskId: task.id,
        title: task.title,
        description: task.description,
        intervalMonths: task.intervalMonths,
        sourceDocument: task.sourceDocument,
        lastCompletedAt: lastLog?.completedAt?.toISOString() || null,
        completionCount,
        nextDueDate: nextDueDate?.toISOString() || null,
        daysUntilDue,
        isOverdue,
        needsPurchaseDate: !purchaseDate && !lastLog
      };
    });

    // Sort: overdue first, then by nearest due date
    schedule.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      if (a.daysUntilDue === null) return 1;
      if (b.daysUntilDue === null) return -1;
      return a.daysUntilDue - b.daysUntilDue;
    });

    return { success: true, data: schedule };
  } catch (error: any) {
    console.error("[GET_SCHEDULE_ERROR]", error);
    return { success: false, error: error.message || "Failed to get schedule." };
  }
}

/**
 * Marks a maintenance task as completed for a user's product.
 */
export async function completeMaintenanceTask(
  userProductId: string,
  maintenanceTaskId: string,
  notes?: string
): Promise<MyProductResult> {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return { success: false, error: "Unauthorized." };
    }

    const userProduct = await db.userProduct.findUnique({
      where: { id: userProductId }
    });

    if (!userProduct || userProduct.userId !== session.user.id) {
      return { success: false, error: "Product not found or access denied." };
    }

    // Verify the maintenance task belongs to the same product
    const task = await db.maintenanceTask.findUnique({
      where: { id: maintenanceTaskId }
    });

    if (!task || task.productId !== userProduct.productId) {
      return { success: false, error: "Maintenance task not found for this product." };
    }

    await db.maintenanceLog.create({
      data: {
        userProductId,
        maintenanceTaskId,
        notes: notes || null
      }
    });

    revalidatePath("/my-products");
    revalidatePath(`/my-products/${userProductId}`);
    return { success: true };
  } catch (error: any) {
    console.error("[COMPLETE_TASK_ERROR]", error);
    return { success: false, error: error.message || "Failed to complete task." };
  }
}
