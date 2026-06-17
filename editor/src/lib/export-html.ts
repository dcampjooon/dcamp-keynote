// ABOUTME: 덱(슬라이드 배열) → 자립형 단일 HTML 문자열. 더블클릭만으로 풀스크린 발표가 되는 익스포트.
// ABOUTME: React 없이 블록 모델을 직접 HTML 문자열로 렌더(미리보기 SlideView/Diagram과 동일한 클래스·구조·기하)하고 공유 ppt-theme.css + 바닐라 런타임을 인라인한다.

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Block } from "@/lib/slide-schema";
import type { RenderSlide } from "@/components/slide-renderer/SlideView";
import { DEFAULT_THEME, type Theme } from "@/lib/themes";
import { sanitizeSvg } from "@/lib/sanitize-svg";

async function themeCss(): Promise<string> {
  return readFile(path.join(process.cwd(), "src/styles/ppt-theme.css"), "utf8");
}

function esc(s: string): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ---------- 다이어그램(Diagram.tsx와 동일한 기하) ---------- */
const COLOR: Record<string, string> = { blue: "var(--blue)", cyan: "var(--cyan)", green: "var(--green)", purple: "var(--purple)", amber: "var(--amber)", gray: "var(--gray)" };
const W = 640, H = 380, NW = 150, NH = 60, PAD = 18;

function cleanLabel(s: string): string {
  return s.replace(/\\n|\n/g, " ").replace(/\s+/g, " ").trim();
}
function wrapLabel(raw: string): string[] {
  const s = cleanLabel(raw);
  const MAX = 9;
  if (s.length <= MAX) return [s];
  const mid = Math.ceil(s.length / 2);
  let cut = -1;
  for (let d = 0; d < 5; d++) {
    for (const c of [mid - d, mid + d]) if (c > 0 && c < s.length && /[\s·,/]/.test(s[c])) { cut = c; break; }
    if (cut >= 0) break;
  }
  const l1 = cut >= 0 ? s.slice(0, cut).trim() : s.slice(0, MAX);
  let l2 = cut >= 0 ? s.slice(cut).trim() : s.slice(MAX);
  if (l2.length > MAX) l2 = l2.slice(0, MAX - 1) + "…";
  return [l1, l2];
}

type DiagramBlock = Extract<Block, { type: "diagram" }>;
type Pos = { x: number; y: number };

function diagramLayout(nodes: DiagramBlock["nodes"], kind: "graph" | "flow"): Record<string, Pos> {
  const pos: Record<string, Pos> = {};
  const n = nodes.length;
  if (n === 0) return pos;
  const span = W - NW - 2 * PAD;
  if (kind === "flow") {
    nodes.forEach((node, i) => { pos[node.id] = { x: n === 1 ? W / 2 - NW / 2 : PAD + (i * span) / (n - 1), y: H / 2 - NH / 2 }; });
    return pos;
  }
  if (n <= 2) {
    nodes.forEach((node, i) => { pos[node.id] = { x: n === 1 ? W / 2 - NW / 2 : PAD + i * span, y: H / 2 - NH / 2 }; });
    return pos;
  }
  const cx = W / 2 - NW / 2, cy = H / 2 - NH / 2, r = Math.min(W, H) / 2 - NH;
  nodes.forEach((node, i) => { const a = (i / n) * Math.PI * 2 - Math.PI / 2; pos[node.id] = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }; });
  return pos;
}

function renderDiagram(block: DiagramBlock, uid: string): string {
  const pos = diagramLayout(block.nodes, block.kind);
  const ctr = (p: Pos) => ({ x: p.x + NW / 2, y: p.y + NH / 2 });
  const edges = block.edges
    .map((e, i) => {
      const a = pos[e.from], b = pos[e.to];
      if (!a || !b) return null;
      const ca = ctr(a), cb = ctr(b), mx = (ca.x + cb.x) / 2;
      return { id: `${uid}e${i}`, d: `M${ca.x},${ca.y} C${mx},${ca.y} ${mx},${cb.y} ${cb.x},${cb.y}`, label: cleanLabel(e.label), mid: { x: mx, y: (ca.y + cb.y) / 2 } };
    })
    .filter(Boolean) as { id: string; d: string; label: string; mid: Pos }[];

  const edgePaths = edges.map((e) => `<path id="${e.id}" class="ppt-edge draw" d="${e.d}" pathLength="1"></path>`).join("");
  const dots = edges.map((e) => `<circle r="5" fill="var(--cyan)"><animateMotion dur="2.4s" repeatCount="indefinite"><mpath href="#${e.id}"></mpath></animateMotion></circle>`).join("");
  // graph는 엣지가 중앙에서 교차해 라벨이 뭉치므로 flow에서만 라벨 표시
  const edgeLabels = block.kind === "flow" ? edges.filter((e) => e.label).map((e) => `<text x="${e.mid.x}" y="${e.mid.y - 8}" text-anchor="middle" font-size="13" fill="var(--ink-faint)">${esc(e.label)}</text>`).join("") : "";
  const nodes = block.nodes
    .map((node) => {
      const p = pos[node.id];
      if (!p) return "";
      const c = COLOR[node.color] ?? COLOR.blue;
      const lines = wrapLabel(node.label);
      const cy = p.y + NH / 2;
      const text =
        lines.length === 1
          ? `<text x="${p.x + NW / 2}" y="${cy + 6}" text-anchor="middle" font-size="15" fill="var(--ink)">${esc(lines[0])}</text>`
          : `<text x="${p.x + NW / 2}" y="${cy - 2}" text-anchor="middle" font-size="15" fill="var(--ink)">${lines.map((ln, k) => `<tspan x="${p.x + NW / 2}" dy="${k === 0 ? 0 : 18}">${esc(ln)}</tspan>`).join("")}</text>`;
      return `<g class="ppt-node"><rect x="${p.x}" y="${p.y}" width="${NW}" height="${NH}" rx="12" stroke="${c}" stroke-width="2"></rect>${text}</g>`;
    })
    .join("");

  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${edgePaths}${dots}${edgeLabels}${nodes}</svg>`;
}

/* ---------- 블록 ---------- */
function highlighted(text: string, accent: string): string {
  if (accent && text.includes(accent)) {
    const [before, after] = text.split(accent);
    return `${esc(before)}<span class="hl">${esc(accent)}</span>${esc(after)}`;
  }
  return esc(text);
}

function renderBlock(block: Block, delay: number, slideIdx: number, blockIdx: number): string {
  const anim = `data-anim="${block.anim}" style="animation-delay:${delay}ms"`;
  switch (block.type) {
    case "heading":
      return `<h2 class="ppt-headline" ${anim}>${highlighted(block.text, block.accent)}</h2>`;
    case "subhead":
      return `<div class="ppt-subhead" ${anim}>${esc(block.text)}</div>`;
    case "paragraph":
      return `<p class="ppt-para" ${anim}>${esc(block.text)}</p>`;
    case "bullets":
      return `<ul class="ppt-bullets" ${anim}>${block.items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul>`;
    case "callout":
      return `<div class="ppt-callout tone-${block.tone}" ${anim}>${esc(block.text)}</div>`;
    case "kpi":
      return `<div class="ppt-kpis" ${anim}>${block.items
        .map((k) => `<div class="ppt-kpi"><span class="num" data-to="${k.value}" data-suffix="${esc(k.suffix)}">${k.value.toLocaleString()}${esc(k.suffix)}</span><span class="lbl">${esc(k.label)}</span></div>`)
        .join("")}</div>`;
    case "diagram":
      return `<div class="ppt-svgwrap" ${anim}>${renderDiagram(block, `d${slideIdx}_${blockIdx}_`)}</div>`;
    case "image":
      return `<div class="ppt-svgwrap" ${anim}><div style="width:100%;height:100%;border:2px dashed var(--line);border-radius:12px;display:flex;align-items:center;justify-content:center;color:var(--ink-faint);font-size:16px">🖼 ${esc(block.prompt || "이미지")}</div></div>`;
    case "freecanvas":
      return `<div class="ppt-svgwrap" ${anim}>${sanitizeSvg(block.svg)}</div>`;
    default:
      return "";
  }
}

/* ---------- 슬라이드 ---------- */
function renderSlide(slide: RenderSlide, idx: number): string {
  const full = slide.blocks.filter((b) => b.column === "full");
  const left = slide.blocks.filter((b) => b.column === "left");
  const right = slide.blocks.filter((b) => b.column === "right");
  const hasCols = left.length > 0 || right.length > 0;

  let i = 0;
  const delay = () => 110 + i++ * 90;

  const isHero = slide.layout === "title" || slide.layout === "section";
  const hasHeading = slide.blocks.some((b) => b.type === "heading");
  const showTitle = slide.title && !(isHero && hasHeading);

  let bi = 0;
  const rb = (b: Block) => renderBlock(b, delay(), idx, bi++);

  const brand = isHero ? `<div class="ppt-brand" data-anim="fade" style="animation-delay:40ms">d·camp &nbsp;|&nbsp; IT팀</div>` : "";
  const titleEl = showTitle ? `<h2 class="ppt-headline" data-anim="rise" style="animation-delay:${delay()}ms">${esc(slide.title)}</h2>` : "";
  const fullEls = full.map(rb).join("");
  const colsEl = hasCols ? `<div class="ppt-cols"><div class="ppt-col">${left.map(rb).join("")}</div><div class="ppt-col">${right.map(rb).join("")}</div></div>` : "";

  return `<section class="ppt-slide layout-${slide.layout}">${brand}${titleEl}${fullEls}${colsEl}</section>`;
}

const LAYOUT_CSS = `
*{box-sizing:border-box}
html,body{margin:0;height:100%;background:radial-gradient(1200px 800px at 78% -10%,rgba(79,156,249,.10),transparent 60%),#0a0e24;}
.export-stage{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
#deck{transform-origin:center center}
#deck .ppt-slide{display:none}
#deck .ppt-slide.active{display:flex}
.export-bar{position:fixed;left:0;right:0;bottom:14px;display:flex;gap:14px;align-items:center;justify-content:center;color:#9fb0cc;font:600 13px Pretendard,system-ui,sans-serif}
#dots{display:flex;gap:6px}
#dots i{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.25);cursor:pointer;transition:.2s}
#dots i.on{width:22px;border-radius:5px;background:linear-gradient(120deg,#2f6df6,#14b8c4)}
.export-hint{position:fixed;top:14px;right:18px;color:#6c7c9c;font:500 12px Pretendard,system-ui,sans-serif}
`;

const RUNTIME_JS = `
(function(){
  var deck=document.getElementById('deck');
  var slides=[].slice.call(deck.querySelectorAll('.ppt-slide'));
  var pager=document.getElementById('pager'),dotsWrap=document.getElementById('dots'),stage=document.getElementById('stage');
  var cur=0;
  slides.forEach(function(_,i){var d=document.createElement('i');d.onclick=function(e){e.stopPropagation();go(i)};dotsWrap.appendChild(d)});
  var dots=[].slice.call(dotsWrap.children);
  function scale(){var s=Math.min(window.innerWidth/1280,(window.innerHeight-56)/720);deck.style.transform='scale('+s+')';}
  function countup(slide){slide.querySelectorAll('.num[data-to]').forEach(function(el){var to=+el.getAttribute('data-to');var suf=el.getAttribute('data-suffix')||'';var t0=performance.now();function tick(now){var p=Math.min(1,(now-t0)/1100);var e=1-Math.pow(1-p,3);el.textContent=Math.round(to*e).toLocaleString()+suf;if(p<1)requestAnimationFrame(tick);}requestAnimationFrame(tick);});}
  function go(n){if(n<0||n>=slides.length)return;slides[cur].classList.remove('active');cur=n;var s=slides[cur];s.classList.add('active');dots.forEach(function(d,i){d.classList.toggle('on',i===cur)});pager.textContent=('0'+(cur+1)).slice(-2)+' / '+('0'+slides.length).slice(-2);countup(s);if((parseInt(location.hash.slice(1),10)||0)!==cur+1)history.replaceState(null,'','#'+(cur+1));}
  window.addEventListener('resize',scale);scale();
  document.addEventListener('keydown',function(e){if(['ArrowRight',' ','PageDown'].indexOf(e.key)>=0){e.preventDefault();go(cur+1)}else if(['ArrowLeft','PageUp'].indexOf(e.key)>=0){go(cur-1)}else if(e.key==='Home')go(0);else if(e.key==='End')go(slides.length-1);else if(e.key==='f'||e.key==='F'){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}});
  stage.addEventListener('click',function(e){var r=this.getBoundingClientRect();if(e.clientX-r.left<r.width*0.16)go(cur-1);else go(cur+1)});
  window.addEventListener('hashchange',function(){var h=parseInt(location.hash.slice(1),10);if(h>=1&&h<=slides.length&&h-1!==cur)go(h-1)});
  var h0=parseInt(location.hash.slice(1),10);go(h0>=1&&h0<=slides.length?h0-1:0);
})();
`;

export async function buildExportHtml(title: string, slides: RenderSlide[], theme: Theme = DEFAULT_THEME): Promise<string> {
  const css = await themeCss();
  const slidesMarkup = slides.map((s, i) => renderSlide(s, i)).join("\n");
  const tokenStyle = Object.entries(theme.tokens)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
<link rel="preconnect" href="https://cdn.jsdelivr.net" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" />
<style>
${css}
${LAYOUT_CSS}
html,body{background:${theme.surround} !important}
</style>
</head>
<body>
<div class="export-stage" id="stage">
  <div class="ppt-canvas play" id="deck" style="${tokenStyle}">
${slidesMarkup}
  </div>
</div>
<div class="export-bar"><span id="pager"></span><div id="dots"></div></div>
<div class="export-hint">← → · Space · F 전체화면</div>
<script>${RUNTIME_JS}</script>
</body>
</html>`;
}
