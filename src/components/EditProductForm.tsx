"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateProduct, deleteProduct } from "@/actions/products";

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  image: string | null;
  warrantyDays: number;
}

interface EditProductFormProps {
  product: Product;
}

export default function EditProductForm({ product }: EditProductFormProps) {
  const router = useRouter();
  const [isUpdating, startUpdateTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startUpdateTransition(async () => {
      const result = await updateProduct(product.id, formData);
      if (!result.success) {
        setError(result.error || "Failed to update product.");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    });
  };

  const handleDeleteTrigger = () => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Product",
      message: "Are you absolutely sure you want to delete this product? This will permanently delete all associated diagnostic histories, support documents, and indexes. This action cannot be undone.",
      onConfirm: () => {
        setConfirmModal(null);
        setError(null);
        startDeleteTransition(async () => {
          const result = await deleteProduct(product.id);
          if (!result.success) {
            setError(result.error || "Failed to delete product.");
          } else {
            router.push("/dashboard");
            router.refresh();
          }
        });
      }
    });
  };

  const isPending = isUpdating || isDeleting;

  return (
    <div className="card">
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1.25rem" }}>
          {error}
        </div>
      )}

      <form onSubmit={handleUpdate}>
        <div className="form-group">
          <label className="form-label">Product Name</label>
          <input
            type="text"
            name="name"
            className="input-field"
            defaultValue={product.name}
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
            defaultValue={product.category}
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
            defaultValue={product.image || ""}
            disabled={isPending}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Default Warranty Duration (Days)</label>
          <input
            type="number"
            name="warrantyDays"
            className="input-field"
            defaultValue={product.warrantyDays}
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
            defaultValue={product.description}
            rows={6}
            required
            disabled={isPending}
            style={{ fontFamily: "inherit", resize: "vertical" }}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <button
            type="button"
            onClick={handleDeleteTrigger}
            className={`btn btn-danger ${isPending ? "btn-disabled" : ""}`}
            disabled={isPending}
            style={{ outline: "none" }}
          >
            {isDeleting ? "Deleting..." : "Delete Product"}
          </button>

          <div style={{ display: "flex", gap: "1rem" }}>
            <Link href="/dashboard" className="btn btn-secondary" style={{ pointerEvents: isPending ? "none" : "auto", outline: "none" }}>
              Cancel
            </Link>
            <button type="submit" className={`btn btn-primary ${isPending ? "btn-disabled" : ""}`} disabled={isPending} style={{ outline: "none" }}>
              {isUpdating ? (
                <>
                  <div className="spinner" style={{ width: "1rem", height: "1rem", marginRight: "0.5rem" }}></div>
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </div>
      </form>

      {confirmModal && confirmModal.isOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(10, 10, 15, 0.75)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "1rem",
        }}>
          <div className="card" style={{
            maxWidth: "500px",
            width: "100%",
            border: "1px solid var(--border-color)",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 10px 10px -5px rgba(0, 0, 0, 0.7)",
            padding: "1.75rem",
            background: "rgba(18, 18, 24, 0.95)",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            textAlign: "left",
          }}>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600, color: "#ffffff" }}>
              {confirmModal.title}
            </h3>
            <p style={{ margin: 0, fontSize: "0.925rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {confirmModal.message}
            </p>
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
              <button
                className="btn btn-secondary w-full"
                onClick={() => setConfirmModal(null)}
                style={{ outline: "none" }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary w-full"
                style={{
                  background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                  outline: "none"
                }}
                onClick={confirmModal.onConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
