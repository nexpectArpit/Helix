import React from "react";

export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "60vh",
        gap: "1.5rem"
      }}
    >
      <div 
        className="spinner" 
        style={{ 
          width: "3rem", 
          height: "3rem", 
          borderWidth: "3px",
          borderTopColor: "var(--accent-primary)"
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem" }}>
        <p style={{ margin: 0, fontWeight: 500, color: "var(--text-primary)" }}>Loading support assets...</p>
        <span className="text-muted text-sm">Synchronizing search indexes and loading manuals</span>
      </div>
    </div>
  );
}
