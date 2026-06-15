import React from "react";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { computeHealthScore } from "@/lib/health-score";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProductAnalyticsPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
    redirect("/login");
  }

  const resolvedParams = await params;
  const productId = resolvedParams.id;

  const product = await db.product.findUnique({
    where: { id: productId }
  });

  if (!product) {
    notFound();
  }

  if (product.companyId !== session.user.companyId) {
    redirect("/dashboard");
  }

  // Calculate health score metrics
  const health = await computeHealthScore(productId);

  // Fetch escalated sessions specifically for this product
  const recentEscalated = await db.diagnosticSession.findMany({
    where: { productId, status: "escalated" },
    include: { user: true },
    orderBy: { updatedAt: "desc" },
    take: 5
  });



  const getScoreColor = (score: number) => {
    if (score === -1) return "var(--text-muted)";
    if (score >= 80) return "var(--success-color)";
    if (score >= 50) return "var(--warning-color)";
    return "var(--error-color)";
  };

  const getScoreGlow = (score: number) => {
    if (score === -1) return "rgba(255, 255, 255, 0.05)";
    if (score >= 80) return "rgba(16, 185, 129, 0.15)";
    if (score >= 50) return "rgba(245, 158, 11, 0.15)";
    return "rgba(239, 68, 68, 0.15)";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      {/* Header breadcrumb */}
      <div>
        <Link href="/dashboard" className="text-muted text-sm flex align-center gap-1 hover:text-white" style={{ display: "inline-flex" }}>
          &larr; Back to Dashboard
        </Link>
        <h1 style={{ marginTop: "0.5rem", marginBottom: "0.25rem" }}>Product Health & Support Insights</h1>
        <p style={{ color: "var(--text-secondary)", margin: 0 }}>
          Support metrics and common issues reported for <strong>{product.name}</strong>.
        </p>
      </div>

      {/* Hero row: Score Gauge and Quick Stats */}
      <div className="grid grid-cols-2" style={{ gridTemplateColumns: "0.9fr 1.1fr", gap: "2rem" }}>
        
        {/* Health Score Circular Display */}
        <div
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "2.5rem",
            position: "relative",
            overflow: "hidden"
          }}
        >
          {/* Subtle glow background */}
          <div
            style={{
              position: "absolute",
              width: "200px",
              height: "200px",
              borderRadius: "50%",
              background: `radial-gradient(circle, ${getScoreGlow(health.score)} 0%, rgba(0, 0, 0, 0) 70%)`,
              filter: "blur(30px)",
              zIndex: 0
            }}
          />

          <h3 style={{ zIndex: 1, marginBottom: "1.5rem", fontSize: "1.2rem", fontWeight: 600 }}>Overall Health Index</h3>

          <div
            style={{
              width: "150px",
              height: "150px",
              borderRadius: "50%",
              border: `6px solid ${getScoreColor(health.score)}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1,
              boxShadow: `0 0 20px ${getScoreGlow(health.score)}`,
              background: "rgba(0, 0, 0, 0.3)"
            }}
          >
            <span style={{ fontSize: "3rem", fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>
              {health.score === -1 ? "N/A" : health.score}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: "0.25rem" }}>
              {health.score === -1 ? "No Data" : "Score"}
            </span>
          </div>


        </div>

        {/* Supporting Statistics Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="grid grid-cols-2" style={{ gap: "1.25rem" }}>
            <div className="card">
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Total Support Chats</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)" }}>{health.totalSessions}</div>
            </div>

            <div className="card">
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Avg turns to resolve</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--text-primary)" }}>{health.avgTurns} turns</div>
            </div>

            <div className="card">
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Resolved Internally</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--success-color)" }}>
                {health.resolvedCount} ({health.totalSessions > 0 ? Math.round((health.resolvedCount / health.totalSessions) * 100) : 0}%)
              </div>
            </div>

            <div className="card">
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>Escalation Rate</div>
              <div style={{ fontSize: "1.75rem", fontWeight: 700, color: health.escalationRate > 0.3 ? "var(--error-color)" : "var(--text-primary)" }}>
                {Math.round(health.escalationRate * 100)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Diagnostics Lists */}
      <div className="grid grid-cols-2" style={{ gridTemplateColumns: "1.1fr 0.9fr", gap: "2rem" }}>
        
        {/* Top Reported Issues list */}
        <div className="card">
          <h3 style={{ fontSize: "1.2rem", marginBottom: "1.25rem" }}>Top Customer Fault Reports</h3>
          
          {health.topIssues.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {health.topIssues.map((issue, index) => (
                <div
                  key={index}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    background: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--border-color)"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.95rem" }}>
                      {index + 1}. {issue.cause}
                    </span>
                    <span className="badge badge-indigo" style={{ fontSize: "0.75rem" }}>
                      {issue.percentage}% of tickets
                    </span>
                  </div>
                  {/* Progress bar visual indicator */}
                  <div style={{ width: "100%", height: "6px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "3px", overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${issue.percentage}%`,
                        height: "100%",
                        background: "linear-gradient(90deg, var(--accent-primary) 0%, #3b82f6 100%)",
                        borderRadius: "3px"
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    <span>Reported {issue.count} times</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Not enough data available to determine recurring issues.
            </div>
          )}
        </div>

        {/* Escalated Support Tickets List */}
        <div className="card">
          <h3 style={{ fontSize: "1.2rem", marginBottom: "1.25rem" }}>Recent Escalated Chats</h3>

          {recentEscalated.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {recentEscalated.map((sess) => (
                <div
                  key={sess.id}
                  style={{
                    padding: "0.75rem 1rem",
                    borderRadius: "6px",
                    background: "rgba(239, 68, 68, 0.01)",
                    border: "1px solid rgba(239, 68, 68, 0.1)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-primary)" }}>{sess.user.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{sess.user.email}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                      Escalated: {new Date(sess.updatedAt).toLocaleDateString("en-US")}
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/sessions/${sess.id}`}
                    className="btn btn-secondary"
                    style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                  >
                    View Chat
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
              No escalated chats for this product. High customer satisfaction!
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
