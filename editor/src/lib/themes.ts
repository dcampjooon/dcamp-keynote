// ABOUTME: 사전 지정 빌트인 템플릿(테마). 액센트 팔레트·캔버스 톤·익스포트 배경을 정의한다.
// ABOUTME: 토큰은 .ppt-canvas의 CSS 변수를 오버라이드 — 흰 캔버스/짙은 텍스트 기조를 유지해 모든 블록 가독성을 보장한다.

/* ---------- 페이지 규격(크기·방향) ---------- */
export type PageSize = "16:9" | "a4";
export type Orientation = "landscape" | "portrait";
export type PageSpec = { size: PageSize; orientation: Orientation };
export const DEFAULT_PAGE: PageSpec = { size: "16:9", orientation: "landscape" };

/** 페이지 규격 → 캔버스 px 크기(96dpi 기준). 가로/세로는 폭·높이를 뒤바꾼다. */
export function pageDims(p?: PageSpec): { w: number; h: number } {
  const size = p?.size ?? "16:9";
  const o = p?.orientation ?? "landscape";
  const base = size === "a4" ? { w: 1123, h: 794 } : { w: 1280, h: 720 };
  return o === "portrait" ? { w: base.h, h: base.w } : base;
}

/* ---------- 레이아웃 스펙(PDF에서 발견·정의되는 영역/배치) ---------- */
export type LayoutRole = "cover" | "section" | "body";
export type AccentStyle = "none" | "bar-left" | "bar-top" | "underline" | "block";

/** 레이아웃 안의 한 영역(zone) — 위치(%)와 역할을 가진다. PDF에서 위치·선·샘플텍스트까지 추출. */
export type RegionKind = "text" | "line" | "placeholder" | "footer";
export type Region = {
  id: string;
  kind: RegionKind;
  label: string; // 역할: eyebrow/headline/intro/partNumber/chartTitle/chart/source/docname/divider 등
  x: number; y: number; w: number; h: number; // 슬라이드 대비 % (0~100)
  sampleText?: string; // PDF의 실제 텍스트(미리보기용)
  fontSize?: number; // px
  color?: string; // hex (빈값=레이아웃 fg/기본 ink)
  weight?: "normal" | "bold" | "black";
  align?: "left" | "center" | "right";
  orient?: "h" | "v"; // line 방향
  thickness?: number; // line 두께 px
};

/** 한 종류의 슬라이드 레이아웃이 어떻게 구성되는지 — PDF 분석으로 채워지고 렌더러가 그대로 그린다. */
export type LayoutSpec = {
  id: string;
  name: string; // 한글 라벨 (예: 표지, 본문(좌제목))
  role: LayoutRole; // 슬라이드 매핑·생성용 거친 분류
  bg: string; // 슬라이드 배경 hex(빈 문자열이면 캔버스 기본)
  fg: string; // 텍스트 색 hex(빈 문자열이면 토큰 기본)
  align: "left" | "center";
  vAlign: "top" | "middle";
  titleSize: number; // 제목 px
  accent: AccentStyle; // 제목 주변 강조 요소
  kicker: boolean; // (레거시) 상단 eyebrow 표시 — regions 없을 때 폴백용
  footer: boolean; // (레거시) 하단 푸터 표시 — regions 없을 때 폴백용
  columns: 1 | 2 | 3; // 본문 하단 콘텐츠 컬럼 수
  colBg?: string; // 컬럼 영역 패널 배경 hex(빈 문자열=패널 없음)
  colGap?: number; // 컬럼 사이 간격 px
  colRadius?: number; // 컬럼 패널 모서리 둥글기 px
  regions?: Region[]; // 영역 기반 정의(있으면 영역으로 렌더, 없으면 위 스펙으로 폴백)
  sourcePage?: number; // 이 레이아웃을 대표하는 원본 PDF 페이지(1-based) — '원본 보기' 오버레이용
};

export const DEFAULT_LAYOUTS: LayoutSpec[] = [
  { id: "cover", name: "표지", role: "cover", bg: "", fg: "", align: "center", vAlign: "middle", titleSize: 60, accent: "none", kicker: true, footer: false, columns: 1 },
  { id: "section", name: "간지", role: "section", bg: "", fg: "", align: "center", vAlign: "middle", titleSize: 52, accent: "none", kicker: true, footer: false, columns: 1 },
  { id: "body", name: "본문", role: "body", bg: "", fg: "", align: "left", vAlign: "top", titleSize: 40, accent: "none", kicker: false, footer: false, columns: 1 },
];

/** 슬라이드 layout(enum) → 템플릿의 레이아웃 스펙 매핑(role 기준, 없으면 기본). */
export function layoutForSlide(slideLayout: string, layouts: LayoutSpec[] = DEFAULT_LAYOUTS): LayoutSpec {
  const role: LayoutRole = slideLayout === "title" ? "cover" : slideLayout === "section" ? "section" : "body";
  return layouts.find((l) => l.role === role) ?? layouts.find((l) => l.role === "body") ?? DEFAULT_LAYOUTS[2];
}

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
  /** PDF에서 발견·정의된 레이아웃들(없으면 기본 3종) */
  layouts?: LayoutSpec[];
  /** 원본 샘플 PDF의 Storage 경로(있으면 '원본 보기'로 언제든 겹쳐 비교) */
  pdfPath?: string;
  /** 페이지 규격(크기·방향) */
  page?: PageSpec;
  /** 빌트인(수정/삭제 불가) 여부 */
  builtin?: boolean;
};

/** 두 액센트 색에서 토큰 묶음을 만든다(템플릿 에디터·DB 행 → Theme 공용). */
export function tokensFrom(accent1: string, accent2: string, canvasBg: string): Record<string, string> {
  return { "--blue": accent1, "--cyan": accent2, "--grad": `linear-gradient(120deg, ${accent1}, ${accent2})`, "--canvas-bg": canvasBg };
}

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

/* ---------- 웹폰트(템플릿에서 선택) ---------- */
export type Font = { id: string; label: string; stack: string; url: string };
export const FONTS: Font[] = [
  { id: "pretendard", label: "Pretendard (기본)", stack: '"Pretendard Variable", Pretendard, system-ui, sans-serif', url: "" },
  { id: "noto-sans-kr", label: "본고딕 (Noto Sans KR)", stack: '"Noto Sans KR", sans-serif', url: "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap" },
  { id: "gowun-dodum", label: "고운돋움", stack: '"Gowun Dodum", sans-serif', url: "https://fonts.googleapis.com/css2?family=Gowun+Dodum&display=swap" },
  { id: "nanum-myeongjo", label: "나눔명조 (세리프)", stack: '"Nanum Myeongjo", serif', url: "https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700;800&display=swap" },
  { id: "ibm-plex-kr", label: "IBM Plex Sans KR", stack: '"IBM Plex Sans KR", sans-serif', url: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;700&display=swap" },
];
export function fontById(id?: string): Font {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

/* ---------- 템플릿 상세 설정 ↔ 토큰 ---------- */
export type Density = "compact" | "normal" | "roomy";
export const DENSITY_PAD: Record<Density, string> = { compact: "48px 64px", normal: "64px 80px", roomy: "82px 104px" };

export type TemplateSettings = {
  accent1: string; accent2: string; canvasBg: string; ink: string; surround: string;
  fontId: string; keepAll: boolean; radius: number; density: Density;
  titleSize: number; sectionSize: number; bodySize: number;
};

export const DEFAULT_SETTINGS: TemplateSettings = {
  accent1: "#2f6df6", accent2: "#14b8c4", canvasBg: "#ffffff", ink: "#16233d", surround: "#0a0e24",
  fontId: "pretendard", keepAll: false, radius: 0, density: "normal", titleSize: 60, sectionSize: 52, bodySize: 40,
};

export function settingsToTokens(s: TemplateSettings): Record<string, string> {
  return {
    "--blue": s.accent1,
    "--cyan": s.accent2,
    "--grad": `linear-gradient(120deg, ${s.accent1}, ${s.accent2})`,
    "--canvas-bg": s.canvasBg,
    "--ink": s.ink,
    "--font": fontById(s.fontId).stack,
    "--wb": s.keepAll ? "keep-all" : "normal",
    "--radius": `${s.radius}px`,
    "--pad": DENSITY_PAD[s.density],
    "--h-title": `${s.titleSize}px`,
    "--h-section": `${s.sectionSize}px`,
    "--h-standard": `${s.bodySize}px`,
  };
}

/** 토큰(기존 템플릿)에서 설정값 복원 — 에디터로 불러올 때. */
export function tokensToSettings(tokens: Record<string, string>, surround: string): TemplateSettings {
  const px = (v: string | undefined, d: number) => (v ? parseInt(v, 10) || d : d);
  const fontId = FONTS.find((f) => f.stack === tokens["--font"])?.id ?? "pretendard";
  const density = (Object.entries(DENSITY_PAD).find(([, v]) => v === tokens["--pad"])?.[0] as Density) ?? "normal";
  return {
    accent1: tokens["--blue"] ?? DEFAULT_SETTINGS.accent1,
    accent2: tokens["--cyan"] ?? DEFAULT_SETTINGS.accent2,
    canvasBg: tokens["--canvas-bg"] ?? DEFAULT_SETTINGS.canvasBg,
    ink: tokens["--ink"] ?? DEFAULT_SETTINGS.ink,
    surround: surround || DEFAULT_SETTINGS.surround,
    fontId,
    keepAll: tokens["--wb"] === "keep-all",
    radius: px(tokens["--radius"], 10),
    density,
    titleSize: px(tokens["--h-title"], 60),
    sectionSize: px(tokens["--h-section"], 52),
    bodySize: px(tokens["--h-standard"], 40),
  };
}
