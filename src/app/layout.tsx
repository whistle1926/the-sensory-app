import type { Metadata } from "next";
import { Geist, Geist_Mono, Baloo_2, Nunito } from "next/font/google";
import { Providers } from "@/components/providers";
import { ClarityScript } from "@/components/analytics/clarity-script";
import { MetaPixelScript } from "@/components/analytics/meta-pixel-script";
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

// The public storefront's own voice: Baloo 2 for headings, Nunito for
// body. Loaded as variables and used only by the pages that opt in, so
// the admin app keeps Geist.
const baloo = Baloo_2({
  variable: "--font-baloo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
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
      className={`${geistSans.variable} ${geistMono.variable} ${baloo.variable} ${nunito.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
        {/* Tracking — Clarity + Meta Pixel are server-rendered (each
            no-ops if unconfigured). UTM capture is client-side and runs
            once on first load to stash the campaign params in
            sessionStorage. */}
        <ClarityScript />
        <MetaPixelScript />
        <UtmCapture />
      </body>
    </html>
  );
}
