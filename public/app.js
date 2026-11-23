import { PRESET_LOCATIONS, searchLocations, inferNewsBucket } from './lib/locations.mjs';
import { fetchWeatherBundle } from './lib/weather.mjs';
import { buildCyclingReport } from './lib/scoring.mjs';

const STORAGE_KEY = 'bike-go-index:prefs:v1';

const IS_LOCAL_API = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.endsWith('.local') ||
  /^192\.168\./.test(window.location.hostname) ||
  /^10\./.test(window.location.hostname)
);

const state = {
  presets: PRESET_LOCATIONS,
  currentLocation: PRESET_LOCATIONS[0],
  bike: 'hybrid',
  report: null,
  newsFilter: '전체',
  staticNewsCache: null
};

const els = {
  presetSelect: document.getElementById('location-preset'),
  searchForm: document.getElementById('location-search-form'),
  searchInput: document.getElementById('location-search-input'),
  searchResults: document.getElementById('search-results'),
  bikeSelector: document.getElementById('bike-selector'),
  geoBtn: document.getElementById('geo-btn'),
  refreshBtn: document.getElementById('refresh-btn'),
  statusBanner: document.getElementById('status-banner'),
  locationMeta: document.getElementById('location-meta'),
  scoreNumber: document.getElementById('score-number'),
  verdictTag: document.getElementById('verdict-tag'),
  verdictHeadline: document.getElementById('verdict-headline'),
  capNote: document.getElementById('cap-note'),
  iceBox: document.getElementById('ice-box'),
  icePct: document.getElementById('ice-pct'),
  iceMeterFill: document.getElementById('ice-meter-fill'),
  iceDetail: document.getElementById('ice-detail'),
  quickStats: document.getElementById('quick-stats'),
  routeNote: document.getElementById('route-note'),
  checklist: document.getElementById('checklist'),
  profileMeta: document.getElementById('profile-meta'),
  factorList: document.getElementById('factor-list'),
  timelineChart: document.getElementById('timeline-chart'),
  windowSummary: document.getElementById('window-summary'),
  hourlyTbody: document.getElementById('hourly-tbody'),
  newsSummary: document.getElementById('news-summary'),
  newsFilters: document.getElementById('news-filters'),
  newsList: document.getElementById('news-list'),
  refLinks: document.getElementById('ref-links')
};

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function tierFromScore(score) {
  if (score >= 75) return 'go';
  if (score >= 55) return 'caution';
  if (score >= 35) return 'avoid';
  return 'stop';
}

function formatHourLabel(isoLocal) {
  const month = isoLocal.slice(5, 7);
  const day = isoLocal.slice(8, 10);
  const hour = isoLocal.slice(11, 13);
  return `${month}/${day} ${hour}:00`;
}

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(isoString).getTime()) / 60000));
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `${diffHours}시간 전`;
  return `${Math.round(diffHours / 24)}일 전`;
}

function showStatus(message, tone = 'info') {
  if (!message) {
    els.statusBanner.hidden = true;
    els.statusBanner.textContent = '';
    return;
  }
  els.statusBanner.hidden = false;
  els.statusBanner.dataset.tone = tone;
  els.statusBanner.textContent = message;
}

function savePrefs() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      bike: state.bike,
      location: state.currentLocation
    }));
  } catch {
  }
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.bike && ['road', 'hybrid', 'gravel'].includes(saved.bike)) {
      state.bike = saved.bike;
      const radio = document.querySelector(`input[name="bike"][value="${saved.bike}"]`);
      if (radio) radio.checked = true;
    }
    if (saved.location && Number.isFinite(saved.location.lat) && Number.isFinite(saved.location.lon)) {
      state.currentLocation = saved.location;
    }
  } catch {
  }
}

function buildReportQuery(refresh = false) {
  const params = new URLSearchParams({ bike: state.bike });
  if (refresh) params.set('refresh', '1');
  if (state.currentLocation) {
    if (state.currentLocation.id && !state.currentLocation.id.startsWith('custom:')) {
      params.set('location', state.currentLocation.id);
    } else {
      params.set('lat', String(state.currentLocation.lat));
      params.set('lon', String(state.currentLocation.lon));
      params.set('name', state.currentLocation.name);
      params.set('fullName', state.currentLocation.fullName || state.currentLocation.name);
      if (state.currentLocation.regionTerms?.length) {
        params.set('terms', state.currentLocation.regionTerms.join(','));
      }
    }
  }
  return params.toString();
}

async function loadStaticNews(location, refresh = false) {
  if (refresh || !state.staticNewsCache) {
    try {
      const res = await fetch(`./data/news.json?t=${Date.now()}`);
      if (res.ok) {
        state.staticNewsCache = await res.json();
      }
    } catch {
    }
  }

  const bucketKey = location.newsBucket || inferNewsBucket(location.lat, location.lon, location.fullName || location.name || '');
  const bucket = state.staticNewsCache?.buckets?.[bucketKey] || state.staticNewsCache?.buckets?.namyangju;

  if (bucket) {
    return {
      ...bucket,
      articles: (bucket.articles || []).map((a) => ({
        ...a,
        relativeTime: a.publishedAt ? formatRelativeTime(a.publishedAt) : a.relativeTime
      }))
    };
  }

  return {
    regionQueryLabel: location.name,
    summaryText: '실시간 기상 특보 링크에서 지역 특보를 확인하세요',
    articles: [],
    referenceLinks: [
      { label: '기상청 날씨누리 특보', url: 'https://www.weather.go.kr/w/weather/warning/status.do' },
      { label: '에어코리아 실시간 대기질', url: 'https://www.airkorea.or.kr/' }
    ]
  };
}

async function fetchReportData(refresh = false) {
  if (IS_LOCAL_API) {
    try {
      const res = await fetch(`./api/report?${buildReportQuery(refresh)}`);
      if (res.ok) return await res.json();
    } catch {
    }
  }

  const loc = state.currentLocation || PRESET_LOCATIONS[0];
  const [weather, news] = await Promise.all([
    fetchWeatherBundle(loc.lat, loc.lon),
    loadStaticNews(loc, refresh)
  ]);
  const report = buildCyclingReport(weather, loc, state.bike);
  return { ...report, news };
}

function initPresets() {
  state.presets = PRESET_LOCATIONS;
  els.presetSelect.innerHTML = state.presets
    .map((loc) => `<option value="${escapeHtml(loc.id)}">${escapeHtml(loc.name)}</option>`)
    .join('');

  if (state.currentLocation?.id && state.presets.some((p) => p.id === state.currentLocation.id)) {
    els.presetSelect.value = state.currentLocation.id;
  }
}

async function loadReport(refresh = false) {
  els.refreshBtn.disabled = true;
  try {
    const data = await fetchReportData(refresh);
    state.report = data;
    state.currentLocation = data.location;
    state.newsFilter = '전체';
    savePrefs();
    showStatus('');
    renderReport(data);
  } catch (err) {
    showStatus(`데이터를 불러오지 못했습니다: ${err.message}`, 'error');
  } finally {
    els.refreshBtn.disabled = false;
  }
}

function renderReport(report) {
  const c = report.current;
  const sunStr = report.todaySun?.sunset ? `일몰 ${report.todaySun.sunset.slice(11, 16)}` : '';
  els.locationMeta.textContent = [
    report.location.fullName,
    `기준 ${formatHourLabel(c.time)}`,
    sunStr
  ].filter(Boolean).join(' · ');

  document.title = `${c.score}점 (${c.verdict.label}) · ${report.location.name} | 자전거 출격 지수`;

  els.scoreNumber.textContent = String(c.score);
  els.verdictTag.textContent = c.verdict.label;
  els.verdictTag.dataset.level = c.verdict.level;
  els.verdictHeadline.textContent = c.verdict.headline;

  if (c.activeCap) {
    els.capNote.hidden = false;
    els.capNote.textContent = `안전 상한 적용: 원점수 ${c.rawScore}점 -> ${c.score}점 (${c.activeCap.reason})`;
  } else {
    els.capNote.hidden = true;
  }

  els.icePct.textContent = `${c.blackIceRisk}%`;
  els.iceMeterFill.style.inlineSize = `${c.blackIceRisk}%`;
  els.iceBox.dataset.risk = c.blackIceRisk >= 60 ? 'high' : c.blackIceRisk >= 30 ? 'mid' : 'low';

  const rainHistoryText = c.precip48h > 0
    ? `최근 48시간 강수 ${c.precip48h}mm${c.minRoadTempAfterPrecip !== null ? ` · 이후 노면 최저 ${c.minRoadTempAfterPrecip}°C` : ''}`
    : '최근 48시간 강수 기록 없음';
  els.iceDetail.textContent = `${c.surfaceState} · 현재 추정 노면 ${c.roadTemp}°C · ${rainHistoryText}`;

  const stats = [
    { label: '현재 기온 / 체감', value: `${c.temp}°C / ${c.apparentTemp}°C` },
    { label: '추정 노면온도', value: `${c.roadTemp}°C` },
    { label: '바람 / 순간돌풍', value: `${c.windSpeed} / ${c.windGusts} m/s` },
    { label: '최근 48시간 강수', value: `${c.precip48h} mm` },
    { label: '초미세먼지 (PM2.5)', value: c.pm25 === null ? '정보 없음' : `${c.pm25} ㎍/㎥` }
  ];

  els.quickStats.innerHTML = stats
    .map((s) => `<div class="stat-cell"><dt>${escapeHtml(s.label)}</dt><dd>${escapeHtml(s.value)}</dd></div>`)
    .join('');

  els.routeNote.textContent = report.location.routeNote || '';
  els.checklist.innerHTML = (report.checklist || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('');

  els.profileMeta.textContent = `${c.profile.label} 기준 · ${c.profile.detail}`;
  els.factorList.innerHTML = c.factors.map((f) => {
    const tier = tierFromScore(f.score);
    return `
      <li class="factor-item">
        <div class="factor-top">
          <span class="factor-name">${escapeHtml(f.label)}</span>
          <span class="factor-metric">${escapeHtml(f.metric)}</span>
        </div>
        <div class="factor-bar-row">
          <div class="factor-track" aria-hidden="true">
            <div class="factor-fill" data-tier="${tier}" style="inline-size: ${f.score}%"></div>
          </div>
          <span class="factor-score">${f.score}점</span>
        </div>
        <p class="factor-reason">${escapeHtml(f.reason)}</p>
      </li>
    `;
  }).join('');

  renderTimelineChart(report.chartSeries);
  renderHourlyTable(report);
  renderNews(report.news);
}

function renderTimelineChart(series) {
  if (!series || series.length === 0) {
    els.timelineChart.textContent = '표시할 시계열 데이터가 없습니다.';
    return;
  }

  const width = 920;
  const height = 250;
  const pad = { top: 20, right: 44, bottom: 34, left: 42 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const temps = series.flatMap((d) => [d.temp, d.roadTemp]);
  const minT = Math.min(-4, Math.floor(Math.min(...temps) - 2));
  const maxT = Math.max(8, Math.ceil(Math.max(...temps) + 2));
  const maxRain = Math.max(4, ...series.map((d) => d.precipitation));

  const xAt = (i) => pad.left + (i / Math.max(1, series.length - 1)) * plotW;
  const yTemp = (t) => pad.top + ((maxT - t) / Math.max(1, maxT - minT)) * plotH;
  const yRainH = (mm) => (mm / maxRain) * (plotH * 0.45);

  const zeroY = yTemp(0);
  const nowIdx = series.findIndex((d) => d.isCurrent);
  const barW = Math.max(4, (plotW / series.length) * 0.65);

  const iceRects = [];
  for (let i = 0; i < series.length; i++) {
    if (series[i].blackIceRisk >= 45) {
      const x = xAt(i) - barW / 2;
      iceRects.push(
        `<rect x="${x.toFixed(1)}" y="${pad.top}" width="${(plotW / series.length + 1).toFixed(1)}" height="${plotH}" fill="var(--chart-ice)" />`
      );
    }
  }

  const rainBars = series.map((d, i) => {
    if (d.precipitation <= 0) return '';
    const h = Math.max(2, yRainH(d.precipitation));
    const x = xAt(i) - barW / 2;
    const y = pad.top + plotH - h;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="var(--chart-rain)" opacity="0.55" rx="1" />`;
  }).join('');

  const airPath = series
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yTemp(d.temp).toFixed(1)}`)
    .join(' ');
  const roadPath = series
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yTemp(d.roadTemp).toFixed(1)}`)
    .join(' ');

  const gridLines = [];
  const step = maxT - minT > 16 ? 5 : 3;
  for (let t = Math.ceil(minT / step) * step; t <= maxT; t += step) {
    const y = yTemp(t);
    gridLines.push(
      `<line x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="1" />` +
      `<text x="${pad.left - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="var(--muted)" font-size="11">${t}°</text>`
    );
  }

  const xLabels = [];
  for (let i = 0; i < series.length; i += 6) {
    const d = series[i];
    const x = xAt(i);
    const label = d.time.slice(11, 13) === '00' ? `${d.time.slice(5, 10)}` : `${d.time.slice(11, 13)}시`;
    xLabels.push(
      `<text x="${x.toFixed(1)}" y="${height - 10}" text-anchor="middle" fill="var(--muted)" font-size="11">${label}</text>`
    );
  }

  const nowMarker = nowIdx >= 0 ? `
    <line x1="${xAt(nowIdx).toFixed(1)}" y1="${pad.top}" x2="${xAt(nowIdx).toFixed(1)}" y2="${pad.top + plotH}" stroke="var(--text)" stroke-width="1.2" stroke-dasharray="3 3" />
    <text x="${xAt(nowIdx).toFixed(1)}" y="${pad.top - 5}" text-anchor="middle" fill="var(--text)" font-size="11" font-weight="600">현재</text>
  ` : '';

  const zeroLine = zeroY >= pad.top && zeroY <= pad.top + plotH ? `
    <line x1="${pad.left}" y1="${zeroY.toFixed(1)}" x2="${width - pad.right}" y2="${zeroY.toFixed(1)}" stroke="var(--stop-fg)" stroke-width="1.2" stroke-dasharray="5 3" />
    <text x="${width - pad.right + 6}" y="${(zeroY + 4).toFixed(1)}" fill="var(--stop-fg)" font-size="11" font-weight="600">0°C</text>
  ` : '';

  const peakIce = Math.max(...series.map((d) => d.blackIceRisk));
  const summaryTitle = `최근 36시간과 향후 24시간의 기온, 추정 노면온도, 시간당 강수량 및 최대 결빙 위험 ${peakIce}% 추이 차트`;

  els.timelineChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(summaryTitle)}">
      <title>${escapeHtml(summaryTitle)}</title>
      ${gridLines.join('')}
      ${iceRects.join('')}
      ${zeroLine}
      ${rainBars}
      <path d="${roadPath}" fill="none" stroke="var(--chart-road)" stroke-width="2" />
      <path d="${airPath}" fill="none" stroke="var(--chart-air)" stroke-width="2" />
      ${nowMarker}
      ${xLabels.join('')}
    </svg>
  `;
}

function renderHourlyTable(report) {
  const best = report.bestWindow;
  const peak = report.peakBlackIce;
  const summaryBits = [];
  if (best) {
    const label = best.score >= 70 ? '추천 시간' : '상대적 양호 시간';
    summaryBits.push(`${label}: ${formatHourLabel(best.time)} (${best.score}점 · ${best.label})`);
  }
  if (peak && peak.blackIceRisk >= 35) {
    summaryBits.push(`최대 결빙 위험: ${formatHourLabel(peak.time)} (${peak.blackIceRisk}%)`);
  }
  els.windowSummary.textContent = summaryBits.join(' · ');

  const rows = report.upcomingHours.slice(0, 24);
  els.hourlyTbody.innerHTML = rows.map((h, i) => `
    <tr class="${i === 0 ? 'is-now' : ''}">
      <td>${escapeHtml(formatHourLabel(h.time))}${i === 0 ? ' (현재)' : ''}</td>
      <td><strong>${h.score}</strong></td>
      <td><span class="level-chip" data-level="${escapeHtml(h.level)}">${escapeHtml(h.label)}</span></td>
      <td>${h.temp}°C / ${h.roadTemp}°C</td>
      <td>${h.precipitation > 0 ? `${h.precipitation} mm` : '-'}</td>
      <td>${h.windGusts} m/s</td>
      <td>${h.blackIceRisk}% (${escapeHtml(h.surfaceState)})</td>
    </tr>
  `).join('');
}

function renderNews(news) {
  els.newsSummary.textContent = `${news.regionQueryLabel} · ${news.summaryText}`;

  const allTags = ['전체'];
  for (const a of news.articles) {
    for (const tag of a.tags) {
      if (!allTags.includes(tag)) allTags.push(tag);
    }
  }

  els.newsFilters.innerHTML = allTags
    .map((tag) => `<button type="button" class="filter-btn" data-tag="${escapeHtml(tag)}" aria-pressed="${state.newsFilter === tag}">${escapeHtml(tag)}</button>`)
    .join('');

  const filtered = state.newsFilter === '전체'
    ? news.articles
    : news.articles.filter((a) => a.tags.includes(state.newsFilter));

  if (filtered.length === 0) {
    els.newsList.innerHTML = '<li class="news-item"><p class="meta-line">해당 조건에 맞는 최근 기상 뉴스가 없습니다.</p></li>';
  } else {
    els.newsList.innerHTML = filtered.map((a) => {
      const tagsHtml = a.tags
        .map((t) => `<span class="news-tag" data-high="${t === '결빙·빙판' || t === '기상특보'}">${escapeHtml(t)}</span>`)
        .join('');
      return `
        <li class="news-item">
          <a class="news-link" href="${escapeHtml(a.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(a.title)}</a>
          <div class="news-meta">
            ${tagsHtml}
            <span>${escapeHtml(a.source)}${a.relativeTime ? ` · ${escapeHtml(a.relativeTime)}` : ''}</span>
          </div>
        </li>
      `;
    }).join('');
  }

  els.refLinks.innerHTML = (news.referenceLinks || [])
    .map((l) => `<a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(l.label)}</a>`)
    .join('');
}

function useCurrentGps() {
  if (!navigator.geolocation) {
    showStatus('이 브라우저에서는 위치 조회를 지원하지 않습니다.', 'error');
    return;
  }
  els.geoBtn.disabled = true;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = Number(pos.coords.latitude.toFixed(4));
      const lon = Number(pos.coords.longitude.toFixed(4));
      state.currentLocation = {
        id: `custom:${lat},${lon}`,
        name: '현재 GPS 위치',
        fullName: `현재 위치 (${lat}, ${lon})`,
        lat,
        lon,
        newsBucket: inferNewsBucket(lat, lon),
        regionTerms: ['수도권'],
        broadRegion: '경기 OR 수도권',
        routeNote: '현재 위치 기준 기상·지표면 온도입니다. 하천변·교량·그늘 구간은 1~2°C 더 낮을 수 있습니다.'
      };
      els.geoBtn.disabled = false;
      loadReport(true);
    },
    (err) => {
      els.geoBtn.disabled = false;
      showStatus(`현재 위치를 가져오지 못했습니다 (${err.message}).`, 'error');
    },
    { enableHighAccuracy: false, timeout: 8000 }
  );
}

function bindEvents() {
  els.presetSelect.addEventListener('change', () => {
    const picked = state.presets.find((p) => p.id === els.presetSelect.value);
    if (picked) {
      state.currentLocation = picked;
      els.searchResults.hidden = true;
      loadReport(false);
    }
  });

  els.searchForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const q = els.searchInput.value.trim();
    if (!q) {
      els.searchResults.hidden = true;
      return;
    }

    let list = [];
    if (IS_LOCAL_API) {
      try {
        const res = await fetch(`./api/locations?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          list = data.locations || [];
        }
      } catch {
      }
    }
    if (list.length === 0) {
      list = await searchLocations(q, { allowNominatim: false });
    }

    if (list.length === 0) {
      els.searchResults.innerHTML = '<div class="search-result-btn">검색 결과가 없습니다.</div>';
      els.searchResults.hidden = false;
      return;
    }
    els.searchResults.innerHTML = list.map((loc, idx) => `
      <button type="button" class="search-result-btn" data-idx="${idx}">
        <span>${escapeHtml(loc.name)}</span>
        <span class="search-result-sub">${escapeHtml(loc.fullName)}</span>
      </button>
    `).join('');
    els.searchResults.hidden = false;
    els.searchResults.onclick = (ev) => {
      const btn = ev.target.closest('button[data-idx]');
      if (!btn) return;
      const chosen = list[Number(btn.dataset.idx)];
      if (chosen) {
        state.currentLocation = chosen;
        els.searchResults.hidden = true;
        els.searchInput.value = chosen.name;
        loadReport(false);
      }
    };
  });

  document.addEventListener('click', (e) => {
    if (!els.searchForm.contains(e.target)) {
      els.searchResults.hidden = true;
    }
  });

  els.bikeSelector.addEventListener('change', (e) => {
    if (e.target.name === 'bike') {
      state.bike = e.target.value;
      savePrefs();
      loadReport(false);
    }
  });

  els.geoBtn.addEventListener('click', useCurrentGps);
  els.refreshBtn.addEventListener('click', () => loadReport(true));

  els.newsFilters.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-tag]');
    if (!btn || !state.report) return;
    state.newsFilter = btn.dataset.tag;
    renderNews(state.report.news);
  });
}

loadPrefs();
initPresets();
bindEvents();
await loadReport(false);
