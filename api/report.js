import { resolveLocationFromParams } from '../lib/locations.mjs';
import { fetchWeatherBundle } from '../lib/weather.mjs';
import { fetchLocalWeatherNews } from '../lib/news.mjs';
import { buildCyclingReport, BIKE_PROFILES } from '../lib/scoring.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const location = resolveLocationFromParams(url.searchParams);
    const bike = BIKE_PROFILES[url.searchParams.get('bike')] ? url.searchParams.get('bike') : 'hybrid';

    const [weather, news] = await Promise.all([
      fetchWeatherBundle(location.lat, location.lon),
      fetchLocalWeatherNews(location)
    ]);

    const report = buildCyclingReport(weather, location, bike, news);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ...report, weather, news });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
