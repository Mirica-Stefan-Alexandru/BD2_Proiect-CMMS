import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: {
    default: "CMMS Industrial",
    template: "%s | CMMS Industrial",
  },
  description: "Sistem de management, asamblare si verificare pentru tablouri electrice proiectate in EPLAN",
};

export const viewport: Viewport = {
  themeColor: "#222831",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ro"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#222831] text-[#EEEEEE]">{children}</body>
    </html>
  );
}
