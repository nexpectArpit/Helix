"use server";

import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface MaintenanceActionResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Verifies if the authenticated user has access to a specific product (belongs to their company).
 */
async function checkProductOwnership(productId: string): Promise<{ authorized: boolean; error?: string }> {
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

  return { authorized: true };
}

/**
 * Approve an auto-extracted maintenance task.
 */
export async function approveTask(taskId: string): Promise<MaintenanceActionResult> {
  try {
    const task = await db.maintenanceTask.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return { success: false, error: "Maintenance task not found." };
    }

    const authCheck = await checkProductOwnership(task.productId);
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

    const updatedTask = await db.maintenanceTask.update({
      where: { id: taskId },
      data: { isApproved: true }
    });

    revalidatePath(`/dashboard/products/${task.productId}/maintenance`);
    revalidatePath("/my-products");
    return { success: true, data: updatedTask };
  } catch (error: any) {
    console.error("[APPROVE_TASK_ERROR]", error);
    return { success: false, error: error.message || "Failed to approve task." };
  }
}

/**
 * Reject / Delete a maintenance task.
 */
export async function rejectTask(taskId: string): Promise<MaintenanceActionResult> {
  try {
    const task = await db.maintenanceTask.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return { success: false, error: "Maintenance task not found." };
    }

    const authCheck = await checkProductOwnership(task.productId);
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

    // Delete logs associated with this task first, then the task itself
    await db.maintenanceLog.deleteMany({
      where: { maintenanceTaskId: taskId }
    });

    await db.maintenanceTask.delete({
      where: { id: taskId }
    });

    revalidatePath(`/dashboard/products/${task.productId}/maintenance`);
    revalidatePath("/my-products");
    return { success: true };
  } catch (error: any) {
    console.error("[REJECT_TASK_ERROR]", error);
    return { success: false, error: error.message || "Failed to delete task." };
  }
}

/**
 * Create a maintenance task manually (automatically approved).
 */
export async function createManualTask(
  productId: string,
  data: {
    title: string;
    description?: string | null;
    intervalMonths: number;
  }
): Promise<MaintenanceActionResult> {
  try {
    const authCheck = await checkProductOwnership(productId);
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

    if (!data.title || data.intervalMonths <= 0) {
      return { success: false, error: "Title and positive interval are required." };
    }

    const task = await db.maintenanceTask.create({
      data: {
        productId,
        title: data.title,
        description: data.description || null,
        intervalMonths: data.intervalMonths,
        isApproved: true,
        sourceDocument: "Manual Entry"
      }
    });

    revalidatePath(`/dashboard/products/${productId}/maintenance`);
    revalidatePath("/my-products");
    return { success: true, data: task };
  } catch (error: any) {
    console.error("[CREATE_MANUAL_TASK_ERROR]", error);
    return { success: false, error: error.message || "Failed to create task." };
  }
}

/**
 * Update an existing maintenance task.
 */
export async function updateTask(
  taskId: string,
  data: {
    title?: string;
    description?: string | null;
    intervalMonths?: number;
    isApproved?: boolean;
  }
): Promise<MaintenanceActionResult> {
  try {
    const task = await db.maintenanceTask.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      return { success: false, error: "Maintenance task not found." };
    }

    const authCheck = await checkProductOwnership(task.productId);
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error };
    }

    const updated = await db.maintenanceTask.update({
      where: { id: taskId },
      data: {
        title: data.title !== undefined ? data.title : undefined,
        description: data.description !== undefined ? data.description : undefined,
        intervalMonths: data.intervalMonths !== undefined ? data.intervalMonths : undefined,
        isApproved: data.isApproved !== undefined ? data.isApproved : undefined,
      }
    });

    revalidatePath(`/dashboard/products/${task.productId}/maintenance`);
    revalidatePath("/my-products");
    return { success: true, data: updated };
  } catch (error: any) {
    console.error("[UPDATE_TASK_ERROR]", error);
    return { success: false, error: error.message || "Failed to update task." };
  }
}
