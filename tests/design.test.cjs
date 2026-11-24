const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('design-system.css', 'utf8');

test('local resources exist and styling does not depend on runtime CDNs', () => {
  for (const [, path] of html.matchAll(/(?:src|href)="\.\/([^"?]+)(?:\?[^\"]*)?"/g)) {
    assert.ok(fs.existsSync(path), `Missing resource: ${path}`);
  }
  assert.doesNotMatch(html, /cdn\.tailwindcss\.com|unpkg\.com\/lucide/);
  assert.ok(fs.statSync('assets/utilities.css').size > 10000);
  assert.ok(fs.statSync('assets/icons.js').size > 10000);
});

test('balance redesign retains the IDs used by the financial renderer', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(new Set(ids).size, ids.length, 'Duplicate DOM IDs');
  for (const id of ['hero-balance', 'hero-daily-left', 'hero-daily-cap', 'hero-reserved', 'hero-free-pool', 'hero-payday-date', 'hero-bar', 'hero-forecast-text', 'hero-split-free', 'hero-split-res', 'hero-res-pct', 'hero-free-pct', 'status-badge', 'hero-card-brand-lbl', 'hero-limit-explain', 'stealth-pill']) {
    assert.ok(ids.includes(id), `Missing renderer hook: ${id}`);
  }
});

test('shared tokens, light theme, focus and reduced motion are defined', () => {
  for (const token of ['--accent', '--surface-1', '--surface-2', '--border-subtle', '--text-primary', '--text-secondary']) {
    assert.ok(css.split(`${token}:`).length >= 3, `Token needs both themes: ${token}`);
  }
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
});
