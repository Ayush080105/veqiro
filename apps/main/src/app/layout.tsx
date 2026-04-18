import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono, Bagel_Fat_One, Archivo_Black, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const bagelFatOne = Bagel_Fat_One({ weight: "400", subsets: ["latin"], variable: "--font-bagel" });
const archivoBl = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Veqiro — Hire Six AI Employees",
  description: "Six AI employees with real jobs, real personalities, and zero chill.",
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
        geistSans.variable, geistMono.variable,
        jetbrainsMono.variable, bagelFatOne.variable,
        archivoBl.variable, spaceGrotesk.variable,
      )}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
