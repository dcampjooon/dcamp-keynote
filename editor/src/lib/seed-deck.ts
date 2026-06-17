// ABOUTME: 렌더러 검증용 샘플 덱. 모든 블록 타입(heading/bullets/kpi/diagram/callout/split)을 한 번씩 사용한다.
// ABOUTME: API 키 없이도 흰배경 PPT 테마 + 애니메이션을 즉시 확인할 수 있게 한다.

import type { RenderSlide } from "@/components/slide-renderer/SlideView";

export const SEED_SLIDES: RenderSlide[] = [
  {
    layout: "title",
    title: "",
    blocks: [
      { id: "t", type: "heading", text: "통합DB & 전사 AX", accent: "전사 AX", column: "full", anim: "rise" },
      { id: "s", type: "subhead", text: "지금까지의 실적과 다음 단계", column: "full", anim: "fade" },
    ],
    notes: "표지입니다.",
  },
  {
    layout: "centered",
    title: "하나의 SSOT로 수렴",
    blocks: [
      {
        id: "k",
        type: "kpi",
        column: "full",
        anim: "scale",
        items: [
          { value: 906, suffix: "", label: "기업" },
          { value: 1207, suffix: "", label: "인물" },
          { value: 1248, suffix: "", label: "자펀드 포트폴리오" },
        ],
      },
    ],
    notes: "핵심 수치 강조.",
  },
  {
    layout: "split",
    title: "현업이 만들고 · IT팀이 뒷받침",
    blocks: [
      { id: "b", type: "bullets", column: "left", anim: "rise", items: ["투자팀 AI 심사역", "사업실 AI 멘토", "경영본부 재무 대시보드"] },
      {
        id: "d",
        type: "diagram",
        column: "right",
        anim: "draw",
        kind: "flow",
        nodes: [
          { id: "a", label: "현업 의도", color: "blue" },
          { id: "b", label: "AI 구체화", color: "cyan" },
          { id: "c", label: "성과", color: "green" },
        ],
        edges: [
          { from: "a", to: "b", label: "" },
          { from: "b", to: "c", label: "" },
        ],
      },
    ],
    notes: "AX Support 구조.",
  },
  {
    layout: "standard",
    title: "한 단계 장애도 전체 무중단",
    blocks: [
      {
        id: "g",
        type: "diagram",
        column: "full",
        anim: "draw",
        kind: "graph",
        nodes: [
          { id: "src", label: "출처 데이터", color: "gray" },
          { id: "db", label: "통합DB(SSOT)", color: "blue" },
          { id: "ai", label: "AI", color: "purple" },
          { id: "app", label: "업무 시스템", color: "cyan" },
        ],
        edges: [
          { from: "src", to: "db", label: "정제" },
          { from: "db", to: "ai", label: "" },
          { from: "db", to: "app", label: "" },
          { from: "ai", to: "app", label: "지능" },
        ],
      },
      { id: "c", type: "callout", column: "full", anim: "rise", tone: "success", text: "이 구조는 이미 작동하고 있다." },
    ],
    notes: "전사 AX 2-Track 구조도.",
  },
];
