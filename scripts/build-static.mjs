import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchLocalWeatherNews } from '../lib/news.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const NEWS_BUCKETS = {
  namyangju: { regionTerms: ['남양주', '다산동', '구리', '경기북부'], broadRegion: '경기 OR 수도권' },
  gyeonggi_east: { regionTerms: ['하남', '미사', '남양주', '경기동부'], broadRegion: '경기 OR 수도권' },
  seoul: { regionTerms: ['서울', '한강', '잠실', '반포'], broadRegion: '서울 OR 수도권' },
  gyeonggi_south: { regionTerms: ['성남', '판교', '수원', '경기남부'], broadRegion: '경기 OR 수도권' },
  gyeonggi_north: { regionTerms: ['고양', '일산', '파주', '의정부', '경기북부'], broadRegion: '경기 OR 수도권' },
  incheon: { regionTerms: ['인천', '김포', '계양', '수도권'], broadRegion: '인천 OR 수도권' },
  gangwon: { regionTerms: ['강원', '춘천', '강릉'], broadRegion: '강원' },
  chungcheong: { regionTerms: ['대전', '세종', '충남', '충북'], broadRegion: '대전 OR 충남' },
  gyeongsang: { regionTerms: ['부산', '대구', '울산', '경남', '경북'], broadRegion: '부산 OR 대구' },
  jeolla: { regionTerms: ['광주', '전남', '전북'], broadRegion: '광주 OR 전남' },
  jeju: { regionTerms: ['제주'], broadRegion: '제주' }
};

async function main() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(path.join(DIST, 'lib'), { recursive: true });
  await fs.mkdir(path.join(DIST, 'data'), { recursive: true });

  const publicFiles = await fs.readdir(path.join(ROOT, 'public'));
  for (const file of publicFiles) {
    const src = path.join(ROOT, 'public', file);
    const stat = await fs.stat(src);
    if (stat.isFile()) {
      await fs.copyFile(src, path.join(DIST, file));
    }
  }

  for (const mod of ['scoring.mjs', 'weather.mjs', 'locations.mjs']) {
    await fs.copyFile(path.join(ROOT, 'lib', mod), path.join(DIST, 'lib', mod));
  }

  const entries = await Promise.all(
    Object.entries(NEWS_BUCKETS).map(async ([bucket, spec]) => {
      const feed = await fetchLocalWeatherNews(spec);
      return [bucket, feed];
    })
  );

  const newsPayload = {
    generatedAt: new Date().toISOString(),
    buckets: Object.fromEntries(entries)
  };

  await fs.writeFile(path.join(DIST, 'data', 'news.json'), JSON.stringify(newsPayload));
  await fs.writeFile(path.join(DIST, '.nojekyll'), '');
  console.log(`Built static bundle in dist/ with ${entries.length} regional news feeds.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
