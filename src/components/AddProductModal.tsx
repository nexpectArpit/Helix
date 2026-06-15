"use client";

import React, { useState, useEffect } from "react";
import { getProducts } from "@/actions/products";
import { addProductToInventory } from "@/actions/my-products";
import { useRouter } from "next/navigation";

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

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

export default function AddProductModal({ isOpen, onClose, onSuccess }: AddProductModalProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ownership fields
  const [purchaseDate, setPurchaseDate] = useState("");
  const [serialNumber, setSerialNumber] = useState("");

  // Search products when query changes
  useEffect(() => {
    if (!isOpen) return;

    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await getProducts(searchQuery);
        // Cast or map to matching type
        setProducts(results as unknown as Product[]);
      } catch {
        setError("Failed to fetch products.");
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(fetchProducts, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, isOpen]);

  // Reset form when modal closes or opens
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setProducts([]);
      setSelectedProduct(null);
      setPurchaseDate("");
      setSerialNumber("");
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    setAdding(true);
    setError(null);

    try {
      const res = await addProductToInventory(
        selectedProduct.id,
        purchaseDate || null,
        serialNumber || null
      );

      if (res.success) {
        onClose();
        if (onSuccess) onSuccess();
        router.refresh();
      } else {
        setError(res.error || "Failed to add product.");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "550px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "rgba(20, 20, 28, 0.95)",
          border: "1px solid var(--border-color-hover)",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(95, 92, 230, 0.15)",
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ fontSize: "1.5rem", margin: 0, fontWeight: 600 }}>Add Product to Inventory</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              fontSize: "1.5rem",
              padding: "0.25rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            &times;
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {!selectedProduct ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Search Catalog</label>
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Type product name, category, or brand..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                  style={{ paddingLeft: "2.5rem" }}
                />
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{
                    position: "absolute",
                    left: "0.85rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
            </div>

            <div
              style={{
                maxHeight: "280px",
                overflowY: "auto",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                background: "rgba(0, 0, 0, 0.2)",
              }}
            >
              {loading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                  <div className="spinner"></div>
                </div>
              ) : products.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => setSelectedProduct(product)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        padding: "0.75rem 1rem",
                        background: "none",
                        border: "none",
                        borderBottom: "1px solid var(--border-color)",
                        width: "100%",
                        textAlign: "left",
                        cursor: "pointer",
                        transition: "background 0.2s",
                      }}
                      className="hover-bg-card"
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card-hover)")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      {product.image ? (
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "6px",
                            backgroundImage: `url(${product.image})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                            flexShrink: 0,
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "40px",
                            height: "40px",
                            borderRadius: "6px",
                            background: "rgba(95, 92, 230, 0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                          </svg>
                        </div>
                      )}
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.95rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {product.name}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                          {product.company.name} &bull; {product.category}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
                  {searchQuery ? "No products found." : "Search to browse products."}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={handleAddProduct} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "1rem",
                borderRadius: "8px",
                background: "rgba(95, 92, 230, 0.05)",
                border: "1px solid rgba(95, 92, 230, 0.2)",
              }}
            >
              {selectedProduct.image ? (
                <div
                  style={{
                    width: "50px",
                    height: "50px",
                    borderRadius: "6px",
                    backgroundImage: `url(${selectedProduct.image})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: "50px",
                    height: "50px",
                    borderRadius: "6px",
                    background: "rgba(95, 92, 230, 0.15)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                </div>
              )}
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "1rem" }}>
                  {selectedProduct.name}
                </div>
                <div style={{ fontSize: "0.85rem", color: "var(--accent-primary)", fontWeight: 500 }}>
                  {selectedProduct.company.name}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                onClick={() => setSelectedProduct(null)}
              >
                Change
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Purchase Date (Optional)</label>
              <input
                type="date"
                className="input-field"
                style={{ colorScheme: "dark" }}
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
              <small className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>
                Used to calculate maintenance tasks schedule from purchase date if never done.
              </small>
            </div>

            <div className="form-group">
              <label className="form-label">Serial Number (Optional)</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. SN-12345-XYZ"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={() => setSelectedProduct(null)}
                disabled={adding}
              >
                Back
              </button>
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={adding}
              >
                {adding ? "Adding..." : "Add to Inventory"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
