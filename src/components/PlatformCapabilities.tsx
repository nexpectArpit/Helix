"use client";

import React from "react";

export default function PlatformCapabilities() {
  const capabilities = [
    {
      bg: "rgba(139, 92, 246, 0.08)",
      color: "#8b5cf6", // Violet
      borderColor: "rgba(139, 92, 246, 0.15)",
      icon: (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="12" cy="12" r="3.5" fill="currentColor" fillOpacity="0.15" />
          <circle cx="12" cy="12" r="1.2" />
          <circle cx="12" cy="4" r="2.2" />
          <circle cx="5" cy="18" r="2.2" />
          <circle cx="19" cy="18" r="2.2" />
          <path d="M12 7v2m0 6v1M6.2 16.8l3-3m8.6 3l-3-3" strokeWidth="1.2" strokeDasharray="3 2" />
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeOpacity="0.25" strokeDasharray="4 3" />
        </svg>
      ),
      title: "Structured Diagnostic Engine",
      description: "AI technician that systematically investigates, tests, and eliminates causes, not a chatbot. Tracks diagnostic state through intake → investigation → testing → diagnosis → resolution."
    },
    {
      bg: "rgba(99, 102, 241, 0.08)",
      color: "#6366f1", // Indigo
      borderColor: "rgba(99, 102, 241, 0.15)",
      icon: (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeOpacity="0.2" />
          <circle cx="16" cy="16" r="5.5" stroke="currentColor" strokeOpacity="0.2" />
          <path d="M8 13.5a5.5 5.5 0 0 0 5.5-5.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="16" cy="16" r="1.5" fill="currentColor" />
          <path d="M4 4l2 2m14 14l-2-2" stroke="currentColor" strokeWidth="1.2" strokeOpacity="0.4" />
        </svg>
      ),
      title: "Community Knowledge",
      description: "The platform learns from every resolved case. Helix indexes past solutions so future users with similar symptoms get faster, proven fixes, making the system smarter over time."
    },
    {
      bg: "rgba(59, 130, 246, 0.08)",
      color: "#3b82f6", // Blue
      borderColor: "rgba(59, 130, 246, 0.15)",
      icon: (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M12 2v20M5 7l7-3.5 7 3.5-7 3.5-7-3.5zM5 14l7-3.5 7 3.5-7 3.5-7-3.5z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 15.5l5 2.5 5-2.5" stroke="currentColor" strokeOpacity="0.4" />
          <circle cx="12" cy="12" r="2.5" fill="currentColor" fillOpacity="0.25" />
        </svg>
      ),
      title: "Helix Semantic Search",
      description: "Hybrid vector search with metadata filtering. Manuals are chunked, enriched with component/subsystem tags, and indexed into Helix for precise, context-aware retrieval."
    },
    {
      bg: "rgba(16, 185, 129, 0.08)",
      color: "#10b981", // Green
      borderColor: "rgba(16, 185, 129, 0.15)",
      icon: (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.25" />
          <path d="M12 6.5v5.5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="1.2" fill="currentColor" />
          <path d="M12 3v1.5M12 19.5v1.5M3 12h1.5M19.5 12H21" stroke="currentColor" strokeOpacity="0.4" strokeWidth="1.2" />
        </svg>
      ),
      title: "Maintenance Schedules",
      description: "Auto-extracts maintenance tasks from uploaded manuals using AI. Companies approve, users track due dates and mark tasks complete on their personal dashboard."
    },
    {
      bg: "rgba(245, 158, 11, 0.08)",
      color: "#f59e0b", // Yellow
      borderColor: "rgba(245, 158, 11, 0.15)",
      icon: (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M12 21.5s7.5-4 7.5-9.5V5.5L12 2.5 4.5 5.5v6.5c0 5.5 7.5 9.5 7.5 9.5z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 8.5v4" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="16" r="1.2" fill="currentColor" />
        </svg>
      ),
      title: "Warranty & Recall Alerts",
      description: "Companies can publish safety recalls and service notices. Users see alerts for products they own, with warranty expiry countdowns and severity indicators."
    },
    {
      bg: "rgba(249, 115, 22, 0.08)",
      color: "#f97316", // Orange
      borderColor: "rgba(249, 115, 22, 0.15)",
      icon: (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z" />
          <path d="M12 2v2.5M12 19.5v2.5M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" strokeLinecap="round" strokeWidth="2.2" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
      ),
      title: "Spare Part Suggestions",
      description: "When a root cause is identified, the assistant automatically suggests compatible replacement parts extracted from official documentation with part numbers."
    },
    {
      bg: "rgba(239, 68, 68, 0.08)",
      color: "#ef4444", // Red
      borderColor: "rgba(239, 68, 68, 0.15)",
      icon: (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M2 12h3.5l1.8-5.5 3.2 11 1.8-8.5 2 5.5h7.7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" />
          <path d="M5.5 4h.01M18.5 4h.01M12 20h.01" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeOpacity="0.4" />
        </svg>
      ),
      title: "Product Health Score",
      description: "Companies see real-time analytics: escalation rates, top reported failures, resolution trends, and an overall product health gauge to identify systemic issues."
    },
    {
      bg: "rgba(236, 72, 153, 0.08)",
      color: "#ec4899", // Violet-Red/Pink
      borderColor: "rgba(236, 72, 153, 0.15)",
      icon: (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.2" />
          <path d="M12 2.5c2.5 0 4.5 4.5 4.5 9.5s-2 9.5-4.5 9.5-4.5-4.5-4.5-9.5 2-9.5 4.5-9.5z" stroke="currentColor" strokeOpacity="0.35" />
          <path d="M2.5 12h19" stroke="currentColor" strokeOpacity="0.35" />
          <circle cx="12" cy="12" r="2.8" fill="currentColor" fillOpacity="0.15" />
        </svg>
      ),
      title: "Multi-Language Support",
      description: "Users can interact in Hindi, Spanish, French, German, and more. The assistant reads English manuals and responds fluently in the selected language."
    },
    {
      bg: "rgba(14, 165, 233, 0.08)",
      color: "#0ea5e9", // Sky Blue
      borderColor: "rgba(14, 165, 233, 0.15)",
      icon: (
        <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M14 2v5.5h5.5M16.5 13H7.5M16.5 17H7.5M10.5 9H7.5" stroke="currentColor" strokeOpacity="0.5" strokeLinecap="round" />
          <path d="M7.5 13.5l1.5 1.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity="0.85" />
        </svg>
      ),
      title: "Citations & Handoff Briefs",
      description: "Every recommendation cites source documents. When escalated to human support, an AI-generated handoff summary gives agents full context instantly."
    }
  ];

  return (
    <section style={{ borderTop: "1px solid var(--border-color)", paddingTop: "4.5rem", overflow: "hidden" }}>
      <h2 style={{ textAlign: "center", marginBottom: "0.75rem" }}>Platform Capabilities</h2>
      <p style={{ textAlign: "center", color: "var(--text-muted)", marginBottom: "3rem", maxWidth: "600px", margin: "0 auto 3rem auto" }}>
        A complete ecosystem for product support, powered by Helix semantic search, structured diagnostics, and community intelligence.
      </p>

      {/* Infinite Horizontal Marquee Scrolling Loop */}
      <div className="marquee-container">
        <div className="marquee-content">
          {/* First Render Loop */}
          {capabilities.map((item, idx) => (
            <div
              key={`c1-${idx}`}
              className="premium-card"
              style={{ position: "relative", overflow: "hidden" }}
            >
              {/* Enlarged watermark icon in the background */}
              <div 
                className="bg-watermark-icon"
                style={{
                  position: "absolute",
                  bottom: "-20px",
                  right: "-20px",
                  width: "140px",
                  height: "140px",
                  opacity: 0.12,
                  color: item.color,
                  filter: `drop-shadow(0 0 15px ${item.color}35)`,
                  transition: "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease",
                  pointerEvents: "none",
                  zIndex: 0
                }}
              >
                {item.icon}
              </div>

              {/* Foreground content */}
              <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "0.75rem", height: "100%" }}>
                {/* Colored top accent bar representing the VIBGYOR theme */}
                <div style={{ width: "24px", height: "3.5px", borderRadius: "10px", background: item.color, marginBottom: "0.25rem" }}></div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#ffffff", margin: 0 }}>{item.title}</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                  {item.description}
                </p>
              </div>
            </div>
          ))}

          {/* Second Duplicate Render Loop (Seamless transition) */}
          {capabilities.map((item, idx) => (
            <div
              key={`c2-${idx}`}
              className="premium-card"
              style={{ position: "relative", overflow: "hidden" }}
            >
              {/* Enlarged watermark icon in the background */}
              <div 
                className="bg-watermark-icon"
                style={{
                  position: "absolute",
                  bottom: "-20px",
                  right: "-20px",
                  width: "140px",
                  height: "140px",
                  opacity: 0.12,
                  color: item.color,
                  filter: `drop-shadow(0 0 15px ${item.color}35)`,
                  transition: "transform 0.5s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.5s ease",
                  pointerEvents: "none",
                  zIndex: 0
                }}
              >
                {item.icon}
              </div>

              {/* Foreground content */}
              <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: "0.75rem", height: "100%" }}>
                {/* Colored top accent bar representing the VIBGYOR theme */}
                <div style={{ width: "24px", height: "3.5px", borderRadius: "10px", background: item.color, marginBottom: "0.25rem" }}></div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#ffffff", margin: 0 }}>{item.title}</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
