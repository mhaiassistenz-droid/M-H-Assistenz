import type { Metadata } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { FloatingHeader } from "@/components/ui/floating-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "M&H Assistenz – KI-Automatisierung für KMUs",
  description: "Wir bauen Voice Agents, RAG-Systeme und Workflow-Automatisierungen für selbstständige Unternehmer in Deutschland. Kostenloses Fallstudie-Programm — 7 Plätze.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} ${cormorant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="px-4 pt-4">
          <FloatingHeader />
        </div>
        {children}
      </body>
    </html>
  );
}
