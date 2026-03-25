import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { BackgroundEnv } from "@/components/ui/backgroundEnv";
import { Providers } from "@/components/providers";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "archiChat — Tu Segunda Mente",
  description: "Análisis inteligente de documentos con RAG de alta precisión.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-[var(--font-geist-sans)] bg-background text-foreground selection:bg-primary/30`}
      >
        <Providers>
          <BackgroundEnv />
          <main className="relative min-h-screen flex flex-col z-10">
            {children}
          </main>
          <Toaster richColors position="top-right" closeButton />
        </Providers>
      </body>
    </html>
  );
}
