import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gitdocify — AI-Powered Code Intelligence",
  description:
    "Ingest GitHub repositories and get deep architectural insights powered by Google Gemini. BYOK SaaS for semantic code search, auto-documentation, and an interactive AI tutor.",
  keywords: ["code intelligence", "GitHub", "Gemini", "RAG", "documentation", "semantic search"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
