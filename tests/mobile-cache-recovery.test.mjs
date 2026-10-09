import assert from 'node:assert/strict';
import fs from 'node:fs';

const release = 'mobile-cache-recovery-1';
const read = path => fs.readFileSync(path, 'utf8');
const entry = read('github-pages-entry.html');
const page = read('pagnottella-gourmet/index.html');
const killer = read('pagnottella-gourmet/sw-killer.js');
const netlify = read('netlify.toml');
const build = read('scripts/netlify_publish_pdf.sh');

assert.match(entry, new RegExp(`const release = '${release}'`));
assert.match(killer, new RegExp(`const RELEASE = '${release}'`));
assert.ok(page.indexOf('sw-killer.js') < page.indexOf('pagnottella.css'), 'cache cleanup must start before CSS');
assert.equal((page.match(/sw-killer\.js/g) || []).length, 1, 'sw-killer must load once');
assert.match(page, /pagnottella\.css\?v=mobile-cache-recovery-1[^>]+onerror=/);
assert.match(page, /production\.css\?v=analytics-2[^>]+onerror=/);
assert.doesNotMatch(entry, /target\.searchParams\.set\('swreset'/);
assert.match(netlify, /\/sw\.js[\s\S]+no-cache, no-store, must-revalidate/);
assert.match(netlify, /entry=mobile-cache-recovery-1&swreset=1&v=mobile-cache-recovery-1/);
assert.match(build, /cp sw\.js/);
assert.match(build, /cp service-worker\.js/);
assert.equal(fs.existsSync('sw.js'), true);
assert.equal(fs.existsSync('service-worker.js'), true);

console.log('mobile cache recovery: ok');
