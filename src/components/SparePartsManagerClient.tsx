"use client";

import React, { useState, useTransition } from "react";
import { createSparePart, updateSparePart, deleteSparePart } from "@/actions/spare-parts";
import CustomSelect from "./CustomSelect";

interface SparePart {
  id: string;
  partName: string;
  partNumber: string | null;
  category: string | null;
  cost: number | null;
  description: string | null;
  sourceDocument: string | null;
}

interface SparePartsManagerClientProps {
  productId: string;
  spareParts: SparePart[];
}

export default function SparePartsManagerClient({
  productId,
  spareParts,
}: SparePartsManagerClientProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states for adding/editing
  const [editingPartId, setEditingPartId] = useState<string | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Field states
  const [partName, setPartName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [category, setCategory] = useState("general");
  const [cost, setCost] = useState("");
  const [description, setDescription] = useState("");

  const handleEditClick = (part: SparePart) => {
    setEditingPartId(part.id);
    setIsAddingNew(false);
    setPartName(part.partName);
    setPartNumber(part.partNumber || "");
    setCategory(part.category ? part.category.toLowerCase() : "general");
    setCost(part.cost !== null && part.cost !== undefined ? String(part.cost) : "");
    setDescription(part.description || "");
    setError(null);
    setSuccess(null);
  };

  const handleAddNewClick = () => {
    setIsAddingNew(true);
    setEditingPartId(null);
    setPartName("");
    setPartNumber("");
    setCategory("general");
    setCost("");
    setDescription("");
    setError(null);
    setSuccess(null);
  };

  const handleCancel = () => {
    setEditingPartId(null);
    setIsAddingNew(false);
    setPartName("");
    setPartNumber("");
    setCategory("general");
    setCost("");
    setDescription("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!partName.trim()) {
      setError("Part name is required.");
      return;
    }

    const parsedCost = cost.trim() === "" ? null : parseFloat(cost.trim());
    if (parsedCost !== null && isNaN(parsedCost)) {
      setError("Cost must be a valid number.");
      return;
    }

    startTransition(async () => {
      try {
        if (editingPartId) {
          const res = await updateSparePart(editingPartId, {
            partName: partName.trim(),
            partNumber: partNumber.trim() || null,
            category: category.trim().toLowerCase() || "general",
            cost: parsedCost,
            description: description.trim() || null,
          });

          if (res.success) {
            setSuccess("Spare part updated successfully.");
            handleCancel();
          } else {
            setError(res.error || "Failed to update spare part.");
          }
        } else {
          const res = await createSparePart(productId, {
            partName: partName.trim(),
            partNumber: partNumber.trim() || null,
            category: category.trim().toLowerCase() || "general",
            cost: parsedCost,
            description: description.trim() || null,
          });

          if (res.success) {
            setSuccess("Spare part added successfully.");
            handleCancel();
          } else {
            setError(res.error || "Failed to add spare part.");
          }
        }
      } catch (err) {
        setError("An unexpected error occurred.");
      }
    });
  };

  const handleDelete = (partId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Spare Part",
      message: "Are you sure you want to delete this spare part?",
      onConfirm: () => {
        setConfirmModal(null);
        setError(null);
        setSuccess(null);

        startTransition(async () => {
          try {
            const res = await deleteSparePart(partId);
            if (res.success) {
              setSuccess("Spare part deleted successfully.");
            } else {
              setError(res.error || "Failed to delete spare part.");
            }
          } catch (err) {
            setError("An unexpected error occurred.");
          }
        });
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* Trigger or Form Card */}
      {(isAddingNew || editingPartId) ? (
        <div className="card" style={{ border: "1px solid var(--accent-primary)" }}>
          <h3 style={{ fontSize: "1.1rem", marginBottom: "1.25rem" }}>
            {editingPartId ? "Edit Spare Part" : "Add New Spare Part"}
          </h3>
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Part Name</label>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Replacement Cooling Fan"
                value={partName}
                onChange={(e) => setPartName(e.target.value)}
                required
                disabled={isPending}
              />
            </div>

            <div className="grid grid-cols-3" style={{ gap: "1rem" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Part Number (OEM)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="e.g. FAN-120MM"
                  value={partNumber}
                  onChange={(e) => setPartNumber(e.target.value)}
                  disabled={isPending}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Category</label>
                <CustomSelect
                  value={category}
                  onChange={(val) => setCategory(val)}
                  disabled={isPending}
                  options={[
                    { value: "general", label: "General" },
                    { value: "cooling", label: "Cooling" },
                    { value: "power", label: "Power" },
                    { value: "filter", label: "Filter" },
                    { value: "belt", label: "Belt" },
                    { value: "battery", label: "Battery" },
                    { value: "mounting", label: "Mounting" },
                  ]}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Cost ($)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="input-field"
                  placeholder="e.g. 15.00"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Description & Notes</label>
              <textarea
                className="input-field"
                placeholder="Details about dimensions, voltage, or install notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ minHeight: "80px", resize: "vertical", fontFamily: "inherit" }}
                disabled={isPending}
              />
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary w-full"
                onClick={handleCancel}
                disabled={isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={isPending}
              >
                {isPending ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button className="btn btn-primary" onClick={handleAddNewClick}>
            + Add Spare Part
          </button>
        </div>
      )}

      {/* Spare Parts List Display */}
      {spareParts.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {spareParts.map((part) => (
            <div
              key={part.id}
              style={{
                padding: "1rem",
                borderRadius: "8px",
                background: "rgba(255, 255, 255, 0.01)",
                border: "1px solid var(--border-color)",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem" }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{part.partName}</h4>
                  <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    Category: <span style={{ textTransform: "capitalize" }}>{part.category || "general"}</span> | Source: {part.sourceDocument || "Manual"}
                  </p>
                  {part.description && (
                    <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.825rem", color: "var(--text-muted)", lineHeight: "1.4" }}>
                      {part.description}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
                  {part.partNumber && (
                    <span className="badge badge-indigo" style={{ fontSize: "0.75rem" }}>
                      {part.partNumber}
                    </span>
                  )}
                  {part.cost !== null && part.cost !== undefined && (
                    <span className="badge badge-green" style={{ fontSize: "0.75rem" }}>
                      ${part.cost.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>

              {/* Inline actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "1.25rem", borderTop: "1px solid rgba(255,255,255,0.02)", paddingTop: "0.5rem", marginTop: "0.25rem" }}>
                <button
                  style={{ background: "none", border: "none", color: "var(--accent-primary)", cursor: "pointer", fontSize: "0.785rem", fontWeight: 500, outline: "none" }}
                  onClick={() => handleEditClick(part)}
                  disabled={isPending}
                >
                  Edit
                </button>
                <button
                  style={{ background: "none", border: "none", color: "var(--error-color)", cursor: "pointer", fontSize: "0.785rem", fontWeight: 500, outline: "none" }}
                  onClick={() => handleDelete(part.id)}
                  disabled={isPending}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem", border: "1px dashed var(--border-color)", borderRadius: "6px" }}>
          No spare parts extracted yet. Upload a technical document containing a parts list or click '+ Add Spare Part' to create one manually.
        </div>
      )}
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
