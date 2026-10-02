const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const source = path.resolve(__dirname, '..');
const output = path.resolve(process.env.GIZA_EVIDENCE_DIR || require('node:os').tmpdir(), 'giza-guide-offline-verification');
const prefix = '/GizaTourGide2019/';
const checks = [];
const errors = [];
const sourceVersion = require('node:fs').readFileSync(path.join(source, 'sw.js'), 'utf8').match(/const VERSION = "([^"]+)"/)[1];
const failedVersion = sourceVersion + '-failed-test';
const updatedVersion = sourceVersion + '-update-test';
let version = sourceVersion;
let failShell = false;
let browser;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (!url.pathname.startsWith(prefix)) { res.writeHead(404); res.end('missing'); return; }
  const file = url.pathname.slice(prefix.length) || 'index.html';
  if (!['index.html', 'style.css', 'app.mjs', 'places.mjs', 'offline.mjs', 'sw.js'].includes(file)
    || (failShell && file === 'places.mjs' && req.headers['sec-fetch-dest'] !== 'script')) { res.writeHead(404); res.end('missing'); return; }
  try {
    let content = await fs.readFile(path.join(source, file));
    if (file === 'sw.js') content = Buffer.from(content.toString().replace(sourceVersion, version));
    res.writeHead(200, { 'Content-Type': file.endsWith('.html') ? 'text/html; charset=utf-8'
      : file.endsWith('.css') ? 'text/css' : 'application/javascript', 'Cache-Control': 'no-store' });
    res.end(content);
  } catch { res.writeHead(500); res.end('fixture failure'); }
});
async function listen(port = 0) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server.address().port;
}
async function closeServer() { await new Promise(resolve => server.close(resolve)); }
async function ready(page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.endsWith('/GizaTourGide2019/sw.js'));
  await page.locator('#offline-status').getByText(/محفوظ|Guide saved/).waitFor();
}
(async () => {
  await fs.mkdir(output, { recursive: true });
  const port = await listen();
  const url = `http://127.0.0.1:${port}${prefix}`;
  browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url);
  await ready(page);
  assert.equal(await page.locator('#results article').count(), 4);
  const initialCache = await page.evaluate(async () => {
    const names = await caches.keys();
    const name = names.find(x => x.startsWith('giza-guide:'));
    const keys = await (await caches.open(name)).keys();
    return { name, urls: keys.map(x => x.url) };
  });
  assert.equal(initialCache.urls.length, 6);
  assert.ok(initialCache.urls.every(x => x.startsWith(url)));
  checks.push('first real service-worker install controls scoped guide and stores exactly six shell files');
  await page.getByRole('button', { name: /أضف إلى الزيارة: أهرامات/ }).click();
  const stored = await page.evaluate(() => localStorage.getItem('giza-guide-favorites-v1'));
  await page.evaluate(async () => {
    await caches.open('neighbor-app');
    await caches.open('giza-guide:/neighbor/:old');
    await caches.open('giza-guide:/GizaTourGide2019/:old');
  });
  await context.setOffline(true);
  await closeServer();
  await page.reload();
  await page.locator('#offline-status').getByText(/أنت دون اتصال/).waitFor();
  assert.equal(await page.locator('#results article').count(), 4);
  assert.equal(await page.getByRole('button', { name: /أزل من الزيارة: أهرامات/ }).count(), 1);
  await page.locator('#query').fill('دهشور');
  assert.equal(await page.locator('#results article').count(), 1);
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await page.locator('#query').fill('SAQQARA');
  assert.equal(await page.locator('#results article').count(), 1);
  assert.equal(await page.locator('html').getAttribute('dir'), 'ltr');
  assert.match(await page.locator('#offline-status').innerText(), /You are offline/);
  await page.locator('#query').fill('');
  await page.locator('#favorites').check();
  assert.equal(await page.locator('#results article').count(), 1);
  await page.locator('#favorites').uncheck();
  assert.equal(await page.evaluate(() => localStorage.getItem('giza-guide-favorites-v1')), stored);
  checks.push('server stopped and real browser offline: reload, persisted visit list, bilingual search and filtering work');
  const other = await context.newPage();
  await other.goto(url + 'index.html?visit=1');
  assert.equal(await other.locator('#results article').count(), 4);
  await other.close();
  assert.equal(await page.evaluate(async () => {
    try { await fetch('missing.html'); return false; } catch { return true; }
  }), true);
  assert.equal(await page.evaluate(async () => {
    try { await fetch('https://egymonuments.gov.eg/'); return false; } catch { return true; }
  }), true);
  checks.push('index navigation with query works offline; unknown paths and external source are not replaced with cached HTML');
  await page.screenshot({ path: path.join(output, 'giza-offline-phone.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  checks.push('390px offline page has no horizontal overflow');
  await listen(port);
  await context.setOffline(false);
  version = failedVersion;
  failShell = true;
  const failed = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const result = new Promise(resolve => {
      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        worker.addEventListener('statechange', () => { if (worker.state === 'redundant') resolve(true); });
      }, { once: true });
    });
    await registration.update();
    return result;
  });
  assert.equal(failed, true);
  assert.equal(await page.locator('#offline-update').isVisible(), false);
  const afterFailure = await page.evaluate(async () => ({ names: await caches.keys(), waiting: !!(await navigator.serviceWorker.getRegistration()).waiting }));
  assert.equal(afterFailure.waiting, false);
  assert.ok(afterFailure.names.includes(initialCache.name));
  assert.ok(!afterFailure.names.some(x => x.endsWith(failedVersion)));
  checks.push('actual failed update (shell 404) removes incomplete cache and keeps active previous version');
  await context.setOffline(true);
  await page.reload();
  assert.equal(await page.locator('#results article').count(), 4);
  await context.setOffline(false);
  failShell = false;
  version = updatedVersion;
  await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
  await page.locator('#offline-update').waitFor({ state: 'visible' });
  assert.ok(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting));
  assert.equal(await page.evaluate(() => localStorage.getItem('giza-guide-favorites-v1')), stored);
  checks.push('successful update waits for explicit user action without replacing the open guide or visit list');
  await page.locator('#offline-update').click();
  await ready(page);
  await page.waitForFunction(async name => !(await caches.keys()).includes(name), initialCache.name);
  await page.waitForFunction(() => document.querySelector('#offline-update').hidden);
  const activated = await page.evaluate(async () => await caches.keys());
  assert.ok(activated.includes('giza-guide:/GizaTourGide2019/:' + updatedVersion));
  assert.ok(!activated.includes('giza-guide:/GizaTourGide2019/:old'));
  assert.ok(activated.includes('neighbor-app'));
  assert.ok(activated.includes('giza-guide:/neighbor/:old'));
  assert.equal(await page.evaluate(() => localStorage.getItem('giza-guide-favorites-v1')), stored);
  checks.push('explicit update activates and reloads; removes only own obsolete caches, preserving neighbor caches and local visit list');
  await context.setOffline(true);
  await page.reload();
  assert.equal(await page.locator('#results article').count(), 4);
  await page.setViewportSize({ width: 1280, height: 800 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await context.close();
  checks.push('updated version reloads offline and fits desktop viewport');
  const denied = await browser.newContext();
  await denied.addInitScript(() => Object.defineProperty(navigator, 'serviceWorker', { value: undefined }));
  const fallback = await denied.newPage();
  await fallback.goto(url);
  assert.equal(await fallback.locator('#results article').count(), 4);
  assert.match(await fallback.locator('#offline-status').innerText(), /تعذر حفظ الدليل/);
  await denied.close();
  checks.push('unsupported service-worker browser retains guide functionality and does not claim offline readiness');
  failShell = true;
  const firstFailed = await browser.newContext();
  const failedPage = await firstFailed.newPage();
  failedPage.on('pageerror', error => errors.push(error.message));
  await failedPage.goto(url);
  await failedPage.locator('#offline-status').getByText(/تعذر حفظ الدليل/).waitFor();
  assert.equal(await failedPage.locator('#results article').count(), 4);
  assert.equal(await failedPage.evaluate(() => !!navigator.serviceWorker.controller), false);
  assert.equal(await failedPage.evaluate(async () => (await caches.keys()).some(x => x.startsWith('giza-guide:'))), false);
  await firstFailed.close();
  failShell = false;
  checks.push('first-install shell failure retains the online guide and reports unavailability without an incomplete cache');
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'giza-offline-browser-result.json'), JSON.stringify({ checkedAt: new Date().toISOString(), browser: 'real Microsoft Edge via Playwright', source, serverStoppedDuringOfflineTest: true, checks, errors, simulatedUpdateVersions: [failedVersion, updatedVersion], sourceVersionUnchanged: sourceVersion }, null, 2));
  console.log(JSON.stringify({ success: true, groups: checks.length, errors }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); if (server.listening) await closeServer(); });
