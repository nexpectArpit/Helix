"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export interface RegisterResult {
  success: boolean;
  error?: string;
}

export async function registerUser(formData: FormData): Promise<RegisterResult> {
  try {
    const email = formData.get("email")?.toString().toLowerCase().trim();
    const password = formData.get("password")?.toString();
    const name = formData.get("name")?.toString().trim();
    const role = formData.get("role")?.toString(); // "USER" or "COMPANY_ADMIN"
    const companyName = formData.get("companyName")?.toString().trim();

    if (!email || !password || !name || !role) {
      return { success: false, error: "Please fill out all required fields." };
    }

    if (password.length < 6) {
      return { success: false, error: "Password must be at least 6 characters long." };
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return { success: false, error: "A user with this email already exists." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    if (role === "COMPANY_ADMIN") {
      if (!companyName) {
        return { success: false, error: "Company name is required for administrators." };
      }

      // Create company and user inside a transaction
      await db.$transaction(async (tx) => {
        const company = await tx.company.create({
          data: {
            name: companyName,
            description: `Support team for ${companyName}`
          }
        });

        await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            role: "COMPANY_ADMIN",
            companyId: company.id
          }
        });
      });
    } else {
      // Normal user registration
      await db.user.create({
        data: {
          email,
          password: hashedPassword,
          name,
          role: "USER"
        }
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("[REGISTER_ACTION_ERROR]", error);
    return { success: false, error: error.message || "An unexpected error occurred during registration." };
  }
}
