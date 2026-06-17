// ABOUTME: 샘플 PDF → AI 디자인 분석 → 템플릿 설정 추출. 여러 페이지를 한꺼번에 보고 공통 디자인 시스템(여백·색·타이포·모서리)을 뽑는다.
// ABOUTME: 본문 세부가 아니라 '영역/시스템' 관점으로 분석해 우리 TemplateSettings로 매핑. 결과는 템플릿 에디터에 채워 미세조정 후 저장.

import { z } from "zod";
import { anthropic, MODEL } from "@/lib/anthropic";

const FONT_IDS = ["pretendard", "noto-sans-kr", "gowun-dodum", "nanum-myeongjo", "ibm-plex-kr"] as const;

const Analysis = z.object({
  name: z.string().describe("이 디자인을 잘 나타내는 짧은 템플릿 이름"),
  rationale: z.string().describe("어떤 디자인 특징을 반영했는지 한 문장"),
  accent1: z.string().describe("주 강조색 hex (#RRGGBB)"),
  accent2: z.string().describe("보조 강조색 hex"),
  ink: z.string().describe("본문 텍스트 색 hex"),
  canvasBg: z.string().describe("슬라이드 배경색 hex"),
  surround: z.string().describe("발표 모드 바깥 배경 hex(어두운 톤 권장)"),
  fontId: z.enum(FONT_IDS).describe("가장 가까운 폰트: 세리프=nanum-myeongjo, 둥근 고딕=gowun-dodum, 일반 고딕=pretendard/noto-sans-kr/ibm-plex-kr"),
  keepAll: z.boolean().describe("한글 문서면 true(단어 단위 줄바꿈)"),
  radius: z.number().describe("모서리 둥글기 px (각진 디자인 0~4, 둥근 디자인 12~24)"),
  density: z.enum(["compact", "normal", "roomy"]).describe("여백 밀도: 여백이 좁으면 compact, 넓으면 roomy"),
  titleSize: z.number().describe("표지 헤드라인 px (36~84)"),
  sectionSize: z.number().describe("간지 헤드라인 px (32~72)"),
  bodySize: z.number().describe("본문 헤드라인 px (28~56)"),
});
const TOOL_SCHEMA = z.toJSONSchema(Analysis) as Record<string, unknown>;

const SYSTEM = `당신은 프레젠테이션 디자인 시스템 분석가다. 업로드된 샘플 덱(PDF)의 여러 페이지를 한꺼번에 보고, 개별 페이지의 본문 내용이 아니라 '여러 페이지에 공통으로 적용된 디자인 시스템'을 추출하라.

분석 관점(공통 패턴):
- 여백/마진을 어떻게 잡았는가(넓은지 좁은지) → density
- 색 팔레트: 주/보조 강조색, 본문 텍스트색, 배경색
- 타이포: 세리프/고딕 계열, 표지·간지·본문 헤드라인의 상대적 크기 위계
- 핵심 메시지(헤드라인)를 어떤 크기·위치로 배치하는지
- 모서리 처리(각진지 둥근지) → radius
- 한글 위주면 단어 단위 줄바꿈(keepAll)

본문의 세세한 내용은 무시하고, '템플릿'으로 재사용할 디자인 규칙만 우리 파라미터로 매핑하라. 색은 실제 사용된 대표색을 hex로.`;

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

    const { name, rationale, ...settings } = parsed.data;
    return Response.json({ name, rationale, settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return Response.json({ error: message }, { status: 500 });
  }
}
