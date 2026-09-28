import { describe, expect, it } from 'vitest';
import { isValidBoothNumber, parseBoothText, type ParseOptions, type StaticJudgment } from './text';

describe('parseBoothText (v1 behaviour kept)', () => {
  it('parses bracketed event/booth format', () => {
    const r = parseBoothText('[서코45/A-01] 서클명입니다!');
    expect(r.eventHint).toBe('서코45');
    expect(r.boothNumber).toBe('A-01');
  });

  it('detects mail order', () => {
    expect(parseBoothText('통판 오픈합니다').boothNumber).toBe('통판');
  });

  it('collects unique urls', () => {
    const r = parseBoothText('폼 https://a.com/x 그리고 https://a.com/x https://b.com');
    expect(r.formUrl).toBe('https://a.com/x\nhttps://b.com');
  });

  it('uses author display name as circle name', () => {
    expect(parseBoothText('hi', { author: '달빛서클 @moon' }).circleName).toBe('달빛서클');
  });
});

describe('ACORN-11 known bug', () => {
  it('keeps the physical booth when a post also offers mail order', () => {
    const r = parseBoothText(
      '[서코/B-12] 달빛서클 신간 & 굿즈 안내! 통판 폼 https://witchform.com/example'
    );
    expect(r.boothNumber).toBe('B-12');
    expect(r.isMailOrder).toBe(true);
    expect(r.eventHint).toBe('서코');
    expect(r.eventKey).toBe('seoul-comic-world');
    expect(r.formUrl).toBe('https://witchform.com/example');
  });
});

type Expected = Partial<
  Pick<
    StaticJudgment,
    | 'boothNumber'
    | 'eventHint'
    | 'eventKey'
    | 'eventNumber'
    | 'circleName'
    | 'zone'
    | 'formUrl'
    | 'isMailOrder'
    | 'dayHint'
    | 'dayIndex'
    | 'weekday'
    | 'saleMode'
  >
>;

interface Sample {
  name: string;
  text: string;
  options?: ParseOptions;
  expected: Expected;
  /** Fields that must be absent. */
  absent?: Array<keyof StaticJudgment>;
}

const SAMPLES: Sample[] = [
  // ---------------- Korean (X) ----------------
  {
    name: 'ko: labeled booth, circle and google form with tracking params',
    text: '서울코믹월드 2026 가을 참가합니다!\n부스 번호: H-15\n서클명: 별빛공방\n선입금 폼 https://forms.gle/AbC123?utm_source=x&utm_medium=social',
    expected: {
      boothNumber: 'H-15',
      eventKey: 'seoul-comic-world',
      eventNumber: 2026,
      circleName: '별빛공방',
      formUrl: 'https://forms.gle/AbC123',
      saleMode: 'preorder',
      isMailOrder: false,
    },
  },
  {
    name: 'ko: booth next to a date, weekday, paper size and prices',
    text: '10/17(토) 서코 1일차 AA-214 부스에서 만나요! 신간 A5 32p 5,000원 / 아크릴 스탠드 15,000원',
    expected: { boothNumber: 'AA-214', eventHint: '서코', dayIndex: 1, dayHint: '1일차' },
  },
  {
    name: 'ko: countdown D-7 and hashtags are not booths',
    text: '일페 D-7!! 이번에 G37에서 뵙겠습니다 🙇 #일러스타페스 #일페',
    expected: { boothNumber: 'G37', eventHint: '일페', eventKey: 'illustar-fes' },
  },
  {
    name: 'ko: negated mail order, on-site only',
    text: '부스는 B-12입니다. 통판은 없어요! 현장판매만 해요',
    expected: { boothNumber: 'B-12', isMailOrder: false, saleMode: 'onsite' },
  },
  {
    name: 'ko: hall prefix and R-18 rating',
    text: '코믹월드 홀1-B32 로 배치받았어요 R-18 신간 있음 (성인 확인)',
    expected: { boothNumber: '홀1-B32', eventHint: '코믹월드' },
  },
  {
    name: 'ko: order form listed before info page, www stripped from dedupe only',
    text: '케이크스퀘어 7 / 부스 C-05 / 인포 https://www.postype.com/@moon/post/123 / 폼 https://witchform.com/formViewer.php?fidx=9',
    expected: {
      boothNumber: 'C-05',
      eventKey: 'cake-square',
      eventNumber: 7,
      formUrl: 'https://witchform.com/formViewer.php?fidx=9\nhttps://www.postype.com/@moon/post/123',
    },
  },
  {
    name: 'ko: countdown, time and entry fee are not booths',
    text: '서코 D-3! 오후 1시~13:00 입장, 입장료 3,000원 ㅠㅠ',
    expected: { eventHint: '서코', isMailOrder: false },
    absent: ['boothNumber'],
  },
  {
    name: 'ko: handle and hashtags are not booths',
    text: '@B12_art 님 부스 놀러갈게요 #B12 #서코',
    expected: { eventHint: '서코' },
    absent: ['boothNumber'],
  },
  {
    name: 'ko: item variant list with prices is not a booth',
    text: '신간 굿즈 안내\nA-1 아크릴키링 5,000원\nA-2 아크릴키링 5,000원\nA-3 포카 세트 3,000원',
    expected: {},
    absent: ['boothNumber'],
  },
  {
    name: 'ko: booth and event from the author name, emoji stripped',
    text: '이번 행사 신간 샘플입니다',
    options: { author: '🌙달빛서클🌙 서코 B-12 @moon_circle' },
    expected: { circleName: '달빛서클', boothNumber: 'B-12', eventHint: '서코' },
  },
  {
    name: 'ko: lock emoji and "(부스 …)" note removed from author',
    text: '신간 안내',
    options: { author: '달빛서클🔒 (부스 A-12) @moon' },
    expected: { circleName: '달빛서클', boothNumber: 'A-12' },
  },
  {
    name: 'ko: mail-order-only post keeps the v1 label',
    text: '통신판매 폼 열었습니다 https://smartstore.naver.com/moon/products/1',
    expected: {
      boothNumber: '통판',
      isMailOrder: true,
      formUrl: 'https://smartstore.naver.com/moon/products/1',
    },
  },
  {
    name: 'ko: only-event with a prefix word in a bracket tag',
    text: '[주술 온리전/C-12] 달빛서클 참가합니다',
    expected: { boothNumber: 'C-12', eventHint: '주술 온리전' },
  },
  {
    name: 'ko: full-width characters are normalized',
    text: '［서코／Ｂ－１２］ 신간 안내',
    expected: { boothNumber: 'B-12', eventHint: '서코' },
  },
  {
    name: 'ko: suffix label "B-12번 부스"',
    text: '부코 B-12번 부스로 오세요~ 2일차에만 있어요',
    expected: { boothNumber: 'B-12', eventKey: 'busan-comic-world', dayIndex: 2 },
  },

  // ---------------- Japanese (おしながき) ----------------
  {
    name: 'ja: Comiket bracket with day prefix',
    text: '【C108 1日目 東ホ-12a】新刊おしながきです！よろしくお願いします🙏',
    expected: {
      boothNumber: '東ホ-12a',
      eventHint: 'C108',
      eventKey: 'comiket',
      eventNumber: 108,
      dayIndex: 1,
      dayHint: '1日目',
    },
  },
  {
    name: 'ja: 2日目, mail order via melonbooks with reservation',
    text: 'C108 2日目 西あ-05b「月光堂」で頒布します。通販はメロンブックスさんで予約受付中です https://www.melonbooks.co.jp/detail/detail.php?product_id=123',
    expected: {
      boothNumber: '西あ-05b',
      eventNumber: 108,
      dayIndex: 2,
      isMailOrder: true,
      saleMode: 'preorder',
      formUrl: 'https://www.melonbooks.co.jp/detail/detail.php?product_id=123',
    },
  },
  {
    name: 'ja: COMITIA kana block and labeled circle',
    text: 'コミティア150 き18a にいます！ サークル名：ねこまた屋 #コミティア150',
    expected: {
      boothNumber: 'き18a',
      eventHint: 'コミティア150',
      eventKey: 'comitia',
      eventNumber: 150,
      circleName: 'ねこまた屋',
    },
  },
  {
    name: 'ja: half-width kana and weekday',
    text: 'スペース：南ｱ01ab（土曜日）',
    expected: { boothNumber: '南ア01ab', weekday: 'sat', dayHint: '土曜日' },
  },
  {
    name: 'ja: hall number with space before the block',
    text: '冬コミ 東7ホール ア-12b でお待ちしております',
    expected: { boothNumber: '東7ホール ア-12b', eventHint: '冬コミ', eventKey: 'comiket' },
  },
  {
    name: 'ja: space written in the author name',
    text: '新刊サンプルです！',
    options: { author: '山田@C108 1日目東ホ-12a' },
    expected: {
      circleName: '山田',
      boothNumber: '東ホ-12a',
      eventHint: 'C108',
      dayIndex: 1,
    },
  },
  {
    name: 'ja: dates, times, B5 and 28P are not booths',
    text: '10/5(日) 11:00〜16:00 COMIC CITY 大阪 新刊 B5/28P 500円',
    expected: { eventKey: 'comic-city' },
    absent: ['boothNumber'],
  },
  {
    name: 'ja: no mail order planned',
    text: 'スパコミ 東1ホール ぬ12a 通販の予定はありません',
    expected: { boothNumber: '東1ホール ぬ12a', eventKey: 'comic-city', isMailOrder: false },
  },
  {
    name: 'ja: quoted circle name',
    text: 'サークル「星屑工房」 スペース：西れ-33a',
    expected: { circleName: '星屑工房', boothNumber: '西れ-33a' },
  },
  {
    name: 'ja: Final Fantasy "FF14" is neither event nor booth',
    text: 'FF14 ファンアート本 新刊です',
    expected: {},
    absent: ['boothNumber', 'eventHint'],
  },

  // ---------------- Taiwan (Plurk / FB) ----------------
  {
    name: 'zh-TW: FF bracket, Day1, labeled 攤位, pre-order form',
    text: '【FF42】Day1 攤位 J15 「貓咪社」 新刊預購表單 https://forms.gle/xyz123',
    expected: {
      boothNumber: 'J15',
      eventHint: 'FF42',
      eventKey: 'fancy-frontier',
      eventNumber: 42,
      dayIndex: 1,
      dayHint: 'Day1',
      saleMode: 'preorder',
      formUrl: 'https://forms.gle/xyz123',
    },
  },
  {
    name: 'zh-TW: CWT with 社團 label and 週六',
    text: 'CWT67 場次 社團：星夜 攤位：K32 週六',
    expected: {
      boothNumber: 'K32',
      eventHint: 'CWT67',
      eventKey: 'cwt',
      eventNumber: 67,
      circleName: '星夜',
      weekday: 'sat',
    },
  },
  {
    name: 'zh-TW: 第二天, table range and 無通販',
    text: '開拓動漫祭 FF42 第二天 攤位號 D05-06 本攤無通販',
    expected: {
      boothNumber: 'D05-06',
      eventHint: 'FF42',
      dayIndex: 2,
      isMailOrder: false,
    },
  },
  {
    name: 'zh-TW: hashtag event, time and NT$ price only',
    text: '#CWT67 見！時間 13:00-17:00 價格 NT$150',
    expected: { eventKey: 'cwt' },
    absent: ['boothNumber'],
  },

  // ---------------- Mainland China (Weibo) ----------------
  {
    name: 'zh-CN: CP with day in the 摊位号 label and 通贩 link',
    text: 'CP30 摊位号：DAY1 A-12 社团：月下 通贩链接 https://weidian.com/item.html?itemID=1&spider_token=abc',
    expected: {
      boothNumber: 'A-12',
      eventHint: 'CP30',
      eventKey: 'comicup',
      dayIndex: 1,
      circleName: '月下',
      isMailOrder: true,
      formUrl: 'https://weidian.com/item.html?itemID=1&spider_token=abc',
    },
  },
  {
    name: 'zh-CN: hall prefix 3号馆',
    text: 'CP29 3号馆 F19 见！ #COMICUP',
    expected: { boothNumber: '3号馆 F19', eventHint: 'CP29', eventKey: 'comicup' },
  },
  {
    name: 'zh-CN: pairing "CP", date, time and price are not booths',
    text: '漫展 10-17 14:00 场贩 ¥35 五悠CP向 #CP',
    expected: { eventKey: 'doujin-generic-zh', saleMode: 'onsite', isMailOrder: false },
    absent: ['boothNumber'],
  },
  {
    name: 'zh-CN: 周日 is Sunday',
    text: 'BW2026 周日 摊位 H-33',
    expected: { boothNumber: 'H-33', eventKey: 'bilibili-world', weekday: 'sun' },
  },

  // ---------------- English (artist alley) ----------------
  {
    name: 'en: Anime Expo artist alley table, pre-order for pickup',
    text: 'Find me at Anime Expo 2026 Artist Alley, table A12! Prints, stickers & charms 💖 Pre-orders for pickup: https://forms.gle/abc123',
    expected: {
      boothNumber: 'A12',
      eventHint: 'Anime Expo 2026',
      eventKey: 'anime-expo',
      eventNumber: 2026,
      zone: 'Artist Alley',
      saleMode: 'preorder',
      isMailOrder: false,
      formUrl: 'https://forms.gle/abc123',
    },
  },
  {
    name: 'en: AX acronym, "Table #C-45", ko-fi utm params stripped',
    text: 'AX 2026 ✨ Artist Alley Table #C-45 ✨ shop: https://ko-fi.com/moonart/shop?utm_source=twitter&utm_medium=social',
    expected: {
      boothNumber: 'C-45',
      eventHint: 'AX 2026',
      eventKey: 'anime-expo',
      formUrl: 'https://ko-fi.com/moonart/shop',
    },
  },
  {
    name: 'en: numeric dealer booth and weekday',
    text: 'Otakon booth 1234 — see you Saturday!',
    expected: { boothNumber: '1234', eventKey: 'otakon', weekday: 'sat', dayHint: 'Saturday' },
  },
  {
    name: 'en: mail order only, ships worldwide',
    text: 'Mail order is open until 10/31! Ships worldwide 🌍 https://moonart.bigcartel.com/product/charm',
    expected: {
      boothNumber: 'Mail order',
      isMailOrder: true,
      formUrl: 'https://moonart.bigcartel.com/product/charm',
    },
  },
  {
    name: 'en: pre-order without a booth counts as mail order',
    text: 'Pre-orders are open now! https://tally.so/r/abc',
    expected: { isMailOrder: true, saleMode: 'preorder', formUrl: 'https://tally.so/r/abc' },
  },
  {
    name: 'en: times, prices, versions, ratings and "no mail order"',
    text: 'Doors open 10AM, tickets $25. No mail order this time, sorry! v1.2 of my zine is out, R18 section at the back',
    expected: { isMailOrder: false },
    absent: ['boothNumber', 'eventHint'],
  },
  {
    name: 'en/MY: Comic Fiesta with ringgit prices',
    text: 'See you at Comic Fiesta 2026! Booth: H-07 (Hall 2). Prices RM15 / RM20',
    expected: { boothNumber: 'H-07', eventHint: 'Comic Fiesta 2026', eventKey: 'comic-fiesta' },
  },
  {
    name: 'en/ID: Comifuro edition code and day',
    text: 'CF21 day 2 — booth E-33 ✨ Comic Frontier',
    expected: { boothNumber: 'E-33', eventHint: 'CF21', eventKey: 'comic-frontier', dayIndex: 2 },
  },
  {
    name: 'en/FR: Japan Expo table',
    text: 'Japan Expo 2026 : Table E-120, Hall 5',
    expected: { boothNumber: 'E-120', eventKey: 'japan-expo', eventNumber: 2026 },
  },
  {
    name: 'en/SG: AFA creators hub',
    text: 'AFA SG 2026 Creators Hub booth B-08!',
    expected: { boothNumber: 'B-08', eventKey: 'afa' },
  },
  {
    name: 'en/DE: Connichi numeric table',
    text: 'Connichi 2026 - Artist Alley Table 12',
    expected: { boothNumber: '12', eventKey: 'connichi', zone: 'Artist Alley' },
  },

  // ---------------- Tricky negatives ----------------
  {
    name: 'neg: ISBN, version string and A4 size',
    text: 'ISBN 978-4-123456-78-9 / ver2.1 / A4 クリアファイル',
    expected: {},
    absent: ['boothNumber'],
  },
  {
    name: 'neg: a date before the event name',
    text: '10-17 서코에서 만나요',
    expected: { eventHint: '서코' },
    absent: ['boothNumber'],
  },
  {
    name: 'neg: prices in four currencies',
    text: '3,000원 / ¥1,500 / $20 / NT$300',
    expected: {},
    absent: ['boothNumber', 'eventHint'],
  },
  {
    name: 'neg: time and PM1',
    text: '13:00 開場 PM1 集合',
    expected: {},
    absent: ['boothNumber'],
  },
  {
    name: 'neg: handle that looks like a booth',
    text: '@A12 ありがとうございます',
    expected: {},
    absent: ['boothNumber'],
  },
  {
    name: 'neg: hashtags that look like booths',
    text: '#A12 #B-05',
    expected: {},
    absent: ['boothNumber'],
  },
  {
    name: 'neg: booth-shaped URL path',
    text: 'https://example.com/A-12/B12',
    expected: { formUrl: 'https://example.com/A-12/B12' },
    absent: ['boothNumber'],
  },
  {
    name: 'neg: B5, 36P and R-18',
    text: 'B5 36P R-18 本',
    expected: {},
    absent: ['boothNumber'],
  },
  {
    name: 'neg: pairing "CP" alone is not COMICUP',
    text: '五悠 CP 本 준비중',
    expected: {},
    absent: ['eventHint'],
  },
  {
    name: 'neg: x2 quantity and S size',
    text: '아크릴 스탠드 x2, 티셔츠 S/M/L',
    expected: {},
    absent: ['boothNumber'],
  },
  {
    name: 'neg: K-pop group name "ZB1" and floor "B1층"',
    text: 'ZB1 포카 교환 B1층',
    expected: {},
    absent: ['boothNumber'],
  },

  // ---------------- Found while probing ----------------
  {
    name: 'author: pronouns removed, other parentheses kept',
    text: 'hello',
    options: { author: 'Luna (she/her)' },
    expected: { circleName: 'Luna' },
  },
  {
    name: 'author: balanced parentheses are part of the name',
    text: 'hello',
    options: { author: 'Luna (Moonlight Studio)' },
    expected: { circleName: 'Luna (Moonlight Studio)' },
  },
  {
    name: 'author: "|" separated info after the name',
    text: 'hello',
    options: { author: '🌸 Luna 🌸 | AX Table A12 | comms closed' },
    expected: { circleName: 'Luna', boothNumber: 'A12', eventKey: 'anime-expo' },
  },
  {
    name: 'en: pre-order that ships counts as mail order even with a table',
    text: 'Pre-order now, ships after the con! Table A-12',
    expected: { boothNumber: 'A-12', isMailOrder: true, saleMode: 'preorder' },
  },
  {
    name: 'en: negated pre-order',
    text: 'no pre-orders, onsite only! table B-3',
    expected: { boothNumber: 'B-3', isMailOrder: false, saleMode: 'onsite' },
  },
  {
    name: 'ja: no mail order, on-site only',
    text: '通販なし、当日頒布のみ',
    expected: { isMailOrder: false, saleMode: 'onsite' },
    absent: ['boothNumber'],
  },
  {
    name: 'ko: two bracket tags, mail order marked O',
    text: '[일페/A-12][통판O]',
    expected: { boothNumber: 'A-12', eventHint: '일페', isMailOrder: true },
  },
  {
    name: 'ja: mail order on BOOTH without a space',
    text: '通販あります！BOOTHで https://moon.booth.pm/items/123',
    expected: { boothNumber: '通販', isMailOrder: true, formUrl: 'https://moon.booth.pm/items/123' },
  },
];

describe('parseBoothText sample table', () => {
  it('has at least 40 samples', () => {
    expect(SAMPLES.length).toBeGreaterThanOrEqual(40);
  });

  it.each(SAMPLES.map((s) => [s.name, s] as const))('%s', (_name, sample) => {
    const r = parseBoothText(sample.text, sample.options);
    const picked: Record<string, unknown> = {};
    for (const key of Object.keys(sample.expected)) picked[key] = r[key as keyof StaticJudgment];
    expect(picked).toEqual(sample.expected);
    for (const key of sample.absent ?? []) expect(r[key], `${String(key)} should be absent`).toBeUndefined();
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });
});

describe('confidence', () => {
  it('reports per-field confidence in [0,1] and an overall score', () => {
    const r = parseBoothText(
      '서울코믹월드 2026 가을\n부스 번호: H-15\n서클명: 별빛공방\n폼 https://witchform.com/x'
    );
    for (const v of Object.values(r.fieldConfidence)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(r.fieldConfidence.boothNumber).toBeGreaterThanOrEqual(0.9);
    expect(r.fieldConfidence.circleName).toBeGreaterThanOrEqual(0.8);
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it('ranks a labeled booth above a bare code', () => {
    const r = parseBoothText('A12 굿즈 샘플 / 부스 B-07');
    expect(r.boothNumber).toBe('B-07');
    expect(r.boothCandidates[0]?.source).toBe('label');
    expect(r.boothCandidates.map((c) => c.value)).toContain('A12');
  });

  it('is low for a mail-order-only post and zero for empty text', () => {
    expect(parseBoothText('통판 오픈').confidence).toBeLessThan(0.3);
    const empty = parseBoothText('');
    expect(empty.confidence).toBe(0);
    expect(empty.isMailOrder).toBe(false);
    expect(empty.links).toEqual([]);
  });
});

describe('options', () => {
  it('matches the detected event against existing events', () => {
    const r = parseBoothText('[서코/B-12] 신간 안내', {
      existingEvents: [
        { id: 'e1', name: '부산코믹월드 2026' },
        { id: 'e2', name: '서울코믹월드 2026 가을' },
      ],
    });
    expect(r.matchedEvent?.id).toBe('e2');
  });

  it('uses captured DOM links to expand a truncated display URL', () => {
    const r = parseBoothText('통판 폼 witchform.com/formViewer.php…', {
      links: ['https://witchform.com/formViewer.php?fidx=77'],
    });
    expect(r.formUrl).toBe('https://witchform.com/formViewer.php?fidx=77');
    expect(r.links).toHaveLength(1);
  });
});

describe('isValidBoothNumber', () => {
  it.each(['A-01', 'B12', 'AA-214', '東ホ-12a', '南ア01ab', '홀1-B32', 'き18a', 'D05-06', '1234'])(
    'accepts %s',
    (v) => expect(isValidBoothNumber(v)).toBe(true)
  );
  it.each(['통판', '通販', 'Mail order', '', '10/17', 'A-1234567'])('rejects %s', (v) =>
    expect(isValidBoothNumber(v)).toBe(false)
  );
});
