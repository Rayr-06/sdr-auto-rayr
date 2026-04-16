import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "SDR Autopilot — AI-Powered Sales Pipeline",
  description: "5-stage AI SDR automation: Research → Profile → Signals → Generate → Send. Built by RAYR.",
  authors: [{ name: "Adithya Sharma", url: "https://github.com/Rayr-06" }],
  keywords: ["SDR", "sales automation", "AI outreach", "cold email", "B2B sales"],
  openGraph: {
    title: "SDR Autopilot",
    description: "AI-powered sales development — from ICP to inbox in 30 minutes",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased min-h-screen">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
