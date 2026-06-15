"use client";

import React, { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an analytics service
    console.error("[GLOBAL_UI_ERROR_BOUNDARY]", error);
  }, [error]);

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
      <div className="card text-center" style={{ maxWidth: "480px", width: "100%" }}>
        <div 
          style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            justifyContent: "center", 
            width: "56px", 
            height: "56px", 
            borderRadius: "50%", 
            background: "rgba(239, 68, 68, 0.1)", 
            color: "var(--error-color)", 
            marginBottom: "1.5rem" 
          }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 style={{ marginBottom: "0.5rem" }}>Something Went Wrong</h2>
        <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)", marginBottom: "1.5rem", lineHeight: 1.5 }}>
          An unexpected rendering error occurred. This might be due to a missing indexing database or database table mismatch.
        </p>

        {error.message && (
          <div 
            style={{ 
              background: "rgba(255,255,255,0.02)", 
              border: "1px solid var(--border-color)", 
              borderRadius: "6px", 
              padding: "0.75rem", 
              fontSize: "0.8rem", 
              color: "var(--text-muted)", 
              fontFamily: "var(--font-mono)",
              wordBreak: "break-all",
              textAlign: "left",
              marginBottom: "1.5rem"
            }}
          >
            {error.message}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>
          <button onClick={() => reset()} className="btn btn-primary">
            Try Again
          </button>
          <Link href="/" className="btn btn-secondary">
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
