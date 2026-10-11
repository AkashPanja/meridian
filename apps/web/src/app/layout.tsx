import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Shell from "../components/shell";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Meridian — ask the desk",
  description: "Chat-first intraday and F&O trading desk. Paper by default.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <a href="#main" className="skip-link">Skip to content</a>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
