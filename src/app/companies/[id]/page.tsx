import React from "react";
import { db } from "@/lib/db";
import { getCompanyById, getProducts } from "@/actions/products";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import BrowseSection from "@/components/BrowseSection";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ search?: string; category?: string }>;
}

export const dynamic = "force-dynamic";

export default async function CompanyProductsPage({ params, searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  const id = resolvedParams.id;

  if (session && session.user?.role === "COMPANY_ADMIN") {
    redirect("/dashboard");
  }

  const search = resolvedSearchParams.search || "";
  const category = resolvedSearchParams.category || "All";

  const company = await getCompanyById(id);
  if (!company) {
    notFound();
  }

  // Fetch products matching search/category within this company
  const products = await getProducts(search, category, id);

  // Fetch category list specifically for this company
  const allCompanyCategories = await db.product.findMany({
    where: { companyId: id },
    select: { category: true }
  });

  const categoriesList = [
    "All",
    ...Array.from(new Set(allCompanyCategories.map((p) => p.category)))
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Breadcrumbs */}
      <div style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
        <Link href="/companies">Manufacturers</Link> &gt;{" "}
        <span style={{ color: "var(--text-secondary)" }}>{company.name}</span>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <h1 style={{ fontSize: "2.5rem" }}>{company.name} Support</h1>
        <p style={{ fontSize: "1.1rem", color: "var(--text-secondary)" }}>
          {company.description || `Certified product line, user manuals, and automated diagnostics for ${company.name}.`}
        </p>
      </div>

      <BrowseSection 
        initialProducts={products} 
        categories={categoriesList} 
        basePath={`/companies/${id}`}
      />
    </div>
  );
}
