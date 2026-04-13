import fs from 'node:fs/promises';
import path from 'node:path';

const START_URL = process.argv[2] || 'https://www.chytrapena.cz/';
const OUTPUT_DIR = process.argv[3] || path.resolve(process.cwd(), 'downloads', 'chytrapena');
const MAX_PAGES = Number(process.argv[4] || 60);
const MIN_IMAGE_BYTES = Number(process.argv[5] || 80_000);
const SAME_ORIGIN = new URL(START_URL).origin;

const visitedPages = new Set();
const queuedPages = [START_URL];
const downloadedImages = new Set();

function normalizeUrl(raw, baseUrl) {
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return null;
  }
}

function sanitizeFilename(value) {
  return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').slice(0, 180);
}

function extractMatches(html, regex, groupIndex = 1) {
  const results = [];
  for (const match of html.matchAll(regex)) {
    const value = match[groupIndex]?.trim();
    if (value) results.push(value);
  }
  return results;
}

function pickBestSrcFromSrcset(srcset, baseUrl) {
  const candidates = srcset
    .split(',')
    .map((item) => item.trim().split(/\s+/)[0])
    .map((item) => normalizeUrl(item, baseUrl))
    .filter(Boolean);

  return candidates[candidates.length - 1] || null;
}

function extractImageUrls(html, pageUrl) {
  const imageUrls = new Set();

  for (const src of extractMatches(html, /<img[^>]+src=["']([^"']+)["']/gi)) {
    const normalized = normalizeUrl(src, pageUrl);
    if (normalized) imageUrls.add(normalized);
  }

  for (const srcset of extractMatches(html, /<img[^>]+srcset=["']([^"']+)["']/gi)) {
    const best = pickBestSrcFromSrcset(srcset, pageUrl);
    if (best) imageUrls.add(best);
  }

  for (const styleUrl of extractMatches(html, /url\((?:'|")?([^)'"]+)(?:'|")?\)/gi)) {
    const normalized = normalizeUrl(styleUrl, pageUrl);
    if (normalized) imageUrls.add(normalized);
  }

  return [...imageUrls];
}

function extractLinks(html, pageUrl) {
  const links = new Set();

  for (const href of extractMatches(html, /<a[^>]+href=["']([^"']+)["']/gi)) {
    const normalized = normalizeUrl(href, pageUrl);
    if (!normalized) continue;
    const parsed = new URL(normalized);
    if (parsed.origin !== SAME_ORIGIN) continue;
    if (/\.(jpg|jpeg|png|webp|svg|gif|pdf|zip)$/i.test(parsed.pathname)) continue;
    links.add(parsed.href.split('#')[0]);
  }

  return [...links];
}

function looksUsefulImage(url) {
  return !/logo|icon|favicon|sprite|banner|flag|svg$/i.test(url);
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function saveImage(url, responseBuffer) {
  const parsed = new URL(url);
  const extFromPath = path.extname(parsed.pathname) || '.jpg';
  const folderName = sanitizeFilename(parsed.hostname + parsed.pathname.replace(/\//g, '_'));
  const filename = sanitizeFilename(folderName) + extFromPath;
  const targetPath = path.join(OUTPUT_DIR, filename);
  await fs.writeFile(targetPath, responseBuffer);
}

async function downloadImage(url) {
  if (downloadedImages.has(url) || !looksUsefulImage(url)) return;
  downloadedImages.add(url);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KlaraImageCollector/1.0)',
      },
    });

    if (!response.ok) return;

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return;

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.byteLength < MIN_IMAGE_BYTES) return;

    await saveImage(url, buffer);
    console.log(`saved image: ${url}`);
  } catch (error) {
    console.warn(`image failed: ${url} -> ${error.message}`);
  }
}

async function crawlPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; KlaraImageCollector/1.0)',
      },
    });

    if (!response.ok) return;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) return;

    const html = await response.text();
    const imageUrls = extractImageUrls(html, url);
    const links = extractLinks(html, url);

    await Promise.all(imageUrls.map((imageUrl) => downloadImage(imageUrl)));

    for (const link of links) {
      if (!visitedPages.has(link) && !queuedPages.includes(link) && visitedPages.size + queuedPages.length < MAX_PAGES) {
        queuedPages.push(link);
      }
    }

    console.log(`crawled page: ${url}`);
  } catch (error) {
    console.warn(`page failed: ${url} -> ${error.message}`);
  }
}

async function main() {
  await ensureDir(OUTPUT_DIR);

  while (queuedPages.length > 0 && visitedPages.size < MAX_PAGES) {
    const nextPage = queuedPages.shift();
    if (!nextPage || visitedPages.has(nextPage)) continue;
    visitedPages.add(nextPage);
    await crawlPage(nextPage);
  }

  console.log(`done: ${visitedPages.size} pages, ${downloadedImages.size} image URLs seen`);
  console.log(`saved into: ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
