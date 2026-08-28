import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Inter, Inter_Tight } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { SITE_URL, SITE_KEYWORDS } from "@/lib/seo";
import { JsonLd } from "@/components/veqiro/json-ld";
import { organizationJsonLd, websiteJsonLd } from "@/lib/jsonld";

// Inter Tight carries headings (tight, editorial), Inter the body copy, and
// JetBrains Mono the eyebrows/metrics. Replaces the previous display stack
// (Bagel Fat One / Archivo Black / Space Grotesk).
const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700"],
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Veqiro — Hire Your AI Crew",
    template: "%s · Veqiro",
  },
  description:
    "Veqiro gives you six AI employees — an exec assistant, SEO, content, research, legal, and finance — each billed independently starting at $9/mo. Hire your AI crew today.",
  keywords: SITE_KEYWORDS,
  authors: [{ name: "Veqiro" }],
  creator: "Veqiro",
  publisher: "Veqiro",
  category: "Technology",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "Veqiro — Hire Your AI Crew",
    description:
      "AI employees with real jobs, real personalities, and zero chill.",
    siteName: "Veqiro",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Veqiro — Hire your AI crew",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Veqiro — Hire Your AI Crew",
    description:
      "AI employees with real jobs, real personalities, and zero chill.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={cn(
        "h-full antialiased",
        interTight.variable,
        inter.variable,
        jetbrainsMono.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <JsonLd data={[organizationJsonLd(), websiteJsonLd()]} />
        {children}
      </body>
    </html>
  );
}
