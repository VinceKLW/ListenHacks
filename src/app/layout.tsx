import type { Metadata } from "next";
import { JetBrains_Mono, Barlow_Condensed } from "next/font/google";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "HUM PRODUCER - AI Music Production",
  description:
    "Hum a melody, get a full produced track. AI-powered music production.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${jetbrainsMono.variable} ${barlowCondensed.variable} font-[family-name:var(--font-mono)] bg-[#0D0D0F] text-[#E0E0E4] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
