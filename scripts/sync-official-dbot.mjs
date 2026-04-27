import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'references', 'deriv-bot-current', 'dist');
const targetDir = path.join(root, 'public', 'official-dbot');

if (!existsSync(sourceDir)) {
  throw new Error(`Official DBot build not found: ${sourceDir}`);
}

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
cpSync(sourceDir, targetDir, { recursive: true });

const textExtensions = new Set(['.html', '.js', '.css', '.json', '.txt']);

const replacements = [
  ['/static/', '/official-dbot/static/'],
  ['/assets/', '/official-dbot/assets/'],
  ['/js/smartcharts/', '/official-dbot/js/smartcharts/'],
  ['/manifest.json', '/official-dbot/manifest.json'],
  ['/deriv-logo.svg', '/official-dbot/deriv-logo.svg'],
  ['/front-channel.html', '/official-dbot/front-channel.html'],
  ['/offline.html', '/official-dbot/offline.html'],
  ['/sw.js', '/official-dbot/sw.js'],
  ['scope: \'/\'', 'scope: \'/official-dbot/\''],
  ['scope:"/"', 'scope:"/official-dbot/"'],
  ['scope: "/"', 'scope: "/official-dbot/"'],
];

function rewriteFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!textExtensions.has(ext)) return;

  let content = readFileSync(filePath, 'utf8');
  let updated = content;

  for (const [search, replace] of replacements) {
    updated = updated.split(search).join(replace);
  }

  if (path.basename(filePath) === 'sw.js') {
    updated = updated
      .replace('PRECACHE_URLS=["/","/official-dbot/index.html"', 'PRECACHE_URLS=["/official-dbot/","/official-dbot/index.html"')
      .replace('caches.match("/")||await caches.match("/official-dbot/index.html")', 'caches.match("/official-dbot/")||await caches.match("/official-dbot/index.html")')
      .replace('return caches.match("/");', 'return caches.match("/official-dbot/");');
  }

  if (updated !== content) {
    writeFileSync(filePath, updated, 'utf8');
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walk(fullPath);
      continue;
    }
    rewriteFile(fullPath);
  }
}

walk(targetDir);

const officialIndex = path.join(targetDir, 'index.html');
const aliasIndex = path.join(targetDir, 'official-dbot.html');
writeFileSync(aliasIndex, readFileSync(officialIndex, 'utf8'), 'utf8');

console.log(`Official DBot synced to ${targetDir}`);
