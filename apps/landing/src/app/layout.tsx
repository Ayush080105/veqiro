import type { Metadata } from "next";
import { JetBrains_Mono, Bagel_Fat_One, Archivo_Black, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const bagelFatOne = Bagel_Fat_One({ weight: "400", subsets: ["latin"], variable: "--font-bagel" });
const archivoBl = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const SITE_URL =
  process.env.NEXT_PUBLIC_LANDING_URL || "https://veqiro.com";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Veqiro — Hire Your AI Crew",
    template: "%s · Veqiro",
  },
  description:
    "Veqiro is a crew of AI employees with real jobs, real personalities, and zero chill. They do the work. You take the credit.",
  keywords: [
    "AI employees",
    "AI workforce",
    "AI agents",
    "AI for startups",
    "autonomous agents",
    "veqiro",
  ],
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
  alternates: {
    canonical: SITE_URL,
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
      className={cn(
        "h-full antialiased",
        jetbrainsMono.variable,
        bagelFatOne.variable,
        archivoBl.variable,
        spaceGrotesk.variable,
      )}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
