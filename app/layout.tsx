import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "52주 고점 눌림목 스크리너",
  description:
    "코스피·코스닥·나스닥에서 52주 최고가 대비 30% 이상 하락하고 최근 2주 보합인 종목을 찾습니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={`${notoSansKr.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#070b12] font-sans text-slate-100">{children}</body>
    </html>
  );
}
