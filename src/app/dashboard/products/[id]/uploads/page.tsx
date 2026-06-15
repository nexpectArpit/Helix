import React from "react";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import UploadManager from "@/components/UploadManager";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductUploadsPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
    redirect("/login");
  }

  const resolvedParams = await params;
  const productId = resolvedParams.id;

  // Fetch product details and all current uploads
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      uploads: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!product) {
    notFound();
  }

  // Double check admin company match
  if (product.companyId !== session.user.companyId) {
    redirect("/dashboard");
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2.5rem" }}>
        <Link href="/dashboard" style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
          &larr; Back to Dashboard
        </Link>
        <h1 style={{ marginTop: "0.5rem" }}>Manage Support Files</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Upload PDF manuals, text files, or index website URLs for <strong>{product.name}</strong> to train the diagnostic AI.
        </p>
      </div>

      <UploadManager productId={product.id} initialUploads={product.uploads} />
    </div>
  );
}
