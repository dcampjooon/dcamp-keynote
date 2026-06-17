// ABOUTME: 샘플 PDF → AI 디자인 분석 → 템플릿 설정 추출. 여러 페이지를 한꺼번에 보고 공통 디자인 시스템(여백·색·타이포·모서리)을 뽑는다.
// ABOUTME: 본문 세부가 아니라 '영역/시스템' 관점으로 분석해 우리 TemplateSettings로 매핑. 결과는 템플릿 에디터에 채워 미세조정 후 저장.

import { z } from "zod";
import { anthropic, MODEL } from "@/lib/anthropic";

const FONT_IDS = ["pretendard", "noto-sans-kr", "gowun-dodum", "nanum-myeongjo", "ibm-plex-kr"] as const;

const Layout = z.object({
  name: z.string().describe("이 레이아웃의 한글 이름(예: 표지, 간지, 본문, 통계 강조)"),
  role: z.enum(["cover", "section", "body"]).describe("표지=cover, 장 구분=section, 그 외 내용 슬라이드=body"),
  bg: z.string().describe("이 레이아웃의 배경색 hex(밝으면 흰색 계열). 표지/간지가 어두우면 그 색."),
  fg: z.string().describe("이 레이아웃의 본문/제목 텍스트 색 hex(배경 대비)"),
  align: z.enum(["left", "center"]).describe("제목·콘텐츠 가로 정렬"),
  vAlign: z.enum(["top", "middle"]).describe("제목 블록의 세로 위치(중앙 배치면 middle)"),
  titleSize: z.number().describe("제목 px (표지 48~84, 본문 28~48)"),
  accent: z.enum(["none", "bar-left", "bar-top", "underline", "block"]).describe("제목 주변 강조 요소(없음/세로바/가로바/밑줄/블록)"),
  kicker: z.boolean().describe("상단에 브랜드/eyebrow 텍스트가 있는가"),
  footer: z.boolean().describe("하단에 페이지번호/푸터가 있는가"),
  columns: z.number().int().describe("본문 영역 컬럼 수(1 또는 2)"),
});

const Analysis = z.object({
  name: z.string().describe("이 디자인을 잘 나타내는 짧은 템플릿 이름"),
  rationale: z.string().describe("어떤 디자인 특징을 반영했는지 한 문장"),
  accent1: z.string().describe("주 강조색 hex (#RRGGBB)"),
  accent2: z.string().describe("보조 강조색 hex"),
  ink: z.string().describe("기본 본문 텍스트 색 hex"),
  canvasBg: z.string().describe("기본 슬라이드 배경색 hex"),
  surround: z.string().describe("발표 모드 바깥 배경 hex(어두운 톤 권장)"),
  fontId: z.enum(FONT_IDS).describe("가장 가까운 폰트: 세리프=nanum-myeongjo, 둥근 고딕=gowun-dodum, 일반 고딕=pretendard/noto-sans-kr/ibm-plex-kr"),
  keepAll: z.boolean().describe("한글 문서면 true(단어 단위 줄바꿈)"),
  radius: z.number().describe("모서리 둥글기 px (각진 디자인 0~4, 둥근 디자인 12~24)"),
  density: z.enum(["compact", "normal", "roomy"]).describe("여백 밀도: 여백이 좁으면 compact, 넓으면 roomy"),
  layouts: z.array(Layout).max(6).describe("덱에서 발견한 서로 다른 레이아웃들(보통 표지·간지·본문 등 2~4종)"),
});
const TOOL_SCHEMA = z.toJSONSchema(Analysis) as Record<string, unknown>;

const SYSTEM = `당신은 프레젠테이션 디자인 시스템 분석가다. 업로드된 샘플 덱(PDF)의 여러 페이지를 한꺼번에 보고, 개별 페이지의 본문 내용이 아니라 '여러 페이지에 반복 적용된 레이아웃과 디자인 시스템'을 추출하라.

핵심: 이 PDF가 곧 템플릿의 기준이다. 고정된 틀에 끼워 맞추지 말고, PDF에 실제로 존재하는 레이아웃 종류를 '발견'하라.
1) 레이아웃 발견(layouts): 표지·간지·본문처럼 구분되는 레이아웃을 찾아, 각각에 대해 배경색·텍스트색·정렬·제목 세로위치·제목 크기·강조요소(바/밑줄 등)·상단 브랜드 유무·하단 푸터 유무·본문 컬럼수를 기술하라. 표지/간지가 색 배경이면 그 bg를 정확히. 본문은 보통 흰 배경·상단 제목.
2) 전역 디자인 시스템: 주/보조 강조색, 기본 본문색, 기본 배경, 폰트(세리프/고딕), 여백 밀도, 모서리 둥글기, 한글 줄바꿈.

본문의 세세한 텍스트 내용은 무시하고 '영역/배치 규칙'만 추출하라. 색은 실제 사용된 대표색을 hex로.`;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "PDF 파일이 필요합니다." }, { status: 400 });
    if (file.type !== "application/pdf") return Response.json({ error: "PDF 파일만 분석할 수 있습니다." }, { status: 400 });

    const data = Buffer.from(await file.arrayBuffer()).toString("base64");

    const msg = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM,
      tools: [{ name: "emit_template", description: "분석한 디자인 시스템을 템플릿 설정으로 출력한다.", input_schema: TOOL_SCHEMA as never }],
      tool_choice: { type: "tool", name: "emit_template" },
      messages: [
        {
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
            { type: "text", text: "이 샘플 덱의 공통 디자인 시스템을 분석해 템플릿 설정으로 출력하라." },
          ],
        },
      ],
    });

    const tu = msg.content.find((b) => b.type === "tool_use");
    if (!tu || tu.type !== "tool_use") return Response.json({ error: "분석 실패" }, { status: 502 });
    const parsed = Analysis.safeParse(tu.input);
    if (!parsed.success) return Response.json({ error: "분석 결과 형식 오류", detail: parsed.error.issues }, { status: 502 });

    const { name, rationale, layouts: rawLayouts, ...settings } = parsed.data;
    const roleCount: Record<string, number> = {};
    const layouts = rawLayouts.map((l) => {
      const n = (roleCount[l.role] = (roleCount[l.role] ?? 0) + 1);
      return { ...l, columns: (l.columns >= 2 ? 2 : 1) as 1 | 2, id: n > 1 ? `${l.role}-${n}` : l.role };
    });
    return Response.json({ name, rationale, settings, layouts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return Response.json({ error: message }, { status: 500 });
  }
}
