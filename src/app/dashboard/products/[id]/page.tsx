import React from "react";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import EditProductForm from "@/components/EditProductForm";
import SparePartsManagerClient from "@/components/SparePartsManagerClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
    redirect("/login");
  }

  const resolvedParams = await params;
  const productId = resolvedParams.id;

  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      spareParts: true
    }
  });

  if (!product) {
    notFound();
  }

  if (product.companyId !== session.user.companyId) {
    redirect("/dashboard");
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto", paddingBottom: "3rem" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/dashboard" style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
          &larr; Back to Dashboard
        </Link>
        <h1 style={{ marginTop: "0.5rem" }}>Edit Product Details</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Modify details for <strong>{product.name}</strong>. Updating this will automatically sync details to the support search.
        </p>
      </div>

      <EditProductForm product={product} />

      {/* Spare Parts List Card */}
      <div className="card" style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Auto-Extracted Spare Parts</h2>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: "1.25rem" }}>
          These parts were automatically extracted by the AI from your uploaded support manuals. They are used to match customer queries in the chat assistant.
        </p>

        <SparePartsManagerClient productId={product.id} spareParts={product.spareParts} />
      </div>
    </div>
  );
}
