"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteUpload } from "@/actions/uploads";

interface Upload {
  id: string;
  fileName: string;
  fileType: string;
  externalUrl: string | null;
  sizeBytes: number | null;
  indexed: boolean;
  createdAt: Date;
}

interface UploadManagerProps {
  productId: string;
  initialUploads: Upload[];
}

export default function UploadManager({ productId, initialUploads }: UploadManagerProps) {
  const router = useRouter();
  const [uploads, setUploads] = useState<Upload[]>(initialUploads);
  const [fileType, setFileType] = useState("PDF"); // PDF, TEXT, LINK
  const [file, setFile] = useState<File | null>(null);
  const [externalUrl, setExternalUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [isDeleting, startDeleteTransition] = useTransition();
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Update uploads when props change
  useEffect(() => {
    setUploads(initialUploads);
  }, [initialUploads]);

  // Polling for processing uploads
  useEffect(() => {
    const hasUnindexed = uploads.some((u) => !u.indexed);
    if (!hasUnindexed) return;

    const interval = setInterval(() => {
      router.refresh();
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [uploads, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("productId", productId);
      formData.append("fileType", fileType);

      if (fileType === "LINK") {
        if (!externalUrl) {
          setError("Please enter a valid URL.");
          setUploading(false);
          return;
        }
        formData.append("externalUrl", externalUrl);
      } else {
        if (!file) {
          setError("Please select a file to upload.");
          setUploading(false);
          return;
        }
        formData.append("file", file);
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload.");
      }

      setSuccess(`"${data.fileName}" registered successfully! It is now being indexed.`);
      setFile(null);
      setExternalUrl("");
      
      // Reset file input element
      const fileInput = document.getElementById("file-input-el") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred during upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (uploadId: string) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Support Resource",
      message: "Are you sure you want to delete this resource? It will be permanently removed from the AI search database.",
      onConfirm: () => {
        setConfirmModal(null);
        setError(null);
        setSuccess(null);

        startDeleteTransition(async () => {
          const result = await deleteUpload(uploadId);
          if (!result.success) {
            setError(result.error || "Failed to delete resource.");
          } else {
            setSuccess("Resource deleted successfully.");
            router.refresh();
          }
        });
      }
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Upload Box Form */}
      <div className="card">
        <h3 style={{ marginBottom: "1.25rem" }}>Upload Support Material</h3>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Resource Type</label>
            <div style={{ display: "flex", gap: "1rem" }}>
              {["PDF", "TEXT", "LINK"].map((type) => (
                <label
                  key={type}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                    fontSize: "0.9rem",
                    color: "var(--text-secondary)"
                  }}
                >
                  <input
                    type="radio"
                    name="upload-type"
                    value={type}
                    checked={fileType === type}
                    onChange={() => {
                      setFileType(type);
                      setError(null);
                      setSuccess(null);
                    }}
                    disabled={uploading}
                    style={{ accentColor: "var(--accent-primary)" }}
                  />
                  {type === "LINK" ? "External URL (Web Page)" : `${type} Document`}
                </label>
              ))}
            </div>
          </div>

          {fileType === "LINK" ? (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Reference Web URL</label>
              <input
                key="url-input"
                type="url"
                className="input-field"
                placeholder="https://example.com/scooter-manual"
                value={externalUrl || ""}
                onChange={(e) => setExternalUrl(e.target.value)}
                required
                disabled={uploading}
              />
            </div>
          ) : (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Select File</label>
              <input
                key="file-input"
                id="file-input-el"
                type="file"
                className="input-field"
                accept={fileType === "PDF" ? ".pdf" : ".txt"}
                onChange={handleFileChange}
                required
                disabled={uploading}
                style={{ padding: "0.5rem" }}
              />
              <span className="text-muted text-sm" style={{ display: "block", marginTop: "0.25rem" }}>
                Maximum size 10MB. Files are split into chunks and indexed vectorially.
              </span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              className={`btn btn-primary ${uploading ? "btn-disabled" : ""}`}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <div className="spinner" style={{ width: "1rem", height: "1rem", marginRight: "0.5rem" }}></div>
                  Uploading & Chunking...
                </>
              ) : (
                "Upload Resource"
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Uploaded Files Table list */}
      <div className="card">
        <h3 style={{ marginBottom: "1.25rem" }}>Uploaded Resources ({uploads.length})</h3>

        {uploads.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.875rem" }}>Resource Name</th>
                <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.875rem" }}>Type</th>
                <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.875rem" }}>Status</th>
                <th style={{ padding: "0.75rem 0.5rem", color: "var(--text-muted)", fontWeight: 500, fontSize: "0.875rem", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((up) => (
                <tr key={up.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ padding: "1rem 0.5rem" }}>
                    <span style={{ fontWeight: 500, color: "var(--text-primary)", display: "block" }}>{up.fileName}</span>
                    {up.externalUrl ? (
                      <a href={up.externalUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.75rem", color: "var(--text-muted)", wordBreak: "break-all" }}>
                        {up.externalUrl}
                      </a>
                    ) : (
                      up.sizeBytes && (
                        <span className="text-muted" style={{ fontSize: "0.75rem" }}>
                          {(up.sizeBytes / 1024).toFixed(1)} KB
                        </span>
                      )
                    )}
                  </td>
                  <td style={{ padding: "1rem 0.5rem" }}>
                    <span className="badge badge-gray">{up.fileType}</span>
                  </td>
                  <td style={{ padding: "1rem 0.5rem" }}>
                    {up.indexed ? (
                      <span className="badge badge-green">Indexed</span>
                    ) : (
                      <span className="badge badge-orange" style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                        <div className="spinner" style={{ width: "0.75rem", height: "0.75rem", borderWidth: "1px" }}></div>
                        Processing
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "1rem 0.5rem", textAlign: "right" }}>
                    <button
                      onClick={() => handleDelete(up.id)}
                      className={`btn btn-danger ${isDeleting ? "btn-disabled" : ""}`}
                      disabled={isDeleting}
                      style={{ padding: "0.3rem 0.75rem", fontSize: "0.75rem" }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.9rem" }}>
            No support documents or links have been added yet for this product.
          </div>
        )}
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
