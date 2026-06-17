// ABOUTME: 템플릿 수정/복제(/templates/[id]). id로 템플릿을 불러와 에디터에 채운다(빌트인이면 읽기전용→복제).

"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TemplateEditor } from "@/components/TemplateEditor";
import type { Theme } from "@/lib/themes";

export default function EditTemplatePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [template, setTemplate] = useState<Theme | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch(`/api/templates/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.template) setTemplate(d.template); else setError(d.error || "템플릿을 찾을 수 없습니다."); })
      .catch(() => setError("불러오기 오류"));
  }, [id]);

  if (error) return <div className="p-10 text-sm text-muted-foreground">{error}</div>;
  if (!template) return <div className="p-10 text-sm text-muted-foreground">불러오는 중…</div>;
  // 빌트인이면 복제(새 저장), 사용자 템플릿이면 수정
  return <TemplateEditor initial={template} templateId={template.builtin ? undefined : id} />;
}
