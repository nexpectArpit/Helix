"use client";

import React, { useState } from "react";
import { approveTask, rejectTask, createManualTask, updateTask } from "@/actions/maintenance";
import { useRouter } from "next/navigation";

interface MaintenanceTask {
  id: string;
  title: string;
  description: string | null;
  intervalMonths: number;
  sourceDocument: string | null;
  sourceExcerpt: string | null;
  isApproved: boolean;
  createdAt: Date;
}

interface MaintenanceManagerClientProps {
  productId: string;
  productName: string;
  tasks: MaintenanceTask[];
}

export default function MaintenanceManagerClient({ productId, tasks }: MaintenanceManagerClientProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // New task form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newInterval, setNewInterval] = useState(12);

  // Editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editInterval, setEditInterval] = useState(12);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const pendingTasks = tasks.filter((t) => !t.isApproved);
  const approvedTasks = tasks.filter((t) => t.isApproved);

  const handleApprove = async (taskId: string) => {
    setError(null);
    setSuccess(null);
    const res = await approveTask(taskId);
    if (res.success) {
      setSuccess("Maintenance task approved successfully.");
      router.refresh();
    } else {
      setError(res.error || "Failed to approve task.");
    }
  };

  const handleReject = (taskId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Reject and Delete Task",
      message: "Are you sure you want to reject and delete this task?",
      onConfirm: async () => {
        setConfirmModal(null);
        setError(null);
        setSuccess(null);
        const res = await rejectTask(taskId);
        if (res.success) {
          setSuccess("Task rejected and deleted.");
          router.refresh();
        } else {
          setError(res.error || "Failed to delete task.");
        }
      }
    });
  };

  const handleCreateManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newTitle.trim() || newInterval <= 0) {
      setError("Title and positive interval are required.");
      return;
    }

    const res = await createManualTask(productId, {
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      intervalMonths: newInterval,
    });

    if (res.success) {
      setSuccess("Maintenance task created successfully.");
      setNewTitle("");
      setNewDescription("");
      setNewInterval(12);
      router.refresh();
    } else {
      setError(res.error || "Failed to create task.");
    }
  };

  const handleStartEdit = (task: MaintenanceTask) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditDescription(task.description || "");
    setEditInterval(task.intervalMonths);
  };

  const handleSaveEdit = async (taskId: string) => {
    setError(null);
    setSuccess(null);

    if (!editTitle.trim() || editInterval <= 0) {
      setError("Title and positive interval are required.");
      return;
    }

    const res = await updateTask(taskId, {
      title: editTitle.trim(),
      description: editDescription.trim() || null,
      intervalMonths: editInterval,
    });

    if (res.success) {
      setSuccess("Task updated successfully.");
      setEditingTaskId(null);
      router.refresh();
    } else {
      setError(res.error || "Failed to update task.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      {/* Notifications */}
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="grid grid-cols-2" style={{ gridTemplateColumns: "1.8fr 1.2fr", gap: "2rem" }}>
        {/* Left Side: Tasks Lists */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
          
          {/* Pending Section */}
          <div className="card" style={{ border: pendingTasks.length > 0 ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span>Review Auto-extracted Tasks</span>
                {pendingTasks.length > 0 && (
                  <span className="badge badge-orange animate-pulse" style={{ fontSize: "0.75rem" }}>
                    {pendingTasks.length} Pending
                  </span>
                )}
              </h3>
            </div>

            {pendingTasks.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
                  These tasks were automatically identified from uploaded manuals. Please review and approve them before they are suggested to product owners.
                </p>
                
                {pendingTasks.map((task) => (
                  <div
                    key={task.id}
                    style={{
                      padding: "1rem",
                      borderRadius: "8px",
                      background: "rgba(245, 158, 11, 0.02)",
                      border: "1px solid rgba(245, 158, 11, 0.15)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{task.title}</h4>
                        {task.description && (
                          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                            {task.description}
                          </p>
                        )}
                      </div>
                      <span className="badge badge-gray" style={{ whiteSpace: "nowrap" }}>
                        Every {task.intervalMonths} mo
                      </span>
                    </div>

                    {task.sourceExcerpt && (
                      <div
                        style={{
                          fontSize: "0.8rem",
                          background: "rgba(0, 0, 0, 0.2)",
                          padding: "0.75rem",
                          borderRadius: "6px",
                          borderLeft: "2px solid var(--accent-primary)",
                          fontStyle: "italic",
                          color: "var(--text-secondary)",
                        }}
                      >
                        &ldquo;{task.sourceExcerpt}&rdquo;
                      </div>
                    )}

                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      Source: {task.sourceDocument || "Unknown File"}
                    </div>

                    <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.25rem" }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: "0.35rem 0.85rem", fontSize: "0.75rem" }}
                        onClick={() => handleApprove(task.id)}
                      >
                        Approve & Publish
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: "0.35rem 0.85rem", fontSize: "0.75rem" }}
                        onClick={() => handleReject(task.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                No pending tasks to review. When you upload manuals, any identified schedules will appear here.
              </div>
            )}
          </div>

          {/* Approved Section */}
          <div className="card">
            <h3 style={{ fontSize: "1.2rem", marginBottom: "1.25rem" }}>Approved & Active Tasks</h3>

            {approvedTasks.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {approvedTasks.map((task) => {
                  const isEditing = editingTaskId === task.id;

                  return (
                    <div
                      key={task.id}
                      style={{
                        padding: "1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border-color)",
                        background: "rgba(255, 255, 255, 0.01)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.75rem",
                      }}
                    >
                      {isEditing ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: "0.75rem" }}>Title</label>
                            <input
                              type="text"
                              className="input-field"
                              style={{ fontSize: "0.85rem", padding: "0.4rem" }}
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: "0.75rem" }}>Description</label>
                            <input
                              type="text"
                              className="input-field"
                              style={{ fontSize: "0.85rem", padding: "0.4rem" }}
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                            />
                          </div>
                          <div className="form-group" style={{ marginBottom: 0 }}>
                            <label className="form-label" style={{ fontSize: "0.75rem" }}>Interval (Months)</label>
                            <input
                              type="number"
                              className="input-field"
                              style={{ fontSize: "0.85rem", padding: "0.4rem" }}
                              value={editInterval}
                              onChange={(e) => setEditInterval(parseInt(e.target.value) || 12)}
                            />
                          </div>
                          <div style={{ display: "flex", gap: "0.5rem", alignSelf: "flex-end", marginTop: "0.25rem" }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem" }}
                              onClick={() => setEditingTaskId(null)}
                            >
                              Cancel
                            </button>
                            <button
                              className="btn btn-primary"
                              style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem" }}
                              onClick={() => handleSaveEdit(task.id)}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start" }}>
                            <div>
                              <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{task.title}</h4>
                              {task.description && (
                                <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                                  {task.description}
                                </p>
                              )}
                            </div>
                            <span className="badge badge-indigo" style={{ whiteSpace: "nowrap" }}>
                              Every {task.intervalMonths} mo
                            </span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255, 255, 255, 0.02)", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
                            <span>Source: {task.sourceDocument || "Manual Entry"}</span>
                            <div style={{ display: "flex", gap: "0.75rem" }}>
                              <button
                                style={{ background: "none", border: "none", color: "var(--accent-primary)", cursor: "pointer" }}
                                onClick={() => handleStartEdit(task)}
                              >
                                Edit
                              </button>
                              <button
                                style={{ background: "none", border: "none", color: "var(--error-color)", cursor: "pointer" }}
                                onClick={() => handleReject(task.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: "2.5rem", textAlign: "center", color: "var(--text-muted)", border: "1px dashed var(--border-color)", borderRadius: "8px" }}>
                No active maintenance schedules defined for this product. Add a task on the right to start.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Add Manual Task */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div className="card">
            <h3 style={{ fontSize: "1.2rem", marginBottom: "1.25rem" }}>Add Manual Task</h3>
            <form onSubmit={handleCreateManual} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Task Title</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. Replace air filter"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Instructions / Details (Optional)</label>
                <textarea
                  className="input-field"
                  placeholder="e.g. Open front panel, slide old filter out, insert new HEPA filter with arrows pointing up."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  style={{ minHeight: "100px", resize: "vertical", fontFamily: "inherit" }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Interval (Months)</label>
                <input
                  type="number"
                  className="input-field"
                  placeholder="12"
                  value={newInterval}
                  onChange={(e) => setNewInterval(parseInt(e.target.value) || 12)}
                  min="1"
                  required
                />
                <small className="text-muted" style={{ fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>
                  How often this task needs to be performed (e.g., 6 for twice a year, 12 for annually).
                </small>
              </div>

              <button type="submit" className="btn btn-primary w-full" style={{ marginTop: "0.5rem" }}>
                Create Maintenance Task
              </button>
            </form>
          </div>
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
              <button
                className="btn btn-secondary w-full"
                onClick={() => setConfirmModal(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary w-full"
                style={{
                  background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)"
                }}
                onClick={confirmModal.onConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
