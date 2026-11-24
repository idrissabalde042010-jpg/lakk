// Génère dist/sw.js après `vite build` : précache tous les fichiers produits
// (JS/CSS hachés, polices, icônes) pour un fonctionnement 100 % hors ligne.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = fileURLToPath(new URL('../dist/', import.meta.url));

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(DIST)
  .map((f) => '/' + relative(DIST, f).split('\\').join('/'))
  .filter((f) => f !== '/sw.js');

const version = createHash('sha256').update(files.join('|')).digest('hex').slice(0, 10);
const precache = ['/', ...files].sort();

const sw = `// Généré automatiquement par scripts/build-sw.mjs — ne pas éditer.
const CACHE = 'lakk-${version}';
const PRECACHE = ${JSON.stringify(precache, null, 2)};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreVary: true }).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => (req.mode === 'navigate' ? caches.match('/index.html', { ignoreVary: true }) : Response.error()));
    }),
  );
});
`;

writeFileSync(join(DIST, 'sw.js'), sw);
console.log(`sw.js généré : ${precache.length} fichiers, cache lakk-${version}`);
