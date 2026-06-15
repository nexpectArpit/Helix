"use client";

import React, { useState } from "react";
import { createRecallAlert, updateRecallAlert } from "@/actions/recalls";
import { useRouter } from "next/navigation";
import CustomSelect from "@/components/CustomSelect";

interface RecallAlert {
  id: string;
  title: string;
  description: string;
  severity: string;
  isActive: boolean;
  publishedAt: Date;
}

interface RecallsManagerClientProps {
  productId: string;
  productName: string;
  recalls: RecallAlert[];
}

export default function RecallsManagerClient({ productId, recalls }: RecallsManagerClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"info" | "warning" | "critical">("warning");
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);

  const activeRecalls = recalls.filter((r) => r.isActive);
  const inactiveRecalls = recalls.filter((r) => !r.isActive);

  const handleSubmitRecall = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!title.trim() || !description.trim()) {
      setError("Title and description are required.");
      return;
    }

    setPublishing(true);
    try {
      if (editingAlertId) {
        const res = await updateRecallAlert(editingAlertId, { title: title.trim(), description: description.trim(), severity });
        if (res.success) {
          setSuccess("Recall alert updated successfully.");
          handleCancelEdit();
          router.refresh();
        } else {
          setError(res.error || "Failed to update recall alert.");
        }
      } else {
        const res = await createRecallAlert(productId, title.trim(), description.trim(), severity);
        if (res.success) {
          setSuccess("Safety recall alert published and synchronized successfully.");
          setTitle("");
          setDescription("");
          setSeverity("warning");
          router.refresh();
        } else {
          setError(res.error || "Failed to create recall alert.");
        }
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setPublishing(false);
    }
  };

  const handleEditClick = (recall: RecallAlert) => {
    setEditingAlertId(recall.id);
    setTitle(recall.title);
    setDescription(recall.description);
    setSeverity(recall.severity as any);
  };

  const handleCancelEdit = () => {
    setEditingAlertId(null);
    setTitle("");
    setDescription("");
    setSeverity("warning");
    setError(null);
  };

  const handleToggleActive = async (alertId: string, currentStatus: boolean) => {
    setError(null);
    setSuccess(null);
    try {
      const res = await updateRecallAlert(alertId, { isActive: !currentStatus });
      if (res.success) {
        setSuccess(currentStatus ? "Recall alert deactivated." : "Recall alert reactivated.");
        router.refresh();
      } else {
        setError(res.error || "Failed to update alert status.");
      }
    } catch {
      setError("An unexpected error occurred.");
    }
  };

  const getSeverityBadge = (sev: string) => {
    switch (sev) {
      case "critical":
        return (
          <span
            className="badge animate-pulse"
            style={{
              background: "rgba(239, 68, 68, 0.15)",
              color: "var(--error-color)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              fontWeight: 700,
            }}
          >
            CRITICAL SAFETY RECALL
          </span>
        );
      case "warning":
        return <span className="badge badge-orange">WARNING</span>;
      default:
        return <span className="badge badge-indigo">INFO</span>;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      {/* Notifications */}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="grid grid-cols-2" style={{ gridTemplateColumns: "1.2fr 0.8fr", gap: "2rem" }}>
        {/* Left Side: Recalls List */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Active Recalls Card */}
          <div className="card" style={{ border: activeRecalls.length > 0 ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid var(--border-color)" }}>
            <h3 style={{ fontSize: "1.2rem", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: activeRecalls.length > 0 ? "var(--error-color)" : "var(--text-muted)" }} />
              Active Recalls & Safety Notices
            </h3>

            {activeRecalls.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {activeRecalls.map((recall) => (
                  <div
                    key={recall.id}
                    style={{
                      padding: "1rem",
                      borderRadius: "8px",
                      background: recall.severity === "critical" ? "rgba(239, 68, 68, 0.02)" : "rgba(255, 255, 255, 0.01)",
                      border: recall.severity === "critical" ? "1px solid rgba(239, 68, 68, 0.15)" : "1px solid var(--border-color)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>{recall.title}</h4>
                        <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                          {recall.description}
                        </p>
                      </div>
                      {getSeverityBadge(recall.severity)}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255, 255, 255, 0.02)", paddingTop: "0.5rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      <span>Published: {new Date(recall.publishedAt).toLocaleDateString("en-US")}</span>
                      <div style={{ display: "flex", gap: "1rem" }}>
                        <button
                          style={{ background: "none", border: "none", color: "var(--accent-primary)", cursor: "pointer", fontWeight: 500 }}
                          onClick={() => handleEditClick(recall)}
                        >
                          Edit
                        </button>
                        <button
                          style={{ background: "none", border: "none", color: "var(--error-color)", cursor: "pointer", fontWeight: 500 }}
                          onClick={() => handleToggleActive(recall.id, recall.isActive)}
                        >
                          Deactivate Alert
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                No active safety recalls for this product.
              </div>
            )}
          </div>

          {/* Historical/Inactive Recalls Card */}
          <div className="card">
            <h3 style={{ fontSize: "1.2rem", marginBottom: "1.25rem", color: "var(--text-muted)" }}>Recall History (Archived)</h3>
            {inactiveRecalls.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {inactiveRecalls.map((recall) => (
                  <div
                    key={recall.id}
                    style={{
                      padding: "1rem",
                      borderRadius: "8px",
                      border: "1px solid var(--border-color)",
                      background: "rgba(255, 255, 255, 0.01)",
                      opacity: 0.6,
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 500 }}>{recall.title}</h4>
                      <span className="badge badge-gray" style={{ fontSize: "0.7rem" }}>Archived ({recall.severity})</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)" }}>{recall.description}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                      <span>Closed: {new Date(recall.publishedAt).toLocaleDateString("en-US")}</span>
                      <button
                        style={{ background: "none", border: "none", color: "var(--accent-primary)", cursor: "pointer" }}
                        onClick={() => handleToggleActive(recall.id, recall.isActive)}
                      >
                        Reactivate Notice
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                No archived recall alerts.
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Publish New Notice */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div className="card">
            <h3 style={{ fontSize: "1.2rem", marginBottom: "1.25rem" }}>
              {editingAlertId ? "Update Safety Notice" : "Publish Safety Notice"}
            </h3>
            <form onSubmit={handleSubmitRecall} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Notice Title</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Battery Module Overheating Hazard"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Notice Details & Instructions</label>
                <textarea
                  className="input-field"
                  placeholder="Provide explicit instructions for owners. If critical, explain how to request a free replacement battery module or contact service center."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ minHeight: "120px", resize: "vertical", fontFamily: "inherit" }}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Severity Level</label>
                <CustomSelect
                  value={severity}
                  onChange={(val) => setSeverity(val as any)}
                  options={[
                    { value: "info", label: "Info / Service Update" },
                    { value: "warning", label: "Warning / Recall (Non-Critical)" },
                    { value: "critical", label: "Critical Safety Recall (Stop Use)" }
                  ]}
                />
                <small className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>
                  Critical recall notices trigger immediate visual alert banners at the top of customer inventories and pin safety notifications in active chats.
                </small>
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                {editingAlertId && (
                  <button
                    type="button"
                    className="btn btn-secondary w-full"
                    onClick={handleCancelEdit}
                    disabled={publishing}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="submit"
                  className="btn btn-primary w-full"
                  disabled={publishing}
                  style={{
                    background: severity === "critical" ? "var(--error-color)" : "var(--accent-primary)",
                  }}
                >
                  {publishing ? "Saving..." : editingAlertId ? "Save Changes" : "Publish Safety Notice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
