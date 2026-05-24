import type { Metadata } from "next";
import { Cormorant_Garamond, Archivo } from "next/font/google";
import "./globals.css";
import CustomCursor from "@/components/CustomCursor";
import LenisProvider from "@/components/LenisProvider";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["italic"],
  variable: "--font-cormorant",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Angle Mort — Audit de lucidité relationnelle",
  description:
    "Avant un engagement majeur, explorez vos zones d'ombre relationnelles. Un audit introspectif propulsé par Hyper AI Engine™. 10 questions. Un miroir sans complaisance.",
  openGraph: {
    title: "Angle Mort",
    description: "Ce que vous ne voyez pas peut tout changer.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fr"
      className={`${cormorant.variable} ${archivo.variable}`}
    >
      <body>
        <LenisProvider>
          <CustomCursor />
          {children}
        </LenisProvider>
      </body>
    </html>
  );
}
