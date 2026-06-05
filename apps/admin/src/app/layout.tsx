import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import QueryProvider from "@/app/providers/QueryProvider";

export const metadata: Metadata = { title: "Veqiro Admin" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>{children}</QueryProvider>
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
