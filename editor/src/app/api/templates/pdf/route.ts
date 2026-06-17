// ABOUTME: 템플릿 원본 PDF 저장/조회. POST=Storage(template-pdfs)에 업로드 후 path 반환, GET ?path==다운로드(원본 보기 오버레이용).
// ABOUTME: 단일 사용자 모드라 service 키로 접근. path는 uuid 기반이라 추측 어려움.

import { supabaseAdmin } from "@/lib/supabase/admin";
import { randomUUID } from "node:crypto";

const BUCKET = "template-pdfs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "PDF 파일이 필요합니다." }, { status: 400 });
    const path = `pdfs/${randomUUID()}.pdf`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buf, { contentType: "application/pdf", upsert: true });
    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ path });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const path = new URL(request.url).searchParams.get("path");
    if (!path) return Response.json({ error: "path가 필요합니다." }, { status: 400 });
    const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path);
    if (error || !data) return Response.json({ error: "PDF를 찾을 수 없습니다." }, { status: 404 });
    return new Response(data, { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, max-age=3600" } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "오류" }, { status: 500 });
  }
}
