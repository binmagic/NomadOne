import type { Metadata } from "next";
import { Toaster } from "sonner";

import "./globals.css";

import { ThemeScript } from "@/components/layout/theme-script";
import { BrandConsole } from "@/components/shared/brand-console";
import { ChunkReloadGuard } from "@/components/shared/chunk-reload-guard";

export const metadata: Metadata = {
  title: "NomadOne",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/brand-icon.ico",
  },
  description: "NomadOne AI product page and social content generation workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <ThemeScript />
        <ChunkReloadGuard />
        <BrandConsole />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
