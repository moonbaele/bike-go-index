export function getSeoulCurrentHourKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(now);

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:00`;
}

export const WMO_LABELS = {
  0: '맑음',
  1: '대체로 맑음',
  2: '구름 조금',
  3: '흐림',
  45: '안개',
  48: '서리 안개',
  51: '약한 이슬비',
  53: '이슬비',
  55: '강한 이슬비',
  56: '어는 이슬비',
  57: '강한 어는 이슬비',
  61: '약한 비',
  63: '비',
  65: '강한 비',
  66: '어는 비',
  67: '강한 어는 비',
  71: '약한 눈',
  73: '눈',
  75: '강한 눈',
  77: '싸락눈',
  80: '약한 소나기',
  81: '소나기',
  82: '강한 소나기',
  85: '약한 눈보라',
  86: '강한 눈보라',
  95: '뇌우',
  96: '우박 동반 뇌우',
  99: '강한 우박 뇌우'
};

export function describeWmoCode(code) {
  return WMO_LABELS[code] || '기상 관측';
}

function fetchWithTimeout(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function fetchWeatherBundle(lat, lon) {
  const forecastParams = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    past_days: '2',
    forecast_days: '2',
    wind_speed_unit: 'ms',
    hourly: [
      'temperature_2m',
      'apparent_temperature',
      'dew_point_2m',
      'relative_humidity_2m',
      'precipitation',
      'rain',
      'snowfall',
      'snow_depth',
      'weather_code',
      'wind_speed_10m',
      'wind_gusts_10m',
      'soil_temperature_0cm',
      'shortwave_radiation',
      'visibility'
    ].join(','),
    daily: 'sunrise,sunset',
    timezone: 'Asia/Seoul'
  });

  const aqParams = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    past_days: '1',
    forecast_days: '2',
    hourly: 'pm10,pm2_5',
    timezone: 'Asia/Seoul'
  });

  const [forecastRes, aqRes] = await Promise.all([
    fetchWithTimeout(`https://api.open-meteo.com/v1/forecast?${forecastParams}`, 9000),
    fetchWithTimeout(`https://air-quality-api.open-meteo.com/v1/air-quality?${aqParams}`, 9000).catch(() => null)
  ]);

  if (!forecastRes.ok) {
    throw new Error(`Open-Meteo forecast failed with HTTP ${forecastRes.status}`);
  }

  const forecast = await forecastRes.json();
  const aq = aqRes && aqRes.ok ? await aqRes.json() : null;

  const aqByTime = new Map();
  if (aq?.hourly?.time) {
    for (let i = 0; i < aq.hourly.time.length; i++) {
      aqByTime.set(aq.hourly.time[i], {
        pm10: aq.hourly.pm10?.[i] ?? null,
        pm25: aq.hourly.pm2_5?.[i] ?? null
      });
    }
  }

  const h = forecast.hourly;
  const hourly = h.time.map((time, i) => {
    const air = aqByTime.get(time) || { pm10: null, pm25: null };
    return {
      time,
      temp: h.temperature_2m[i],
      apparentTemp: h.apparent_temperature[i],
      dewPoint: h.dew_point_2m[i],
      humidity: h.relative_humidity_2m[i],
      precipitation: h.precipitation[i] ?? 0,
      rain: h.rain[i] ?? 0,
      snowfall: h.snowfall[i] ?? 0,
      snowDepth: h.snow_depth[i] ?? 0,
      weatherCode: h.weather_code[i] ?? 0,
      weatherLabel: describeWmoCode(h.weather_code[i] ?? 0),
      windSpeed: h.wind_speed_10m[i] ?? 0,
      windGusts: h.wind_gusts_10m[i] ?? 0,
      soilTemp: h.soil_temperature_0cm?.[i] ?? null,
      radiation: h.shortwave_radiation?.[i] ?? 0,
      visibility: h.visibility?.[i] ?? 10000,
      pm10: air.pm10,
      pm25: air.pm25
    };
  });

  const daily = (forecast.daily?.time || []).map((date, i) => ({
    date,
    sunrise: forecast.daily.sunrise?.[i] || null,
    sunset: forecast.daily.sunset?.[i] || null
  }));

  const currentHourKey = getSeoulCurrentHourKey();
  let currentIndex = hourly.findIndex((row) => row.time === currentHourKey);
  if (currentIndex === -1) {
    currentIndex = Math.max(0, Math.floor(hourly.length / 2));
  }

  return {
    fetchedAt: new Date().toISOString(),
    timezone: forecast.timezone || 'Asia/Seoul',
    currentHourKey: hourly[currentIndex]?.time || currentHourKey,
    currentIndex,
    hourly,
    daily
  };
}
