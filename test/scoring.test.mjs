import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateScenario, simulateSurfaceTimeline, evaluateHour, evaluateNewsAdjustment, buildCyclingReport } from '../lib/scoring.mjs';
import { classifyNewsItem } from '../lib/news.mjs';

test('rain followed by freezing drop triggers high black ice risk and hard safety cap', () => {
  const result = simulateScenario({
    recentRainMm: 5,
    hoursAgo: 8,
    minTempAfter: -3,
    currentTemp: 0.5,
    humidity: 80,
    windGusts: 4,
    pm25: 18,
    isSunnyNow: false,
    bike: 'hybrid'
  });

  assert.ok(result.blackIceRisk >= 70, `Expected blackIceRisk >= 70, got ${result.blackIceRisk}`);
  assert.ok(result.score <= 25, `Expected capped score <= 25, got ${result.score}`);
  assert.equal(result.verdict.level, 'stop');
  assert.ok(result.activeCap !== null);
});

test('warm sunny weather after rain dries road and keeps black ice risk near zero', () => {
  const result = simulateScenario({
    recentRainMm: 4,
    hoursAgo: 18,
    minTempAfter: 6,
    currentTemp: 13,
    humidity: 45,
    windGusts: 3.5,
    pm25: 15,
    isSunnyNow: true,
    bike: 'hybrid'
  });

  assert.equal(result.blackIceRisk, 0);
  assert.ok(result.score >= 75, `Expected rideable score >= 75, got ${result.score}`);
  assert.equal(result.verdict.level, 'go');
});

test('road bike profile scores stricter than gravel on wet road', () => {
  const base = {
    recentRainMm: 6,
    hoursAgo: 1,
    minTempAfter: 10,
    currentTemp: 12,
    humidity: 85,
    windGusts: 4,
    pm25: 15,
    isSunnyNow: false
  };
  const road = simulateScenario({ ...base, bike: 'road' });
  const gravel = simulateScenario({ ...base, bike: 'gravel' });

  assert.ok(road.factors[0].score < gravel.factors[0].score, 'Road bike should penalize wet surface more than gravel');
});

test('hourly physics converts afternoon rain into overnight black ice when road temp drops below zero', () => {
  const hourly = [];
  for (let i = 0; i < 24; i++) {
    const isRain = i === 6 || i === 7;
    const temp = i < 10 ? 8 : Math.max(-3, 8 - (i - 9) * 1.4);
    hourly.push({
      time: `2026-11-23T${String(i).padStart(2, '0')}:00`,
      temp,
      apparentTemp: temp - 2,
      dewPoint: temp - 2,
      humidity: 82,
      precipitation: isRain ? 2.5 : 0,
      rain: isRain ? 2.5 : 0,
      snowfall: 0,
      snowDepth: 0,
      weatherCode: isRain ? 61 : 0,
      weatherLabel: isRain ? '약한 비' : '맑음',
      windSpeed: 3,
      windGusts: 5,
      soilTemp: temp - 1.5,
      radiation: i >= 8 && i <= 15 ? 120 : 0,
      visibility: 10000,
      pm25: 20,
      pm10: 35
    });
  }

  const timeline = simulateSurfaceTimeline(hourly);
  const afternoon = evaluateHour(timeline, 8, 'hybrid');
  const dawnFreeze = evaluateHour(timeline, 20, 'hybrid');

  assert.ok(afternoon.blackIceRisk < 20, `Afternoon should not be icy yet, got ${afternoon.blackIceRisk}`);
  assert.ok(dawnFreeze.blackIceRisk >= 75, `Dawn after freezing drop should be icy, got ${dawnFreeze.blackIceRisk}`);
  assert.equal(dawnFreeze.verdict.level, 'stop');
});

test('drizzle with rain=0 still wets road surface and affects surface score', () => {
  const hourly = Array.from({ length: 6 }, (_, i) => ({
    time: `2026-11-23T${String(10 + i).padStart(2, '0')}:00`,
    temp: 6,
    apparentTemp: 3,
    dewPoint: 4,
    humidity: 85,
    precipitation: i === 5 ? 0.9 : 0,
    rain: 0,
    snowfall: 0,
    snowDepth: 0,
    weatherCode: i === 5 ? 53 : 2,
    weatherLabel: i === 5 ? '이슬비' : '구름 조금',
    windSpeed: 3,
    windGusts: 4.5,
    soilTemp: 3.5,
    radiation: 100,
    visibility: 6000,
    pm25: 18,
    pm10: 25
  }));

  const timeline = simulateSurfaceTimeline(hourly);
  assert.ok(timeline[5].liquidMoisture > 0.5, 'Drizzle should accumulate surface liquidMoisture');
  assert.notEqual(timeline[5].surfaceState, '건조');
});

test('dried road 46h after rain does not spike to black ice on sunset cooling', () => {
  const hourly = Array.from({ length: 52 }, (_, i) => {
    const isRain = i === 1 || i === 2;
    const isColdFirstNight = i >= 6 && i <= 14;
    const isWarmDryDay = i >= 18 && i <= 46;
    const temp = isColdFirstNight ? -2 : isWarmDryDay ? 6 : 4;
    const soilTemp = i >= 47 ? -2.2 : temp;
    return {
      time: `2026-11-23T${String(i % 24).padStart(2, '0')}:00`,
      temp,
      apparentTemp: temp - 1,
      dewPoint: -2,
      humidity: isWarmDryDay ? 50 : 72,
      precipitation: isRain ? 4 : 0,
      rain: isRain ? 4 : 0,
      snowfall: 0,
      snowDepth: 0,
      weatherCode: isRain ? 61 : 0,
      weatherLabel: isRain ? '약한 비' : '맑음',
      windSpeed: 3,
      windGusts: 4.5,
      soilTemp,
      radiation: isWarmDryDay ? 350 : 0,
      visibility: 10000,
      pm25: 18,
      pm10: 25
    };
  });

  const timeline = simulateSurfaceTimeline(hourly);
  const sunsetHour = evaluateHour(timeline, 47, 'hybrid');
  const nextHour = evaluateHour(timeline, 48, 'hybrid');
  assert.ok(sunsetHour.blackIceRisk < 15, `Dried road should not spike to black ice, got ${sunsetHour.blackIceRisk}%`);
  assert.ok(nextHour.blackIceRisk < 15, `Next hour should also stay dry, got ${nextHour.blackIceRisk}%`);
  assert.notEqual(sunsetHour.verdict.level, 'stop');
});

test('news classifier filters out non-weather and other-region articles accurately', () => {
  const noise = classifyNewsItem('정부, AI 데이터센터 전력 규제 완화…비수도권 평가 면제', ['남양주', '다산'], '경기 OR 수도권');
  assert.equal(noise, null);

  const econNoise = classifyNewsItem('12월 기업 경기전망 3개월 만에 반등…제조업은 여전히 한파', ['남양주', '다산'], '경기 OR 수도권');
  assert.equal(econNoise, null);

  const otherRegion = classifyNewsItem('강원 최대 8cm 눈·서울 30mm 비…출근길 어는 비 빙판 주의', ['남양주', '다산동', '구리', '경기북부'], '경기 OR 수도권');
  assert.equal(otherRegion, null);

  const westCoast = classifyNewsItem('내일도 영하 4도…서해안 빙판길 주의', ['남양주', '다산동', '구리', '경기북부'], '경기 OR 수도권');
  assert.equal(westCoast, null);

  const national = classifyNewsItem('월요일부터 춥고 미끄럽다…전국 비 또는 눈, 살얼음 주의', ['남양주', '다산동', '구리', '경기북부'], '경기 OR 수도권');
  assert.ok(national !== null);
  assert.equal(national.regionScope, 'national');

  const iceNews = classifyNewsItem('남양주 아침 영하권 한파…도로 살얼음·빙판길 주의', ['남양주', '다산'], '경기 OR 수도권');
  assert.ok(iceNews !== null);
  assert.equal(iceNews.isLocalMatch, true);
  assert.equal(iceNews.regionScope, 'local');
  assert.equal(iceNews.severity, 'high');
  assert.ok(iceNews.tags.includes('결빙·빙판'));
  assert.ok(iceNews.tags.includes('한파·추위'));
});

test('news adjustment penalizes 2+ recent 24h local ice/advisory articles and ignores stale or national-only ones', () => {
  const now = Date.parse('2026-11-23T08:00:00Z');
  const hAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();

  const single = evaluateNewsAdjustment({
    articles: [{ title: '도로 살얼음 주의', tags: ['결빙·빙판'], regionScope: 'local', publishedAt: hAgo(3) }]
  }, now);
  assert.equal(single.active, false);
  assert.equal(single.penalty, 0);

  const nationalOnly = evaluateNewsAdjustment({
    articles: [
      { title: '전국 비 또는 눈 살얼음 주의', tags: ['결빙·빙판'], regionScope: 'national', publishedAt: hAgo(2) },
      { title: '전국 한파특보 발효', tags: ['기상특보'], regionScope: 'national', publishedAt: hAgo(3) }
    ]
  }, now);
  assert.equal(nationalOnly.active, false);
  assert.equal(nationalOnly.penalty, 0);

  const stale = evaluateNewsAdjustment({
    articles: [
      { title: '살얼음', tags: ['결빙·빙판'], regionScope: 'local', publishedAt: hAgo(30) },
      { title: '한파특보', tags: ['기상특보'], regionScope: 'local', publishedAt: hAgo(40) }
    ]
  }, now);
  assert.equal(stale.active, false);
  assert.equal(stale.penalty, 0);

  const twoRecent = evaluateNewsAdjustment({
    articles: [
      { title: '도로 살얼음 주의', tags: ['결빙·빙판'], regionScope: 'local', publishedAt: hAgo(4) },
      { title: '경기 한파주의보', tags: ['기상특보'], regionScope: 'local', publishedAt: hAgo(6) }
    ]
  }, now);
  assert.equal(twoRecent.active, true);
  assert.equal(twoRecent.penalty, 5);
  assert.ok(twoRecent.alertText.includes('-5점 보정'));

  const fourRecent = evaluateNewsAdjustment({
    articles: [
      { title: '살얼음 1', tags: ['결빙·빙판'], regionScope: 'local', publishedAt: hAgo(2) },
      { title: '살얼음 2', tags: ['결빙·빙판'], regionScope: 'local', publishedAt: hAgo(5) },
      { title: '특보 1', tags: ['기상특보'], regionScope: 'local', publishedAt: hAgo(7) },
      { title: '빙판길', tags: ['결빙·빙판'], regionScope: 'local', publishedAt: hAgo(9) }
    ]
  }, now);
  assert.equal(fourRecent.active, true);
  assert.equal(fourRecent.penalty, 10);
});

test('buildCyclingReport downgrades borderline go score when recent 24h news alert triggers', () => {
  const nowIso = new Date().toISOString();
  const hourly = Array.from({ length: 12 }, (_, i) => ({
    time: `2026-11-23T${String(10 + i).padStart(2, '0')}:00`,
    temp: 2,
    apparentTemp: -2,
    dewPoint: -5,
    humidity: 45,
    precipitation: 0,
    rain: 0,
    snowfall: 0,
    snowDepth: 0,
    weatherCode: 0,
    weatherLabel: '맑음',
    windSpeed: 6,
    windGusts: 10,
    soilTemp: 3,
    radiation: 260,
    visibility: 10000,
    pm25: 45,
    pm10: 65
  }));
  const weather = { fetchedAt: nowIso, currentIndex: 2, hourly, daily: [] };
  const loc = { id: 'dasan', name: '남양주 다산동', fullName: '경기도 남양주시 다산동' };

  const withoutNews = buildCyclingReport(weather, loc, 'hybrid', { articles: [] });
  const withNews = buildCyclingReport(weather, loc, 'hybrid', {
    articles: [
      { title: '경기 북부 살얼음 주의', tags: ['결빙·빙판'], publishedAt: nowIso },
      { title: '남양주 한파특보 발효', tags: ['기상특보'], publishedAt: nowIso },
      { title: '도로 결빙 사고 주의', tags: ['결빙·빙판'], publishedAt: nowIso }
    ]
  });

  assert.equal(withoutNews.current.verdict.level, 'go');
  assert.equal(withNews.current.newsAdjustment.active, true);
  assert.equal(withNews.current.score, withoutNews.current.score - withNews.current.newsAdjustment.penalty);
  assert.equal(withNews.current.verdict.level, 'caution');
});
