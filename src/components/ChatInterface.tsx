"use client";

import React, { useState, useEffect, useRef, useTransition } from "react";
import { getSessionHistory, endSession, escalateSession } from "@/actions/diagnostic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CustomSelect from "@/components/CustomSelect";

interface Source {
  fileName: string;
  fileType: string;
  score: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  createdAt?: string;
}

interface ChatInterfaceProps {
  productId: string;
  sessionId: string;
  initialMessages: Message[];
  productName: string;
  initialStatus?: string;
  isTesting?: boolean;
  initialResolution?: string | null;
  initialDiagnosticState?: any;
}

/**
 * Helper to render **bold** text
 */
function renderBold(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} style={{ color: "var(--text-primary)" }}>{part.slice(2, -2)}</strong>;
    }
    return <span key={idx}>{part}</span>;
  });
}

/**
 * Custom text renderer that handles bullet points and subtly highlights sentences ending with '?'
 */
function FormatMessageContent({ text }: { text: string }) {
  if (!text) return null;

  // Split into lines
  const lines = text.split("\n");

  return (
    <>
      {lines.map((line, lineIdx) => {
        let content = line;
        let isList = false;

        // Check if it's a list item
        if (content.trim().match(/^[-*]\s+/)) {
          isList = true;
          content = content.replace(/^[-*]\s+/, "");
        }

        // Process bold text
        const renderContent = () => {
          return renderBold(content);
        };

        if (isList) {
          return (
            <ul key={lineIdx} style={{ paddingLeft: "1.25rem", marginBottom: "0.5rem" }}>
              <li style={{ color: "var(--text-primary)" }}>{renderContent()}</li>
            </ul>
          );
        }

        return (
          <p key={lineIdx} style={{ marginBottom: "0.5rem", lineHeight: 1.6 }}>
            {renderContent()}
          </p>
        );
      })}
    </>
  );
}

export default function ChatInterface({ productId, sessionId, initialMessages, productName, initialStatus, isTesting, initialResolution, initialDiagnosticState }: ChatInterfaceProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(initialStatus || "active");
  const sessionActive = status === "active";
  const [isEnding, startEndTransition] = useTransition();
  const [diagState, setDiagState] = useState<any>(initialDiagnosticState);
  const [expandedCauseId, setExpandedCauseId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isAlert?: boolean;
  } | null>(null);

  // Advanced features state
  const [language, setLanguage] = useState("English");
  const [recommendedParts, setRecommendedParts] = useState<any[]>([]);

  // Listen to messages changes to parse spare parts from the final message
  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "assistant" && lastMsg.content) {
      const partsMatch = lastMsg.content.match(/<!--SPARE_PARTS:(.*?)-->/);
      if (partsMatch) {
        try {
          const parsed = JSON.parse(partsMatch[1]);
          setRecommendedParts(parsed);
        } catch (err) {
          console.error("Failed to parse spare parts:", err);
        }
      } else {
        setRecommendedParts([]);
      }
    }
  }, [messages]);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading || !sessionActive) return;

    const userMsg = input.trim();
    setInput("");
    setLoading(true);

    // 1. Append User Message
    const newMessages: Message[] = [...messages, { role: "user", content: userMsg }];
    setMessages(newMessages);

    // 2. Append blank Assistant Message for streaming
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      // 3. Initiate Streaming Fetch
      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, sessionId, message: userMsg, language })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Streaming error.");
      }

      if (!response.body) {
        throw new Error("No response body available for streaming.");
      }

      // 4. Read response stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        assistantText += chunkText;

        // Update the last assistant message in real time
        setMessages((prev) => {
          const list = [...prev];
          const lastIdx = list.length - 1;
          if (list[lastIdx] && list[lastIdx].role === "assistant") {
            list[lastIdx] = { ...list[lastIdx], content: assistantText };
          }
          return list;
        });
      }

      // 5. Query full session history from DB to get the saved citations
      const histResult = await getSessionHistory(sessionId);
      if (histResult.success && histResult.history) {
        setMessages(histResult.history);
        if (histResult.diagnosticState) {
          setDiagState(histResult.diagnosticState);
        }
      }
    } catch (err: any) {
      console.error("[CHAT_STREAM_ERROR]", err);
      // Inject error message in chat
      setMessages((prev) => {
        const list = [...prev];
        const lastIdx = list.length - 1;
        if (list[lastIdx] && list[lastIdx].role === "assistant") {
          list[lastIdx] = {
            ...list[lastIdx],
            content: `Troubleshooting error. Please verify connections and retry.\nDetails: ${err.message || String(err)}`
          };
        }
        return list;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConclude = () => {
    setConfirmModal({
      isOpen: true,
      title: "Conclude Diagnostics Session",
      message: "Are you sure you want to conclude this diagnostic session? This will push session context logs to the cloud index and lock this chat.",
      onConfirm: () => {
        setConfirmModal(null);
        startEndTransition(async () => {
          const result = await endSession(sessionId);
          if (result.success) {
            setStatus("completed");
            router.refresh();
          } else {
            setConfirmModal({
              isOpen: true,
              title: "Error",
              message: result.error || "Failed to conclude session.",
              onConfirm: () => setConfirmModal(null),
              isAlert: true
            });
          }
        });
      }
    });
  };

  const handleEscalate = () => {
    setConfirmModal({
      isOpen: true,
      title: "Escalate to Support",
      message: "Are you sure you want to report this issue to company support? This will escalate the diagnostic session and lock this chat for admin review.",
      onConfirm: () => {
        setConfirmModal(null);
        startEndTransition(async () => {
          const result = await escalateSession(sessionId);
          if (result.success) {
            setStatus("escalated");
            router.refresh();
          } else {
            setConfirmModal({
              isOpen: true,
              title: "Error",
              message: result.error || "Failed to escalate session.",
              onConfirm: () => setConfirmModal(null),
              isAlert: true
            });
          }
        });
      }
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: "2rem", height: "70vh" }}>
      {/* Main Chat Box area */}
      <div className="card flex flex-col" style={{ height: "100%", padding: "1.25rem", overflow: "hidden" }}>
        {/* Sandbox mode banner */}
        {isTesting && (
          <div 
            className="alert alert-error" 
            style={{ 
              marginBottom: "1rem", 
              padding: "0.6rem 1rem", 
              fontSize: "0.85rem", 
              display: "flex", 
              alignItems: "center", 
              gap: "0.5rem", 
              background: "rgba(239, 68, 68, 0.08)", 
              borderColor: "rgba(239, 68, 68, 0.2)",
              color: "#fca5a5"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span><strong>Sandbox Testing Mode</strong>: You are viewing/testing this support chat as a Company Admin. Actions are for configuration testing.</span>
          </div>
        )}

        {/* Chat Messages Log */}
        <div
          ref={chatContainerRef}
          style={{
            flexGrow: 1,
            overflowY: "auto",
            paddingRight: "0.5rem",
            marginBottom: "1rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem"
          }}
        >
          {/* Support team resolution banner */}
          {status === "resolved" && initialResolution && (
            <div 
              className="alert alert-success" 
              style={{ 
                margin: "0 0 1rem 0", 
                padding: "1rem 1.25rem",
                background: "rgba(16, 185, 129, 0.08)",
                borderColor: "rgba(16, 185, 129, 0.2)",
                color: "#a7f3d0"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: "var(--success-color)" }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <strong style={{ color: "#ffffff", fontSize: "0.95rem" }}>Support Team Resolution Response</strong>
              </div>
              <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-secondary)", whiteSpace: "pre-line", lineHeight: 1.5 }}>
                {initialResolution}
              </p>
            </div>
          )}

          {messages.length === 0 ? (
            <div style={{ textAlign: "center", padding: "4rem 2rem", color: "var(--text-muted)" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--accent-primary)", marginBottom: "1rem" }}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <h3>Diagnostic Session Started</h3>
              <p style={{ fontSize: "0.9rem", marginTop: "0.5rem" }}>
                State your symptom (e.g. "my scooter won't turn on") and the technician will investigate.
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={idx}
                  style={{
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    maxWidth: "80%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isUser ? "flex-end" : "flex-start"
                  }}
                >
                  {/* Message bubble */}
                  <div
                    style={{
                      background: isUser ? "var(--accent-primary)" : "rgba(255, 255, 255, 0.03)",
                      border: isUser ? "1px solid var(--accent-primary)" : "1px solid var(--border-color)",
                      color: isUser ? "#ffffff" : "var(--text-primary)",
                      padding: "0.85rem 1.15rem",
                      borderRadius: isUser ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
                      fontSize: "0.925rem"
                    }}
                  >
                    {isUser ? (
                      <p style={{ margin: 0, whiteSpace: "pre-line", color: "inherit" }}>{msg.content}</p>
                    ) : (
                      <FormatMessageContent text={msg.content.replace(/<!--SPARE_PARTS:.*?-->/g, "")} />
                    )}
                  </div>

                  {/* Sources Badges */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                      <span className="text-muted" style={{ fontSize: "0.7rem", alignSelf: "center", marginRight: "0.2rem" }}>
                        Sources:
                      </span>
                      {msg.sources.map((src, sIdx) => (
                        <span
                          key={sIdx}
                          className="badge badge-gray"
                          title={`Similarity match: ${(src.score * 100).toFixed(0)}%`}
                          style={{
                            fontSize: "0.68rem",
                            padding: "0.1rem 0.5rem",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem"
                          }}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          </svg>
                          {src.fileName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Insufficient Information Alert */}
        {sessionActive && diagState && diagState.phase === "insufficient_information" && (
          <div 
            style={{ 
              background: "rgba(251, 191, 36, 0.06)", 
              border: "1px solid rgba(251, 191, 36, 0.25)", 
              borderRadius: "8px", 
              padding: "0.75rem 1rem", 
              marginBottom: "0.75rem",
              display: "flex", 
              alignItems: "flex-start",
              gap: "0.6rem"
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" style={{ flexShrink: 0, marginTop: "0.1rem" }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div>
              <strong style={{ color: "#fbbf24", fontSize: "0.85rem", display: "block", marginBottom: "0.2rem" }}>Insufficient Documentation</strong>
              <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                The available manuals don't contain enough information to diagnose this specific issue. 
                Try describing broader observations (e.g. what does/doesn't work), or check if the correct manual has been uploaded for this product.
              </span>
            </div>
          </div>
        )}

        {/* Input Bar area */}
        <form onSubmit={handleSend} style={{ display: "flex", gap: "0.75rem", borderTop: "1px solid var(--border-color)", paddingTop: "1rem" }}>
          <input
            type="text"
            className="input-field"
            placeholder={
              !sessionActive
                ? status === "escalated"
                  ? "Issue escalated to support."
                  : status === "resolved"
                  ? "Issue resolved by support team."
                  : "Diagnostic session concluded."
                : loading
                ? "Generating diagnostic response..."
                : "Type scooter symptom, error code, or test result..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading || !sessionActive}
            style={{ height: "42px" }}
          />
          <button
            type="submit"
            className={`btn btn-primary ${loading || !sessionActive ? "btn-disabled" : ""}`}
            disabled={loading || !sessionActive}
            style={{ width: "80px", height: "42px" }}
          >
            {loading ? (
              <div className="spinner" style={{ width: "1.25rem", height: "1.25rem" }}></div>
            ) : (
              "Send"
            )}
          </button>
        </form>
      </div>

      {/* Info Sidebar panel */}
      <div className="flex flex-col gap-3" style={{ maxHeight: "70vh", overflowY: "auto", paddingRight: "0.25rem" }}>
        <div className="card">
          <h4 style={{ marginBottom: "0.5rem" }}>Troubleshooting Unit</h4>
          <div style={{ 
            marginBottom: "1rem", 
            padding: "0.5rem 0.75rem", 
            borderRadius: "6px", 
            background: "rgba(99, 102, 241, 0.1)", 
            color: "var(--accent-primary)", 
            fontSize: "0.85rem",
            lineHeight: "1.4",
            border: "1px solid rgba(99, 102, 241, 0.2)"
          }}>
            {productName}
          </div>

          <h4 style={{ marginBottom: "0.5rem" }}>Preferred Language</h4>
          <CustomSelect
            value={language}
            onChange={(val) => setLanguage(val)}
            disabled={!sessionActive || loading}
            options={[
              { value: "English", label: "English" },
              { value: "Spanish", label: "Español (Spanish)" },
              { value: "French", label: "Français (French)" },
              { value: "German", label: "Deutsch (German)" },
              { value: "Hindi", label: "हिन्दी (Hindi)" },
              { value: "Japanese", label: "日本語 (Japanese)" }
            ]}
          />
          <div style={{ marginBottom: "1.25rem" }} />

          <h4 style={{ marginBottom: "0.5rem" }}>Session Status</h4>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.5rem" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: 
                  status === "active" 
                    ? "var(--success-color)" 
                    : status === "resolved"
                    ? "var(--success-color)"
                    : status === "escalated" 
                    ? "var(--error-color)" 
                    : "var(--text-muted)"
              }}
            ></span>
            <span style={{ fontSize: "0.875rem", fontWeight: 500, color: (status === "active" || status === "resolved") ? "var(--text-primary)" : "var(--text-muted)" }}>
              {status === "active" 
                ? "Active Investigation" 
                : status === "resolved"
                ? "Resolved by Support"
                : status === "escalated" 
                ? "Escalated to Support" 
                : "Concluded"}
            </span>
          </div>

          {sessionActive ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button
                onClick={handleConclude}
                className={`btn btn-secondary w-full ${isEnding ? "btn-disabled" : ""}`}
                disabled={isEnding}
                style={{ fontSize: "0.85rem" }}
              >
                {isEnding ? "Concluding..." : "Conclude Investigation"}
              </button>
              <button
                onClick={handleEscalate}
                className={`btn btn-danger w-full ${isEnding ? "btn-disabled" : ""}`}
                disabled={isEnding}
                style={{ fontSize: "0.85rem" }}
              >
                Report Issue to Support
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {status === "escalated" ? (
                <div className="alert alert-error" style={{ margin: 0, padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}>
                  Issue escalated to support.
                </div>
              ) : status === "resolved" ? (
                <div className="alert alert-success" style={{ margin: 0, padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}>
                  Resolution received from support.
                </div>
              ) : (
                <div className="alert alert-success" style={{ margin: 0, padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}>
                  Session records saved.
                </div>
              )}
              <Link href={`/products/${productId}`} className="btn btn-secondary w-full" style={{ fontSize: "0.85rem" }}>
                Exit Diagnostics
              </Link>
            </div>
          )}
        </div>

        {/* Diagnostic Progress Tracker Card */}
        {diagState && diagState.symptom && (
          <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem", background: "rgba(18, 18, 24, 0.6)" }}>
            <h4 style={{ margin: 0, color: "#ffffff", borderBottom: "1px solid var(--border-color)", paddingBottom: "0.5rem" }}>
              Diagnostic Progress
            </h4>
            
            {/* Primary Symptom */}
            <div>
              <span className="text-muted text-sm" style={{ display: "block" }}>Primary Symptom:</span>
              <strong style={{ fontSize: "0.9rem", color: "var(--text-primary)" }}>{diagState.symptom}</strong>
            </div>

            {/* Current Phase Stepper */}
            <div>
              <span className="text-muted text-sm" style={{ display: "block", marginBottom: "0.25rem" }}>Investigation Phase:</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                {["intake", "investigation", "testing", "diagnosis", "resolution", "insufficient_information"].map((p) => {
                  const isActive = diagState.phase === p;
                  let color = "var(--text-muted)";
                  let label = p.toUpperCase();
                  if (isActive) {
                    color = p === "insufficient_information" 
                      ? "var(--error-color)" 
                      : p === "resolution" 
                      ? "var(--success-color)" 
                      : "var(--accent-primary)";
                  }
                  
                  // Don't render insufficient_information as a normal step unless it is active
                  if (p === "insufficient_information" && !isActive) return null;

                  return (
                    <div key={p} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem", color: isActive ? "var(--text-primary)" : "var(--text-muted)" }}>
                      <span style={{ 
                        width: "6px", 
                        height: "6px", 
                        borderRadius: "50%", 
                        background: color,
                        boxShadow: isActive ? `0 0 8px ${color}` : "none"
                      }} />
                      <span style={{ fontWeight: isActive ? 600 : 400 }}>{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Confirmed Root Cause */}
            {diagState.possibleCauses && diagState.possibleCauses.some((c: any) => c.status === "confirmed") && (
              <div>
                <span className="text-sm font-semibold" style={{ display: "block", marginBottom: "0.5rem", color: "var(--success-color)" }}>Confirmed Root Cause:</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1rem" }}>
                  {diagState.possibleCauses.filter((c: any) => c.status === "confirmed").map((cause: any, index: number) => {
                    const isExpanded = expandedCauseId === cause.id;
                    const hasTests = cause.tests && cause.tests.length > 0;
                    
                    return (
                      <div 
                        key={cause.id || `confirmed-${index}`}
                        style={{
                          padding: "0.5rem",
                          borderRadius: "6px",
                          background: "rgba(16, 185, 129, 0.05)",
                          border: "1px solid rgba(16, 185, 129, 0.2)",
                        }}
                      >
                        <div 
                          onClick={() => setExpandedCauseId(isExpanded ? null : cause.id)}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                        >
                          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--success-color)" }}>
                            {cause.label || cause.cause}
                          </span>
                          <span className="badge badge-green" style={{ fontSize: "0.65rem", padding: "0.05rem 0.35rem" }}>
                            confirmed
                          </span>
                        </div>

                        {/* Expandable Cause Details */}
                        {isExpanded && (
                          <div style={{ marginTop: "0.5rem", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                            {/* Evidence Excerpts */}
                            {cause.evidence && cause.evidence.map((ev: any, evIdx: number) => (
                              <div key={evIdx} style={{ fontSize: "0.725rem", color: "var(--text-secondary)" }}>
                                <div style={{ fontStyle: "italic", color: "var(--text-muted)" }}>
                                  "{ev.excerpt.slice(0, 100)}..."
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.15rem", fontSize: "0.65rem" }}>
                                  <span style={{ color: "var(--accent-primary)" }}>{ev.sourceDocument}</span>
                                  {ev.retrievalReason && <span className="text-muted" title={ev.retrievalReason}>[Reason]</span>}
                                </div>
                              </div>
                            ))}

                            {/* Cause-Test-Result Chains */}
                            {hasTests && (
                              <div style={{ fontSize: "0.7rem", marginTop: "0.25rem" }}>
                                <strong style={{ color: "var(--text-muted)", display: "block", marginBottom: "0.15rem" }}>Testing Chain:</strong>
                                {cause.tests.map((t: any, tIdx: number) => (
                                  <div key={tIdx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: t.status === "failed" ? "var(--error-color)" : t.status === "passed" ? "var(--success-color)" : "var(--text-muted)" }}>
                                    <span>{t.testDescription || t.test}</span>
                                    <span>{t.actualResult || "pending"}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Possible Causes (Un-eliminated & Un-confirmed) */}
            {diagState.possibleCauses && diagState.possibleCauses.some((c: any) => c.status !== "eliminated" && c.status !== "confirmed") && (
              <div style={{ marginBottom: "1rem" }}>
                <span className="text-muted text-sm" style={{ display: "block", marginBottom: "0.5rem" }}>Possible Causes & Evidence:</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {diagState.possibleCauses.filter((c: any) => c.status !== "eliminated" && c.status !== "confirmed").map((cause: any, index: number) => {
                    const isExpanded = expandedCauseId === cause.id;
                    const hasTests = cause.tests && cause.tests.length > 0;
                    
                    return (
                      <div 
                        key={cause.id || `cause-${index}`}
                        style={{
                          padding: "0.5rem",
                          borderRadius: "6px",
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid var(--border-color)",
                        }}
                      >
                        <div 
                          onClick={() => setExpandedCauseId(isExpanded ? null : cause.id)}
                          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
                        >
                          <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-primary)" }}>
                            {cause.label || cause.cause}
                          </span>
                          <span className={`badge ${
                            cause.status === "highly_likely" || cause.status === "likely"
                              ? "badge-indigo"
                              : "badge-gray"
                          }`} style={{ fontSize: "0.65rem", padding: "0.05rem 0.35rem" }}>
                            {cause.status}
                          </span>
                        </div>

                        {/* Expandable Cause Details */}
                        {isExpanded && (
                          <div style={{ marginTop: "0.5rem", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "0.4rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                            {/* Evidence Excerpts */}
                            {cause.evidence && cause.evidence.map((ev: any, evIdx: number) => (
                              <div key={evIdx} style={{ fontSize: "0.725rem", color: "var(--text-secondary)" }}>
                                <div style={{ fontStyle: "italic", color: "var(--text-muted)" }}>
                                  "{ev.excerpt.slice(0, 100)}..."
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.15rem", fontSize: "0.65rem" }}>
                                  <span style={{ color: "var(--accent-primary)" }}>{ev.sourceDocument}</span>
                                  {ev.retrievalReason && <span className="text-muted" title={ev.retrievalReason}>[Reason]</span>}
                                </div>
                              </div>
                            ))}

                            {/* Cause-Test-Result Chains */}
                            {hasTests && (
                              <div style={{ fontSize: "0.7rem", marginTop: "0.25rem" }}>
                                <strong style={{ color: "var(--text-muted)", display: "block", marginBottom: "0.15rem" }}>Testing Chain:</strong>
                                {cause.tests.map((t: any, tIdx: number) => (
                                  <div key={tIdx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: t.status === "failed" ? "var(--error-color)" : t.status === "passed" ? "var(--success-color)" : "var(--text-muted)" }}>
                                    <span>{t.testDescription || t.test}</span>
                                    <span>{t.actualResult || "pending"}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Eliminated Causes */}
            {diagState.possibleCauses && diagState.possibleCauses.some((c: any) => c.status === "eliminated") && (
              <div>
                <span className="text-muted text-sm" style={{ display: "block", marginBottom: "0.25rem" }}>Eliminated Causes:</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  {diagState.possibleCauses.filter((c: any) => c.status === "eliminated").map((cause: any) => (
                    <div 
                      key={cause.id} 
                      style={{ 
                        fontSize: "0.75rem", 
                        textDecoration: "line-through", 
                        color: "var(--text-muted)",
                        display: "flex",
                        justifyContent: "space-between"
                      }}
                    >
                      <span>{cause.label || cause.cause}</span>
                      <span className="badge badge-gray" style={{ fontSize: "0.6rem", padding: "0.02rem 0.2rem", background: "rgba(255,255,255,0.02)" }}>eliminated</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Current Action / Diagnosis */}
            {diagState.currentQuestion && (
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem" }}>
                <span className="badge badge-orange" style={{ display: "inline-block", marginBottom: "0.25rem", fontSize: "0.65rem" }}>Recommended Step</span>
                <div style={{ fontSize: "0.8rem", color: "var(--text-primary)", fontWeight: 500 }}>
                  {diagState.currentQuestion}
                </div>
              </div>
            )}

            {/* Investigation Timeline Log */}
            {diagState.rootCauseHistory && diagState.rootCauseHistory.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "0.75rem" }}>
                <span className="text-muted text-sm" style={{ display: "block", marginBottom: "0.25rem" }}>Investigation Log:</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: "100px", overflowY: "auto" }}>
                  {diagState.rootCauseHistory.map((hist: any, histIdx: number) => (
                    <div key={histIdx} style={{ fontSize: "0.7rem", color: "var(--text-secondary)", borderLeft: "2px solid var(--border-color)", paddingLeft: "0.4rem" }}>
                      {hist.action}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Spare Parts Card */}
            {recommendedParts && recommendedParts.length > 0 && (
              <div className="card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", background: "rgba(95, 92, 230, 0.05)", border: "1px solid rgba(95, 92, 230, 0.25)" }}>
                <h4 style={{ margin: 0, color: "#ffffff", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  </svg>
                  Recommended Parts
                </h4>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {recommendedParts.map((part, pIdx) => (
                    <div key={pIdx} style={{ fontSize: "0.8rem", borderBottom: pIdx < recommendedParts.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none", paddingBottom: pIdx < recommendedParts.length - 1 ? "0.5rem" : 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem" }}>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{part.partName}</div>
                        {part.cost !== undefined && part.cost !== null && (
                          <span className="badge badge-green" style={{ fontSize: "0.7rem", padding: "0.1rem 0.4rem" }}>
                            ${Number(part.cost).toFixed(2)}
                          </span>
                        )}
                      </div>
                      {part.partNumber && (
                        <div style={{ color: "var(--accent-primary)", fontFamily: "var(--font-mono)", fontSize: "0.75rem", marginTop: "0.1rem" }}>
                          P/N: {part.partNumber}
                        </div>
                      )}
                      {part.description && (
                        <div style={{ color: "var(--text-secondary)", fontSize: "0.75rem", marginTop: "0.15rem" }}>
                          {part.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="card flex-grow" style={{ display: "flex", flexDirection: "column", background: "rgba(18, 18, 24, 0.4)" }}>
          <h4 style={{ marginBottom: "0.5rem" }}>Instructions</h4>
          <ol style={{ paddingLeft: "1.1rem", fontSize: "0.8rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <li>Explain the symptoms clearly (e.g. flashing red light, code E10).</li>
            <li>Perform the physical safety tests requested by the assistant.</li>
            <li>Reply with results to eliminate potential electrical/mechanical causes.</li>
            <li>Citations will highlight the reference manual sections.</li>
          </ol>
        </div>
      </div>
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
          }}>
            <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600, color: "#ffffff" }}>
              {confirmModal.title}
            </h3>
            <p style={{ margin: 0, fontSize: "0.925rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
              {confirmModal.message}
            </p>
            <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
              {!confirmModal.isAlert && (
                <button
                  className="btn btn-secondary w-full"
                  onClick={() => setConfirmModal(null)}
                  style={{ outline: "none" }}
                >
                  Cancel
                </button>
              )}
              <button
                className="btn btn-primary w-full"
                style={{
                  background: confirmModal.title.toLowerCase().includes("escalate") || confirmModal.title.toLowerCase().includes("delete") || confirmModal.title.toLowerCase().includes("error")
                    ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                    : "linear-gradient(135deg, #5f5ce6 0%, #7c3aed 100%)",
                  outline: "none"
                }}
                onClick={confirmModal.onConfirm}
              >
                {confirmModal.isAlert ? "Dismiss" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
