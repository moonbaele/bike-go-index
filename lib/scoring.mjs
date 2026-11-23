export const BIKE_PROFILES = {
  road: {
    id: 'road',
    label: '로드바이크',
    detail: '슬릭 타이어 · 빙판/젖은 노면 민감',
    wetMultiplier: 1.25,
    iceMultiplier: 1.2,
    windMultiplier: 1.15
  },
  hybrid: {
    id: 'hybrid',
    label: '하이브리드 · 생활',
    detail: '일반 출퇴근 · 표준 기준',
    wetMultiplier: 1.0,
    iceMultiplier: 1.0,
    windMultiplier: 1.0
  },
  gravel: {
    id: 'gravel',
    label: '그래블 · MTB',
    detail: '광폭 타이어 · 젖은 노면 내성 높음 (결빙은 동일 주의)',
    wetMultiplier: 0.82,
    iceMultiplier: 0.95,
    windMultiplier: 0.92
  }
};

const FREEZING_PRECIP_CODES = new Set([56, 57, 66, 67]);
const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

export function estimateRoadSurfaceTemp(hour) {
  const air = hour.temp;
  const soil = hour.soilTemp;
  const rad = hour.radiation ?? 0;
  const radiativeOffset = rad < 80 ? 1.2 : rad < 220 ? 0.5 : 0.1;
  const airBased = air - radiativeOffset;
  if (soil === null || soil === undefined || Number.isNaN(soil)) {
    return round1(airBased);
  }
  return round1(Math.min(soil, airBased));
}

export function simulateSurfaceTimeline(hourly) {
  let liquidMoisture = 0;
  let iceLoad = 0;
  let lastPrecipIndex = -1;
  let lastPrecipAmount24h = 0;
  let lastFreezeFromPrecipIndex = -1;

  return hourly.map((hour, idx) => {
    const roadTemp = estimateRoadSurfaceTemp(hour);
    const precip = Math.max(0, hour.precipitation ?? 0);
    const snowCm = Math.max(0, hour.snowfall ?? 0);
    const rainMm = Math.max(0, hour.rain ?? 0, precip - snowCm);
    const rh = hour.humidity ?? 60;
    const dew = hour.dewPoint ?? (hour.temp - 4);
    const rad = hour.radiation ?? 0;
    const wind = hour.windSpeed ?? 2;
    const snowDepthCm = Math.max(0, (hour.snowDepth ?? 0) * 100);
    const wmo = hour.weatherCode ?? 0;

    if (precip >= 0.1 || snowCm >= 0.1) {
      lastPrecipIndex = idx;
    }

    if (FREEZING_PRECIP_CODES.has(wmo)) {
      iceLoad = Math.min(12, iceLoad + Math.max(0.6, precip * 1.1));
      lastFreezeFromPrecipIndex = idx;
    } else if (snowCm > 0 || SNOW_CODES.has(wmo)) {
      const snowWater = Math.max(snowCm, precip);
      if (roadTemp <= 1.2) {
        iceLoad = Math.min(12, iceLoad + snowWater * 0.9);
        lastFreezeFromPrecipIndex = idx;
      } else {
        liquidMoisture = Math.min(12, liquidMoisture + snowWater * 0.65);
        iceLoad = Math.min(12, iceLoad + snowWater * 0.35);
      }
    } else if (rainMm > 0) {
      liquidMoisture = Math.min(12, liquidMoisture + rainMm * 0.9);
    }

    const frostLikely = rh >= 86 && (hour.temp - dew) <= 1.8 && roadTemp <= 0.8 && rad < 110;
    if (frostLikely) {
      iceLoad = Math.min(12, Math.max(iceLoad, Math.min(0.85, iceLoad + 0.16)));
    }

    if (roadTemp <= 0.5 && liquidMoisture > 0.04) {
      const freezeRate = roadTemp <= -2.0 ? 0.85 : roadTemp <= 0 ? 0.62 : 0.28;
      const frozen = liquidMoisture * freezeRate;
      liquidMoisture = Math.max(0, liquidMoisture - frozen);
      iceLoad = Math.min(12, iceLoad + frozen);
      if (frozen >= 0.08) {
        lastFreezeFromPrecipIndex = idx;
      }
    } else if (roadTemp > 1.0 && iceLoad > 0) {
      const meltRate = clamp((roadTemp - 1.0) * 0.13 + (rad / 520) * 0.22, 0.03, 0.72);
      const melted = iceLoad * meltRate;
      iceLoad = Math.max(0, iceLoad - melted);
      liquidMoisture = Math.min(12, liquidMoisture + melted * 0.82);
    }

    if (snowDepthCm >= 0.5) {
      iceLoad = Math.max(iceLoad, Math.min(8, snowDepthCm * 0.6));
    }

    if (precip < 0.1 && snowCm < 0.1) {
      if (roadTemp > 0.5) {
        const dryRate = (
          0.04 +
          Math.max(0, 100 - rh) * 0.0045 +
          (rad / 450) * 0.28 +
          Math.min(wind, 8) * 0.015
        ) * (hour.temp > 5 ? 1.2 : 0.72);
        liquidMoisture = Math.max(0, liquidMoisture * (1 - clamp(dryRate, 0.03, 0.62)) - 0.035);
      } else {
        iceLoad = Math.max(0, iceLoad - 0.02);
        liquidMoisture = Math.max(0, liquidMoisture - 0.01);
      }
    }

    const start24 = Math.max(0, idx - 24);
    const start48 = Math.max(0, idx - 48);
    let precip24h = 0;
    let precip48h = 0;
    let snow48h = 0;
    let minTempAfterPrecip = null;
    let minRoadTempAfterPrecip = null;

    for (let j = start48; j <= idx; j++) {
      const p = hourly[j].precipitation ?? 0;
      const s = hourly[j].snowfall ?? 0;
      precip48h += p;
      snow48h += s;
      if (j >= start24) precip24h += p;
      if (lastPrecipIndex !== -1 && j >= lastPrecipIndex) {
        const rTemp = estimateRoadSurfaceTemp(hourly[j]);
        if (minTempAfterPrecip === null || hourly[j].temp < minTempAfterPrecip) {
          minTempAfterPrecip = hourly[j].temp;
        }
        if (minRoadTempAfterPrecip === null || rTemp < minRoadTempAfterPrecip) {
          minRoadTempAfterPrecip = rTemp;
        }
      }
    }
    lastPrecipAmount24h = precip24h;

    const hoursSincePrecip = lastPrecipIndex === -1 ? null : idx - lastPrecipIndex;

    let blackIceRisk = 0;
    if (iceLoad > 0.03) {
      blackIceRisk = clamp(Math.round(22 + iceLoad * 38), 0, 100);
      if (roadTemp <= 0) blackIceRisk = clamp(blackIceRisk + 18, 0, 100);
      else if (roadTemp <= 2.5) blackIceRisk = clamp(blackIceRisk + 6, 0, 100);
      else if (roadTemp >= 5 && rad >= 250) blackIceRisk = Math.max(0, blackIceRisk - 18);
    }

    if (precip48h >= 0.5 && minRoadTempAfterPrecip !== null && minRoadTempAfterPrecip <= 0 && roadTemp <= 2.5) {
      const postRainFreezeFloor = roadTemp <= 0 ? 78 : 52;
      blackIceRisk = Math.max(blackIceRisk, postRainFreezeFloor);
    }

    if (liquidMoisture >= 0.6 && roadTemp <= 1.5 && roadTemp > 0.5) {
      const incipientRisk = Math.round(28 + Math.min(20, liquidMoisture * 4) + (1.5 - roadTemp) * 14);
      blackIceRisk = Math.max(blackIceRisk, clamp(incipientRisk, 28, 55));
    }

    if (FREEZING_PRECIP_CODES.has(wmo)) {
      blackIceRisk = Math.max(blackIceRisk, 95);
    }

    const wetnessRisk = clamp(Math.round(liquidMoisture * 34), 0, 100);

    let surfaceState = '건조';
    if (blackIceRisk >= 70) surfaceState = '블랙아이스 위험';
    else if (blackIceRisk >= 40) surfaceState = '결빙 주의';
    else if (wetnessRisk >= 55) surfaceState = '젖은 노면';
    else if (wetnessRisk >= 15 || blackIceRisk >= 20 || precip >= 0.2) surfaceState = '부분 습기·그늘 주의';

    return {
      ...hour,
      roadTemp,
      liquidMoisture: round1(liquidMoisture),
      iceLoad: round1(iceLoad),
      blackIceRisk,
      wetnessRisk,
      surfaceState,
      frostLikely,
      precip24h: round1(lastPrecipAmount24h),
      precip48h: round1(precip48h),
      snow48h: round1(snow48h),
      hoursSincePrecip,
      minTempAfterPrecip: minTempAfterPrecip === null ? null : round1(minTempAfterPrecip),
      minRoadTempAfterPrecip: minRoadTempAfterPrecip === null ? null : round1(minRoadTempAfterPrecip),
      frozeRecently: lastFreezeFromPrecipIndex !== -1 && (idx - lastFreezeFromPrecipIndex) <= 18
    };
  });
}

function scoreSurface(state, profile) {
  const icePenalty = state.blackIceRisk * 0.92 * profile.iceMultiplier;
  const wetPenalty = state.wetnessRisk * 0.42 * profile.wetMultiplier;
  const combinedPenalty = Math.max(icePenalty, icePenalty * 0.85 + wetPenalty * 0.45, wetPenalty);
  const score = clamp(Math.round(100 - combinedPenalty), 0, 100);

  let reason = `추정 노면 ${state.roadTemp}°C · 건조한 상태`;
  if (state.blackIceRisk >= 70) {
    const rainNote = state.precip48h >= 0.5
      ? `최근 48시간 강수 ${state.precip48h}mm 후 노면이 ${state.minRoadTempAfterPrecip}°C까지 하강`
      : `노면 추정온도 ${state.roadTemp}°C와 결빙 조건 겹침`;
    reason = `${rainNote} · 그늘/교량 블랙아이스 매우 위험`;
  } else if (state.blackIceRisk >= 40) {
    reason = `노면 추정 ${state.roadTemp}°C · 강변/교량 그늘 구간 잔존 결빙 가능`;
  } else if (state.wetnessRisk >= 50) {
    reason = `최근 강수로 노면이 젖어 제동거리 증가 · 페인트/맨홀 미끄럼 주의`;
  } else if (state.wetnessRisk >= 20) {
    reason = `최근 강수 흔적 잔존 · 부분 물고임 주의`;
  } else if (state.frostLikely) {
    reason = `높은 습도(${state.humidity}%)와 낮은 노면온도(${state.roadTemp}°C)로 서리 가능`;
  }

  return {
    key: 'surface',
    label: '노면·블랙아이스',
    score,
    weight: 0.30,
    metric: `${state.surfaceState} (결빙 ${state.blackIceRisk}%)`,
    reason
  };
}

function scorePrecipitation(timeline, idx) {
  const cur = timeline[idx];
  const next3 = timeline.slice(idx + 1, idx + 4);
  const next6 = timeline.slice(idx + 1, idx + 7);
  const next3Precip = round1(next3.reduce((s, r) => s + (r.precipitation ?? 0), 0));
  const next6Precip = round1(next6.reduce((s, r) => s + (r.precipitation ?? 0), 0));
  const curPrecip = round1(cur.precipitation ?? 0);
  const curSnow = round1(cur.snowfall ?? 0);
  const visKm = round1((cur.visibility ?? 10000) / 1000);

  let penalty = 0;
  if (curSnow >= 0.5) penalty += 85;
  else if (curPrecip >= 3.0) penalty += 90;
  else if (curPrecip >= 1.5) penalty += 72;
  else if (curPrecip >= 0.5) penalty += 48;
  else if (curPrecip >= 0.1) penalty += 26;

  if (next3Precip >= 3.0) penalty += 38;
  else if (next3Precip >= 1.0) penalty += 24;
  else if (next3Precip >= 0.3) penalty += 12;
  else if (next6Precip >= 2.0) penalty += 14;

  if (visKm < 1.0) penalty += 32;
  else if (visKm < 3.0) penalty += 16;
  else if (visKm < 5.0) penalty += 7;

  const score = clamp(Math.round(100 - penalty), 0, 100);

  let reason = `${cur.weatherLabel} · 향후 6시간 강수 예보 없음`;
  if (curSnow >= 0.2) {
    reason = `현재 눈 ${curSnow}cm/h 내리는 중`;
  } else if (curPrecip >= 0.1) {
    reason = `현재 강수 ${curPrecip}mm/h (${cur.weatherLabel}) · 3시간 내 추가 ${next3Precip}mm`;
  } else if (next3Precip >= 0.3) {
    reason = `3시간 내 강수 ${next3Precip}mm 예보 · 복귀 시 우천 위험`;
  } else if (next6Precip >= 1.0) {
    reason = `3~6시간 뒤 강수 ${next6Precip}mm 예보 · 단거리 라이딩 권장`;
  } else if (visKm < 3.0) {
    reason = `시정 ${visKm}km로 안개/박무 · 전조등·후미등 필수`;
  }

  return {
    key: 'precipitation',
    label: '강수·시정',
    score,
    weight: 0.25,
    metric: curPrecip > 0 ? `현재 ${curPrecip}mm/h` : next3Precip > 0 ? `3h 예보 ${next3Precip}mm` : `${cur.weatherLabel} · 시정 ${visKm}km`,
    reason,
    next3Precip,
    next6Precip
  };
}

function scoreWind(cur, profile) {
  const wind = round1(cur.windSpeed ?? 0);
  const gust = round1(cur.windGusts ?? wind);

  let basePenalty = 0;
  if (wind >= 11) basePenalty = 92;
  else if (wind >= 8.5) basePenalty = 72;
  else if (wind >= 6.5) basePenalty = 46;
  else if (wind >= 4.5) basePenalty = 22;
  else if (wind >= 3.0) basePenalty = 8;

  let gustPenalty = 0;
  if (gust >= 15) gustPenalty = 90;
  else if (gust >= 12) gustPenalty = 66;
  else if (gust >= 9.5) basePenalty = Math.max(basePenalty, 42);
  else if (gust >= 7.5) gustPenalty = 20;

  const penalty = Math.max(basePenalty, gustPenalty) * profile.windMultiplier;
  const score = clamp(Math.round(100 - penalty), 0, 100);

  let reason = `풍속 ${wind}m/s (돌풍 ${gust}m/s) · 라이딩에 무난`;
  if (gust >= 12 || wind >= 8.5) {
    reason = `강한 바람/돌풍 ${gust}m/s · 교량·강변 횡풍 낙차 주의`;
  } else if (gust >= 8 || wind >= 5.5) {
    reason = `맞바람 체감 뚜렷함 (돌풍 ${gust}m/s) · 체력 안배 필요`;
  }

  return {
    key: 'wind',
    label: '바람·돌풍',
    score,
    weight: 0.15,
    metric: `${wind} m/s (돌풍 ${gust})`,
    reason
  };
}

function scoreTemperature(timeline, idx) {
  const cur = timeline[idx];
  const app = round1(cur.apparentTemp ?? cur.temp);
  const air = round1(cur.temp);
  const next4 = timeline.slice(idx + 1, idx + 5);
  const minNext4 = next4.length ? Math.min(...next4.map((h) => h.temp)) : air;
  const tempDrop = round1(Math.max(0, air - minNext4));

  let score = 100;
  if (app < 10) {
    score = clamp(Math.round(100 - (10 - app) * 4.8), 5, 100);
  } else if (app > 25) {
    score = clamp(Math.round(100 - (app - 25) * 7.5), 5, 100);
  }

  if (tempDrop >= 6) score = Math.max(5, score - 14);
  else if (tempDrop >= 4) score = Math.max(5, score - 7);

  let reason = `기온 ${air}°C (체감 ${app}°C) · 쾌적한 구간`;
  if (app <= -3) {
    reason = `체감 ${app}°C 강추위 · 방풍 장갑·발열 장비 필수`;
  } else if (app <= 3) {
    reason = `체감 ${app}°C 쌀쌀함 · 방풍 자켓·장갑 권장`;
  } else if (app < 10) {
    reason = `체감 ${app}°C 선선함 · 바람막이 권장`;
  } else if (app >= 32) {
    reason = `체감 ${app}°C 폭염 · 탈수 및 열사병 위험`;
  } else if (app >= 27) {
    reason = `체감 ${app}°C 더움 · 충분한 수분 보충 필요`;
  }

  if (tempDrop >= 4) {
    reason += ` · 4시간 내 ${tempDrop}°C 급락 예상`;
  }

  return {
    key: 'temperature',
    label: '기온·체감',
    score,
    weight: 0.15,
    metric: `${air}°C (체감 ${app}°C)`,
    reason
  };
}

function scoreAirQuality(cur) {
  const pm25 = cur.pm25;
  const pm10 = cur.pm10;

  if (pm25 === null && pm10 === null) {
    return {
      key: 'air',
      label: '대기질',
      score: 75,
      weight: 0.15,
      metric: '측정값 없음',
      reason: '실시간 미세먼지 데이터를 불러오지 못해 중립 점수로 반영'
    };
  }

  const p25 = pm25 ?? 20;
  const p10 = pm10 ?? 35;

  let s25 = 100;
  if (p25 <= 15) s25 = 100;
  else if (p25 <= 35) s25 = Math.round(92 - ((p25 - 15) / 20) * 24);
  else if (p25 <= 75) s25 = Math.round(64 - ((p25 - 35) / 40) * 40);
  else s25 = clamp(Math.round(24 - (p25 - 75) * 0.4), 5, 24);

  let s10 = 100;
  if (p10 <= 30) s10 = 100;
  else if (p10 <= 80) s10 = Math.round(92 - ((p10 - 30) / 50) * 24);
  else if (p10 <= 150) s10 = Math.round(64 - ((p10 - 80) / 70) * 40);
  else s10 = clamp(Math.round(24 - (p10 - 150) * 0.25), 5, 24);

  const score = Math.min(s25, s10);
  let grade = '좋음';
  if (p25 > 75 || p10 > 150) grade = '매우 나쁨';
  else if (p25 > 35 || p10 > 80) grade = '나쁨';
  else if (p25 > 15 || p10 > 30) grade = '보통';

  const reason = grade === '좋음' || grade === '보통'
    ? `초미세먼지 ${Math.round(p25)}㎍/㎥ · 미세먼지 ${Math.round(p10)}㎍/㎥ (${grade})`
    : `초미세먼지 ${Math.round(p25)}㎍/㎥ (${grade}) · 고강도 유산소 호흡 시 부담 큼`;

  return {
    key: 'air',
    label: '대기질',
    score,
    weight: 0.15,
    metric: `PM2.5 ${Math.round(p25)} · PM10 ${Math.round(p10)} (${grade})`,
    reason
  };
}

export function classifyVerdict(score) {
  if (score >= 75) {
    return {
      level: 'go',
      label: '출격 추천',
      headline: '지금 자전거 끌고 나가기 좋은 컨디션입니다.'
    };
  }
  if (score >= 55) {
    return {
      level: 'caution',
      label: '주의 후 출발',
      headline: '라이딩은 가능하지만 노면·기상 변수를 챙기고 출발하세요.'
    };
  }
  if (score >= 35) {
    return {
      level: 'avoid',
      label: '비추천',
      headline: '위험하거나 불쾌한 요소가 커서 시간대를 미루는 편이 안전합니다.'
    };
  }
  return {
    level: 'stop',
    label: '출격 금지',
    headline: '결빙·강수·강풍 등 안전 위험이 높아 오늘 이 시간대 출격은 피하세요.'
  };
}

export function evaluateHour(timeline, idx, bikeProfileId = 'hybrid') {
  const profile = BIKE_PROFILES[bikeProfileId] || BIKE_PROFILES.hybrid;
  const state = timeline[idx];

  const surface = scoreSurface(state, profile);
  const precipitation = scorePrecipitation(timeline, idx);
  const wind = scoreWind(state, profile);
  const temperature = scoreTemperature(timeline, idx);
  const air = scoreAirQuality(state);

  const factors = [surface, precipitation, wind, temperature, air];
  const rawScore = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0)
  );

  const caps = [];
  if (state.blackIceRisk >= 70 || FREEZING_PRECIP_CODES.has(state.weatherCode)) {
    caps.push({ cap: 25, reason: `블랙아이스 위험(${state.blackIceRisk}%)으로 안전 상한 적용` });
  } else if (state.blackIceRisk >= 45) {
    caps.push({ cap: 48, reason: `노면 결빙 주의(${state.blackIceRisk}%)로 상한 적용` });
  }

  if ((state.precipitation ?? 0) >= 2.0 || (state.snowfall ?? 0) >= 0.5) {
    caps.push({ cap: 30, reason: `현재 강수/적설(${state.precipitation}mm/h)으로 안전 상한 적용` });
  } else if ((state.precipitation ?? 0) >= 0.5) {
    caps.push({ cap: 52, reason: `현재 비/이슬비(${state.precipitation}mm/h)로 상한 적용` });
  }

  if ((state.windGusts ?? 0) >= 14 || (state.windSpeed ?? 0) >= 11) {
    caps.push({ cap: 35, reason: `위험 수준 강풍/돌풍(${round1(state.windGusts)}m/s)으로 상한 적용` });
  }

  if ((state.pm25 ?? 0) > 75 || (state.pm10 ?? 0) > 150) {
    caps.push({ cap: 45, reason: `미세먼지 매우 나쁨으로 상한 적용` });
  }

  if (state.wetnessRisk >= 60) {
    caps.push({ cap: 68, reason: `노면이 충분히 젖어 제동·미끄럼 주의 상한 적용` });
  }

  if (precipitation.next3Precip >= 2.5) {
    caps.push({ cap: 66, reason: `3시간 내 강수 ${precipitation.next3Precip}mm 예보로 상한 적용` });
  }

  const activeCap = caps.length > 0
    ? caps.reduce((min, item) => (item.cap < min.cap ? item : min))
    : null;

  const score = activeCap ? Math.min(rawScore, activeCap.cap) : rawScore;
  const verdict = classifyVerdict(score);

  const primaryRisk = [...factors].sort((a, b) => a.score - b.score)[0];

  return {
    time: state.time,
    score,
    rawScore,
    activeCap,
    verdict,
    profile,
    primaryRisk,
    blackIceRisk: state.blackIceRisk,
    surfaceState: state.surfaceState,
    roadTemp: state.roadTemp,
    temp: round1(state.temp),
    apparentTemp: round1(state.apparentTemp ?? state.temp),
    precipitation: round1(state.precipitation ?? 0),
    precip48h: state.precip48h,
    snow48h: state.snow48h,
    hoursSincePrecip: state.hoursSincePrecip,
    minTempAfterPrecip: state.minTempAfterPrecip,
    minRoadTempAfterPrecip: state.minRoadTempAfterPrecip,
    windSpeed: round1(state.windSpeed ?? 0),
    windGusts: round1(state.windGusts ?? 0),
    humidity: state.humidity,
    pm25: state.pm25 === null ? null : Math.round(state.pm25),
    pm10: state.pm10 === null ? null : Math.round(state.pm10),
    weatherLabel: state.weatherLabel,
    factors
  };
}

export function evaluateNewsAdjustment(news, nowMs = Date.now()) {
  const articles = news?.articles || [];
  const windowMs = 24 * 60 * 60 * 1000;
  let iceCount = 0;
  let advisoryCount = 0;
  const matched = [];

  for (const article of articles) {
    const ts = article.timestamp || (article.publishedAt ? Date.parse(article.publishedAt) : 0);
    if (!ts || Number.isNaN(ts)) continue;
    const ageMs = nowMs - ts;
    if (ageMs < -60 * 60 * 1000 || ageMs > windowMs) continue;

    const tags = article.tags || [];
    const hasIce = tags.includes('결빙·빙판');
    const hasAdvisory = tags.includes('기상특보');
    if (hasIce || hasAdvisory) {
      if (hasIce) iceCount++;
      if (hasAdvisory) advisoryCount++;
      matched.push(article);
    }
  }

  const count = matched.length;
  if (count < 2) {
    return {
      active: false,
      penalty: 0,
      count,
      iceCount,
      advisoryCount,
      alertText: ''
    };
  }

  let penalty = 5;
  if (count >= 4 || (iceCount >= 2 && advisoryCount >= 1)) penalty = 10;
  else if (count === 3) penalty = 8;

  const parts = [];
  if (iceCount > 0) parts.push(`결빙·빙판 ${iceCount}건`);
  if (advisoryCount > 0) parts.push(`기상특보 ${advisoryCount}건`);

  return {
    active: true,
    penalty,
    count,
    iceCount,
    advisoryCount,
    alertText: `지역 뉴스 경보: 최근 24시간 내 ${parts.join(' · ')} 보도 (-${penalty}점 보정)`
  };
}

export function buildCyclingReport(weatherBundle, location, bikeProfileId = 'hybrid', news = null) {
  const timeline = simulateSurfaceTimeline(weatherBundle.hourly);
  const idx = weatherBundle.currentIndex;
  const baseCurrent = evaluateHour(timeline, idx, bikeProfileId);
  const newsAdjustment = evaluateNewsAdjustment(news);

  let current = {
    ...baseCurrent,
    weatherScore: baseCurrent.score,
    newsAdjustment
  };

  if (newsAdjustment.active) {
    const adjustedScore = clamp(baseCurrent.score - newsAdjustment.penalty, 0, 100);
    current = {
      ...current,
      score: adjustedScore,
      verdict: classifyVerdict(adjustedScore)
    };
  }

  const forecastSliceEnd = Math.min(timeline.length, idx + 30);
  const upcomingHours = [];
  for (let i = idx; i < forecastSliceEnd; i++) {
    const ev = evaluateHour(timeline, i, bikeProfileId);
    upcomingHours.push({
      time: ev.time,
      score: ev.score,
      level: ev.verdict.level,
      label: ev.verdict.label,
      temp: ev.temp,
      roadTemp: ev.roadTemp,
      precipitation: ev.precipitation,
      windGusts: ev.windGusts,
      blackIceRisk: ev.blackIceRisk,
      surfaceState: ev.surfaceState,
      weatherLabel: ev.weatherLabel
    });
  }

  const bestWindow = [...upcomingHours]
    .filter((h) => {
      const hourNum = Number(h.time.slice(11, 13));
      return hourNum >= 6 && hourNum <= 21;
    })
    .sort((a, b) => b.score - a.score)[0] || upcomingHours[0];

  const peakBlackIce = [...upcomingHours].sort((a, b) => b.blackIceRisk - a.blackIceRisk)[0];

  const historyStart = Math.max(0, idx - 36);
  const chartEnd = Math.min(timeline.length, idx + 25);
  const chartSeries = timeline.slice(historyStart, chartEnd).map((h, offset) => ({
    time: h.time,
    isCurrent: historyStart + offset === idx,
    isFuture: historyStart + offset > idx,
    temp: round1(h.temp),
    roadTemp: h.roadTemp,
    precipitation: round1(h.precipitation ?? 0),
    snowfall: round1(h.snowfall ?? 0),
    blackIceRisk: h.blackIceRisk,
    liquidMoisture: h.liquidMoisture,
    iceLoad: h.iceLoad
  }));

  const checklist = [];
  if (current.blackIceRisk >= 40 || (peakBlackIce && peakBlackIce.blackIceRisk >= 60)) {
    checklist.push(`노면 결빙 경보: ${peakBlackIce.time.slice(5, 16).replace('T', ' ')} 전후 블랙아이스 위험 ${peakBlackIce.blackIceRisk}% 예상 (교량·하천 그늘 구간 주의)`);
  }
  if (current.precipitation > 0 || current.factors[1].next3Precip >= 0.3) {
    checklist.push('강수 대비: 방수 바람막이·머드가드 확인 및 젖은 흰색 차선·맨홀 급제동 금지');
  }
  if (current.windGusts >= 8) {
    checklist.push(`강풍 대비: 순간 돌풍 ${current.windGusts}m/s · 하이림 휠 및 교량 횡풍 주의`);
  }
  if (current.apparentTemp <= 5) {
    checklist.push(`보온 장비: 체감 ${current.apparentTemp}°C · 방풍 장갑, 넥워머, 슈커버 착용 권장`);
  }
  if ((current.pm25 ?? 0) > 35) {
    checklist.push(`대기질 주의: PM2.5 ${current.pm25}㎍/㎥ · 호흡량이 큰 업힐/인터벌 자제`);
  }
  if (checklist.length === 0) {
    checklist.push('전조등·후미등 배터리와 타이어 공기압만 점검하고 출발하면 됩니다.');
  }

  const todayDate = current.time.slice(0, 10);
  const todaySun = weatherBundle.daily?.find((d) => d.date === todayDate) || weatherBundle.daily?.[0] || null;

  return {
    location,
    fetchedAt: weatherBundle.fetchedAt,
    current,
    bestWindow,
    peakBlackIce,
    todaySun,
    upcomingHours,
    chartSeries,
    checklist,
    bikeProfiles: Object.values(BIKE_PROFILES)
  };
}

export function simulateScenario(input) {
  const recentRainMm = clamp(Number(input.recentRainMm ?? 4), 0, 50);
  const hoursAgo = clamp(Math.round(Number(input.hoursAgo ?? 8)), 0, 36);
  const minTempAfter = clamp(Number(input.minTempAfter ?? -3), -20, 25);
  const currentTemp = clamp(Number(input.currentTemp ?? 1), -20, 38);
  const humidity = clamp(Number(input.humidity ?? 78), 15, 100);
  const windGusts = clamp(Number(input.windGusts ?? 5), 0, 25);
  const pm25 = clamp(Number(input.pm25 ?? 22), 0, 200);
  const isSunnyNow = Boolean(input.isSunnyNow);
  const bikeProfileId = input.bike || 'hybrid';

  const totalHours = 49;
  const nowIdx = 40;
  const precipIdx = Math.max(0, nowIdx - hoursAgo);
  const hourly = [];

  for (let i = 0; i < totalHours; i++) {
    const rel = i - nowIdx;
    let temp = currentTemp;
    if (i < precipIdx) {
      temp = Math.max(currentTemp + 2, 5);
    } else if (i === precipIdx) {
      temp = Math.max(minTempAfter + 3, currentTemp);
    } else if (i <= nowIdx) {
      const span = Math.max(1, nowIdx - precipIdx);
      const t = (i - precipIdx) / span;
      const dip = Math.sin(t * Math.PI);
      const base = currentTemp + (1 - t) * 1.5;
      temp = Math.min(base, minTempAfter + (1 - dip) * Math.max(0, currentTemp - minTempAfter));
    } else {
      temp = currentTemp + Math.min(3, rel * 0.4);
    }

    const precip = i === precipIdx ? recentRainMm : 0;
    const rad = i >= nowIdx - 2 && isSunnyNow ? 380 : 30;
    const soilTemp = round1(temp - (rad < 100 ? 1.3 : 0.2));

    hourly.push({
      time: `2026-11-23T${String(i % 24).padStart(2, '0')}:00`,
      temp: round1(temp),
      apparentTemp: round1(temp - windGusts * 0.35),
      dewPoint: round1(temp - ((100 - humidity) / 5)),
      humidity,
      precipitation: precip,
      rain: temp > 0.5 ? precip : 0,
      snowfall: temp <= 0.5 ? precip : 0,
      snowDepth: 0,
      weatherCode: precip > 0 ? (temp <= 0.5 ? 73 : 61) : (isSunnyNow ? 0 : 2),
      weatherLabel: precip > 0 ? (temp <= 0.5 ? '눈' : '비') : (isSunnyNow ? '맑음' : '구름 조금'),
      windSpeed: round1(windGusts * 0.65),
      windGusts: round1(windGusts),
      soilTemp,
      radiation: rad,
      visibility: 10000,
      pm25,
      pm10: Math.round(pm25 * 1.6)
    });
  }

  const timeline = simulateSurfaceTimeline(hourly);
  return evaluateHour(timeline, nowIdx, bikeProfileId);
}
