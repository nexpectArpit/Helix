import React from "react";
import { getCompanies } from "@/actions/products";
import Link from "next/link";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CompaniesPage() {
  const session = await getServerSession(authOptions);
  if (session && session.user?.role === "COMPANY_ADMIN") {
    redirect("/dashboard");
  }

  const companies = await getCompanies();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <h1>Company Support Directory</h1>
        <p style={{ fontSize: "1.1rem" }}>
          Select a manufacturer to browse their certified products, access user manuals, and start guided troubleshooting.
        </p>
      </div>

      {companies.length > 0 ? (
        <div className="grid grid-cols-3">
          {companies.map((company) => (
            <div 
              key={company.id} 
              className="card card-hover flex flex-col justify-between" 
              style={{ minHeight: "220px", position: "relative" }}
            >
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                  <span className="badge badge-indigo">
                    {company._count.products} {company._count.products === 1 ? "Product" : "Products"}
                  </span>
                </div>
                <h3 style={{ fontSize: "1.3rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                  {company.name}
                </h3>
                <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", minHeight: "60px", marginBottom: "1.5rem" }}>
                  {company.description || "Authorized manufacturer of high-quality electronics and hardware accessories."}
                </p>
              </div>
              <div>
                <Link href={`/companies/${company.id}`} className="btn btn-primary w-full" style={{ fontSize: "0.85rem" }}>
                  Browse Products
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card text-center" style={{ padding: "3rem" }}>
          <h3>No Companies Found</h3>
          <p>There are no registered companies in the support database yet.</p>
        </div>
      )}
    </div>
  );
}
