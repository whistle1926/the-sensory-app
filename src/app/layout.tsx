import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { ClarityScript } from "@/components/analytics/clarity-script";
import { UtmCapture } from "@/components/analytics/utm-capture";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Sensory",
  description: "OT Report Management Platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        {/* Tracking — Clarity is server-rendered (no script if unconfigured),
            UTM capture is client-side and runs once on first load to
            stash the campaign params in sessionStorage. */}
        <ClarityScript />
        <UtmCapture />
      </body>
    </html>
  );
}
