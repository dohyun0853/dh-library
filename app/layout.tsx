import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DH Library",
  description: "A private library for course notes, summaries, and exam materials.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "DH Library", statusBarStyle: "default" },
  icons: {
    apple: "/icon-192.png?v=2",
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export const viewport = { themeColor: "#f4f8fa", width: "device-width", initialScale: 1, viewportFit: "cover" }

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
