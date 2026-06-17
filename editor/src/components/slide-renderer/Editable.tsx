// ABOUTME: 인라인 편집용 contentEditable 래퍼. 편집 모드일 때 텍스트를 직접 고치고 blur 시 변경분만 커밋한다.
// ABOUTME: 편집 중에는 value를 리렌더로 덮지 않아(uncontrolled) 커서 튐을 막는다. Enter는 줄바꿈 대신 커밋.

"use client";

import { type ElementType } from "react";

export function Editable({
  as: Tag = "span",
  value,
  editable,
  onCommit,
  className,
  style,
  dataAnim,
}: {
  as?: ElementType;
  value: string;
  editable: boolean;
  onCommit: (next: string) => void;
  className?: string;
  style?: React.CSSProperties;
  dataAnim?: string;
}) {
  if (!editable) {
    return (
      <Tag className={className} style={style} data-anim={dataAnim}>
        {value}
      </Tag>
    );
  }
  return (
    <Tag
      className={className}
      style={style}
      data-anim={dataAnim}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-editable="true"
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const next = (e.currentTarget.textContent ?? "").trim();
        if (next !== value) onCommit(next);
      }}
    >
      {value}
    </Tag>
  );
}
