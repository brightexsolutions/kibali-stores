import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Kibali Stores",
  description: "Simple business records for Kibali Stores — sales, stock, money.",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  openGraph: {
    title: "Kibali Enterprise",
    description: "Simple business records for busy shops — sales, stock, supplier money and profit, all in one place, on your phone.",
    siteName: "Kibali Enterprise",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kibali Enterprise",
    description: "Simple business records for busy shops — sales, stock, supplier money and profit, all in one place, on your phone.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1, // phones-first: no accidental pinch-zoom state
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh">
        <Providers>
          {children}
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  );
}
