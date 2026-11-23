import { findPresetLocation, searchLocations } from './lib/locations.mjs';
import { fetchWeatherBundle } from './lib/weather.mjs';
import { fetchLocalWeatherNews } from './lib/news.mjs';
import { buildCyclingReport, BIKE_PROFILES } from './lib/scoring.mjs';

const args = process.argv.slice(2);
let bike = 'hybrid';
const queryParts = [];

for (const arg of args) {
  if (arg.startsWith('--bike=')) {
    const val = arg.slice(7);
    if (BIKE_PROFILES[val]) bike = val;
  } else {
    queryParts.push(arg);
  }
}

const query = queryParts.join(' ').trim();
let location = findPresetLocation(query || 'dasan');
if (!location && query) {
  const found = await searchLocations(query);
  location = found[0] || findPresetLocation('dasan');
}

const [weather, news] = await Promise.all([
  fetchWeatherBundle(location.lat, location.lon),
  fetchLocalWeatherNews(location)
]);

const report = buildCyclingReport(weather, location, bike);
const c = report.current;

console.log(`\n[${report.location.fullName}] 자전거 출격 지수 (${c.time.replace('T', ' ')} KST · ${c.profile.label})`);
console.log(`종합 점수: ${c.score}/100 · 판정: ${c.verdict.label}`);
console.log(`요약: ${c.verdict.headline}`);
if (c.activeCap) {
  console.log(`안전 상한: 원점수 ${c.rawScore} -> ${c.score} (${c.activeCap.reason})`);
}
console.log(`블랙아이스 위험: ${c.blackIceRisk}% (${c.surfaceState} · 추정 노면 ${c.roadTemp}°C · 최근 48h 강수 ${c.precip48h}mm)`);
console.log('');
console.log('항목별 세부 점수:');
for (const f of c.factors) {
  console.log(`  - ${f.label}: ${f.score}/100 | ${f.metric} | ${f.reason}`);
}

if (report.bestWindow) {
  console.log('');
  console.log(`추천 시간대: ${report.bestWindow.time.slice(5, 16).replace('T', ' ')} (${report.bestWindow.score}점 · ${report.bestWindow.label})`);
}
if (report.peakBlackIce && report.peakBlackIce.blackIceRisk >= 35) {
  console.log(`최대 결빙 주의: ${report.peakBlackIce.time.slice(5, 16).replace('T', ' ')} (위험도 ${report.peakBlackIce.blackIceRisk}% · 노면 ${report.peakBlackIce.roadTemp}°C)`);
}

console.log('');
console.log(`지역 기상 뉴스 (${news.summaryText}):`);
for (const article of news.articles.slice(0, 5)) {
  console.log(`  - [${article.tags.join('/')}] ${article.title} (${article.source}, ${article.relativeTime})`);
}
console.log('');
