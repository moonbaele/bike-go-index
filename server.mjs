import http from 'node:http';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRESET_LOCATIONS, resolveLocationFromParams, searchLocations } from './lib/locations.mjs';
import { fetchWeatherBundle } from './lib/weather.mjs';
import { fetchLocalWeatherNews } from './lib/news.mjs';
import { buildCyclingReport, BIKE_PROFILES } from './lib/scoring.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');
const LIB_DIR = path.join(__dirname, 'lib');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3456);
const CACHE_TTL_MS = 5 * 60 * 1000;

const weatherCache = new Map();
const newsCache = new Map();

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

async function getCached(map, key, fetcher, bypass = false) {
  const cached = map.get(key);
  if (!bypass && cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.value;
  }
  const value = await fetcher();
  map.set(key, { ts: Date.now(), value });
  return value;
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/locations' && req.method === 'GET') {
    const q = url.searchParams.get('q') || '';
    const results = q ? await searchLocations(q) : PRESET_LOCATIONS;
    return sendJson(res, 200, { locations: results });
  }

  if (url.pathname === '/api/report' && req.method === 'GET') {
    const location = resolveLocationFromParams(url.searchParams);
    const bike = BIKE_PROFILES[url.searchParams.get('bike')] ? url.searchParams.get('bike') : 'hybrid';
    const refresh = url.searchParams.get('refresh') === '1';

    const weatherKey = `${location.lat.toFixed(3)},${location.lon.toFixed(3)}`;
    const newsKey = `${location.regionTerms.join('|')}::${location.broadRegion}`;

    const [weather, news] = await Promise.all([
      getCached(weatherCache, weatherKey, () => fetchWeatherBundle(location.lat, location.lon), refresh),
      getCached(newsCache, newsKey, () => fetchLocalWeatherNews(location), refresh)
    ]);

    const report = buildCyclingReport(weather, location, bike);
    return sendJson(res, 200, { ...report, news });
  }

  return sendJson(res, 404, { error: 'Not found' });
}

async function serveStatic(res, pathname) {
  let baseDir = PUBLIC_DIR;
  let relPath = pathname === '/' ? '/index.html' : pathname;

  if (pathname.startsWith('/lib/')) {
    baseDir = LIB_DIR;
    relPath = pathname.slice(4);
  }

  const resolved = path.resolve(baseDir, `.${relPath}`);
  if (!resolved.startsWith(baseDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  try {
    const content = await fs.readFile(resolved);
    const ext = path.extname(resolved);
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url);
      } else {
        await serveStatic(res, url.pathname);
      }
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Internal server error' });
    }
  });
}

function getLanAddresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net.family === 'IPv4' && !net.internal) {
        addresses.push(net.address);
      }
    }
  }
  return addresses;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createServer();
  server.listen(PORT, HOST, () => {
    console.log(`로컬 접속: http://localhost:${PORT}`);
    for (const ip of getLanAddresses()) {
      console.log(`같은 Wi-Fi(핸드폰) 접속: http://${ip}:${PORT}`);
    }
  });
}
