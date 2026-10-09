import type { Metadata, Viewport } from "next";
import "@fontsource/noto-sans-jp/400.css";
import "@fontsource/noto-sans-jp/500.css";
import "@fontsource/noto-sans-jp/700.css";
import "@fontsource/m-plus-rounded-1c/700.css";
import "@fontsource/m-plus-rounded-1c/800.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "担当者会議 議事録 | アソシエ",
  description: "サービス担当者会議の録音から第4表準拠の議事録を作成",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "議事録", statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f6f8fb",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  );
}
