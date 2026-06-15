import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import SessionResolutionManager from "@/components/SessionResolutionManager";

interface PageProps {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

export default async function SessionReviewPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
    redirect("/login?callbackUrl=/dashboard");
  }

  const resolvedParams = await params;
  const sessionId = resolvedParams.id;

  const diagSession = await db.diagnosticSession.findUnique({
    where: { id: sessionId },
    include: {
      product: {
        include: {
          company: true
        }
      },
      user: true
    }
  });

  if (!diagSession) {
    notFound();
  }

  // Security check: Ensure the company owns the product for this session
  if (diagSession.product.companyId !== session.user.companyId) {
    return (
      <div className="card text-center" style={{ marginTop: "3rem" }}>
        <h3 style={{ color: "var(--error-color)" }}>Access Denied</h3>
        <p>You do not have permission to view diagnostic sessions for other companies' products.</p>
        <Link href="/dashboard" className="btn btn-primary mt-2">Back to Dashboard</Link>
      </div>
    );
  }

  const messages = JSON.parse(diagSession.messages || "[]");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Breadcrumbs */}
      <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
        <Link href="/dashboard">Dashboard</Link> &gt;{" "}
        <span style={{ color: "var(--text-secondary)" }}>Review Support Ticket #{diagSession.id.slice(-6)}</span>
      </div>

      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ fontSize: "1.8rem", marginBottom: "0.25rem" }}>Review Troubleshooting Transcript</h1>
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>
            Diagnostic log for customer <strong>{diagSession.user.name}</strong> ({diagSession.user.email}) regarding <strong>{diagSession.product.name}</strong>.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {diagSession.user.role === "COMPANY_ADMIN" && (
            <span className="badge badge-gray" style={{ background: "rgba(239, 68, 68, 0.15)", color: "#fca5a5", borderColor: "rgba(239, 68, 68, 0.2)" }}>
              Testing / Sandbox Mode
            </span>
          )}
          <span className={`badge ${
            diagSession.status === "resolved" 
              ? "badge-green" 
              : diagSession.status === "escalated" 
              ? "badge-orange" 
              : "badge-gray"
          }`}>
            {diagSession.status === "resolved" 
              ? "Resolved" 
              : diagSession.status === "escalated" 
              ? "Escalated" 
              : diagSession.status === "completed" 
              ? "Concluded" 
              : "Active"}
          </span>
          <span className="text-muted text-sm" style={{ alignSelf: "center" }}>
            Reported: {new Date(diagSession.updatedAt).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Instructions & Monitor Banner */}
      <div 
        className="alert alert-error" 
        style={{ 
          margin: 0, 
          padding: "1rem", 
          fontSize: "0.9rem", 
          display: "flex", 
          flexDirection: "column",
          gap: "0.5rem", 
          background: "rgba(95, 92, 230, 0.05)", 
          borderColor: "rgba(95, 92, 230, 0.2)",
          color: "#c7d2fe"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, color: "var(--accent-primary)" }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <strong style={{ color: "#ffffff" }}>Testing & Monitoring Dashboard Mode</strong>
        </div>
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.85rem", lineHeight: 1.5 }}>
          You are viewing a recorded customer diagnostics session for your product. Review the chat transcript below to analyze what actions the user performed and what findings the AI technician discovered. 
          Use the <strong>Ticket Resolution</strong> form below to submit a resolution response and close the ticket, or delete it if needed.
        </p>
      </div>

      {/* Messages Feed */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1.5rem", padding: "2rem", maxHeight: "60vh", overflowY: "auto" }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
            No messages were exchanged in this session.
          </div>
        ) : (
          messages.map((msg: any, idx: number) => {
            const isUser = msg.role === "user";
            return (
              <div
                key={idx}
                style={{
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start"
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                  {isUser ? "Customer" : "AI Technician"}
                </div>
                <div
                  style={{
                    background: isUser ? "var(--accent-primary)" : "rgba(255, 255, 255, 0.03)",
                    border: isUser ? "1px solid var(--accent-primary)" : "1px solid var(--border-color)",
                    color: isUser ? "#ffffff" : "var(--text-primary)",
                    padding: "0.85rem 1.15rem",
                    borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                    fontSize: "0.925rem",
                    whiteSpace: "pre-line"
                  }}
                >
                  {msg.content.replace(/<!--SPARE_PARTS:.*?-->/g, "")}
                </div>
                
                {/* Sources Used */}
                {!isUser && msg.sources && msg.sources.length > 0 && (
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                    <span className="text-muted" style={{ fontSize: "0.7rem", alignSelf: "center", marginRight: "0.2rem" }}>
                      Cited:
                    </span>
                    {msg.sources.map((src: any, sIdx: number) => (
                      <span
                        key={sIdx}
                        className="badge badge-gray"
                        style={{ fontSize: "0.68rem", padding: "0.1rem 0.5rem" }}
                      >
                        {src.fileName} (match: {(src.score * 100).toFixed(0)}%)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Ticket resolution form & danger zone actions */}
      <SessionResolutionManager
        sessionId={diagSession.id}
        initialResolution={diagSession.resolution}
        initialStatus={diagSession.status}
      />

      <div className="flex justify-end gap-2">
        <Link href="/dashboard" className="btn btn-secondary">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
