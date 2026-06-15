import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getMaintenanceSchedule } from "@/actions/my-products";
import ProductDetailsClient from "./ProductDetailsClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect(`/login?callbackUrl=/my-products/${id}`);
  }

  // Fetch the owned product to verify ownership and grab base details
  const ownedProduct = await db.userProduct.findUnique({
    where: { id },
    include: {
      product: {
        include: {
          company: true,
          recallAlerts: {
            orderBy: { publishedAt: "desc" },
          },
        },
      },
      maintenanceLogs: {
        include: {
          maintenanceTask: true,
        },
        orderBy: { completedAt: "desc" },
      },
    },
  });

  if (!ownedProduct || ownedProduct.userId !== session.user.id) {
    notFound();
  }

  // Get the computed schedule
  const scheduleRes = await getMaintenanceSchedule(ownedProduct.id);
  const schedule = scheduleRes.success ? scheduleRes.data || [] : [];

  // Serialize dates for Client Boundary safety
  const serializedOwnedProduct = {
    ...ownedProduct,
    purchaseDate: ownedProduct.purchaseDate ? ownedProduct.purchaseDate.toISOString() : null,
    warrantyExpiry: ownedProduct.warrantyExpiry ? ownedProduct.warrantyExpiry.toISOString() : null,
    createdAt: ownedProduct.createdAt.toISOString(),
    product: {
      ...ownedProduct.product,
      recallAlerts: ownedProduct.product.recallAlerts.map((r) => ({
        ...r,
        publishedAt: r.publishedAt.toISOString(),
        expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
    },
    maintenanceLogs: ownedProduct.maintenanceLogs.map((log) => ({
      ...log,
      completedAt: log.completedAt.toISOString(),
    })),
  };

  return (
    <ProductDetailsClient
      ownedProduct={serializedOwnedProduct as any}
      initialSchedule={schedule}
    />
  );
}
