
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { K7Intro } from "@/components/k7-intro";
import TelegramInit from "@/components/telegram-init";
import "./globals.css";
import "@/components/k7-panels-fix.css";
import "./dark-elite.css";
import "./k7-motion-ui.css";
import "./k7-community.css";

export const metadata: Metadata = {
  title: "K7 CREW — PUBG MOBILE ESPORTS",
  description: "Official K7 CREW community platform",
  applicationName: "K7 CREW",
  robots: {
    index: false,
    follow: false
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#000000",
  colorScheme: "dark"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" translate="no" className="notranslate">
      <body>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />

        <TelegramInit />

        <K7Intro>{children}</K7Intro>
      </body>
    </html>
  );
}
