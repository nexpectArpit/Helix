"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(searchParams.get("error") ? "Authentication failed. Please check your credentials." : null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
      });

      if (result?.error) {
        setError("Invalid email or password.");
        setLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "70vh" }}>
      <div className="card" style={{ width: "100%", maxWidth: "420px" }}>
        <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Welcome Back</h2>
        <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "1.5rem" }}>
          Sign in to access your diagnostics and products
        </p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="input-field"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="form-group" style={{ marginBottom: "1.5rem" }}>
            <label className="form-label">Password</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className={`btn btn-primary w-full ${loading ? "btn-disabled" : ""}`}
            disabled={loading}
            style={{ marginBottom: "1rem" }}
          >
            {loading ? (
              <>
                <div className="spinner" style={{ width: "1rem", height: "1rem", marginRight: "0.5rem" }}></div>
                Signing in...
              </>
            ) : (
              "Sign In"
            )}
          </button>
        </form>

        <p style={{ textAlign: "center", fontSize: "0.875rem", color: "var(--text-muted)", marginTop: "1rem" }}>
          Don't have an account?{" "}
          <Link href="/register" style={{ color: "var(--accent-primary)", fontWeight: 500 }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
