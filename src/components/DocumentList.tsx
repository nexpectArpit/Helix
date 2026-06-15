"use client";

import React from "react";

interface Upload {
  id: string;
  fileName: string;
  fileType: string;
  externalUrl: string | null;
  sizeBytes: number | null;
  indexed: boolean;
  createdAt: Date;
}

interface DocumentListProps {
  uploads: Upload[];
}

export default function DocumentList({ uploads }: DocumentListProps) {
  return (
    <div className="card">
      <h3 style={{ marginBottom: "1.25rem" }}>Support Resources ({uploads.length})</h3>

      {uploads.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {uploads.map((doc) => {
            const isLink = doc.fileType === "LINK";
            const targetUrl = isLink ? doc.externalUrl || "#" : `/api/document/${doc.id}`;
            
            return (
              <div 
                key={doc.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  background: "rgba(255, 255, 255, 0.01)",
                  transition: "border-color 0.2s ease, background 0.2s ease",
                }}
                className="card-hover"
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1, minWidth: 0 }}>
                  {/* File Icon */}
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "6px",
                      background: isLink 
                        ? "rgba(59, 130, 246, 0.1)" 
                        : "rgba(95, 92, 230, 0.1)",
                      border: "1px solid var(--border-color)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: isLink ? "#3b82f6" : "#7c79ff",
                      flexShrink: 0,
                    }}
                  >
                    {isLink ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                      </svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    )}
                  </div>

                  {/* Name and Meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span 
                      style={{ 
                        fontWeight: 500, 
                        color: "var(--text-primary)", 
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                      }}
                    >
                      {doc.fileName}
                    </span>
                    <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.25rem" }}>
                      <span className="badge badge-gray" style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}>
                        {doc.fileType}
                      </span>
                      {!isLink && doc.sizeBytes && (
                        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                          {(doc.sizeBytes / 1024).toFixed(1)} KB
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* View/Download Link */}
                <div style={{ marginLeft: "1rem", flexShrink: 0 }}>
                  <a
                    href={targetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}
                  >
                    {isLink ? "Open Link" : "View PDF"}
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
          No support documents or links have been added yet for this product.
        </div>
      )}
    </div>
  );
}
