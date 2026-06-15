"use client";

import React, { useState } from "react";
import Link from "next/link";
import { updateProductOwnership, completeMaintenanceTask, getMaintenanceSchedule } from "@/actions/my-products";
import { useRouter } from "next/navigation";

interface RecallAlert {
  id: string;
  title: string;
  description: string;
  severity: string;
  isActive: boolean;
  publishedAt: string;
}

interface MaintenanceLog {
  id: string;
  completedAt: string;
  notes: string | null;
  maintenanceTask: {
    title: string;
  };
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
  recallAlerts: RecallAlert[];
}

interface OwnedProduct {
  id: string;
  productId: string;
  purchaseDate: string | null;
  serialNumber: string | null;
  warrantyExpiry: string | null;
  notes: string | null;
  product: Product;
  maintenanceLogs: MaintenanceLog[];
}

interface ComputedScheduleItem {
  taskId: string;
  title: string;
  description: string | null;
  intervalMonths: number;
  sourceDocument: string | null;
  lastCompletedAt: string | null;
  completionCount: number;
  nextDueDate: string | null;
  daysUntilDue: number | null;
  isOverdue: boolean;
  needsPurchaseDate: boolean;
}

interface ProductDetailsClientProps {
  ownedProduct: OwnedProduct;
  initialSchedule: ComputedScheduleItem[];
}

export default function ProductDetailsClient({ ownedProduct, initialSchedule }: ProductDetailsClientProps) {
  const router = useRouter();

  // Mode states
  const [isEditing, setIsEditing] = useState(false);
  const [schedule, setSchedule] = useState<ComputedScheduleItem[]>(initialSchedule);

  // Edit fields
  const [purchaseDate, setPurchaseDate] = useState(ownedProduct.purchaseDate ? ownedProduct.purchaseDate.split("T")[0] : "");
  const [serialNumber, setSerialNumber] = useState(ownedProduct.serialNumber || "");
  const [notes, setNotes] = useState(ownedProduct.notes || "");

  // Completion note state
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpdateDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const res = await updateProductOwnership(ownedProduct.id, {
      purchaseDate: purchaseDate || null,
      serialNumber: serialNumber || null,
      notes: notes || null,
    });

    if (res.success) {
      setSuccess("Product details updated successfully.");
      setIsEditing(false);
      
      // Refresh schedule data
      const schedRes = await getMaintenanceSchedule(ownedProduct.id);
      if (schedRes.success && schedRes.data) {
        setSchedule(schedRes.data);
      }
      
      router.refresh();
    } else {
      setError(res.error || "Failed to update details.");
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    setError(null);
    setSuccess(null);

    const res = await completeMaintenanceTask(ownedProduct.id, taskId, completionNote);

    if (res.success) {
      setSuccess("Task marked as completed.");
      setCompletingTaskId(null);
      setCompletionNote("");

      // Refresh schedule data
      const schedRes = await getMaintenanceSchedule(ownedProduct.id);
      if (schedRes.success && schedRes.data) {
        setSchedule(schedRes.data);
      }

      router.refresh();
    } else {
      setError(res.error || "Failed to log completion.");
    }
  };

  const now = new Date();
  let warrantyDaysLeft: number | null = null;
  let warrantyStatus: "active" | "expiring_soon" | "expired" | "not_set" = "not_set";

  if (ownedProduct.warrantyExpiry) {
    const expiry = new Date(ownedProduct.warrantyExpiry);
    const diffMs = expiry.getTime() - now.getTime();
    warrantyDaysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    if (warrantyDaysLeft < 0) {
      warrantyStatus = "expired";
    } else if (warrantyDaysLeft <= 30) {
      warrantyStatus = "expiring_soon";
    } else {
      warrantyStatus = "active";
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Back button and breadcrumb */}
      <div>
        <Link href="/my-products" className="text-muted text-sm flex align-center gap-1 hover:text-white" style={{ display: "inline-flex" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back to Inventory
        </Link>
      </div>

      {/* Main product header card */}
      <div className="card" style={{ display: "flex", gap: "2rem", flexWrap: "wrap", alignItems: "center" }}>
        {ownedProduct.product.image ? (
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "12px",
              backgroundImage: `url(${ownedProduct.product.image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: "120px",
              height: "120px",
              borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(95, 92, 230, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              border: "1px solid var(--border-color)",
            }}
          >
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            </svg>
          </div>
        )}

        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-primary)", fontWeight: 700 }}>
            {ownedProduct.product.company.name}
          </div>
          <h1 style={{ fontSize: "2rem", margin: "0.25rem 0", fontWeight: 600 }}>{ownedProduct.product.name}</h1>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.5rem" }}>
            <span className="badge badge-indigo">{ownedProduct.product.category}</span>
            {warrantyStatus === "active" && (
              <span className="badge badge-green">Warranty Active ({warrantyDaysLeft} days left)</span>
            )}
            {warrantyStatus === "expiring_soon" && (
              <span className="badge badge-orange">Warranty Expiring ({warrantyDaysLeft} days left)</span>
            )}
            {warrantyStatus === "expired" && (
              <span className="badge" style={{ background: "rgba(239, 68, 68, 0.1)", color: "var(--error-color)", border: "1px solid rgba(239, 68, 68, 0.2)" }}>
                Warranty Expired
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "1rem", flexShrink: 0 }}>
          <Link
            href={`/products/${ownedProduct.product.id}?session=new`}
            className="btn btn-primary"
            style={{
              background: "linear-gradient(135deg, #7c3aed 0%, #5f5ce6 100%)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Start Troubleshooting
          </Link>
        </div>
      </div>

      {/* Notifications */}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Grid: Details & Active Recalls */}
      <div className="grid grid-cols-3" style={{ gridTemplateColumns: "1fr 2fr", gap: "2rem" }}>
        {/* Left Column: Details & Edit Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem" }}>Ownership Details</h3>
              {!isEditing && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem" }}
                  onClick={() => setIsEditing(true)}
                >
                  Edit Details
                </button>
              )}
            </div>

            {isEditing ? (
              <form onSubmit={handleUpdateDetails} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.8rem" }}>Purchase Date</label>
                  <input
                    type="date"
                    className="input-field"
                    style={{ fontSize: "0.85rem", padding: "0.5rem" }}
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.8rem" }}>Serial Number</label>
                  <input
                    type="text"
                    className="input-field"
                    style={{ fontSize: "0.85rem", padding: "0.5rem" }}
                    placeholder="S/N"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: "0.8rem" }}>Notes / Specifics</label>
                  <textarea
                    className="input-field"
                    style={{ fontSize: "0.85rem", padding: "0.5rem", minHeight: "60px", resize: "vertical", fontFamily: "inherit" }}
                    placeholder="Room location, invoice num..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    className="btn btn-secondary w-full"
                    style={{ padding: "0.4rem", fontSize: "0.8rem" }}
                    onClick={() => {
                      setIsEditing(false);
                      // Reset values
                      setPurchaseDate(ownedProduct.purchaseDate ? ownedProduct.purchaseDate.split("T")[0] : "");
                      setSerialNumber(ownedProduct.serialNumber || "");
                      setNotes(ownedProduct.notes || "");
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary w-full"
                    style={{ padding: "0.4rem", fontSize: "0.8rem" }}
                  >
                    Save
                  </button>
                </div>
              </form>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", fontSize: "0.9rem" }}>
                <div>
                  <span className="text-muted" style={{ display: "block", fontSize: "0.8rem" }}>Purchase Date</span>
                  <span style={{ fontWeight: 500 }}>
                    {ownedProduct.purchaseDate ? new Date(ownedProduct.purchaseDate).toLocaleDateString("en-US", { dateStyle: "medium" }) : "Not Set"}
                  </span>
                </div>
                <div>
                  <span className="text-muted" style={{ display: "block", fontSize: "0.8rem" }}>Serial Number</span>
                  <span style={{ fontWeight: 500, fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                    {ownedProduct.serialNumber || "Not Set"}
                  </span>
                </div>
                <div>
                  <span className="text-muted" style={{ display: "block", fontSize: "0.8rem" }}>Warranty Expiration</span>
                  <span style={{ fontWeight: 500 }}>
                    {ownedProduct.warrantyExpiry ? new Date(ownedProduct.warrantyExpiry).toLocaleDateString("en-US", { dateStyle: "medium" }) : "Not Set"}
                  </span>
                </div>
                {ownedProduct.notes && (
                  <div>
                    <span className="text-muted" style={{ display: "block", fontSize: "0.8rem" }}>Ownership Notes</span>
                    <p style={{ margin: 0, fontSize: "0.85rem", opacity: 0.9, whiteSpace: "pre-wrap" }}>{ownedProduct.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Recall Notifications */}
          {ownedProduct.product.recallAlerts.filter(r => r.isActive).length > 0 && (
            <div className="card" style={{ border: "1px solid rgba(239, 68, 68, 0.2)", background: "rgba(239, 68, 68, 0.03)" }}>
              <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "#ff8b8b", marginBottom: "1rem" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--error-color)" }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                </svg>
                Safety Recalls
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {ownedProduct.product.recallAlerts
                  .filter((r) => r.isActive)
                  .map((recall) => (
                    <div key={recall.id} style={{ display: "flex", flexDirection: "column", gap: "0.25rem", borderLeft: "2px solid var(--error-color)", paddingLeft: "0.75rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>{recall.title}</span>
                      <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-secondary)" }}>{recall.description}</p>
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                        Published: {new Date(recall.publishedAt).toLocaleDateString("en-US")}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Maintenance timeline and Logs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          {/* Timeline */}
          <div className="card">
            <h3 style={{ fontSize: "1.25rem", marginBottom: "1.25rem" }}>Maintenance Schedule & Tasks</h3>
            
            {schedule.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {schedule.map((item) => {
                  const isCompleting = completingTaskId === item.taskId;

                  return (
                    <div
                      key={item.taskId}
                      style={{
                        padding: "1rem",
                        borderRadius: "8px",
                        border: item.isOverdue
                          ? "1px solid rgba(245, 158, 11, 0.25)"
                          : "1px solid var(--border-color)",
                        background: item.isOverdue
                          ? "rgba(245, 158, 11, 0.02)"
                          : "rgba(255, 255, 255, 0.01)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}
                    >
                      {/* Top Info */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>{item.title}</h4>
                          {item.description && (
                            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                              {item.description}
                            </p>
                          )}
                        </div>

                        {item.needsPurchaseDate ? (
                          <span className="badge badge-gray" style={{ whiteSpace: "nowrap" }}>
                            Needs Purchase Date
                          </span>
                        ) : item.isOverdue ? (
                          <span className="badge badge-orange animate-pulse" style={{ whiteSpace: "nowrap" }}>
                            Overdue {item.daysUntilDue !== null ? `(${Math.abs(item.daysUntilDue)} days)` : ""}
                          </span>
                        ) : item.daysUntilDue !== null ? (
                          <span className="badge badge-green" style={{ whiteSpace: "nowrap" }}>
                            Due in {item.daysUntilDue} days
                          </span>
                        ) : null}
                      </div>

                      {/* Meta information */}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        <span>Interval: every {item.intervalMonths} month{item.intervalMonths > 1 ? "s" : ""}</span>
                        {item.lastCompletedAt && (
                          <span>
                            Last Done: {new Date(item.lastCompletedAt).toLocaleDateString("en-US")} ({item.completionCount}x)
                          </span>
                        )}
                        {item.nextDueDate && (
                          <span>Next Due: {new Date(item.nextDueDate).toLocaleDateString("en-US")}</span>
                        )}
                        {item.sourceDocument && (
                          <span style={{ fontStyle: "italic" }}>Source: {item.sourceDocument}</span>
                        )}
                      </div>

                      {/* Log Action */}
                      {isCompleting ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border-color)" }}>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Add optional notes (e.g. replaced with OEM filters, checked seals)..."
                            value={completionNote}
                            onChange={(e) => setCompletionNote(e.target.value)}
                            style={{ fontSize: "0.85rem", padding: "0.5rem" }}
                          />
                          <div style={{ display: "flex", gap: "0.5rem", alignSelf: "flex-end" }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                              onClick={() => {
                                setCompletingTaskId(null);
                                setCompletionNote("");
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn btn-primary"
                              style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                              onClick={() => handleCompleteTask(item.taskId)}
                            >
                              Confirm Done
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          className="btn btn-secondary"
                          style={{
                            alignSelf: "flex-start",
                            padding: "0.35rem 0.75rem",
                            fontSize: "0.75rem",
                            marginTop: "0.25rem",
                            background: item.isOverdue ? "rgba(95, 92, 230, 0.1)" : "rgba(255,255,255,0.03)",
                            borderColor: item.isOverdue ? "rgba(95, 92, 230, 0.2)" : "var(--border-color)",
                          }}
                          onClick={() => setCompletingTaskId(item.taskId)}
                        >
                          Mark as Completed
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: "2.5rem", color: "var(--text-muted)", border: "1px dashed var(--border-color)", borderRadius: "8px", textAlign: "center" }}>
                No active maintenance schedule for this product. Upload product manuals to auto-extract schedules.
              </div>
            )}
          </div>

          {/* Log History */}
          <div className="card">
            <h3 style={{ fontSize: "1.25rem", marginBottom: "1.25rem" }}>Maintenance History Log</h3>
            {ownedProduct.maintenanceLogs.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {ownedProduct.maintenanceLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "6px",
                      background: "rgba(255, 255, 255, 0.02)",
                      borderLeft: "3px solid var(--success-color)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.25rem" }}>
                      <span>{log.maintenanceTask.title}</span>
                      <span className="text-muted" style={{ fontWeight: 400, fontSize: "0.8rem" }}>
                        {new Date(log.completedAt).toLocaleDateString("en-US")}
                      </span>
                    </div>
                    {log.notes && (
                      <p style={{ margin: "0.25rem 0 0 0", color: "var(--text-secondary)", fontSize: "0.8rem", opacity: 0.9 }}>
                        Notes: {log.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2rem", color: "var(--text-muted)", textAlign: "center" }}>
                No maintenance tasks have been completed and logged yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
