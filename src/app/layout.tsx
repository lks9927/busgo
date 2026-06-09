import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BusGo - 포천교통 배차 관리 시스템",
  description: "공정한 차량 순환배차 및 휴무 관리 PWA 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="only light" />
      </head>
      <body>{children}</body>
    </html>
  );
}
