"use client";

import React, { useState } from "react";
import Link from "next/link";
import AddProductModal from "@/components/AddProductModal";

interface RecallAlert {
  id: string;
  title: string;
  description: string;
  severity: string;
  isActive: boolean;
}

interface MaintenanceTask {
  id: string;
  title: string;
  intervalMonths: number;
}

interface MaintenanceLog {
  id: string;
  maintenanceTaskId: string;
  completedAt: Date;
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
  maintenanceTasks: MaintenanceTask[];
}

interface OwnedProduct {
  id: string;
  purchaseDate: string | null;
  serialNumber: string | null;
  warrantyExpiry: string | null;
  product: Product;
  maintenanceLogs: MaintenanceLog[];
}

interface MyProductsClientProps {
  initialProducts: OwnedProduct[];
}

export default function MyProductsClient({ initialProducts }: MyProductsClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter owned products based on search
  const filteredProducts = initialProducts.filter((op) => {
    const term = searchQuery.toLowerCase();
    return (
      op.product.name.toLowerCase().includes(term) ||
      op.product.company.name.toLowerCase().includes(term) ||
      op.product.category.toLowerCase().includes(term) ||
      (op.serialNumber && op.serialNumber.toLowerCase().includes(term))
    );
  });

  // Calculate overdue tasks and warranty status for each owned product
  const getProductStats = (op: OwnedProduct) => {
    const now = new Date();
    let overdueCount = 0;
    const purchaseDate = op.purchaseDate ? new Date(op.purchaseDate) : null;

    // Check each approved task
    op.product.maintenanceTasks.forEach((task) => {
      // Find last completion log
      const logs = op.maintenanceLogs.filter((log) => log.maintenanceTaskId === task.id);
      let nextDueDate: Date | null = null;

      if (logs.length > 0) {
        // Sort logs desc
        const sortedLogs = [...logs].sort(
          (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
        );
        nextDueDate = new Date(sortedLogs[0].completedAt);
        nextDueDate.setMonth(nextDueDate.getMonth() + task.intervalMonths);
      } else if (purchaseDate) {
        nextDueDate = new Date(purchaseDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + task.intervalMonths);
      }

      if (nextDueDate && nextDueDate < now) {
        overdueCount++;
      }
    });

    // Warranty calculation
    let warrantyStatus: "active" | "expiring_soon" | "expired" | "not_set" = "not_set";
    let warrantyDaysLeft: number | null = null;

    if (op.warrantyExpiry) {
      const expiry = new Date(op.warrantyExpiry);
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

    // Recalls
    const activeRecalls = op.product.recallAlerts.filter((r) => r.isActive);

    return {
      overdueCount,
      warrantyStatus,
      warrantyDaysLeft,
      activeRecalls,
    };
  };

  // Find all active critical recalls across all products
  const criticalRecalls = initialProducts.flatMap((op) => {
    const stats = getProductStats(op);
    return stats.activeRecalls
      .filter((r) => r.severity === "critical")
      .map((r) => ({ ...r, productName: op.product.name }));
  });

  const getWarrantyBadge = (status: string, days: number | null) => {
    switch (status) {
      case "active":
        return (
          <span className="badge badge-green" style={{ fontSize: "0.75rem" }}>
            Warranty Active {days !== null ? `(${days}d left)` : ""}
          </span>
        );
      case "expiring_soon":
        return (
          <span className="badge badge-orange" style={{ fontSize: "0.75rem" }}>
            Warranty Expiring Soon ({days}d left)
          </span>
        );
      case "expired":
        return (
          <span
            className="badge"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              color: "var(--error-color)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              fontSize: "0.75rem",
            }}
          >
            Warranty Expired
          </span>
        );
      default:
        return (
          <span className="badge badge-gray" style={{ fontSize: "0.75rem" }}>
            No Warranty Details
          </span>
        );
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
      {/* Header section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div>
          <h1 style={{ marginBottom: "0.25rem" }}>My Products Inventory</h1>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>
            Manage the products you own, track maintenance, and monitor recall alerts.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Product
        </button>
      </div>

      {/* Critical Recalls Alert Banner */}
      {criticalRecalls.length > 0 && (
        <div
          className="alert"
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            color: "#ff8b8b",
            borderColor: "rgba(239, 68, 68, 0.25)",
            padding: "1.25rem",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontWeight: 700, fontSize: "1.05rem" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--error-color)" }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            CRITICAL SAFETY RECALL ALERTS
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.9rem" }}>
            {criticalRecalls.map((recall) => (
              <div key={recall.id} style={{ display: "flex", flexDirection: "column", borderLeft: "2px solid var(--error-color)", paddingLeft: "0.75rem" }}>
                <span style={{ fontWeight: 600 }}>{recall.productName} &bull; {recall.title}</span>
                <span style={{ opacity: 0.85 }}>{recall.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div style={{ position: "relative" }}>
        <input
          type="text"
          className="input-field"
          placeholder="Filter owned products by name, company, category, or serial number..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            paddingLeft: "2.75rem",
            height: "46px",
            borderRadius: "8px",
          }}
        />
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            position: "absolute",
            left: "1rem",
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
          }}
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      {/* Grid of Owned Products */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-3">
          {filteredProducts.map((op) => {
            const { overdueCount, warrantyStatus, warrantyDaysLeft, activeRecalls } = getProductStats(op);
            const hasImage = !!op.product.image;

            return (
              <div key={op.id} className="card card-hover flex flex-col" style={{ height: "100%", minHeight: "380px" }}>
                {/* Product Image */}
                {hasImage ? (
                  <div
                    style={{
                      height: "150px",
                      borderRadius: "8px",
                      backgroundImage: `url(${op.product.image})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      marginBottom: "1rem",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: "150px",
                      borderRadius: "8px",
                      background: "linear-gradient(135deg, rgba(95, 92, 230, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
                      border: "1px solid var(--border-color)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: "1rem",
                    }}
                  >
                    <svg
                      width="36"
                      height="36"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      style={{ color: "var(--text-muted)", opacity: 0.6 }}
                    >
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    </svg>
                  </div>
                )}

                {/* Details */}
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "0.75rem" }}>
                  <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--accent-primary)", fontWeight: 700 }}>
                    {op.product.company.name}
                  </div>
                  <h3 style={{ fontSize: "1.15rem", fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {op.product.name}
                  </h3>
                </div>

                {/* Badges row */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
                  {getWarrantyBadge(warrantyStatus, warrantyDaysLeft)}
                  {activeRecalls.length > 0 && (
                    <span
                      className="badge"
                      style={{
                        background: "rgba(239, 68, 68, 0.15)",
                        color: "var(--error-color)",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        fontSize: "0.75rem",
                      }}
                    >
                      {activeRecalls.length} Active Recall{activeRecalls.length > 1 ? "s" : ""}
                    </span>
                  )}
                  {overdueCount > 0 && (
                    <span
                      className="badge animate-pulse"
                      style={{
                        background: "rgba(245, 158, 11, 0.15)",
                        color: "var(--warning-color)",
                        border: "1px solid rgba(245, 158, 11, 0.3)",
                        fontSize: "0.75rem",
                      }}
                    >
                      {overdueCount} Overdue Task{overdueCount > 1 ? "s" : ""}
                    </span>
                  )}
                </div>

                {/* Serial Number & Info */}
                {op.serialNumber && (
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                    <span style={{ fontWeight: 500 }}>S/N:</span> {op.serialNumber}
                  </div>
                )}

                {/* Actions */}
                <div style={{ marginTop: "auto", display: "flex", gap: "0.75rem" }}>
                  <Link href={`/my-products/${op.id}`} className="btn btn-secondary" style={{ flexGrow: 1, fontSize: "0.85rem", padding: "0.5rem" }}>
                    Details & Schedule
                  </Link>
                  <Link
                    href={`/products/${op.product.id}?session=new`}
                    className="btn btn-primary"
                    style={{
                      fontSize: "0.85rem",
                      padding: "0.5rem 0.75rem",
                      background: "linear-gradient(135deg, #7c3aed 0%, #5f5ce6 100%)",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    Diagnose
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="card text-center"
          style={{
            padding: "4rem 2rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(18, 18, 24, 0.4)",
          }}
        >
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}
          >
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          <h3 style={{ marginBottom: "0.5rem" }}>Your Inventory is Empty</h3>
          <p style={{ maxWidth: "450px", fontSize: "0.95rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
            Add products you own to track their warranties, receive auto-extracted maintenance schedules, and get safety recall notices.
          </p>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            Add Your First Product
          </button>
        </div>
      )}

      {/* Add Product Modal */}
      <AddProductModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
