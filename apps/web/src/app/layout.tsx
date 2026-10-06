import type { Metadata } from "next";
import { Archivo, Geist_Mono, Urbanist } from "next/font/google";
import "./globals.css";

// Archivo (variable, axe de largeur) remplace Sztos : rendu quasi identique, sans licence.
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

const urbanist = Urbanist({
  variable: "--font-urbanist",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Horaya",
  description: "Réservations, événements et matériel dans un seul agenda, sous ta marque.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      className={`${archivo.variable} ${urbanist.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
