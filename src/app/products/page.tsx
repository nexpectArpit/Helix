import React from "react";
import { db } from "@/lib/db";
import { getProducts } from "@/actions/products";
import BrowseSection from "@/components/BrowseSection";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ search?: string; category?: string }>;
}

export default async function ProductsPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  if (session && session.user?.role === "COMPANY_ADMIN") {
    redirect("/dashboard");
  }

  const resolvedParams = await searchParams;
  const search = resolvedParams.search || "";
  const category = resolvedParams.category || "All";

  // Fetch products matching parameters (powered by Moss hybrid search if search is active)
  const products = await getProducts(search, category);

  // Fetch all unique categories from database to construct filter chips
  const allProductCategories = await db.product.findMany({
    select: { category: true }
  });
  
  const categoriesList = [
    "All",
    ...Array.from(new Set(allProductCategories.map((p) => p.category)))
  ];

  return (
    <div>
      <div style={{ marginBottom: "2rem" }}>
        <h1>Product Support Library</h1>
        <p style={{ fontSize: "1.1rem" }}>
          Find diagnostic tools, manuals, and expert troubleshooting resources for your products.
        </p>
      </div>

      <BrowseSection initialProducts={products} categories={categoriesList} />
    </div>
  );
}
