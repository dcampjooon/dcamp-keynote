// ABOUTME: 샘플 PDF → AI 디자인 분석 → 템플릿 설정 추출. 여러 페이지를 한꺼번에 보고 공통 디자인 시스템(여백·색·타이포·모서리)을 뽑는다.
// ABOUTME: 본문 세부가 아니라 '영역/시스템' 관점으로 분석해 우리 TemplateSettings로 매핑. 결과는 템플릿 에디터에 채워 미세조정 후 저장.

import { z } from "zod";
import { anthropic, MODEL } from "@/lib/anthropic";

const FONT_IDS = ["pretendard", "noto-sans-kr", "gowun-dodum", "nanum-myeongjo", "ibm-plex-kr"] as const;

const RegionZ = z.object({
  kind: z.enum(["text", "line", "placeholder", "footer"]).describe("text=글자영역, line=구분선, placeholder=차트/이미지 자리, footer=하단 문서명/페이지"),
  label: z.string().describe("역할 이름: eyebrow(보조텍스트)/headline(헤드라인)/intro(소개문)/partNumber(큰 번호)/chartTitle/chart/source(출처)/docname/page/divider 등"),
  x: z.number().describe("좌측 위치 % (0~100, 슬라이드 폭 기준)"),
  y: z.number().describe("상단 위치 % (0~100, 슬라이드 높이 기준)"),
  w: z.number().describe("폭 %"),
  h: z.number().describe("높이 %"),
  sampleText: z.string().default("").describe("PDF에 실제 있던 텍스트 그대로(예: 'PART 01', '2월 KOSPI 전망: 5,100~5,700pt'). line/placeholder는 빈 문자열"),
  fontSize: z.number().default(0).describe("글자 크기 px (1280x720 기준; 큰 번호 100~140, 헤드라인 32~48, 보조 16~22, 본문 14~20). 글자영역만."),
  color: z.string().default("").describe("글자/선 색 hex (빈값이면 레이아웃 기본색)"),
  weight: z.enum(["normal", "bold", "black"]).default("normal"),
  align: z.enum(["left", "center", "right"]).default("left"),
  orient: z.enum(["h", "v"]).default("h").describe("line 방향(가로/세로)"),
  thickness: z.number().default(0).describe("line 두께 px"),
});

const Layout = z.object({
  name: z.string().describe("이 레이아웃의 한글 이름(예: 표지, 간지, 본문, 본문 2단 차트)"),
  role: z.enum(["cover", "section", "body"]).describe("표지=cover, 장 구분=section, 그 외 내용 슬라이드=body"),
  bg: z.string().describe("이 레이아웃의 배경색 hex(밝으면 흰색 계열). 표지/간지가 색 배경이면 그 색."),
  fg: z.string().describe("이 레이아웃의 기본 텍스트 색 hex(배경 대비)"),
  align: z.enum(["left", "center"]).describe("(폴백) 전체 정렬"),
  vAlign: z.enum(["top", "middle"]).describe("(폴백) 제목 세로 위치"),
  titleSize: z.number().describe("(폴백) 제목 px"),
  accent: z.enum(["none", "bar-left", "bar-top", "underline", "block"]).default("none"),
  kicker: z.boolean().default(false),
  footer: z.boolean().default(false),
  columns: z.number().int().describe("본문 차트/콘텐츠 컬럼 수(1단이면 1, 좌우 2단이면 2)"),
  sourcePage: z.number().int().default(1).describe("이 레이아웃을 가장 잘 보여주는 PDF 페이지 번호(1부터)"),
  regions: z.array(RegionZ).max(14).describe("이 레이아웃을 구성하는 영역들 — 위치(%)·역할·실제 텍스트·선·차트 자리·푸터까지"),
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

const SYSTEM = `당신은 프레젠테이션 레이아웃 분석가다. 업로드된 샘플 덱(PDF)을 보고, 이 PDF가 곧 템플릿의 기준이 되도록 '각 레이아웃의 영역(zone) 구성'을 위치까지 정밀하게 추출하라. 슬라이드는 1280x720 좌표계로 보고, 모든 위치는 % (0~100)로 표기한다.

1) 레이아웃 발견(layouts): PDF에 실제로 존재하는 서로 다른 레이아웃을 발견하라. 영역 구성이 다르면 별개 레이아웃이다(예: '본문 2단 차트' vs '본문 1단 차트'). 표지/간지/본문 + 그 변형들.

2) 각 레이아웃의 regions: 그 레이아웃을 이루는 모든 영역을 위치(%)와 함께 나열하라.
   - 글자영역(text): 역할(eyebrow 보조텍스트, headline 헤드라인, intro 소개문, partNumber 큰 번호, chartTitle, source 출처, docname 문서명, page 페이지번호 등)과 PDF의 실제 텍스트를 sampleText에 그대로, 글자 크기(px)·색·굵기·정렬까지.
   - 구분선(line): 위치·방향(orient)·두께·색. (예: 간지의 세로 구분선, 본문 헤드라인 아래 가로선, 푸터 위 라인)
   - 차트/이미지 자리(placeholder): label 'chart' 등으로 영역만. 내부 내용은 분석하지 않는다.
   - 푸터(footer): 하단의 문서명·페이지번호 위치/크기.
   예) 간지: partNumber 'PART 01'(큰 글자, 좌측) + 세로 line + headline '주식시장 전망'(중간 크기, 선 우측).
   예) 본문 2단 차트: eyebrow '주식시장 전망'(상단 작게) + headline '2월 KOSPI 전망:...'(강조색, 큰 글자) + 헤드라인 아래 가로 line + intro 소개문(text) + 좌/우 각각 chartTitle+chart(placeholder)+source(출처 text) + 하단 우측 footer.

3) 전역 디자인: 주/보조 강조색, 기본 텍스트색, 기본 배경, 폰트(세리프/고딕), 여백 밀도, 모서리 둥글기, 한글 줄바꿈.

규칙: 본문의 세세한 모든 글머리표까지 옮길 필요는 없다. 영역의 '위치·역할·대표 텍스트 한 줄'이면 충분하다. 색은 실제 사용된 hex로. fontSize는 1280x720 기준 px로 추정.`;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return Response.json({ error: "PDF 파일이 필요합니다." }, { status: 400 });
    if (file.type !== "application/pdf") return Response.json({ error: "PDF 파일만 분석할 수 있습니다." }, { status: 400 });

    const data = Buffer.from(await file.arrayBuffer()).toString("base64");

    const msg = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 8000,
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
      const id = n > 1 ? `${l.role}-${n}` : l.role;
      const regions = (l.regions ?? []).map((r, ri) => ({ ...r, id: `${id}-r${ri}` }));
      return { ...l, columns: (l.columns >= 2 ? 2 : 1) as 1 | 2, id, regions };
    });
    return Response.json({ name, rationale, settings, layouts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return Response.json({ error: message }, { status: 500 });
  }
}
