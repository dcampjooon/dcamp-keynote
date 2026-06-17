// ABOUTME: 브라우저에서 PDF의 특정 페이지를 이미지(dataURL)로 렌더. 템플릿 '원본 보기' 오버레이용.
// ABOUTME: pdfjs-dist를 동적 import하고 워커는 버전에 맞는 CDN .mjs를 사용. ArrayBuffer는 호출마다 복사해 전달(detach 방지).

let workerSet = false;

export async function renderPdfPageToDataUrl(buf: ArrayBuffer, pageNo: number): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  if (!workerSet) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    workerSet = true;
  }
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  const page = await doc.getPage(Math.max(1, Math.min(pageNo, doc.numPages)));
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  const url = canvas.toDataURL("image/png");
  void doc.cleanup();
  return url;
}
