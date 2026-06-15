import React from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import CompanyProfileForm from "@/components/CompanyProfileForm";

export default async function CompanyProfilePage() {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "COMPANY_ADMIN" || !session.user.companyId) {
    redirect("/login");
  }

  const company = await db.company.findUnique({
    where: { id: session.user.companyId }
  });

  if (!company) {
    redirect("/dashboard");
  }

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/dashboard" style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
          &larr; Back to Dashboard
        </Link>
        <h1 style={{ marginTop: "0.5rem" }}>Edit Company Profile</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Update the profile details for <strong>{company.name}</strong>.
        </p>
      </div>

      <CompanyProfileForm company={company} />
    </div>
  );
}
