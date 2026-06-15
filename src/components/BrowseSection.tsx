"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProductCard from "./ProductCard";

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  image: string | null;
  company: {
    name: string;
  };
}

interface BrowseSectionProps {
  initialProducts: Product[];
  categories: string[];
  basePath?: string;
}

export default function BrowseSection({ initialProducts, categories, basePath }: BrowseSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get("category") || "All");

  // Debounced search trigger
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (selectedCategory && selectedCategory !== "All") params.set("category", selectedCategory);
      
      startTransition(() => {
        router.push(`${basePath || "/products"}?${params.toString()}`);
      });
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, selectedCategory, router, basePath]);

  return (
    <div>
      {/* Search Bar & Header */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            className="input-field"
            placeholder="Search products by name, model number, or brand (e.g. Electric Scooter)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              paddingLeft: "2.75rem",
              paddingRight: "1rem",
              height: "48px",
              fontSize: "1rem",
              borderRadius: "8px"
            }}
          />
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              position: "absolute",
              left: "1rem",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)"
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          {isPending && (
            <div
              className="spinner"
              style={{
                position: "absolute",
                right: "1rem",
                top: "50%",
                transform: "translateY(-50%)",
                width: "1.25rem",
                height: "1.25rem"
              }}
            ></div>
          )}
        </div>

        {/* Category Filter Chips */}
        <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
          {categories.map((category) => {
            const isActive = selectedCategory === category;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className="btn"
                style={{
                  padding: "0.4rem 1rem",
                  borderRadius: "9999px",
                  fontSize: "0.8rem",
                  background: isActive ? "var(--accent-primary)" : "rgba(255, 255, 255, 0.03)",
                  color: isActive ? "#ffffff" : "var(--text-secondary)",
                  border: isActive ? "1px solid var(--accent-primary)" : "1px solid var(--border-color)",
                  whiteSpace: "nowrap"
                }}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid of Products */}
      {initialProducts.length > 0 ? (
        <div className="grid grid-cols-3">
          {initialProducts.map((product) => (
            <div key={product.id}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      ) : (
        <div
          className="card text-center"
          style={{
            padding: "3rem 1.5rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(18, 18, 24, 0.4)"
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--text-muted)", marginBottom: "1rem" }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <h3 style={{ marginBottom: "0.5rem" }}>No Products Found</h3>
          <p style={{ maxWidth: "400px", fontSize: "0.9rem", color: "var(--text-muted)" }}>
            We couldn't find any products matching your query or selected filters. Try broadening your keywords.
          </p>
        </div>
      )}
    </div>
  );
}
