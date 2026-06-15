import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Email and password are required.");
          }

          const user = await db.user.findUnique({
            where: { email: credentials.email.toLowerCase().trim() },
            include: { company: true }
          });

          if (!user || !user.password) {
            throw new Error("No user found with this email.");
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          if (!isPasswordValid) {
            throw new Error("Incorrect password.");
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            companyId: user.companyId,
            companyName: user.company ? user.company.name : null
          };
        } catch (error: any) {
          console.error("[AUTH_AUTHORIZE_ERROR]", error);
          throw new Error(error.message || "Authentication failed.");
        }
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      try {
        if (user) {
          token.id = user.id;
          token.role = user.role;
          token.companyId = user.companyId;
          token.companyName = user.companyName;
        }
        return token;
      } catch (error) {
        console.error("[AUTH_JWT_CALLBACK_ERROR]", error);
        return token;
      }
    },
    async session({ session, token }) {
      try {
        if (token && session.user) {
          session.user.id = token.id;
          session.user.role = token.role;
          session.user.companyId = token.companyId;
          session.user.companyName = token.companyName;
        }
        return session;
      } catch (error) {
        console.error("[AUTH_SESSION_CALLBACK_ERROR]", error);
        return session;
      }
    }
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
export default authOptions;
