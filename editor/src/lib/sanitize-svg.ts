// ABOUTME: 자유 캔버스(freecanvas) 블록의 SVG를 안전하게 정화. script·이벤트핸들러·foreignObject·외부참조를 제거한다.
// ABOUTME: SVG 애니메이션(<animate>/<animateMotion>)은 허용 — 역동적 비주얼을 살리면서 XSS 표면만 차단. 서버·클라 공용(순수 문자열).

export function sanitizeSvg(input: string): string {
  if (!input) return "";
  const start = input.indexOf("<svg");
  const end = input.lastIndexOf("</svg>");
  if (start < 0 || end < 0) return "";
  let svg = input.slice(start, end + 6);

  // 위험 요소 제거(여닫는 쌍)
  svg = svg.replace(/<\s*(script|foreignObject|iframe|object|embed|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "");
  // 위험 요소(자체 닫힘 포함)
  svg = svg.replace(/<\s*(script|foreignObject|iframe|object|embed|style|link|meta)\b[^>]*\/?>/gi, "");
  // on* 이벤트 핸들러 속성 제거
  svg = svg.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  // javascript: / data:text 등 위험 URL 제거
  svg = svg.replace(/((?:xlink:)?href|src)\s*=\s*("(?:javascript|data:text)[^"]*"|'(?:javascript|data:text)[^']*')/gi, "");
  return svg;
}
