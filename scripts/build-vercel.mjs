import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

async function main() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(path.join(DIST, 'lib'), { recursive: true });

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

  console.log('Built Vercel static output in dist/.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
