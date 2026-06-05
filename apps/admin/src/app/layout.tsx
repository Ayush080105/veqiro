import type { Metadata } from "next";
import { JetBrains_Mono, Bagel_Fat_One, Archivo_Black, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "sonner";
import QueryProvider from "@/app/providers/QueryProvider";

const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });
const bagelFatOne = Bagel_Fat_One({ weight: "400", subsets: ["latin"], variable: "--font-bagel" });
const archivoBl = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export const metadata: Metadata = { title: "Veqiro Admin" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
      <body className="min-h-full">
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
