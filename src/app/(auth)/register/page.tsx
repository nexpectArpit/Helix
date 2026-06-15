"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registerUser } from "@/actions/auth";
import CustomSelect from "@/components/CustomSelect";

export default function RegisterPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [role, setRole] = useState("USER"); // USER or COMPANY_ADMIN
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password")?.toString();
    const confirmPassword = formData.get("confirmPassword")?.toString();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result = await registerUser(formData);
      if (!result.success) {
        setError(result.error || "Failed to register.");
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 2000);
      }
    });
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
      <div className="card" style={{ width: "100%", maxWidth: "450px" }}>
        <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Create Account</h2>
        <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
          Get started by setting up your support profile
        </p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success" style={{ marginBottom: "1rem" }}>
            Registration successful! Redirecting to login...
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              name="name"
              className="input-field"
              placeholder="John Doe"
              required
              disabled={isPending}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              name="email"
              className="input-field"
              placeholder="john@example.com"
              required
              disabled={isPending}
            />
          </div>

          <div className="form-group">
            <label className="form-label">I want to register as a:</label>
            <CustomSelect
              name="role"
              value={role}
              onChange={(val) => setRole(val)}
              disabled={isPending}
              options={[
                { value: "USER", label: "User (Diagnose products)" },
                { value: "COMPANY_ADMIN", label: "Company Administrator (Manage support material)" }
              ]}
            />
          </div>

          {role === "COMPANY_ADMIN" && (
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input
                type="text"
                name="companyName"
                className="input-field"
                placeholder="Acme Corp"
                required
                disabled={isPending}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              name="password"
              className="input-field"
              placeholder="••••••••"
              required
              disabled={isPending}
            />
          </div>

          <div className="form-group" style={{ marginBottom: "1.5rem" }}>
            <label className="form-label">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              className="input-field"
              placeholder="••••••••"
              required
              disabled={isPending}
            />
          </div>

          <button
            type="submit"
            className={`btn btn-primary w-full ${isPending ? "btn-disabled" : ""}`}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <div className="spinner" style={{ width: "1rem", height: "1rem", marginRight: "0.5rem" }}></div>
                Creating Account...
              </>
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "1rem" }}>
          Already have an account?{" "}
          <Link href="/login" style={{ color: "var(--accent-primary)", fontWeight: 500 }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
