import { ComboScreenerApp } from "@/components/combo-screener";

export const metadata = {
  title: "눌림목 + 거래량 급증 스크리너",
  description:
    "52주 고점 대비 눌림목이면서 최근 한 달 거래량이 급증하고 상승률이 낮은 한국·미국 종목을 찾습니다.",
};

export default function ComboPage() {
  return <ComboScreenerApp />;
}
