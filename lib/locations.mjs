export const PRESET_LOCATIONS = [
  {
    id: 'dasan',
    name: '남양주 다산동',
    fullName: '경기도 남양주시 다산동 (다산신도시)',
    lat: 37.6249,
    lon: 127.151,
    newsBucket: 'namyangju',
    regionTerms: ['남양주', '다산동', '구리', '경기북부'],
    broadRegion: '경기 OR 수도권',
    routeNote: '왕숙천·한강변 교량과 그늘 구간은 대기 온도보다 노면 온도가 1~2°C 낮아 새벽 결빙이 오래 남습니다.'
  },
  {
    id: 'byeollae',
    name: '남양주 별내',
    fullName: '경기도 남양주시 별내동',
    lat: 37.6431,
    lon: 127.1268,
    newsBucket: 'namyangju',
    regionTerms: ['남양주', '별내', '경기북부', '수도권'],
    broadRegion: '경기 OR 수도권',
    routeNote: '불암산·수락산 인접 내륙 지형 특성상 새벽 최저기온이 도심보다 낮아 결빙이 빠르게 형성됩니다.'
  },
  {
    id: 'paldang',
    name: '남양주 팔당·와부',
    fullName: '경기도 남양주시 와부읍 팔당',
    lat: 37.5476,
    lon: 127.2439,
    newsBucket: 'namyangju',
    regionTerms: ['남양주', '팔당', '하남', '경기동부'],
    broadRegion: '경기 OR 수도권',
    routeNote: '남한강 자전거길 강변 구간은 습도와 안개가 잦아 서리·살얼음 및 강풍 영향을 크게 받습니다.'
  },
  {
    id: 'guri',
    name: '구리 한강시민공원',
    fullName: '경기도 구리시 토평동 (구리 한강변)',
    lat: 37.5778,
    lon: 127.1394,
    newsBucket: 'namyangju',
    regionTerms: ['구리', '남양주', '강동', '수도권'],
    broadRegion: '경기 OR 서울',
    routeNote: '왕숙천 합수부~강동대교 하부 구간은 일조량이 적어 비 온 뒤 노면 건조가 느립니다.'
  },
  {
    id: 'misa',
    name: '하남 미사강변',
    fullName: '경기도 하남시 망월동 (미사강변도시)',
    lat: 37.5612,
    lon: 127.1912,
    newsBucket: 'gyeonggi_east',
    regionTerms: ['하남', '미사', '강동', '수도권'],
    broadRegion: '경기 OR 서울',
    routeNote: '미사경정공원~팔당대교 구간은 개활지 특성상 맞바람과 순간 돌풍 체감이 큽니다.'
  },
  {
    id: 'jamsil',
    name: '서울 잠실 한강',
    fullName: '서울특별시 송파구 잠실동 (잠실철교 남단)',
    lat: 37.5179,
    lon: 127.0865,
    newsBucket: 'seoul',
    regionTerms: ['서울', '송파', '잠실', '한강'],
    broadRegion: '서울 OR 수도권',
    routeNote: '탄천 합수부와 잠실대교 하부 진출입로는 비·눈 이후 물고임과 얇은 결빙이 잦습니다.'
  },
  {
    id: 'banpo',
    name: '서울 반포 한강',
    fullName: '서울특별시 서초구 반포동 (잠수교)',
    lat: 37.5105,
    lon: 126.9959,
    newsBucket: 'seoul',
    regionTerms: ['서울', '서초', '반포', '한강'],
    broadRegion: '서울 OR 수도권',
    routeNote: '잠수교와 교각 그늘 구간은 강바람에 의한 체감온도 하락과 노면 냉각이 빠릅니다.'
  },
  {
    id: 'yeouido',
    name: '서울 여의도 한강',
    fullName: '서울특별시 영등포구 여의도동',
    lat: 37.5284,
    lon: 126.9329,
    newsBucket: 'seoul',
    regionTerms: ['서울', '영등포', '여의도', '한강'],
    broadRegion: '서울 OR 수도권',
    routeNote: '강변 직선 구간이 길어 풍속 6m/s 이상이면 체력 소모와 측풍 위험이 커집니다.'
  },
  {
    id: 'pangyo',
    name: '성남 판교·탄천',
    fullName: '경기도 성남시 분당구 판교동 (탄천)',
    lat: 37.3947,
    lon: 127.1112,
    newsBucket: 'gyeonggi_south',
    regionTerms: ['성남', '판교', '분당', '경기남부'],
    broadRegion: '경기 OR 수도권',
    routeNote: '탄천 하천변 저지대와 목교 구간은 새벽 서리와 결빙에 특히 주의해야 합니다.'
  },
  {
    id: 'ilsan',
    name: '고양 일산 호수공원',
    fullName: '경기도 고양시 일산동구 장항동',
    lat: 37.6562,
    lon: 126.7661,
    newsBucket: 'gyeonggi_north',
    regionTerms: ['고양', '일산', '파주', '경기북부'],
    broadRegion: '경기 OR 수도권',
    routeNote: '경기북부 내륙·행주산성 방면은 서울 도심보다 새벽 최저기온이 2~3°C 낮게 형성됩니다.'
  },
  {
    id: 'suwon',
    name: '수원 광교호수공원',
    fullName: '경기도 수원시 영통구 하동',
    lat: 37.2839,
    lon: 127.0659,
    newsBucket: 'gyeonggi_south',
    regionTerms: ['수원', '광교', '용인', '경기남부'],
    broadRegion: '경기 OR 수도권',
    routeNote: '호수 데크와 수변 그늘 구간은 아침 결로와 서리에 미끄러질 수 있습니다.'
  },
  {
    id: 'incheon',
    name: '인천 아라뱃길',
    fullName: '인천광역시 계양구 장기동 (아라뱃길)',
    lat: 37.5678,
    lon: 126.7438,
    newsBucket: 'incheon',
    regionTerms: ['인천', '김포', '계양', '수도권'],
    broadRegion: '인천 OR 수도권',
    routeNote: '해안 인접 수로 직선 구간이라 바람과 순간 돌풍 영향이 내륙보다 큽니다.'
  }
];

export const EXTRA_KR_PLACES = [
  { id: 'seongsu', name: '서울 성수·서울숲', fullName: '서울특별시 성동구 성수동', lat: 37.5443, lon: 127.0439, newsBucket: 'seoul', regionTerms: ['서울', '성동', '한강'], broadRegion: '서울 OR 수도권' },
  { id: 'sangam', name: '서울 상암·난지한강', fullName: '서울특별시 마포구 상암동', lat: 37.5683, lon: 126.8768, newsBucket: 'seoul', regionTerms: ['서울', '마포', '한강'], broadRegion: '서울 OR 수도권' },
  { id: 'uijeongbu', name: '의정부 중랑천', fullName: '경기도 의정부시 의정부동', lat: 37.7381, lon: 127.0337, newsBucket: 'gyeonggi_north', regionTerms: ['의정부', '양주', '경기북부'], broadRegion: '경기 OR 수도권' },
  { id: 'chuncheon', name: '춘천 의암호', fullName: '강원특별자치도 춘천시 근화동', lat: 37.8813, lon: 127.7298, newsBucket: 'gangwon', regionTerms: ['춘천', '강원', '영서'], broadRegion: '강원' },
  { id: 'daejeon', name: '대전 갑천', fullName: '대전광역시 서구 둔산동', lat: 36.3504, lon: 127.3845, newsBucket: 'chungcheong', regionTerms: ['대전', '세종', '충남'], broadRegion: '대전 OR 충남' },
  { id: 'daegu', name: '대구 금호강', fullName: '대구광역시 동구 효목동', lat: 35.8814, lon: 128.6476, newsBucket: 'gyeongsang', regionTerms: ['대구', '경북'], broadRegion: '대구 OR 경북' },
  { id: 'busan', name: '부산 수영강·온천천', fullName: '부산광역시 해운대구 우동', lat: 35.1631, lon: 129.1319, newsBucket: 'gyeongsang', regionTerms: ['부산', '경남'], broadRegion: '부산 OR 경남' },
  { id: 'gwangju', name: '광주 영산강', fullName: '광주광역시 서구 치평동', lat: 35.1595, lon: 126.8526, newsBucket: 'jeolla', regionTerms: ['광주', '전남'], broadRegion: '광주 OR 전남' },
  { id: 'jeju', name: '제주 환상자전거길', fullName: '제주특별자치도 제주시 연동', lat: 33.4996, lon: 126.5312, newsBucket: 'jeju', regionTerms: ['제주'], broadRegion: '제주' }
];

const DEFAULT_ROUTE_NOTE = '하천변·교량·터널 출입구와 그늘진 경사로는 기온보다 노면 온도가 낮아 결빙이 먼저 생깁니다.';

export function findPresetLocation(query) {
  if (!query) return PRESET_LOCATIONS[0];
  const normalized = query.trim().toLowerCase();
  const all = [...PRESET_LOCATIONS, ...EXTRA_KR_PLACES];
  const hit = all.find((loc) => (
    loc.id === normalized ||
    loc.name.toLowerCase().includes(normalized) ||
    loc.fullName.toLowerCase().includes(normalized) ||
    loc.regionTerms.some((term) => term.toLowerCase() === normalized)
  ));
  return hit ? { routeNote: DEFAULT_ROUTE_NOTE, ...hit } : null;
}

export function inferNewsBucket(lat, lon, text = '') {
  if (text.includes('남양주') || text.includes('다산') || text.includes('구리') || text.includes('별내')) return 'namyangju';
  if (text.includes('하남') || text.includes('양평') || text.includes('광주')) return 'gyeonggi_east';
  if (text.includes('서울')) return 'seoul';
  if (text.includes('인천') || text.includes('김포')) return 'incheon';
  if (text.includes('고양') || text.includes('일산') || text.includes('파주') || text.includes('의정부')) return 'gyeonggi_north';
  if (text.includes('성남') || text.includes('수원') || text.includes('용인') || text.includes('화성')) return 'gyeonggi_south';
  if (text.includes('강원') || text.includes('춘천') || text.includes('강릉')) return 'gangwon';
  if (text.includes('제주')) return 'jeju';
  if (text.includes('부산') || text.includes('대구') || text.includes('울산') || text.includes('경북') || text.includes('경남')) return 'gyeongsang';
  if (text.includes('대전') || text.includes('세종') || text.includes('충북') || text.includes('충남')) return 'chungcheong';
  if (text.includes('전북') || text.includes('전남')) return 'jeolla';

  if (lat < 34.0) return 'jeju';
  if (lat < 36.0 && lon > 128.0) return 'gyeongsang';
  if (lat < 36.0) return 'jeolla';
  if (lat < 36.9) return 'chungcheong';
  if (lon > 127.6) return 'gangwon';
  if (lat > 37.55 && lon > 127.1) return 'namyangju';
  if (lat > 37.45 && lon >= 126.8 && lon <= 127.18) return 'seoul';
  if (lon < 126.8) return 'incheon';
  return 'namyangju';
}

function inferBroadRegion(displayName) {
  if (displayName.includes('서울')) return '서울 OR 수도권';
  if (displayName.includes('경기')) return '경기 OR 수도권';
  if (displayName.includes('인천')) return '인천 OR 수도권';
  if (displayName.includes('부산')) return '부산 OR 경남';
  if (displayName.includes('대구')) return '대구 OR 경북';
  if (displayName.includes('대전')) return '대전 OR 충남';
  if (displayName.includes('광주')) return '광주 OR 전남';
  if (displayName.includes('강원')) return '강원';
  if (displayName.includes('제주')) return '제주';
  return '경기 OR 수도권';
}

function extractRegionTerms(name, displayName) {
  const parts = displayName
    .split(/[\s,]+/)
    .map((p) => p.trim())
    .filter((p) => p && p !== '대한민국' && !/^\d+$/.test(p));
  const cleaned = [name, ...parts.slice(0, 3)]
    .map((p) => p.replace(/(특별시|광역시|특별자치시|특별자치도|도|시|군|구)$/g, '').trim())
    .filter((p) => p.length >= 2);
  return [...new Set(cleaned)].slice(0, 4);
}

export async function searchLocations(query, { allowNominatim = true } = {}) {
  const q = (query || '').trim();
  if (!q) return PRESET_LOCATIONS;

  const catalog = [...PRESET_LOCATIONS, ...EXTRA_KR_PLACES].map((l) => ({
    routeNote: DEFAULT_ROUTE_NOTE,
    ...l
  }));

  const matchedPresets = catalog.filter((loc) => (
    loc.id.includes(q.toLowerCase()) ||
    loc.name.includes(q) ||
    loc.fullName.includes(q) ||
    loc.regionTerms.some((t) => t.includes(q))
  ));

  const remoteResults = [];

  if (allowNominatim && typeof window === 'undefined') {
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&countrycodes=kr&format=json&limit=5&accept-language=ko`;
      const res = await fetch(nomUrl, {
        headers: { 'User-Agent': 'BikeGoIndex/1.0 (local cycling weather tool)' }
      });
      if (res.ok) {
        const data = await res.json();
        for (const item of data) {
          const lat = Number(item.lat);
          const lon = Number(item.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
          const shortName = item.name || item.display_name.split(',')[0].trim();
          const regionParts = item.display_name
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s && s !== '대한민국' && !/^\d+$/.test(s));
          const fullName = [...regionParts].reverse().join(' ');
          const label = regionParts.length >= 2
            ? `${regionParts[Math.min(2, regionParts.length - 1)]} ${shortName}`
            : shortName;
          remoteResults.push({
            id: `custom:${lat.toFixed(4)},${lon.toFixed(4)}`,
            name: label,
            fullName,
            lat: Number(lat.toFixed(4)),
            lon: Number(lon.toFixed(4)),
            newsBucket: inferNewsBucket(lat, lon, fullName),
            regionTerms: extractRegionTerms(shortName, item.display_name),
            broadRegion: inferBroadRegion(item.display_name),
            routeNote: DEFAULT_ROUTE_NOTE
          });
        }
      }
    } catch {
    }
  }

  if (remoteResults.length === 0) {
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=ko&format=json`;
      const res = await fetch(geoUrl);
      if (res.ok) {
        const data = await res.json();
        for (const item of (data.results || []).filter((r) => r.country_code === 'KR')) {
          const fullName = [item.admin1, item.admin2, item.name].filter(Boolean).join(' ');
          remoteResults.push({
            id: `custom:${item.latitude.toFixed(4)},${item.longitude.toFixed(4)}`,
            name: item.admin1 ? `${item.admin1.replace(/(특별시|광역시|도)$/, '')} ${item.name}` : item.name,
            fullName,
            lat: Number(item.latitude.toFixed(4)),
            lon: Number(item.longitude.toFixed(4)),
            newsBucket: inferNewsBucket(item.latitude, item.longitude, fullName),
            regionTerms: extractRegionTerms(item.name, fullName),
            broadRegion: inferBroadRegion(fullName),
            routeNote: DEFAULT_ROUTE_NOTE
          });
        }
      }
    } catch {
    }
  }

  const seenCoords = new Set(matchedPresets.map((l) => `${l.lat.toFixed(2)},${l.lon.toFixed(2)}`));
  const combined = [...matchedPresets];
  for (const r of remoteResults) {
    const key = `${r.lat.toFixed(2)},${r.lon.toFixed(2)}`;
    if (!seenCoords.has(key)) {
      seenCoords.add(key);
      combined.push(r);
    }
  }
  return combined.slice(0, 8);
}

export function resolveLocationFromParams(params) {
  const id = params.get('location') || params.get('id');
  if (id && !id.startsWith('custom:')) {
    const preset = findPresetLocation(id);
    if (preset) return preset;
  }

  const lat = Number(params.get('lat'));
  const lon = Number(params.get('lon'));
  if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    const name = (params.get('name') || `${lat.toFixed(3)}, ${lon.toFixed(3)}`).slice(0, 60);
    const fullName = (params.get('fullName') || name).slice(0, 120);
    const termsRaw = params.get('terms');
    const regionTerms = termsRaw
      ? termsRaw.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 4)
      : extractRegionTerms(name, fullName);
    return {
      id: `custom:${lat.toFixed(4)},${lon.toFixed(4)}`,
      name,
      fullName,
      lat,
      lon,
      newsBucket: inferNewsBucket(lat, lon, fullName),
      regionTerms: regionTerms.length > 0 ? regionTerms : ['수도권'],
      broadRegion: inferBroadRegion(fullName),
      routeNote: DEFAULT_ROUTE_NOTE
    };
  }

  return PRESET_LOCATIONS[0];
}
