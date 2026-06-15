"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveSession, deleteSession } from "@/actions/diagnostic";

function renderBold(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={idx} style={{ color: "var(--text-primary)" }}>{part.slice(2, -2)}</strong>;
    }
    return <span key={idx}>{part}</span>;
  });
}

function FormatMessageContent({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split("\n");

  return (
    <>
      {lines.map((line, lineIdx) => {
        let content = line;
        let isList = false;

        if (content.trim().match(/^[-*]\s+/)) {
          isList = true;
          content = content.replace(/^[-*]\s+/, "");
        }

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

interface SessionResolutionManagerProps {
  sessionId: string;
  initialResolution: string | null;
  initialStatus: string;
}

export default function SessionResolutionManager({
  sessionId,
  initialResolution,
  initialStatus,
}: SessionResolutionManagerProps) {
  const router = useRouter();
  
  const hasHandoffBrief = initialResolution?.startsWith("[AUTO-GENERATED HANDOFF BRIEF]");
  const briefText = initialResolution || "";

  const [resolution, setResolution] = useState(
    initialResolution && !initialResolution.startsWith("[AUTO-GENERATED HANDOFF BRIEF]") 
      ? initialResolution 
      : ""
  );
  const [status, setStatus] = useState(initialStatus);
  const [isPendingResolve, startResolveTransition] = useTransition();
  const [isPendingDelete, startDeleteTransition] = useTransition();
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isAlert?: boolean;
  } | null>(null);

  const isResolved = status === "resolved";

  const handleResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolution.trim()) return;

    startResolveTransition(async () => {
      const res = await resolveSession(sessionId, resolution.trim());
      if (res.success) {
        setStatus("resolved");
        router.refresh();
      } else {
        setConfirmModal({
          isOpen: true,
          title: "Error",
          message: res.error || "Failed to resolve session.",
          onConfirm: () => setConfirmModal(null),
          isAlert: true
        });
      }
    });
  };

  const handleDelete = () => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Support Ticket",
      message: "Are you sure you want to permanently delete this support ticket? This action cannot be undone.",
      onConfirm: () => {
        setConfirmModal(null);
        startDeleteTransition(async () => {
          const res = await deleteSession(sessionId);
          if (res.success) {
            router.push("/dashboard");
            router.refresh();
          } else {
            setConfirmModal({
              isOpen: true,
              title: "Error",
              message: res.error || "Failed to delete session.",
              onConfirm: () => setConfirmModal(null),
              isAlert: true
            });
          }
        });
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* AI Handoff Brief Card */}
      {hasHandoffBrief && (
        <div 
          className="card" 
          style={{ 
            borderColor: "rgba(95, 92, 230, 0.3)", 
            background: "rgba(95, 92, 230, 0.03)", 
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.5rem"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-primary)", fontWeight: 700 }}>
              AI Handoff Brief
            </span>
            <span className="badge badge-indigo" style={{ fontSize: "0.65rem", padding: "0.1rem 0.4rem" }}>
              Auto-Generated
            </span>
          </div>
          <div style={{ fontSize: "0.9rem", color: "var(--text-primary)", lineHeight: 1.5, opacity: 0.9 }}>
            <FormatMessageContent text={briefText} />
          </div>
        </div>
      )}

      {/* Resolution Management Card */}
      <div className="card">
        <h3 style={{ marginBottom: "1rem" }}>Ticket Resolution</h3>
        
        {isResolved ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="alert alert-success" style={{ margin: 0, padding: "1rem" }}>
              <strong>Resolved:</strong> Support team has provided a resolution for this session.
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <label className="form-label">Active Resolution Response</label>
              <textarea
                className="input-field"
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={4}
                style={{ 
                  fontFamily: "inherit", 
                  resize: "vertical", 
                  background: "rgba(255,255,255,0.02)",
                  borderColor: "var(--border-color)"
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button
                type="button"
                onClick={handleResolve}
                className={`btn btn-primary ${isPendingResolve ? "btn-disabled" : ""}`}
                disabled={isPendingResolve}
                style={{ fontSize: "0.85rem" }}
              >
                {isPendingResolve ? "Updating Resolution..." : "Update Resolution Response"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResolve} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-muted)" }}>
              Provide a clear, detailed message to resolve this customer's troubleshooting session. 
              The response will be instantly sent to the customer's portal and ticket stream.
            </p>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Support Resolution Message</label>
              <textarea
                className="input-field"
                placeholder="Describe how the issue is resolved or outline next physical steps for the customer (e.g. warranty placement, battery replace instructions)..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={4}
                required
                style={{ fontFamily: "inherit", resize: "vertical" }}
              />
            </div>

            <div>
              <button
                type="submit"
                className={`btn btn-primary ${isPendingResolve ? "btn-disabled" : ""}`}
                disabled={isPendingResolve}
                style={{ fontSize: "0.85rem" }}
              >
                {isPendingResolve ? "Resolving Ticket..." : "Resolve & Close Ticket"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Danger Zone Card */}
      <div className="card" style={{ borderColor: "rgba(239, 68, 68, 0.2)", background: "rgba(239, 68, 68, 0.02)" }}>
        <h3 style={{ color: "var(--error-color)", marginBottom: "0.5rem" }}>Danger Zone</h3>
        <p style={{ fontSize: "0.9rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
          Deleting this ticket will permanently remove all logs, transcripts, and related session context from both the local database and the cloud memory indexes.
        </p>

        <div>
          <button
            type="button"
            onClick={handleDelete}
            className={`btn btn-danger ${isPendingDelete ? "btn-disabled" : ""}`}
            disabled={isPendingDelete}
            style={{ fontSize: "0.85rem" }}
          >
            {isPendingDelete ? "Deleting Ticket..." : "Delete Support Ticket"}
          </button>
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
            textAlign: "left",
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
                  background: confirmModal.title.toLowerCase().includes("delete") || confirmModal.title.toLowerCase().includes("error")
                    ? "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                    : "linear-gradient(135deg, #5f5ce6 0%, #7c3aed 100%)",
                  outline: "none"
                }}
                onClick={confirmModal.onConfirm}
              >
                {confirmModal.isAlert ? "Dismiss" : confirmModal.title.toLowerCase().includes("delete") ? "Delete" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
