// ABOUTME: 덱(슬라이드 배열) → 편집 가능한 .pptx(PowerPoint). 텍스트/불릿/KPI/callout은 네이티브 텍스트, 다이어그램은 네이티브 도형(노드=둥근사각형, 엣지=선)으로 매핑.
// ABOUTME: flow 기반 미리보기를 PPTX의 절대좌표로 근사 배치한다(블록 순서·레이아웃 보존). 한글은 Malgun Gothic 폰트로.

import PptxGenJS from "pptxgenjs";
import type { Block } from "@/lib/slide-schema";
import type { RenderSlide } from "@/components/slide-renderer/SlideView";
import { layoutForSlide, DEFAULT_LAYOUTS, type LayoutSpec } from "@/lib/themes";

// 16:9 = 13.333 x 7.5 inch. 캔버스 1280x720 → inch 스케일
const SLIDE_W = 13.333;
const SLIDE_H = 7.5;
const S = SLIDE_W / 1280; // inch per px (가로·세로 동일)
const MX = 80 * S; // 좌우 여백(px 80)
const MY = 64 * S; // 상하 여백(px 64)
const CW = SLIDE_W - 2 * MX; // 콘텐츠 폭
let FONT = "Malgun Gothic"; // 테마 폰트로 요청당 설정(PPTX는 뷰어 설치 폰트 기준 — 한글 안전 폴백)

const HEX: Record<string, string> = { blue: "2f6df6", cyan: "14b8c4", green: "16a34a", purple: "7c3aed", amber: "d97706", gray: "64748b" };
const INK = "16233d", INK_DIM = "5b6b86", INK_FAINT = "9aa7bd", LINE = "b9c4da";
// 테마 액센트(요청당 1회 설정). 동시 익스포트 시 색이 섞일 수 있으나 코스메틱이라 허용.
let ACCENT = HEX.blue;
const px = (n: number) => +(n * S).toFixed(3);
const pt = (cssPx: number) => Math.round(cssPx * 0.75);

type Slide = PptxGenJS.Slide;

/** 블록 1개의 대략 높이(inch) — 절대 배치용 추정값. */
function blockH(b: Block, colW: number): number {
  switch (b.type) {
    case "heading": return 0.85;
    case "subhead": return 0.45;
    case "paragraph": return Math.max(0.5, Math.ceil(b.text.length / (colW > 7 ? 60 : 28)) * 0.34);
    case "bullets": return b.items.length * 0.42 + 0.1;
    case "callout": return 0.75;
    case "kpi": return 1.25;
    case "diagram": return 3.2;
    case "image": return 2.6;
    case "freecanvas": return 3.0;
    default: return 0.4;
  }
}

function addBlock(slide: Slide, b: Block, x: number, y: number, w: number, h: number) {
  switch (b.type) {
    case "heading":
      slide.addText(accentRuns(b.text, b.accent), { x, y, w, h, fontFace: FONT, fontSize: pt(40), bold: true, color: INK, align: "left", valign: "top" });
      break;
    case "subhead":
      slide.addText(b.text, { x, y, w, h, fontFace: FONT, fontSize: pt(22), bold: true, color: INK_DIM, valign: "top" });
      break;
    case "paragraph":
      slide.addText(b.text, { x, y, w, h, fontFace: FONT, fontSize: pt(20), color: INK_DIM, valign: "top", lineSpacingMultiple: 1.3 });
      break;
    case "bullets":
      slide.addText(
        b.items.map((it) => ({ text: it, options: { bullet: { code: "2022", indent: 14 }, color: INK, fontSize: pt(20), paraSpaceAfter: 8 } })),
        { x, y, w, h, fontFace: FONT, valign: "top" },
      );
      break;
    case "callout": {
      const fill = b.tone === "success" ? "f0fdf4" : b.tone === "warn" ? "fffbeb" : "f3f7ff";
      const bar = b.tone === "success" ? HEX.green : b.tone === "warn" ? HEX.amber : ACCENT;
      slide.addShape("rect", { x, y, w: px(4), h, fill: { color: bar } });
      slide.addText(b.text, { x: x + px(14), y, w: w - px(18), h, fontFace: FONT, fontSize: pt(20), bold: true, color: INK, valign: "middle", fill: { color: fill } });
      break;
    }
    case "kpi": {
      const n = b.items.length;
      const itemW = Math.min(2.8, w / n);
      b.items.forEach((k, i) => {
        const ix = x + i * itemW;
        slide.addText(`${k.value.toLocaleString()}${k.suffix}`, { x: ix, y, w: itemW, h: 0.85, fontFace: FONT, fontSize: pt(50), bold: true, color: ACCENT, align: "left", valign: "top" });
        slide.addText(k.label, { x: ix, y: y + 0.82, w: itemW, h: 0.35, fontFace: FONT, fontSize: pt(16), bold: true, color: INK_DIM, align: "left", valign: "top" });
      });
      break;
    }
    case "diagram":
      addDiagram(slide, b, x, y, w, h);
      break;
    case "image":
      slide.addShape("rect", { x, y, w, h, fill: { color: "f8fafc" }, line: { color: "e6eaf2", width: 1, dashType: "dash" } });
      slide.addText(`🖼 ${b.prompt || "이미지"}`, { x, y, w, h, fontFace: FONT, fontSize: pt(16), color: INK_FAINT, align: "center", valign: "middle" });
      break;
    case "freecanvas":
      slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.06, fill: { color: "f8fafc" }, line: { color: "e6eaf2", width: 1, dashType: "dash" } });
      slide.addText("커스텀 비주얼 — HTML 익스포트에서 확인", { x, y, w, h, fontFace: FONT, fontSize: pt(15), color: INK_FAINT, align: "center", valign: "middle" });
      break;
  }
}

/** 헤드라인 accent를 파란색 run으로 분리(PPTX는 그라데이션 텍스트 미지원 → 솔리드 블루). */
function accentRuns(text: string, accent: string) {
  if (accent && text.includes(accent)) {
    const [before, after] = text.split(accent);
    return [
      { text: before, options: { color: INK } },
      { text: accent, options: { color: ACCENT } },
      { text: after, options: { color: INK } },
    ];
  }
  return [{ text, options: { color: INK } }];
}

/* ---------- 다이어그램(네이티브 도형) ---------- */
const DW = 640, DH = 380, NW = 150, NH = 60, DPAD = 18;
function dLayout(nodes: Extract<Block, { type: "diagram" }>["nodes"], kind: "graph" | "flow") {
  const pos: Record<string, { x: number; y: number }> = {};
  const n = nodes.length;
  if (!n) return pos;
  const span = DW - NW - 2 * DPAD;
  if (kind === "flow") { nodes.forEach((nd, i) => (pos[nd.id] = { x: n === 1 ? DW / 2 - NW / 2 : DPAD + (i * span) / (n - 1), y: DH / 2 - NH / 2 })); return pos; }
  if (n <= 2) { nodes.forEach((nd, i) => (pos[nd.id] = { x: n === 1 ? DW / 2 - NW / 2 : DPAD + i * span, y: DH / 2 - NH / 2 })); return pos; }
  const cx = DW / 2 - NW / 2, cy = DH / 2 - NH / 2, r = Math.min(DW, DH) / 2 - NH;
  nodes.forEach((nd, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; pos[nd.id] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }; });
  return pos;
}

function addDiagram(slide: Slide, b: Extract<Block, { type: "diagram" }>, rx: number, ry: number, rw: number, rh: number) {
  const pos = dLayout(b.nodes, b.kind);
  const sc = Math.min(rw / DW, rh / DH); // meet
  const ox = rx + (rw - DW * sc) / 2;
  const oy = ry + (rh - DH * sc) / 2;
  const X = (vx: number) => ox + vx * sc;
  const Y = (vy: number) => oy + vy * sc;

  // 엣지(선) — 노드 중심 연결
  for (const e of b.edges) {
    const a = pos[e.from], c = pos[e.to];
    if (!a || !c) continue;
    const x1 = X(a.x + NW / 2), y1 = Y(a.y + NH / 2), x2 = X(c.x + NW / 2), y2 = Y(c.y + NH / 2);
    slide.addShape("line", { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), line: { color: LINE, width: 1.5 }, flipH: x2 < x1, flipV: y2 < y1 });
  }
  // 노드(둥근 사각형 + 라벨)
  for (const nd of b.nodes) {
    const p = pos[nd.id];
    if (!p) continue;
    const color = HEX[nd.color] ?? HEX.blue;
    slide.addText(nd.label.replace(/\\n|\n/g, " ").replace(/\s+/g, " ").trim(), {
      x: X(p.x), y: Y(p.y), w: NW * sc, h: NH * sc,
      shape: "roundRect", rectRadius: 0.06,
      fill: { color: "FFFFFF" }, line: { color, width: 1.75 },
      fontFace: FONT, fontSize: pt(15), bold: true, color: INK, align: "center", valign: "middle",
    });
  }
}

/* ---------- 슬라이드 배치 (레이아웃 스펙 기반) ---------- */
function layoutSlide(pptx: PptxGenJS, slide: RenderSlide, spec: LayoutSpec) {
  const s = pptx.addSlide();
  s.background = { color: (spec.bg || "#FFFFFF").replace(/^#/, "") };
  if (slide.notes) s.addNotes(slide.notes);

  const titleColor = spec.fg ? spec.fg.replace(/^#/, "") : INK;
  const align = spec.align === "center" ? "center" : "left";
  const full = slide.blocks.filter((b) => b.column === "full");
  const left = slide.blocks.filter((b) => b.column === "left");
  const right = slide.blocks.filter((b) => b.column === "right");
  const hasCols = left.length > 0 || right.length > 0;
  const heroLike = spec.role === "cover" || spec.role === "section";
  const hasHeading = slide.blocks.some((b) => b.type === "heading");
  const showTitle = slide.title && !(heroLike && hasHeading);
  const th = Math.max(1.0, spec.titleSize / 40); // 제목 박스 높이(inch) 근사

  // 세로 중앙 배치
  if (spec.vAlign === "middle") {
    if (spec.kicker) s.addText("d·camp  |  IT팀", { x: MX, y: 1.2, w: CW, h: 0.4, fontFace: FONT, fontSize: pt(16), bold: true, color: INK_FAINT, align, charSpacing: 3 });
    const blocks = full;
    const totalH = (showTitle ? th : 0) + blocks.reduce((a, b) => a + blockH(b, CW), 0);
    let y = Math.max(MY + 0.6, (SLIDE_H - totalH) / 2);
    if (showTitle) {
      s.addText(slide.title, { x: MX, y, w: CW, h: th, fontFace: FONT, fontSize: pt(spec.titleSize), bold: true, color: titleColor, align, valign: "middle" });
      y += th;
    }
    for (const b of blocks) {
      const h = blockH(b, CW);
      if (align === "center") addCentered(s, b, MX, y, CW, h);
      else addBlock(s, b, MX, y, CW, h);
      y += h + 0.12;
    }
    return;
  }

  // 상단 정렬
  let top = MY;
  if (spec.kicker) {
    s.addText("d·camp  |  IT팀", { x: MX, y: top, w: CW, h: 0.4, fontFace: FONT, fontSize: pt(16), bold: true, color: INK_FAINT, align, charSpacing: 3 });
    top += 0.5;
  }
  if (showTitle) {
    s.addText(slide.title, { x: MX, y: top, w: CW, h: 0.9, fontFace: FONT, fontSize: pt(spec.titleSize), bold: true, color: titleColor, align, valign: "top" });
    top += 1.05;
  }
  if (!hasCols) {
    let y = top;
    for (const b of full) { const h = blockH(b, CW); addBlock(s, b, MX, y, CW, h); y += h + 0.16; }
  } else {
    let yf = top;
    for (const b of full) { const h = blockH(b, CW); addBlock(s, b, MX, yf, CW, h); yf += h + 0.16; }
    const colW = (CW - 0.5) / 2;
    const colTop = yf;
    const colH = SLIDE_H - MY - colTop;
    placeCol(s, left, MX, colTop, colW, colH);
    placeCol(s, right, MX + colW + 0.5, colTop, colW, colH);
  }
}

/** 컬럼: diagram이 있으면 남은 높이를 다 주고, 텍스트는 추정 높이로 스택. */
function placeCol(s: Slide, blocks: Block[], x: number, y: number, w: number, h: number) {
  const fixed = blocks.filter((b) => b.type !== "diagram").reduce((a, b) => a + blockH(b, w) + 0.14, 0);
  let cy = y;
  for (const b of blocks) {
    const bh = b.type === "diagram" ? Math.max(2.2, h - fixed) : blockH(b, w);
    addBlock(s, b, x, cy, w, bh);
    cy += bh + 0.14;
  }
}

/** 센터 레이아웃 블록(텍스트는 가운데 정렬). */
function addCentered(s: Slide, b: Block, x: number, y: number, w: number, h: number) {
  if (b.type === "kpi") {
    const n = b.items.length;
    const itemW = Math.min(2.8, w / Math.max(n, 1));
    const totalW = itemW * n;
    const sx = x + (w - totalW) / 2;
    b.items.forEach((k, i) => {
      const ix = sx + i * itemW;
      s.addText(`${k.value.toLocaleString()}${k.suffix}`, { x: ix, y, w: itemW, h: 0.85, fontFace: FONT, fontSize: pt(50), bold: true, color: ACCENT, align: "center", valign: "top" });
      s.addText(k.label, { x: ix, y: y + 0.82, w: itemW, h: 0.35, fontFace: FONT, fontSize: pt(16), bold: true, color: INK_DIM, align: "center", valign: "top" });
    });
    return;
  }
  if (b.type === "bullets" || b.type === "callout" || b.type === "diagram" || b.type === "image" || b.type === "freecanvas") {
    addBlock(s, b, x, y, w, h);
    return;
  }
  // heading/subhead/paragraph 가운데 정렬
  const fs = b.type === "subhead" ? 22 : b.type === "paragraph" ? 20 : 28;
  const text = b.type === "heading" ? b.text : b.type === "subhead" ? b.text : b.text;
  s.addText(text, { x, y, w, h, fontFace: FONT, fontSize: pt(fs), bold: b.type !== "paragraph", color: b.type === "paragraph" ? INK_DIM : INK, align: "center", valign: "top" });
}

export async function buildPptx(title: string, slides: RenderSlide[], accentHex?: string, fontFace?: string, layouts?: LayoutSpec[]): Promise<Buffer> {
  ACCENT = (accentHex || HEX.blue).replace(/^#/, "");
  FONT = fontFace || "Malgun Gothic";
  const specs = layouts && layouts.length ? layouts : DEFAULT_LAYOUTS;
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pptx.title = title;
  for (const sl of slides) layoutSlide(pptx, sl, layoutForSlide(sl.layout, specs));
  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}
