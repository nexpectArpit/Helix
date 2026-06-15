import React from "react";
import { db } from "@/lib/db";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import UploadManager from "@/components/UploadManager";
import DocumentList from "@/components/DocumentList";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDetailPage({ params }: PageProps) {
  const resolvedParams = await params;
  const productId = resolvedParams.id;

  const session = await getServerSession(authOptions);

  // Fetch product and its uploaded documents from SQLite
  const product = await db.product.findUnique({
    where: { id: productId },
    include: {
      company: true,
      uploads: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!product) {
    notFound();
  }

  // Security check: If COMPANY_ADMIN, they can only view their own products
  if (session && session.user?.role === "COMPANY_ADMIN" && session.user.companyId && session.user.companyId !== product.companyId) {
    redirect("/dashboard");
  }

  const hasImage = !!product.image;
  const docs = product.uploads.filter((u) => u.fileType === "PDF" || u.fileType === "TEXT" || u.fileType === "LINK");

  const isAdmin = session?.user?.role === "COMPANY_ADMIN" && session.user.companyId === product.companyId;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Breadcrumbs */}
      <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
        <Link href="/products">Support Library</Link> &gt; <span style={{ color: "var(--text-secondary)" }}>{product.name}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "2.5rem" }}>
        {/* Left Column: Details & Documents */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Header */}
          <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
            {hasImage ? (
              <div
                style={{
                  width: "100px",
                  height: "100px",
                  borderRadius: "10px",
                  backgroundImage: `url(${product.image})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  flexShrink: 0,
                  border: "1px solid var(--border-color)"
                }}
              />
            ) : (
              <div
                style={{
                  width: "100px",
                  height: "100px",
                  borderRadius: "10px",
                  background: "linear-gradient(135deg, rgba(95, 92, 230, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                </svg>
              </div>
            )}

            <div>
              <div style={{ fontSize: "0.875rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-primary)", fontWeight: 700, marginBottom: "0.25rem" }}>
                {product.company.name}
              </div>
              <h1 style={{ fontSize: "2.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>{product.name}</h1>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span className="badge badge-indigo">{product.category}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="card">
            <h3 style={{ marginBottom: "1rem" }}>Product Description</h3>
            <p style={{ margin: 0, lineHeight: 1.6, color: "var(--text-secondary)" }}>
              {product.description}
            </p>
          </div>

          {/* Documents Section */}
          {isAdmin ? (
            <UploadManager productId={product.id} initialUploads={docs} />
          ) : (
            <DocumentList uploads={docs} />
          )}
        </div>

        {/* Right Column: Diagnostic Trigger Card */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div className="card" style={{ border: "1px solid rgba(95, 92, 230, 0.25)", background: "rgba(18, 18, 24, 0.9)" }}>
            <h3 style={{ marginBottom: "0.75rem" }}>Diagnostic Assistant</h3>
            <p style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              Experiencing issues with your {product.name}? Connect with our AI-powered technician. It will guide you step-by-step to diagnose the problem.
            </p>

            {session ? (
              <Link
                href={`/products/${product.id}/diagnose`}
                className="btn btn-primary w-full"
                style={{ background: "var(--accent-gradient)" }}
              >
                Start Diagnostic Chat
              </Link>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Link
                  href={`/login?callbackUrl=/products/${product.id}`}
                  className="btn btn-primary w-full"
                >
                  Sign In to Start Chat
                </Link>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>
                  Free account required to log diagnostic history.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
