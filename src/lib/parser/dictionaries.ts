/**
 * Keyword dictionaries for the static judgment parser (ko / ja / zh / en).
 *
 * These strings are data, not UI copy, so they are exempt from the i18n
 * hard-coded string rule (docs/v2/CONVENTIONS.md).
 */

export interface EventCode {
  /** Uppercase prefix such as "C" (Comiket 108 -> C108) or "CP" (COMICUP). */
  prefix: string;
  /** Inclusive range of edition numbers accepted after the prefix. */
  min: number;
  max: number;
  /** Allow "CWT-67" / "CWT 67" in addition to "CWT67". */
  loose?: boolean;
}

export interface EventDef {
  /** Stable key, e.g. "comiket". */
  id: string;
  /**
   * Names and aliases, matched case-insensitively. Spaces inside a name also
   * match "no space" and "-" (so "Anime Expo" matches "AnimeExpo").
   */
  names: readonly string[];
  /** Short codes that are only an event when followed by a number. */
  codes?: readonly EventCode[];
  /** Upper-case acronyms matched as whole words, case-sensitively (AX, AFA). */
  acronyms?: readonly string[];
  /** Too broad to identify one event on its own (漫展, 온리전, Comic Con). */
  generic?: boolean;
  /** Keep the preceding word as part of the hint ("주술 온리전"). */
  takesPrefix?: boolean;
}

export const EVENT_DEFS: readonly EventDef[] = [
  // ---- Korea ----
  {
    id: 'seoul-comic-world',
    names: ['서울코믹월드', '서울 코믹월드', '서코', 'Seoul Comic World', 'SEOUL COMIC WORLD'],
  },
  { id: 'busan-comic-world', names: ['부산코믹월드', '부산 코믹월드', '부코'] },
  { id: 'comic-world', names: ['코믹월드', 'Comic World'] },
  {
    id: 'illustar-fes',
    names: ['일러스타페스', '일러스타 페스', '일러스타', '일페', 'ILLUSTAR FES', 'Illustar Fes'],
  },
  { id: 'd-festa', names: ['디페스타', '디페', 'D-FESTA', 'D.FESTA'] },
  { id: 'dongne-festa', names: ['동네페스타'] },
  { id: 'iso', names: ['아이소'] },
  { id: 'booth-days', names: ['부스데이즈', 'Booth Days', 'BOOTH DAYS'] },
  { id: 'cake-square', names: ['케이크스퀘어', '케이크 스퀘어', '케스퀘', 'Cake Square'] },
  { id: 'seoul-illustration-fair', names: ['서울일러스트레이션페어', '서울 일러스트레이션 페어', '서일페'] },
  { id: 'agf', names: ['애니메이트 걸즈 페스티벌', 'アニメイトガールズフェスティバル'], acronyms: ['AGF'] },
  { id: 'only-event-ko', names: ['온리전'], generic: true, takesPrefix: true },
  { id: 'fan-meeting', names: ['팬미팅'], generic: true },

  // ---- Japan ----
  {
    id: 'comiket',
    names: ['コミックマーケット', 'コミケット', 'コミケ', '冬コミ', '夏コミ', 'Comic Market', 'Comiket', '코미케', '코믹마켓'],
    codes: [{ prefix: 'C', min: 80, max: 199 }],
  },
  { id: 'comitia', names: ['コミティア', 'COMITIA', '코미티아'] },
  {
    id: 'comic-city',
    names: [
      'SUPER COMIC CITY',
      'スーパーコミックシティ',
      'HARU COMIC CITY',
      'COMIC CITY',
      'コミックシティ',
      'スパコミ',
      '春コミ',
    ],
  },
  {
    id: 'wonder-festival',
    names: ['ワンダーフェスティバル', 'ワンフェス', 'Wonder Festival', 'WONFES'],
    codes: [{ prefix: 'WF', min: 2000, max: 2099 }],
  },
  { id: 'comic-treasure', names: ['コミックトレジャー', 'コミトレ'] },
  { id: 'sunshine-creation', names: ['サンシャインクリエイション', 'サンクリ'] },
  { id: 'reitaisai', names: ['博麗神社例大祭', '例大祭'] },
  { id: 'bunfree', names: ['文学フリマ', '文フリ'] },
  { id: 'design-festa', names: ['デザインフェスタ', 'デザフェス', 'Design Festa'] },
  { id: 'j-garden', names: ['J.GARDEN', 'J GARDEN'] },
  { id: 'comic1', names: ['COMIC1'] },
  { id: 'only-event-ja', names: ['オンリーイベント', 'オンリー'], generic: true, takesPrefix: true },
  { id: 'sokubaikai', names: ['同人誌即売会', '即売会'], generic: true },

  // ---- Greater China ----
  {
    id: 'comicup',
    names: ['COMICUP', 'Comic Up', '魔都同人祭'],
    codes: [{ prefix: 'CP', min: 10, max: 99 }],
  },
  {
    id: 'cwt',
    names: ['Comic World Taiwan'],
    acronyms: ['CWT'],
    codes: [
      { prefix: 'CWT', min: 1, max: 199, loose: true },
      { prefix: 'CWTK', min: 1, max: 199, loose: true },
    ],
  },
  {
    id: 'fancy-frontier',
    names: ['Fancy Frontier', '開拓動漫祭', '开拓动漫祭', '開拓動漫', '开拓动漫'],
    // FF1-FF16 are Final Fantasy titles; Fancy Frontier is past its 40th edition.
    codes: [{ prefix: 'FF', min: 20, max: 99 }],
  },
  { id: 'petit-fancy', names: ['Petit Fancy'], codes: [{ prefix: 'PF', min: 20, max: 99 }] },
  // Bare "BW" is also black & white in art posts, so it needs a year.
  {
    id: 'bilibili-world',
    names: ['Bilibili World', 'BilibiliWorld'],
    codes: [{ prefix: 'BW', min: 2000, max: 2099 }],
  },
  { id: 'chinajoy', names: ['ChinaJoy', 'China Joy'], acronyms: ['CJ'] },
  { id: 'cicf', names: ['中国国际漫画节', '中國國際漫畫節'], acronyms: ['CICF'] },
  { id: 'firefly', names: ['萤火虫动漫游戏嘉年华', '萤火虫漫展', '螢火蟲'] },
  { id: 'comicon', names: ['ComiCon'] },
  { id: 'shcc', names: ['上海同人展'], acronyms: ['SHCC'] },
  { id: 'bjcc', names: ['北京同人展'], acronyms: ['BJCC'] },
  { id: 'acghk', names: ['香港動漫電玩節', '香港动漫电玩节', 'Ani-Com & Games', 'Ani-Com'], acronyms: ['ACGHK'] },
  { id: 'guoman', names: ['国漫'], generic: true },
  {
    id: 'doujin-generic-zh',
    names: ['同人誌販售會', '同人志展', '同人展', '同人祭', '漫展', '動漫展', '动漫展'],
    generic: true,
  },

  // ---- North America / SEA / Europe ----
  { id: 'anime-expo', names: ['Anime Expo'], acronyms: ['AX'] },
  { id: 'anime-nyc', names: ['Anime NYC'] },
  { id: 'otakon', names: ['Otakon'] },
  { id: 'fanime', names: ['FanimeCon', 'Fanime'] },
  { id: 'anime-central', names: ['Anime Central', 'ACen'] },
  { id: 'anime-boston', names: ['Anime Boston'] },
  { id: 'anime-north', names: ['Anime North'] },
  { id: 'katsucon', names: ['Katsucon'] },
  { id: 'momocon', names: ['MomoCon'] },
  { id: 'sakura-con', names: ['Sakura-Con', 'Sakura Con'] },
  { id: 'otakuthon', names: ['Otakuthon'] },
  { id: 'animazement', names: ['Animazement'] },
  { id: 'awa', names: ['Anime Weekend Atlanta'], acronyms: ['AWA'] },
  { id: 'sdcc', names: ['San Diego Comic-Con', 'San Diego Comic Con'], acronyms: ['SDCC'] },
  { id: 'nycc', names: ['New York Comic Con', 'New York Comic-Con'], acronyms: ['NYCC'] },
  { id: 'eccc', names: ['Emerald City Comic Con'], acronyms: ['ECCC'] },
  { id: 'fan-expo', names: ['Fan Expo'] },
  {
    id: 'comic-fiesta',
    names: ['Comic Fiesta'],
    codes: [{ prefix: 'CF', min: 2000, max: 2099 }],
  },
  {
    id: 'comic-frontier',
    names: ['Comic Frontier', 'Comifuro'],
    codes: [{ prefix: 'CF', min: 1, max: 99 }],
  },
  { id: 'afa', names: ['Anime Festival Asia'], acronyms: ['AFA'] },
  { id: 'japan-expo', names: ['Japan Expo'] },
  { id: 'connichi', names: ['Connichi'] },
  { id: 'dokomi', names: ['DoKomi'] },
  { id: 'animagic', names: ['AnimagiC', 'Animagic'] },
  { id: 'hyper-japan', names: ['Hyper Japan'] },
  { id: 'mcm', names: ['MCM Comic Con'], acronyms: ['MCM'] },
  { id: 'lucca', names: ['Lucca Comics'] },
  { id: 'paris-manga', names: ['Paris Manga'] },
  { id: 'comic-con', names: ['Comic-Con', 'Comic Con', 'ComicCon', '코믹콘'], generic: true },
];

/** Legacy zone keywords (kept verbatim) plus a few common additions. */
export const ZONE_KEYWORDS: readonly string[] = [
  // ko
  '쁘띠존',
  '프리존',
  '신간존',
  '합동존',
  '기업존',
  '동인존',
  '일반존',
  '특별존',
  // en
  'Artist Alley',
  'Dealers Hall',
  'Dealer',
  'Small Press',
  'Corporate',
  'Indie',
  'Fan Table',
  // ja
  '企業ブース',
  '同人ブース',
  'サークルスペース',
  '壁サークル',
  '島中',
  'お誕生日席',
  // zh
  '同人区',
  '同人區',
  '企业区',
  '企業區',
  '画师区',
  '繪師區',
  '独立区',
  '獨立區',
];

export type LangGroup = 'ko' | 'ja' | 'zh' | 'en';

/**
 * Explicit mail-order terms. `label` is what the booth number falls back to
 * when a post is mail-order only ("통판" is the v1 value and stays for ko).
 */
export const MAIL_ORDER_TERMS: ReadonlyArray<{ lang: LangGroup; label: string; terms: readonly string[] }> = [
  {
    lang: 'ko',
    label: '통판',
    terms: ['통판', '통신판매', '온라인판매', '온라인 판매', '온라인샵', '온라인 샵', '온라인 주문'],
  },
  {
    lang: 'ja',
    label: '通販',
    terms: ['事前通販', '事後通販', '自家通販', '通信販売', 'オンライン販売', 'オンラインショップ', '通販'],
  },
  { lang: 'zh', label: '通贩', terms: ['通贩', '邮购', '郵購', '网购', '網購', '线上贩售', '線上販售'] },
  {
    lang: 'en',
    label: 'Mail order',
    terms: ['mail order', 'mail-order', 'mailorder', 'online orders', 'online order', 'online shop', 'online store', 'webshop', 'web shop'],
  },
];

/**
 * English "pre-order" is ambiguous: at cons it usually means "reserve now,
 * pick up at the table". It counts as mail order only without a pickup cue
 * (see signals.ts).
 */
export const PREORDER_EN_TERMS: readonly string[] = ['pre-orders', 'pre-order', 'preorders', 'preorder', 'pre orders', 'pre order'];

export const PREORDER_TERMS: readonly string[] = [
  ...PREORDER_EN_TERMS,
  // ko
  '선입금',
  '선주문',
  '사전예약',
  '사전 예약',
  '예약판매',
  '예약 판매',
  '사전판매',
  '사전 판매',
  // ja
  '事前予約',
  '予約',
  '取り置き',
  '取置',
  // zh
  '预售',
  '預售',
  '预购',
  '預購',
  '预订',
  '預訂',
  '预定',
  '預定',
];

export const ONSITE_TERMS: readonly string[] = [
  // ko
  '현장판매',
  '현장 판매',
  '현장구매',
  '현장 구매',
  '현장수령',
  '현장 수령',
  '현판',
  // ja
  '当日頒布',
  '当日販売',
  '会場頒布',
  '会場限定',
  '現地',
  // zh
  '现场贩售',
  '現場販售',
  '现场',
  '現場',
  '场贩',
  '場販',
  // en
  'on-site',
  'onsite',
  'on site',
  'at the table',
  'at the booth',
  'at the con',
  'in person',
  'in-person',
];

export const PICKUP_TERMS: readonly string[] = [
  '현장수령',
  '현장 수령',
  '현장 픽업',
  '수령',
  '取り置き',
  '会場受け取り',
  '当日受け取り',
  '現地受け取り',
  '现场取货',
  '現場取貨',
  '自取',
  '面交',
  'pickup',
  'pick-up',
  'pick up',
  'at the con',
  'at the table',
  'at the booth',
];

export const SHIPPING_TERMS: readonly string[] = [
  '택배',
  '배송',
  '発送',
  '配送',
  '郵送',
  '发货',
  '寄送',
  '运费',
  '運費',
  'shipping',
  'ships',
  'ship worldwide',
  'delivery',
  'worldwide',
];

/** Words that make a parenthetical in a display name a status note. */
export const NAME_NOTE_WORDS: readonly string[] = [
  '부스',
  '통판',
  '신간',
  '휴재',
  '마감',
  '작업',
  '원고',
  'booth',
  'table',
  'closed',
  'hiatus',
  'busy',
  'comms',
  'スペース',
  '通販',
  '新刊',
  '低浮上',
  '修羅場',
  '原稿',
  '摊位',
  '攤位',
  '通贩',
];

export type LinkKind = 'order' | 'info' | 'other';

export interface LinkRule {
  /** Host or host suffix (a rule for "booth.pm" also matches "foo.booth.pm"). */
  host: string;
  /** Optional path prefix, e.g. "/forms" on docs.google.com. */
  path?: string;
  kind: LinkKind;
  service: string;
}

/** First matching rule wins, so more specific rules come first. */
export const LINK_RULES: readonly LinkRule[] = [
  // order forms and shops
  { host: 'witchform.com', kind: 'order', service: 'witchform' },
  { host: 'forms.gle', kind: 'order', service: 'google-forms' },
  { host: 'docs.google.com', path: '/forms', kind: 'order', service: 'google-forms' },
  { host: 'tally.so', kind: 'order', service: 'tally' },
  { host: 'typeform.com', kind: 'order', service: 'typeform' },
  { host: 'form.run', kind: 'order', service: 'formrun' },
  { host: 'jotform.com', kind: 'order', service: 'jotform' },
  { host: 'forms.office.com', kind: 'order', service: 'microsoft-forms' },
  { host: 'smartstore.naver.com', kind: 'order', service: 'smartstore' },
  { host: 'tumblbug.com', kind: 'order', service: 'tumblbug' },
  { host: 'marpple.shop', kind: 'order', service: 'marpple' },
  { host: 'booth.pm', kind: 'order', service: 'booth' },
  { host: 'melonbooks.co.jp', kind: 'order', service: 'melonbooks' },
  { host: 'toranoana.jp', kind: 'order', service: 'toranoana' },
  { host: 'alice-books.com', kind: 'order', service: 'alice-books' },
  { host: 'pictspace.net', kind: 'order', service: 'pictspace' },
  { host: 'suzuri.jp', kind: 'order', service: 'suzuri' },
  { host: 'weidian.com', kind: 'order', service: 'weidian' },
  { host: 'taobao.com', kind: 'order', service: 'taobao' },
  { host: 'm.tb.cn', kind: 'order', service: 'taobao' },
  { host: 'pinkoi.com', kind: 'order', service: 'pinkoi' },
  { host: 'shopee.tw', kind: 'order', service: 'shopee' },
  { host: 'shopee.com.my', kind: 'order', service: 'shopee' },
  { host: 'shopee.sg', kind: 'order', service: 'shopee' },
  { host: 'ko-fi.com', kind: 'order', service: 'ko-fi' },
  { host: 'gumroad.com', kind: 'order', service: 'gumroad' },
  { host: 'etsy.com', kind: 'order', service: 'etsy' },
  { host: 'bigcartel.com', kind: 'order', service: 'bigcartel' },
  { host: 'storenvy.com', kind: 'order', service: 'storenvy' },
  // info pages
  { host: 'x.com', path: '/i/', kind: 'info', service: 'x' },
  { host: 'twitter.com', path: '/i/', kind: 'info', service: 'x' },
  { host: 'postype.com', kind: 'info', service: 'postype' },
  { host: 'linktr.ee', kind: 'info', service: 'linktree' },
  { host: 'lit.link', kind: 'info', service: 'litlink' },
  { host: 'potofu.me', kind: 'info', service: 'potofu' },
  { host: 'carrd.co', kind: 'info', service: 'carrd' },
  { host: 'notion.site', kind: 'info', service: 'notion' },
  { host: 'privatter.net', kind: 'info', service: 'privatter' },
  { host: 'circle.ms', kind: 'info', service: 'circle-ms' },
  { host: 'comiket.co.jp', kind: 'info', service: 'comiket' },
  // everything else that we still want to recognize by name
  { host: 'x.com', kind: 'other', service: 'x' },
  { host: 'twitter.com', kind: 'other', service: 'x' },
  { host: 't.co', kind: 'other', service: 'x' },
  { host: 'twimg.com', kind: 'other', service: 'x' },
  { host: 'instagram.com', kind: 'other', service: 'instagram' },
  { host: 'threads.net', kind: 'other', service: 'threads' },
  { host: 'threads.com', kind: 'other', service: 'threads' },
  { host: 'bsky.app', kind: 'other', service: 'bluesky' },
  { host: 'tiktok.com', kind: 'other', service: 'tiktok' },
  { host: 'youtube.com', kind: 'other', service: 'youtube' },
  { host: 'youtu.be', kind: 'other', service: 'youtube' },
  { host: 'pixiv.net', kind: 'other', service: 'pixiv' },
  { host: 'plurk.com', kind: 'other', service: 'plurk' },
  { host: 'weibo.com', kind: 'other', service: 'weibo' },
  { host: 'facebook.com', kind: 'other', service: 'facebook' },
];

/** Services that are the post itself or media, never a form fallback. */
export const SOCIAL_SERVICES: ReadonlySet<string> = new Set([
  'x',
  'instagram',
  'threads',
  'bluesky',
  'tiktok',
  'youtube',
  'pixiv',
  'plurk',
  'weibo',
  'facebook',
]);

/** Share/tracking params removed from every URL. */
export const TRACKING_PARAMS: ReadonlySet<string> = new Set([
  'igsh',
  'igshid',
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'yclid',
  'mc_cid',
  'mc_eid',
  'mibextid',
  'ref_src',
  'ref_url',
  '_ga',
]);

/**
 * `s` and `t` are share params on social hosts (x.com/...?s=20&t=abc), but
 * `t` is a timestamp on video sites and may be meaningful elsewhere, so they
 * are only removed on these services.
 */
export const SHARE_PARAM_SERVICES: ReadonlySet<string> = new Set(['x', 'instagram', 'threads', 'tiktok']);
