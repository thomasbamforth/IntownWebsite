#!/usr/bin/env node
/**
 * fetch-figma-images.js
 *
 * Downloads PNG exports from a Figma file for frames whose names start with "web/".
 * Saves them to /public/figma/ with clean filenames.
 *
 * Required environment variables:
 *   FIGMA_TOKEN    – your Figma personal access token
 *   FIGMA_FILE_KEY – the Figma file key (from the URL: figma.com/file/<FILE_KEY>/...)
 *
 * Optional:
 *   FIGMA_PAGE_NAME – name of the page to look in (default: first page)
 *   FIGMA_SCALE     – export scale, e.g. "2" for @2x (default: "2")
 *
 * Usage:
 *   FIGMA_TOKEN=xxx FIGMA_FILE_KEY=yyy node scripts/fetch-figma-images.js
 *   npm run figma:pull
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const FIGMA_TOKEN = process.env.FIGMA_TOKEN;
const FIGMA_FILE_KEY = process.env.FIGMA_FILE_KEY;
const FIGMA_PAGE_NAME = process.env.FIGMA_PAGE_NAME || null;
const FIGMA_SCALE = process.env.FIGMA_SCALE || '2';
const FRAME_PREFIX = 'web/';
const OUTPUT_DIR = path.resolve(__dirname, '..', 'public', 'figma');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function validateEnv() {
  const missing = [];
  if (!FIGMA_TOKEN) missing.push('FIGMA_TOKEN');
  if (!FIGMA_FILE_KEY) missing.push('FIGMA_FILE_KEY');
  if (missing.length) {
    console.error('Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
}

/**
 * Perform an HTTPS GET request and return the parsed JSON response.
 */
function fetchJson(url, headers) {
  return new Promise((resolve, reject) => {
    const options = {
      headers: Object.assign({ 'X-Figma-Token': FIGMA_TOKEN }, headers || {}),
    };
    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse JSON: ' + e.message));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Download a binary file from a URL and save it to disk.
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      // Follow redirects (Figma CDN often redirects)
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); // clean up partial file
      reject(err);
    });
  });
}

/**
 * Convert a frame name like "web/usecase-hometown" to "usecase-hometown.png"
 */
function frameNameToFilename(name) {
  const stripped = name.slice(FRAME_PREFIX.length); // remove "web/"
  const safe = stripped
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-') // replace non-alphanumeric with hyphen
    .replace(/-+/g, '-')           // collapse consecutive hyphens
    .replace(/^-|-$/g, '');        // trim leading/trailing hyphens
  return safe + '.png';
}

/**
 * Recursively collect nodes from a Figma document page.
 */
function collectFrames(node, results) {
  if (!results) results = [];
  if (node.type === 'FRAME' && node.name && node.name.startsWith(FRAME_PREFIX)) {
    results.push({ id: node.id, name: node.name });
  }
  if (node.children) {
    node.children.forEach((child) => collectFrames(child, results));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  validateEnv();

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`Output directory: ${OUTPUT_DIR}`);

  // 1. Fetch Figma file structure
  console.log(`\nFetching Figma file: ${FIGMA_FILE_KEY}`);
  const fileUrl = `https://api.figma.com/v1/files/${FIGMA_FILE_KEY}`;
  const fileData = await fetchJson(fileUrl);

  if (fileData.err || fileData.status === 403) {
    console.error('Figma API error:', fileData.err || fileData.message || JSON.stringify(fileData));
    process.exit(1);
  }

  // 2. Find target page
  const pages = fileData.document.children;
  let page;
  if (FIGMA_PAGE_NAME) {
    page = pages.find((p) => p.name === FIGMA_PAGE_NAME);
    if (!page) {
      console.error(`Page "${FIGMA_PAGE_NAME}" not found. Available pages: ${pages.map((p) => p.name).join(', ')}`);
      process.exit(1);
    }
  } else {
    page = pages[0];
  }
  console.log(`Using page: "${page.name}"`);

  // 3. Collect frames starting with "web/"
  const frames = collectFrames(page);
  if (frames.length === 0) {
    console.log(`No frames found with prefix "${FRAME_PREFIX}" on page "${page.name}".`);
    console.log('Create frames in Figma with names like "web/usecase-festival" and re-run this script.');
    process.exit(0);
  }
  console.log(`Found ${frames.length} frame(s): ${frames.map((f) => f.name).join(', ')}`);

  // 4. Request PNG exports from Figma
  const nodeIds = frames.map((f) => f.id).join(',');
  const imagesUrl = `https://api.figma.com/v1/images/${FIGMA_FILE_KEY}?ids=${encodeURIComponent(nodeIds)}&format=png&scale=${FIGMA_SCALE}`;
  console.log('\nRequesting PNG exports from Figma…');
  const imagesData = await fetchJson(imagesUrl);

  if (imagesData.err) {
    console.error('Figma images API error:', imagesData.err);
    process.exit(1);
  }

  // 5. Download each image
  const imageMap = imagesData.images || {};
  let downloaded = 0;
  let failed = 0;

  for (const frame of frames) {
    const imageUrl = imageMap[frame.id];
    if (!imageUrl) {
      console.warn(`  [skip] No URL returned for frame: ${frame.name} (id: ${frame.id})`);
      failed++;
      continue;
    }

    const filename = frameNameToFilename(frame.name);
    const destPath = path.join(OUTPUT_DIR, filename);
    process.stdout.write(`  Downloading ${frame.name} → public/figma/${filename} … `);

    try {
      await downloadFile(imageUrl, destPath);
      console.log('done');
      downloaded++;
    } catch (err) {
      console.log('FAILED:', err.message);
      failed++;
    }
  }

  console.log(`\nDone. ${downloaded} downloaded, ${failed} failed.`);
  if (downloaded > 0) {
    console.log(`Images saved to: ${OUTPUT_DIR}`);
    console.log('These images are referenced by the homepage use-case cards and phone mock.');
  }
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
