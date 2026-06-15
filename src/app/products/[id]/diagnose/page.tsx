import React from "react";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import ChatInterface from "@/components/ChatInterface";
import { startSession, autoCloseIfExpired } from "@/actions/diagnostic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductDiagnosePage({ params }: PageProps) {
  const authSession = await getServerSession(authOptions);

  const resolvedParams = await params;
  const productId = resolvedParams.id;

  if (!authSession || !authSession.user) {
    redirect(`/login?callbackUrl=/products/${productId}/diagnose`);
  }

  // Fetch product metadata
  const product = await db.product.findUnique({
    where: { id: productId }
  });

  if (!product) {
    notFound();
  }

  // Security check: If COMPANY_ADMIN, they can only diagnose their own company's products
  if (authSession.user.role === "COMPANY_ADMIN" && authSession.user.companyId !== product.companyId) {
    redirect("/dashboard");
  }

  // 1. Check if there is already an active troubleshooting session for this user/product
  let diagSession = await db.diagnosticSession.findFirst({
    where: {
      productId,
      userId: authSession.user.id,
      status: "active"
    },
    orderBy: { createdAt: "desc" }
  });

  // Check if session has expired (been inactive for more than 2 hours)
  if (diagSession) {
    const wasClosed = await autoCloseIfExpired(diagSession);
    if (wasClosed) {
      diagSession = null;
    }
  }

  // 2. If no active session, create one
  if (!diagSession) {
    const result = await startSession(productId);
    if (!result.success || !result.sessionId) {
      return (
        <div className="card text-center" style={{ marginTop: "3rem" }}>
          <h3 style={{ color: "var(--error-color)" }}>Diagnostic Failure</h3>
          <p>{result.error || "Failed to initialize diagnostic session."}</p>
          <Link href={`/products/${productId}`} className="btn btn-secondary mt-2">
            Back to Product Support
          </Link>
        </div>
      );
    }
    
    // Fetch the newly created session
    diagSession = await db.diagnosticSession.findUnique({
      where: { id: result.sessionId }
    });
  }

  if (!diagSession) {
    notFound();
  }

  const messages = JSON.parse(diagSession.messages || "[]");
  const initialDiagnosticState = diagSession.diagnosticState && diagSession.diagnosticState !== "{}"
    ? JSON.parse(diagSession.diagnosticState)
    : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Breadcrumbs */}
      <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
        <Link href="/companies">Manufacturers</Link> &gt;{" "}
        <Link href={`/companies/${product.companyId}`}>{product.name}</Link> &gt;{" "}
        <span style={{ color: "var(--text-secondary)" }}>Diagnose</span>
      </div>

      <div style={{ marginBottom: "0.5rem" }}>
        <h1>Intelligent Diagnostic Technician</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Let the AI technician guide you to isolate and solve the fault in your product.
        </p>
      </div>

      <ChatInterface
        productId={product.id}
        sessionId={diagSession.id}
        initialMessages={messages}
        productName={product.name}
        initialStatus={diagSession.status}
        isTesting={authSession.user.role === "COMPANY_ADMIN"}
        initialResolution={diagSession.resolution}
        initialDiagnosticState={initialDiagnosticState}
      />
    </div>
  );
}
