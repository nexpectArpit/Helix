import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function CustomerTicketsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login?callbackUrl=/tickets");
  }

  // Redirect company admin to their dashboard
  if (session.user.role === "COMPANY_ADMIN") {
    redirect("/dashboard");
  }

  // Fetch all diagnostic sessions created by this user
  const tickets = await db.diagnosticSession.findMany({
    where: { userId: session.user.id },
    include: {
      product: {
        include: {
          company: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div>
        <h1>My Troubleshooting Tickets</h1>
        <p style={{ fontSize: "1.1rem" }}>
          Track your guided troubleshooting sessions, escalated support tickets, and manufacturer resolutions.
        </p>
      </div>

      {tickets.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {tickets.map((ticket) => {
            const isResolved = ticket.status === "resolved";
            const isActive = ticket.status === "active";
            const isEscalated = ticket.status === "escalated";

            return (
              <div 
                key={ticket.id} 
                className="card"
                style={{
                  border: isResolved 
                    ? "1px solid rgba(16, 185, 129, 0.2)" 
                    : isEscalated 
                    ? "1px solid rgba(245, 158, 11, 0.2)" 
                    : "1px solid var(--border-color)",
                  boxShadow: isResolved 
                    ? "0 4px 20px rgba(16, 185, 129, 0.05)" 
                    : "0 4px 20px rgba(0, 0, 0, 0.4)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "1.25rem"
                }}
              >
                {/* Top Row: Product Info & Status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-primary)", fontWeight: 700, marginBottom: "0.25rem" }}>
                      {ticket.product.company.name}
                    </div>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
                      {ticket.product.name}
                    </h3>
                    <div className="text-muted text-sm" style={{ marginTop: "0.25rem" }}>
                      Updated: {new Date(ticket.updatedAt).toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span className={`badge ${
                      isResolved 
                        ? "badge-green" 
                        : isEscalated 
                        ? "badge-orange" 
                        : isActive 
                        ? "badge-indigo" 
                        : "badge-gray"
                    }`}>
                      {isResolved 
                        ? "Resolution Received" 
                        : isEscalated 
                        ? "Escalated to Support" 
                        : isActive 
                        ? "Active Chat" 
                        : "Concluded"}
                    </span>
                  </div>
                </div>

                {/* Resolution Message Preview */}
                {isResolved && ticket.resolution && (
                  <div 
                    style={{ 
                      padding: "1rem", 
                      borderRadius: "8px", 
                      background: "rgba(16, 185, 129, 0.04)", 
                      border: "1px solid rgba(16, 185, 129, 0.15)",
                      fontSize: "0.9rem",
                      color: "var(--text-primary)"
                    }}
                  >
                    <div style={{ fontWeight: 600, color: "var(--success-color)", marginBottom: "0.35rem" }}>
                      Resolution from Support Team:
                    </div>
                    <p style={{ margin: 0, color: "var(--text-secondary)", whiteSpace: "pre-line", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {ticket.resolution}
                    </p>
                  </div>
                )}

                {/* Bottom Row: Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "1rem" }}>
                  <span className="text-muted text-sm">
                    Ticket ID: #{ticket.id.slice(-8)}
                  </span>
                  
                  <Link 
                    href={`/products/${ticket.productId}/diagnose`} 
                    className={`btn ${isActive ? "btn-primary" : "btn-secondary"}`}
                    style={{ fontSize: "0.8rem", padding: "0.4rem 1rem" }}
                  >
                    {isActive ? "Continue Diagnostics" : "View Details & Transcript"}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card text-center" style={{ padding: "4rem 2rem", background: "rgba(18, 18, 24, 0.4)" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--text-muted)", marginBottom: "1rem" }}>
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <h3>No Troubleshooting Tickets</h3>
          <p style={{ fontSize: "0.95rem", color: "var(--text-muted)", maxWidth: "450px", margin: "0.5rem auto 1.5rem auto" }}>
            You haven't initiated any product troubleshooting sessions yet. Browse our manufacturer directory to find your products and start diagnostics.
          </p>
          <Link href="/companies" className="btn btn-primary">
            Browse Manufacturers
          </Link>
        </div>
      )}
    </div>
  );
}
