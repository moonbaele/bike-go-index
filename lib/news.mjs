const WEATHER_KEYWORDS = [
  '날씨', '기상', '한파', '추위', '영하', '빙판', '살얼음', '블랙아이스',
  '결빙', '강풍', '돌풍', '미세먼지', '초미세먼지', '황사', '호우', '폭우',
  '대설', '폭설', '소나기', '장마', '태풍', '폭염', '특보', '주의보',
  '경보', '안개', '서리', '일교차', '체감', '강수', '눈비', '비·눈', '눈·비'
];

const EXCLUDED_TOPICS = [
  '데이터센터', '전력 규제', '부동산', '분양', '주식', '주가', '공모주',
  '아파트 청약', '청약', '국회', '선거', '정당', '연예', '드라마', '스포츠',
  '기업', '제조업', '체감경기', '경기전망', '경기침체', '경기 회복', '소비',
  '수출', '증시', '코스피', '환율', '금리', '주담대', '대출', '전공의',
  '팝업스토어', '취업', '고용', '채용', '매매', '전세', '실적', '투자'
];

const HAZARD_TAG_RULES = [
  { tag: '결빙·빙판', severity: 'high', pattern: /블랙아이스|살얼음|빙판|결빙|얼음|서리/ },
  { tag: '기상특보', severity: 'high', pattern: /특보|주의보|경보/ },
  { tag: '한파·추위', severity: 'medium', pattern: /한파|영하|강추위|추위|체감온도/ },
  { tag: '강수·눈비', severity: 'medium', pattern: /폭설|대설|눈비|비·눈|호우|폭우|소나기|비\s|눈\s|강수/ },
  { tag: '강풍', severity: 'medium', pattern: /강풍|돌풍|바람/ },
  { tag: '미세먼지', severity: 'medium', pattern: /미세먼지|초미세먼지|황사|대기질/ }
];

const ALL_REGION_TOKENS = [
  '서울', '경기', '수도권', '인천', '강원', '영동', '영서', '춘천', '강릉',
  '충청', '충남', '충북', '대전', '세종', '호남', '전남', '전북', '광주',
  '영남', '경남', '경북', '부산', '대구', '울산', '제주', '서귀포',
  '서해안', '동해안', '남해안', '울릉', '독도'
];

function expandAllowedRegionTerms(regionTerms = [], broadRegion = '') {
  const tokens = new Set();
  for (const raw of regionTerms) {
    const t = String(raw || '').trim();
    if (!t) continue;
    tokens.add(t);
    const stem = t.replace(/(동|읍|면|시|군|구)$/g, '');
    if (stem.length >= 2) tokens.add(stem);
    if (t.startsWith('경기')) tokens.add('경기');
  }
  for (const raw of String(broadRegion || '').split(/\s+OR\s+/i)) {
    const t = raw.trim();
    if (t.length >= 2 && t !== '전국') tokens.add(t);
  }
  return [...tokens];
}

function decodeXmlEntities(str) {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .trim();
}

function parseRssItems(xmlText) {
  const items = [];
  const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const block = match[1];
    const rawTitle = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
    const rawLink = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
    const rawDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
    const rawSource = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] || '';

    let title = decodeXmlEntities(rawTitle);
    let source = decodeXmlEntities(rawSource);

    if (!source && title.includes(' - ')) {
      const lastDash = title.lastIndexOf(' - ');
      source = title.slice(lastDash + 3).trim();
      title = title.slice(0, lastDash).trim();
    } else if (source && title.endsWith(` - ${source}`)) {
      title = title.slice(0, -(` - ${source}`).length).trim();
    }

    const link = decodeXmlEntities(rawLink);
    const publishedAt = rawDate ? new Date(rawDate) : null;
    const timestamp = publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt.getTime() : 0;

    if (title && link) {
      items.push({
        title,
        source: source || '뉴스',
        link,
        publishedAt: timestamp ? new Date(timestamp).toISOString() : null,
        timestamp
      });
    }
  }
  return items;
}

export function classifyNewsItem(title, regionTerms = [], broadRegion = '') {
  const lower = title.toLowerCase();
  if (EXCLUDED_TOPICS.some((bad) => lower.includes(bad))) {
    return null;
  }

  const hasWeatherKeyword = WEATHER_KEYWORDS.some((kw) => title.includes(kw));
  if (!hasWeatherKeyword) {
    return null;
  }

  const allowedTerms = expandAllowedRegionTerms(regionTerms, broadRegion);
  const directLocalMatch = regionTerms.some((term) => {
    if (!term) return false;
    const stem = term.replace(/(동|읍|면|시|군|구)$/g, '');
    return title.includes(term) || (stem.length >= 2 && title.includes(stem));
  });
  const hasMyRegion = allowedTerms.some((term) => title.includes(term));
  const hasNational = /전국|한반도/.test(title);
  const otherRegions = ALL_REGION_TOKENS.filter((token) => !allowedTerms.some((a) => a.includes(token) || token.includes(a)));
  const hasOtherRegion = otherRegions.some((token) => title.includes(token));

  if (!hasMyRegion && hasOtherRegion) {
    return null;
  }

  let regionScope = 'other';
  if (hasMyRegion) regionScope = 'local';
  else if (hasNational) regionScope = 'national';
  else return null;

  const tags = [];
  let maxSeverity = 'info';
  for (const rule of HAZARD_TAG_RULES) {
    if (rule.pattern.test(title)) {
      tags.push(rule.tag);
      if (rule.severity === 'high') maxSeverity = 'high';
      else if (rule.severity === 'medium' && maxSeverity !== 'high') maxSeverity = 'medium';
    }
  }

  return {
    tags: tags.length > 0 ? tags.slice(0, 3) : ['날씨'],
    severity: maxSeverity,
    isLocalMatch: directLocalMatch,
    regionScope
  };
}

export function formatRelativeKoreanTime(isoString, nowMs = Date.now()) {
  if (!isoString) return '';
  const diffMin = Math.max(0, Math.round((nowMs - new Date(isoString).getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}일 전`;
}

async function fetchGoogleNewsRss(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BikeGoIndex/1.0)' },
    signal: AbortSignal.timeout(7000)
  });
  if (!res.ok) return [];
  const xml = await res.text();
  return parseRssItems(xml);
}

export async function fetchLocalWeatherNews(location) {
  const terms = location.regionTerms?.length ? location.regionTerms : ['남양주', '수도권'];
  const broad = location.broadRegion || '경기 OR 수도권';

  const localQuery2d = `(${terms.join(' OR ')}) (날씨 OR 기상 OR 한파 OR 빙판 OR 살얼음 OR 비 OR 눈 OR 미세먼지) when:2d`;
  const hazardQuery2d = `(블랙아이스 OR 도로살얼음 OR 빙판길 OR 결빙 OR 한파주의보 OR 대설 OR 강풍주의보 OR 기상특보) (${broad}) when:2d`;

  let [localRaw, hazardRaw] = await Promise.all([
    fetchGoogleNewsRss(localQuery2d).catch(() => []),
    fetchGoogleNewsRss(hazardQuery2d).catch(() => [])
  ]);

  const nowMs = Date.now();
  const maxAgeMs = 5 * 24 * 60 * 60 * 1000;

  const collect = (rawList) => {
    const seenKeys = new Set();
    const list = [];
    for (const item of rawList) {
      if (item.timestamp && nowMs - item.timestamp > maxAgeMs) continue;
      const dedupeKey = item.title.replace(/[\s"'‘’“”·…\[\]\(\)]/g, '').slice(0, 28);
      if (seenKeys.has(dedupeKey)) continue;

      const classification = classifyNewsItem(item.title, terms, broad);
      if (!classification) continue;

      seenKeys.add(dedupeKey);
      list.push({
        ...item,
        ...classification,
        relativeTime: formatRelativeKoreanTime(item.publishedAt, nowMs)
      });
    }
    return list;
  };

  let articles = collect([...localRaw, ...hazardRaw]);

  if (articles.length < 4) {
    const localQuery5d = `(${terms.join(' OR ')}) (날씨 OR 기상 OR 한파 OR 빙판 OR 비 OR 눈 OR 미세먼지) when:5d`;
    const hazardQuery5d = `(블랙아이스 OR 도로살얼음 OR 빙판길 OR 결빙 OR 한파주의보 OR 대설 OR 강풍주의보) (${broad}) when:5d`;
    const [moreLocal, moreHazard] = await Promise.all([
      fetchGoogleNewsRss(localQuery5d).catch(() => []),
      fetchGoogleNewsRss(hazardQuery5d).catch(() => [])
    ]);
    articles = collect([...localRaw, ...hazardRaw, ...moreLocal, ...moreHazard]);
  }

  articles.sort((a, b) => {
    const recencyDiffHours = (b.timestamp - a.timestamp) / 3600000;
    if (Math.abs(recencyDiffHours) > 6) return b.timestamp - a.timestamp;
    const scoreA = (a.isLocalMatch ? 2 : 0) + (a.regionScope === 'local' ? 1 : 0) + (a.severity === 'high' ? 1.5 : 0);
    const scoreB = (b.isLocalMatch ? 2 : 0) + (b.regionScope === 'local' ? 1 : 0) + (b.severity === 'high' ? 1.5 : 0);
    if (scoreB !== scoreA) return scoreB - scoreA;
    return b.timestamp - a.timestamp;
  });

  const topArticles = articles.slice(0, 10);

  const hazardCounts = {
    ice: 0,
    cold: 0,
    precip: 0,
    wind: 0,
    dust: 0,
    advisory: 0
  };

  for (const a of topArticles) {
    if (a.tags.includes('결빙·빙판')) hazardCounts.ice++;
    if (a.tags.includes('한파·추위')) hazardCounts.cold++;
    if (a.tags.includes('강수·눈비')) hazardCounts.precip++;
    if (a.tags.includes('강풍')) hazardCounts.wind++;
    if (a.tags.includes('미세먼지')) hazardCounts.dust++;
    if (a.tags.includes('기상특보')) hazardCounts.advisory++;
  }

  const summaryParts = [];
  if (hazardCounts.ice > 0) summaryParts.push(`결빙·빙판 ${hazardCounts.ice}건`);
  if (hazardCounts.advisory > 0) summaryParts.push(`기상특보 ${hazardCounts.advisory}건`);
  if (hazardCounts.cold > 0) summaryParts.push(`한파·추위 ${hazardCounts.cold}건`);
  if (hazardCounts.precip > 0) summaryParts.push(`눈·비 ${hazardCounts.precip}건`);
  if (hazardCounts.wind > 0) summaryParts.push(`강풍 ${hazardCounts.wind}건`);
  if (hazardCounts.dust > 0) summaryParts.push(`미세먼지 ${hazardCounts.dust}건`);

  return {
    fetchedAt: new Date().toISOString(),
    regionQueryLabel: terms.slice(0, 3).join(' · '),
    hazardCounts,
    summaryText: summaryParts.length > 0
      ? `최근 지역 기상 기사 분석: ${summaryParts.join(' · ')}`
      : '최근 지역 기상 특이 보도 없음',
    articles: topArticles,
    referenceLinks: [
      { label: '기상청 날씨누리 특보', url: 'https://www.weather.go.kr/w/weather/warning/status.do' },
      { label: '에어코리아 실시간 대기질', url: 'https://www.airkorea.or.kr/' }
    ]
  };
}
