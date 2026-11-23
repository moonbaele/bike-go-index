import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateScenario, simulateSurfaceTimeline, evaluateHour } from '../lib/scoring.mjs';
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

test('news classifier filters out non-weather articles and tags black ice accurately', () => {
  const noise = classifyNewsItem('정부, AI 데이터센터 전력 규제 완화…비수도권 평가 면제', ['남양주', '다산']);
  assert.equal(noise, null);

  const iceNews = classifyNewsItem('남양주 아침 영하권 한파…도로 살얼음·빙판길 주의', ['남양주', '다산']);
  assert.ok(iceNews !== null);
  assert.equal(iceNews.isLocalMatch, true);
  assert.equal(iceNews.severity, 'high');
  assert.ok(iceNews.tags.includes('결빙·빙판'));
  assert.ok(iceNews.tags.includes('한파·추위'));
});
