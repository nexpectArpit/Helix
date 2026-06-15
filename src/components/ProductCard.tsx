import React from "react";
import Link from "next/link";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    category: string;
    description: string;
    image: string | null;
    company: {
      name: string;
    };
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  // If no image is uploaded, we'll use a stylized SVG placeholder or gradient background
  const hasImage = !!product.image;

  return (
    <div className="card card-hover flex flex-col" style={{ height: "100%", minHeight: "340px" }}>
      {hasImage ? (
        <div
          style={{
            height: "160px",
            borderRadius: "8px",
            backgroundImage: `url(${product.image})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            marginBottom: "1rem"
          }}
        />
      ) : (
        <div
          style={{
            height: "160px",
            borderRadius: "8px",
            background: "linear-gradient(135deg, rgba(95, 92, 230, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
            border: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: "1rem"
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ color: "var(--text-muted)", opacity: 0.6 }}
          >
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "0.5rem" }}>
        <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-primary)", fontWeight: 700 }}>
          {product.company.name}
        </div>
        <h3 style={{ fontSize: "1.15rem", fontWeight: 600, margin: 0 }}>{product.name}</h3>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <span className="badge badge-indigo">{product.category}</span>
      </div>
      
      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--text-secondary)",
          flexGrow: 1,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          textOverflow: "ellipsis",
          marginBottom: "1.25rem"
        }}
      >
        {product.description}
      </p>

      <div style={{ marginTop: "auto" }}>
        <Link href={`/products/${product.id}`} className="btn btn-primary w-full" style={{ fontSize: "0.85rem" }}>
          View Product Support
        </Link>
      </div>
    </div>
  );
}
