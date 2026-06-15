import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import SessionProvider from "@/components/SessionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Helix | Intelligent Product Support Platform",
  description: "Investigate and diagnose product issues using an advanced AI diagnostic assistant powered by Helix.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <SessionProvider>
          <div className="app-container">
            <div className="glow-effect" style={{ top: '10%', left: '5%' }}></div>
            <div className="glow-effect" style={{ bottom: '10%', right: '5%' }}></div>
            <Navbar />
            <main className="main-content">
              {children}
            </main>
          </div>
        </SessionProvider>
      </body>
    </html>
  );
}
