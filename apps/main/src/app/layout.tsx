import type { Metadata } from "next";
import { JetBrains_Mono, Inter_Tight, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import QueryProvider from "@/app/providers/QueryProvider";
import { Agentation } from "agentation";

// Inter Tight carries headings/CTAs, Inter carries body copy — matches
// apps/landing's font stack. JetBrains Mono (labels/eyebrows) is unchanged.
// --font-archivo is aliased to --font-bagel in globals.css so FONT.head
// (apps/main/src/lib/fonts.ts) keeps resolving without any call-site changes.
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--font-bagel", weight: ["500", "600", "700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-space", weight: ["400", "500", "600"] });

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
        jetbrainsMono.variable,
        interTight.variable,
        inter.variable,
      )}
    >
      <body className="min-h-full flex flex-col">
        <QueryProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </QueryProvider>
        <Toaster />
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
