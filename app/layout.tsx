
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import TelegramInit from "@/components/telegram-init";
import "./globals.css";

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
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#080808"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />

        <TelegramInit />

        {children}
      </body>
    </html>
  );
}
