"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createProduct } from "@/actions/products";

export default function NewProductPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createProduct(formData);
      if (!result.success) {
        setError(result.error || "Failed to create product.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    });
  };

  return (
    <div style={{ maxWidth: "600px", margin: "0 auto" }}>
      <div style={{ marginBottom: "2rem" }}>
        <Link href="/dashboard" style={{ fontSize: "0.875rem", color: "var(--text-muted)" }}>
          &larr; Back to Dashboard
        </Link>
        <h1 style={{ marginTop: "0.5rem" }}>Register New Product</h1>
        <p style={{ color: "var(--text-secondary)" }}>
          Add a new product to your company support catalog. Users will be able to browse and troubleshoot it.
        </p>
      </div>

      <div className="card">
        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1.25rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Product Name</label>
            <input
              type="text"
              name="name"
              className="input-field"
              placeholder="e.g. Helix V2 Electric Scooter"
              required
              disabled={isPending}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <input
              type="text"
              name="category"
              className="input-field"
              placeholder="e.g. Scooter, AC, Laptop"
              required
              disabled={isPending}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Product Image URL (Optional)</label>
            <input
              type="text"
              name="imageUrl"
              className="input-field"
              placeholder="e.g. https://images.unsplash.com/photo-scooter"
              disabled={isPending}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Default Warranty Duration (Days)</label>
            <input
              type="number"
              name="warrantyDays"
              className="input-field"
              defaultValue={365}
              min={0}
              required
              disabled={isPending}
            />
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
              This defines the automated warranty lifespan for customer registrations.
            </p>
          </div>

          <div className="form-group" style={{ marginBottom: "2rem" }}>
            <label className="form-label">Description & Specifications</label>
            <textarea
              name="description"
              className="input-field"
              placeholder="Detailed description of the product, its specifications, and default usage instructions..."
              rows={6}
              required
              disabled={isPending}
              style={{ fontFamily: "inherit", resize: "vertical" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem" }}>
            <Link href="/dashboard" className="btn btn-secondary" style={{ pointerEvents: isPending ? "none" : "auto" }}>
              Cancel
            </Link>
            <button type="submit" className={`btn btn-primary ${isPending ? "btn-disabled" : ""}`} disabled={isPending}>
              {isPending ? (
                <>
                  <div className="spinner" style={{ width: "1rem", height: "1rem", marginRight: "0.5rem" }}></div>
                  Registering...
                </>
              ) : (
                "Register Product"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
