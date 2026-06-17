// ABOUTME: 루트 레이아웃. PPT 캔버스가 쓰는 Pretendard 폰트(CDN)와 한국어 메타데이터를 설정한다.

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "키노트 에디터 · dcamp",
  description: "자연어로 설명하면 애니메이션 PPT 키노트를 만들어주는 에디터",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
        {/* 템플릿에서 선택 가능한 웹폰트(미리보기용 전체 로드) */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&family=Gowun+Dodum&family=Nanum+Myeongjo:wght@400;700;800&family=IBM+Plex+Sans+KR:wght@400;500;700&display=swap" />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
