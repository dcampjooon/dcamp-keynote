-- ABOUTME: slides에 title(슬라이드 헤드라인) 컬럼 추가. M1에서 누락되어 헤드라인이 DB에 저장되지 않던 버그 수정.
-- ABOUTME: 기존 행은 빈 문자열로 백필(헤드라인은 blocks/heading에도 있는 경우가 많아 치명적이지 않음).

alter table slides add column if not exists title text not null default '';
