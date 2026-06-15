"use client";

import React from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

export default function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const isActive = (path: string) => pathname === path;

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <Link href="/" className="navbar-logo" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <img
            src="/logo.png"
            alt="Helix Logo"
            style={{ width: "24px", height: "24px", objectFit: "contain" }}
          />
          <span style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>Helix</span>
        </Link>

        <ul className="navbar-links">
          {status === "authenticated" && session?.user?.role === "COMPANY_ADMIN" ? (
            // Admins manage products via the Dashboard, no browse links
            null
          ) : (
            <li>
              <Link
                href="/companies"
                className={`navbar-link ${isActive("/companies") || pathname?.startsWith("/companies") ? "active" : ""}`}
              >
                Browse Companies
              </Link>
            </li>
          )}

          {status === "authenticated" && session?.user?.role === "USER" && (
            <>
              <li>
                <Link
                  href="/my-products"
                  className={`navbar-link ${isActive("/my-products") ? "active" : ""}`}
                >
                  My Products
                </Link>
              </li>
              <li>
                <Link
                  href="/tickets"
                  className={`navbar-link ${isActive("/tickets") ? "active" : ""}`}
                >
                  My Tickets
                </Link>
              </li>
            </>
          )}

          {status === "authenticated" && session?.user ? (
            <>
              {session.user.role === "COMPANY_ADMIN" ? (
                <>
                  <li>
                    <Link
                      href="/dashboard"
                      className={`navbar-link ${isActive("/dashboard") ? "active" : ""}`}
                    >
                      Dashboard
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dashboard/company"
                      className={`navbar-link ${isActive("/dashboard/company") ? "active" : ""}`}
                    >
                      {session.user.companyName || "My Company"}
                    </Link>
                  </li>
                </>
              ) : null}

              <li style={{ marginLeft: "1rem" }}>
                <span className="text-muted text-sm" style={{ marginRight: "0.5rem" }}>
                  {session.user.name} ({session.user.role === "COMPANY_ADMIN" ? "Admin" : "User"})
                </span>
                <button
                  onClick={handleSignOut}
                  className="btn btn-secondary"
                  style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}
                >
                  Sign Out
                </button>
              </li>
            </>
          ) : (
            status !== "loading" && (
              <>
                <li>
                  <Link
                    href="/login"
                    className={`navbar-link ${isActive("/login") ? "active" : ""}`}
                  >
                    Sign In
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="btn btn-primary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.75rem" }}>
                    Sign Up
                  </Link>
                </li>
              </>
            )
          )}
        </ul>
      </div>
    </nav>
  );
}
