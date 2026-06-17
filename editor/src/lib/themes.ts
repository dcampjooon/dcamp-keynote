// ABOUTME: 사전 지정 빌트인 템플릿(테마). 액센트 팔레트·캔버스 톤·익스포트 배경을 정의한다.
// ABOUTME: 토큰은 .ppt-canvas의 CSS 변수를 오버라이드 — 흰 캔버스/짙은 텍스트 기조를 유지해 모든 블록 가독성을 보장한다.

export type Theme = {
  id: string;
  name: string;
  desc: string;
  /** .ppt-canvas에 주입할 CSS 변수 오버라이드 */
  tokens: Record<string, string>;
  /** 익스포트(발표 모드)의 캔버스 바깥 배경 */
  surround: string;
  /** 선택 UI 미리보기용 대표색 */
  swatch: [string, string];
};

export const THEMES: Theme[] = [
  { id: "dcamp-white", name: "디캠프 화이트", desc: "블루→시안 (기본)", tokens: {}, surround: "#0a0e24", swatch: ["#2f6df6", "#14b8c4"] },
  { id: "ocean", name: "오션", desc: "딥 블루", tokens: { "--blue": "#2563eb", "--cyan": "#3b82f6", "--grad": "linear-gradient(120deg,#1d4ed8,#3b82f6)" }, surround: "#0a1330", swatch: ["#1d4ed8", "#3b82f6"] },
  { id: "emerald", name: "에메랄드", desc: "그린→틸", tokens: { "--blue": "#059669", "--cyan": "#10b981", "--grad": "linear-gradient(120deg,#047857,#10b981)" }, surround: "#04140e", swatch: ["#047857", "#10b981"] },
  { id: "sunset", name: "선셋", desc: "앰버→오렌지", tokens: { "--blue": "#ea580c", "--cyan": "#f59e0b", "--grad": "linear-gradient(120deg,#ea580c,#f59e0b)" }, surround: "#1a0f08", swatch: ["#ea580c", "#f59e0b"] },
  { id: "graphite", name: "그래파이트", desc: "모노톤", tokens: { "--blue": "#475569", "--cyan": "#64748b", "--grad": "linear-gradient(120deg,#334155,#64748b)", "--canvas-bg": "#fbfcfd" }, surround: "#111419", swatch: ["#334155", "#64748b"] },
];

export const DEFAULT_THEME = THEMES[0];
export function themeById(id?: string | null): Theme {
  return THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}
