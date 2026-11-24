import { PRESET_LOCATIONS, searchLocations } from '../lib/locations.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const q = url.searchParams.get('q') || '';
    const locations = q ? await searchLocations(q) : PRESET_LOCATIONS;
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ locations });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
