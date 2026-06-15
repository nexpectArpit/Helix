import React from "react";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import RecallsManagerClient from "./RecallsManagerClient";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductRecallsPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
    redirect("/login");
  }

  const resolvedParams = await params;
  const productId = resolvedParams.id;

  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      recallAlerts: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!product) {
    notFound();
  }

  if (product.companyId !== session.user.companyId) {
    redirect("/dashboard");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div>
        <Link
          href={`/dashboard`}
          className="text-muted text-sm flex align-center gap-1 hover:text-white"
          style={{ display: "inline-flex" }}
        >
          &larr; Back to Dashboard
        </Link>
        <h1 style={{ marginTop: "0.5rem", marginBottom: "0.25rem" }}>Manage Recall & Safety Alerts</h1>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Create safety notices, publish active product recalls, and sync alerts to support streams for <strong>{product.name}</strong>.
        </p>
      </div>

      <RecallsManagerClient
        productId={product.id}
        productName={product.name}
        recalls={product.recallAlerts}
      />
    </div>
  );
}
