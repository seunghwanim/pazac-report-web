// data/hall.js — 홀 마스터 데이터 (로직 없음, export만)

export const POSITIONS = ['파스','포장','인포','러너','설거지'];

// 발주 품목 — 드롭다운 항목과 단위를 여기서 직접 관리하세요.
//   { name:'품목명', unit:'단위' } 형태로 추가/수정.
//   목록에 없는 품목은 폼에서 '✏️ 직접 입력'으로 타이핑할 수 있습니다.
export const ORDER_ITEMS = {
  bev: [
    { name:'콜라',          unit:'박스' },
    { name:'제로콜라',      unit:'박스' },
    { name:'사이다',        unit:'박스' },
    { name:'생수',          unit:'박스' },
    { name:'스파클링워터',  unit:'박스' },
    { name:'오렌지주스',    unit:'박스' },
    { name:'자몽에이드',    unit:'박스' },
    { name:'아메리카노 원액', unit:'박스' },
    { name:'맥주',          unit:'박스' },
    { name:'레드와인',      unit:'박스' },
    { name:'화이트와인',    unit:'박스' },
  ],
  con: [
    { name:'스푼',          unit:'박스' },
    { name:'포크',          unit:'박스' },
    { name:'나이프',        unit:'박스' },
    { name:'냅킨',          unit:'박스' },
    { name:'물티슈',        unit:'박스' },
    { name:'퇴식구 물티슈', unit:'박스' },
    { name:'빨대',          unit:'박스' },
    { name:'크로스타 용기', unit:'박스' },
    { name:'포장봉투',      unit:'박스' },
    { name:'1구 캐리어',    unit:'박스' },
    { name:'2구 캐리어',    unit:'박스' },
    { name:'스프레드 스푼', unit:'박스' },
  ],
};

// 드롭다운에서 단위가 비어있는 품목/직접입력 시 기본 단위
export const DEFAULT_UNIT = '박스';
