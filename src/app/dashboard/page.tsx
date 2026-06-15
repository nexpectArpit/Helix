import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { computeHealthScore } from "@/lib/health-score";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
    redirect("/login?callbackUrl=/dashboard");
  }

  // Fetch company info
  const company = await db.company.findUnique({
    where: { id: session.user.companyId },
    include: {
      products: {
        include: {
          uploads: true,
          sessions: true
        }
      }
    }
  });

  if (!company) {
    return (
      <div className="card text-center" style={{ marginTop: "3rem" }}>
        <h3>Company Record Missing</h3>
        <p>Your administrator profile is not linked to an active company record.</p>
        <Link href="/" className="btn btn-primary">Go Home</Link>
      </div>
    );
  }

  // Fetch health scores for all products in parallel
  const productsWithHealth = await Promise.all(
    company.products.map(async (prod) => {
      const health = await computeHealthScore(prod.id);
      return { ...prod, health };
    })
  );

  // Fetch escalated support sessions for this company
  const escalatedSessions = await db.diagnosticSession.findMany({
    where: {
      product: {
        companyId: session.user.companyId
      },
      status: "escalated"
    },
    include: {
      product: true,
      user: true
    },
    orderBy: { updatedAt: "desc" }
  });

  // Aggregate stats
  const productCount = company.products.length;
  const totalUploads = company.products.reduce((acc, p) => acc + p.uploads.length, 0);
  const totalSessions = company.products.reduce((acc, p) => acc + p.sessions.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div>
        <h1>Company Dashboard</h1>
        <p style={{ fontSize: "1.1rem" }}>
          Manage products and reference manuals for <strong>{company.name}</strong>.
        </p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-3">
        <div className="card">
          <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Registered Products</div>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{productCount}</div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Support Files Indexed</div>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{totalUploads}</div>
        </div>

        <div className="card">
          <div style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>Diagnostic Sessions</div>
          <div style={{ fontSize: "2.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{totalSessions}</div>
        </div>
      </div>

      {/* Escalated Support Requests */}
      <div className="card" style={{ border: escalatedSessions.length > 0 ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid var(--border-color)" }}>
        <div className="flex justify-between align-center" style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ 
              width: "8px", 
              height: "8px", 
              borderRadius: "50%", 
              background: escalatedSessions.length > 0 ? "var(--error-color)" : "var(--text-muted)" 
            }} />
            <h3>Escalated Support Requests</h3>
          </div>
          {escalatedSessions.length > 0 && (
            <span className="badge badge-orange">{escalatedSessions.length} Action Needed</span>
          )}
        </div>

        {escalatedSessions.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>
                <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.875rem" }}>Customer</th>
                <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.875rem" }}>Product</th>
                <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.875rem" }}>Last Active</th>
                <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.875rem", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {escalatedSessions.map((sess) => (
                <tr key={sess.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ padding: "1rem 0.5rem" }}>
                    <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{sess.user.name}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{sess.user.email}</div>
                  </td>
                  <td style={{ padding: "1rem 0.5rem" }}>
                    <span className="badge badge-gray">{sess.product.name}</span>
                  </td>
                  <td style={{ padding: "1rem 0.5rem", color: "var(--text-secondary)", fontSize: "0.85rem" }}>
                    {new Date(sess.updatedAt).toLocaleString()}
                  </td>
                  <td style={{ padding: "1rem 0.5rem", textAlign: "right" }}>
                    <Link href={`/dashboard/sessions/${sess.id}`} className="btn btn-primary" style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem" }}>
                      Review Transcript
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
            No escalated customer sessions at this time.
          </div>
        )}
      </div>

      {/* Company Products Table/List */}
      <div className="card">
        <div className="flex justify-between align-center" style={{ marginBottom: "1.5rem" }}>
          <h3>Company Products</h3>
          <Link href="/dashboard/products/new" className="btn btn-primary" style={{ fontSize: "0.85rem" }}>
            + Register Product
          </Link>
        </div>

        {productsWithHealth.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>
                <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.875rem" }}>Product Name</th>
                <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.875rem" }}>Category</th>
                <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.875rem" }}>Indexed Docs</th>
                <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.875rem" }}>Active Chats</th>
                <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.875rem" }}>Health Score</th>
                <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.875rem", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {productsWithHealth.map((prod) => {
                const getScoreColor = (score: number) => {
                  if (score === -1) return "var(--text-muted)";
                  if (score >= 80) return "#34d399"; // Green
                  if (score >= 50) return "#fbbf24"; // Orange/Yellow
                  return "#ef4444"; // Red
                };

                return (
                  <tr key={prod.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td style={{ padding: "1rem 0.5rem", fontWeight: 500 }}>
                      <Link href={`/products/${prod.id}`} style={{ color: "var(--text-primary)" }}>
                        {prod.name}
                      </Link>
                    </td>
                    <td style={{ padding: "1rem 0.5rem" }}>
                      <span className="badge badge-gray">{prod.category}</span>
                    </td>
                    <td style={{ padding: "1rem 0.5rem" }}>{prod.uploads.length} files</td>
                    <td style={{ padding: "1rem 0.5rem" }}>{prod.sessions.length} chats</td>
                    <td style={{ padding: "1rem 0.5rem" }}>
                      <Link
                        href={`/dashboard/products/${prod.id}/analytics`}
                        style={{
                          color: getScoreColor(prod.health.score),
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.35rem"
                        }}
                      >
                        {prod.health.score === -1 ? "N/A" : prod.health.score}
                      </Link>
                    </td>
                    <td style={{ padding: "1rem 0.5rem", textAlign: "right" }}>
                      <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                        <Link href={`/dashboard/products/${prod.id}/uploads`} className="btn btn-secondary" style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem" }}>
                          Files
                        </Link>
                        <Link href={`/dashboard/products/${prod.id}/maintenance`} className="btn btn-secondary" style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem" }}>
                          Maintenance
                        </Link>
                        <Link href={`/dashboard/products/${prod.id}/recalls`} className="btn btn-secondary" style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem" }}>
                          Recalls
                        </Link>
                        <Link href={`/dashboard/products/${prod.id}`} className="btn btn-secondary" style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem" }}>
                          Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
            You haven't registered any products yet. Click "+ Register Product" to get started.
          </div>
        )}
      </div>
    </div>
  );
}
