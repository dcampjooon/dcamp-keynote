// ABOUTME: 슬라이드의 블록 기반 데이터 모델(Zod). AI는 이 스키마를 채우고, 렌더러는 이걸 흰배경 16:9 HTML로 그린다.
// ABOUTME: 표현 자유도를 제약해 인라인 편집·AI 패치·PPT 익스포트가 모두 성립하게 한다(자유 HTML/SVG 금지).

import { z } from "zod";

/** 등장 애니메이션 종류 — engine/keynote.js의 data-anim 컨벤션과 매핑된다. */
export const AnimKind = z.enum(["rise", "fade", "scale", "draw", "stagger", "none"]);
export type AnimKind = z.infer<typeof AnimKind>;

/** 블록이 놓이는 그리드 컬럼(2-컬럼 split 레이아웃에서 사용). */
export const Column = z.enum(["full", "left", "right"]);
export type Column = z.infer<typeof Column>;

const Base = {
  id: z.string().describe("블록 고유 id (영문/숫자/하이픈)"),
  column: Column.default("full"),
  anim: AnimKind.default("rise"),
};

/** 다이어그램 노드(색은 출처/도메인 구분용 키워드). */
export const DiagramNode = z.object({
  id: z.string(),
  label: z.string(),
  color: z.enum(["blue", "cyan", "green", "purple", "amber", "gray"]).default("blue"),
});

export const DiagramEdge = z.object({
  from: z.string().describe("출발 노드 id"),
  to: z.string().describe("도착 노드 id"),
  label: z.string().default(""),
});

/** 블록 = 슬라이드 위의 한 시각/텍스트 요소. 제약된 타입만 허용. */
export const Block = z.discriminatedUnion("type", [
  z.object({ ...Base, type: z.literal("heading"), text: z.string(), accent: z.string().default("").describe("강조(그라데이션) 처리할 부분 문자열, 없으면 빈 문자열") }),
  z.object({ ...Base, type: z.literal("subhead"), text: z.string() }),
  z.object({ ...Base, type: z.literal("paragraph"), text: z.string() }),
  z.object({ ...Base, type: z.literal("bullets"), items: z.array(z.string()).max(6) }),
  z.object({ ...Base, type: z.literal("callout"), text: z.string(), tone: z.enum(["info", "success", "warn"]).default("info") }),
  z.object({
    ...Base,
    type: z.literal("kpi"),
    items: z.array(z.object({ value: z.number(), suffix: z.string().default(""), label: z.string() })).max(4).describe("카운트업되는 핵심 수치"),
  }),
  z.object({
    ...Base,
    type: z.literal("diagram"),
    kind: z.enum(["graph", "flow"]).describe("graph=관계도, flow=좌→우 흐름"),
    nodes: z.array(DiagramNode).max(8),
    edges: z.array(DiagramEdge).max(12),
  }),
  z.object({ ...Base, type: z.literal("image"), prompt: z.string().default("").describe("AI 이미지 생성 프롬프트(현재는 자리표시자)"), url: z.string().default("") }),
]);
export type Block = z.infer<typeof Block>;

/** 슬라이드 레이아웃 프리셋. */
export const SlideLayout = z.enum(["title", "section", "standard", "split", "centered"]);
export type SlideLayout = z.infer<typeof SlideLayout>;

/** 한 장의 슬라이드. blocks는 Supabase slides.blocks(jsonb)로 저장된다. */
export const Slide = z.object({
  id: z.string(),
  layout: SlideLayout.default("standard"),
  title: z.string().default("").describe("슬라이드 헤드라인(결론 한 줄). title/section 레이아웃에서 크게 표시"),
  blocks: z.array(Block).max(8),
  notes: z.string().default("").describe("발표자 노트/원고"),
});
export type Slide = z.infer<typeof Slide>;

/** 기획 단계 산출물: 슬라이드별 계획(아웃라인). */
export const SlidePlan = z.object({
  purpose: z.string().describe("이 슬라이드의 목적/메시지 한 줄"),
  headline: z.string().describe("헤드라인(결론·인사이트)"),
  layout: SlideLayout,
  blockHints: z.array(z.string()).describe("들어갈 블록 종류·내용 힌트 (예: 'bullets: 3대 원칙', 'diagram: 데이터 흐름')"),
});
export type SlidePlan = z.infer<typeof SlidePlan>;

export const Outline = z.object({
  title: z.string().describe("발표 제목"),
  subtitle: z.string().default(""),
  storyline: z.string().describe("전체 스토리라인을 2~3문장으로"),
  slides: z.array(SlidePlan).max(20),
});
export type Outline = z.infer<typeof Outline>;
