"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCompany } from "@/actions/products";

interface Company {
  id: string;
  name: string;
  description: string | null;
}

interface CompanyProfileFormProps {
  company: Company;
}

export default function CompanyProfileForm({ company }: CompanyProfileFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updateCompany(formData);
      if (!result.success) {
        setError(result.error || "Failed to update profile.");
      } else {
        setSuccess(true);
        router.refresh();
      }
    });
  };

  return (
    <div className="card">
      {error && (
        <div className="alert alert-error" style={{ marginBottom: "1.25rem" }}>
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success" style={{ marginBottom: "1.25rem" }}>
          Company profile updated successfully!
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Company Name</label>
          <input
            type="text"
            name="name"
            className="input-field"
            defaultValue={company.name}
            required
            disabled={isPending}
          />
        </div>

        <div className="form-group" style={{ marginBottom: "2rem" }}>
          <label className="form-label">Company Description</label>
          <textarea
            name="description"
            className="input-field"
            defaultValue={company.description || ""}
            rows={5}
            disabled={isPending}
            style={{ fontFamily: "inherit", resize: "vertical" }}
            placeholder="A short summary of what products this company provides support materials for..."
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button type="submit" className={`btn btn-primary ${isPending ? "btn-disabled" : ""}`} disabled={isPending}>
            {isPending ? (
              <>
                <div className="spinner" style={{ width: "1rem", height: "1rem", marginRight: "0.5rem" }}></div>
                Saving Profile...
              </>
            ) : (
              "Save Profile"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
