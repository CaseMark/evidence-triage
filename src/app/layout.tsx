import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Evidence Triage Tool",
  description: "Bulk upload evidence, auto-categorize by type, OCR handwritten notes, tag and search for litigation teams",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
}
