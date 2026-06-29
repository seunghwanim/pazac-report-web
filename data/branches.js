// data/branches.js — 지점 설정 (로직 없음, export만)
import { ITEMS } from './kitchen.js';

const FULL = ['도우','잠봉슬라이스','풀드포크','게새포','계란','치킨(닭)','연어','스프','베토소','허니버터','호두','BD','샌프란','스리라차','나르코티코','RTM','연어(야채)','크랩포션','치킨포션'];

export const BRANCHES = {
  '북성수':    { roster: FULL.slice(), reportTypes: ['kitchen_open','hall_open','kitchen_close','hall_close'] },
  '여의도':    { roster: FULL.slice(), reportTypes: ['kitchen_open','hall_open','kitchen_close','hall_close'] },
  '신세계강남':{ roster: ['도우','잠봉슬라이스','베토소','허니버터','BD','RTM','그라나파다노','슬라이스치즈','피오르디','레몬컷'], reportTypes: ['kitchen_open','hall_open','kitchen_close','hall_close'] },
  '청계천':    { roster: ['도우','잠봉슬라이스','풀드포크','게새포','계란','치킨(닭)','연어','스프','베토소','허니버터','호두','어니언칩','BD','샌프란','스리라차','나르코티코','그라나파다노','슬라이스치즈','슈레드치즈','RTM','연어(야채)','크랩포션','치킨포션'], reportTypes: ['kitchen_open','hall_open','kitchen_close','hall_close'] },
};

export const BRANCH_ORDER = ['북성수','여의도','신세계강남','청계천'];
