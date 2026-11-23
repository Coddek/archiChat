import type { Metadata } from "next";
import { Instrument_Sans, Literata } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";

// Interfaz: sans con carácter. Lectura (respuestas, transcripción): serif pensada para pantalla.
const ui = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});
const read = Literata({
  subsets: ["latin"],
  variable: "--font-read",
  display: "swap",
});

export const metadata: Metadata = {
  title: "archiChat — chateá con tus documentos y tus clases",
  description:
    "Chat con documentos que cita de dónde sale cada respuesta, y transcripción en vivo de clases y reuniones que explica los conceptos mientras pasan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${ui.variable} ${read.variable}`}>
      <body className="font-sans antialiased bg-background text-foreground">
        <Providers>
          <main className="relative min-h-screen flex flex-col">
            {children}
          </main>
          <Toaster position="bottom-right" closeButton />
        </Providers>
      </body>
    </html>
  );
}
