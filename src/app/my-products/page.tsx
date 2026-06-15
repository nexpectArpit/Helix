import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import MyProductsClient from "./MyProductsClient";

export const dynamic = "force-dynamic";

export default async function MyProductsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login?callbackUrl=/my-products");
  }

  // Redirect company admin to their dashboard
  if (session.user.role === "COMPANY_ADMIN") {
    redirect("/dashboard");
  }

  // Fetch all owned products for this user
  const ownedProducts = await db.userProduct.findMany({
    where: { userId: session.user.id },
    include: {
      product: {
        include: {
          company: true,
          recallAlerts: {
            where: { isActive: true },
          },
          maintenanceTasks: {
            where: { isApproved: true },
          },
        },
      },
      maintenanceLogs: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Convert dates to ISO strings for safety/serialization across client boundary
  const serializedOwnedProducts = ownedProducts.map((op) => ({
    ...op,
    purchaseDate: op.purchaseDate ? op.purchaseDate.toISOString() : null,
    warrantyExpiry: op.warrantyExpiry ? op.warrantyExpiry.toISOString() : null,
    createdAt: op.createdAt.toISOString(),
    maintenanceLogs: op.maintenanceLogs.map((log) => ({
      ...log,
      completedAt: log.completedAt.toISOString(),
    })),
  }));

  return (
    <MyProductsClient initialProducts={serializedOwnedProducts as any} />
  );
}
