import type { Metadata } from "next";
import { Geist, Geist_Mono, JetBrains_Mono, Lora, Bagel_Fat_One, Archivo_Black, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import QueryProvider from "@/app/providers/QueryProvider";

const loraHeading = Lora({ subsets: ['latin'], variable: '--font-heading' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const bagelFatOne = Bagel_Fat_One({ weight: "400", subsets: ["latin"], variable: "--font-bagel" });
const archivoBl = Archivo_Black({ weight: "400", subsets: ["latin"], variable: "--font-archivo" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space" });

export const metadata: Metadata = {
  title: "Veqiro — Your Six AI Employees",
  description: "Six AI employees with real jobs, real personalities, and zero chill. Marketing, research, SEO, legal, finance, and executive assistance on tap.",
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
        "h-full antialiased font-mono",
        geistSans.variable,
        geistMono.variable,
        jetbrainsMono.variable,
        loraHeading.variable,
        bagelFatOne.variable,
        archivoBl.variable,
        spaceGrotesk.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
