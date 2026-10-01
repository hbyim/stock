import { VolumeScreenerApp } from "@/components/volume-screener";

export const metadata = {
  title: "거래량 급증 저상승 스크리너",
  description:
    "최근 한 달 거래량이 3배 이상 늘었고 수익률이 4% 이하인 코스피·코스닥·나스닥 종목을 찾습니다.",
};

export default function VolumePage() {
  return <VolumeScreenerApp />;
}
