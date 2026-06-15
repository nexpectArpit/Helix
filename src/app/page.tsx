import React from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import ProductCard from "@/components/ProductCard";
import PlatformCapabilities from "@/components/PlatformCapabilities";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);

  // Retrieve the 3 most recently created products for the featured section
  // If a COMPANY_ADMIN is logged in, restrict to their company's products
  const featuredProductsWhere: any = {};
  if (session && session.user?.role === "COMPANY_ADMIN" && session.user.companyId) {
    featuredProductsWhere.companyId = session.user.companyId;
  }

  const featuredProducts = await db.product.findMany({
    where: featuredProductsWhere,
    take: 3,
    orderBy: { createdAt: "desc" },
    include: { company: true }
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5rem", padding: "2rem 0" }}>
      {/* Hero Section */}
      <section style={{ textAlign: "center", position: "relative", padding: "4rem 0" }}>
        <div 
          style={{
            background: "linear-gradient(135deg, rgba(95, 92, 230, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%)",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "80%",
            height: "80%",
            borderRadius: "40px",
            filter: "blur(60px)",
            pointerEvents: "none",
            zIndex: -1
          }}
        />

        <h1 
          style={{
            fontSize: "3.5rem",
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-0.04em",
            marginBottom: "1.5rem",
            background: "linear-gradient(to right, #ffffff, #a1a1aa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent"
          }}
        >
          Product Troubleshooting.<br />
          Solved by Intelligence.
        </h1>

        <p 
          style={{
            fontSize: "1.25rem",
            color: "var(--text-secondary)",
            maxWidth: "600px",
            margin: "0 auto 2.5rem auto",
            lineHeight: 1.6
          }}
        >
          Helix is a diagnostics assistant. Connect manuals, schema documents, and support files to diagnose issues in minutes.
        </p>

        <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
          <Link href="/companies" className="btn btn-primary" style={{ padding: "0.8rem 1.8rem", fontSize: "1rem" }}>
            Browse Manufacturers
          </Link>
          <Link href="/register?role=COMPANY_ADMIN" className="btn btn-secondary" style={{ padding: "0.8rem 1.8rem", fontSize: "1rem" }}>
            For Support Teams
          </Link>
        </div>
      </section>

      {/* Feature grid */}
      <PlatformCapabilities />

      {/* Featured Products */}
      <section style={{ borderTop: "1px solid var(--border-color)", paddingTop: "4rem", marginBottom: "2rem" }}>
        <div className="flex justify-between align-center" style={{ marginBottom: "2.5rem" }}>
          <h2>Recently Registered Products</h2>
          <Link href="/companies" className="btn btn-secondary" style={{ fontSize: "0.85rem" }}>
            Browse Manufacturers →
          </Link>
        </div>

        {featuredProducts.length > 0 ? (
          <div className="grid grid-cols-3">
            {featuredProducts.map((product) => (
              <div key={product.id}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card text-center" style={{ padding: "3rem", background: "rgba(18, 18, 24, 0.4)" }}>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              No products have been added to the library yet. Register a company account to add products!
            </p>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer style={{ textAlign: "center", padding: "2rem 0", color: "var(--text-muted)", fontSize: "0.85rem", borderTop: "1px solid var(--border-color)", marginTop: "auto" }}>
        <p>All rights reserved, made for MOSS hack hackthon, &copy; team gantz (arpit and ashutosh)</p>
      </footer>
    </div>
  );
}
