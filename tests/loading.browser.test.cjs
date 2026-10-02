const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const root = path.join(__dirname, '..');
const output = path.join(root, 'output', 'verification');
fs.mkdirSync(output, { recursive: true });

// Um servidor temporário permite controlar o download de cada PNG de verdade.
// Não muda o jogo nem exige dependências/CDNs além do Playwright de desenvolvimento.
async function server() {
  const app = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const filename = path.join(root, pathname === '/' ? 'index.html' : pathname.slice(1));
    if (!filename.startsWith(root + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, { 'Content-Type': filename.endsWith('.png') ? 'image/png' : 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(filename));
  });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${app.address().port}/`, close: () => new Promise(resolve => app.close(resolve)) };
}
async function observe(page, character = 'eric') {
  await page.addInitScript(id => {
    localStorage.setItem('eric-runner-character-v1', id);
    globalThis.__loadingDraws = [];
    const originals = new WeakMap();
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
      const asset = image.src?.split('?')[0].split('/').pop() || originals.get(image);
      if (asset && /^(eric|daniel|samuel)(-|\.)/.test(asset)) {
        if (this.canvas.id === 'game') {
          __loadingDraws.push({ asset, running: !!globalThis.__loadingState?.running });
          if (__loadingDraws.length > 500) __loadingDraws.shift();
        } else originals.set(this.canvas, asset);
      }
      return draw.call(this, image, ...args);
    };
    let engine;
    Object.defineProperty(globalThis, 'RunnerEngine', { configurable: true, get: () => engine, set(value) {
      engine = value;
      const create = value.create;
      value.create = (...args) => { const state = create(...args); globalThis.__loadingState = state; return state; };
    } });
  }, character);
}
function basename(route) { return new URL(route.request().url()).pathname.split('/').pop(); }
async function holdAssets(page, names) {
  const gates = new Map(names.map(name => {
    let release;
    return [name, { requested: 0, released: false, wait: new Promise(resolve => { release = resolve; }), release: () => release() }];
  }));
  await page.route('**/*.png*', async route => {
    const gate = gates.get(basename(route));
    if (gate && !gate.released) { gate.requested++; await gate.wait; }
    try { await route.continue(); } catch (_) {}
  });
  return {
    requested: name => gates.get(name).requested,
    release(name) { const gate = gates.get(name); gate.released = true; gate.release(); },
    releaseAll() { for (const [name] of gates) this.release(name); }
  };
}
async function running(page) { return page.evaluate(() => !!globalThis.__loadingState?.running && !__loadingState.ended); }
async function ready(page) {
  await page.waitForFunction(() => {
    const overlay = document.getElementById('asset-loading');
    return !!overlay && (overlay.hidden || getComputedStyle(overlay).display === 'none') && !document.getElementById('start').disabled;
  });
}
async function assertProgress(page, done, total) {
  await page.waitForFunction(({ done, total }) => {
    const element = document.getElementById('loading-progress');
    const text = element?.textContent || '';
    return new RegExp(`${done}\\s*(?:/|de)\\s*${total}`).test(text) || Number(element?.getAttribute('aria-valuenow')) === done && Number(element?.getAttribute('aria-valuemax')) === total;
  }, { done, total });
}
async function assertWaiting(page, message) {
  assert.equal(await running(page), false, message);
  assert.equal(await page.locator('#asset-loading').isVisible(), true, 'tela de carregamento permanece visível');
  assert.equal(await page.locator('#start').isDisabled(), true, 'botão de início indisponível enquanto falta PNG');
}
async function startReady(page) {
  await ready(page);
  if (!await running(page)) await page.locator('#start').click();
  await page.waitForFunction(() => __loadingState.running && !__loadingState.ended);
}
async function delayedEric(browser, url) {
  const page = await browser.newPage(); await observe(page);
  const gates = await holdAssets(page, ['eric-run.png', 'eric-roar-actions.png']);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!globalThis.__loadingState);
    await page.evaluate(() => document.getElementById('start').click());
    // RED original: o jogo iniciava com run/special ainda sem download concluído.
    assert.equal(await running(page), false, 'início deve aguardar as folhas; não mostrar o boneco provisório enquanto baixa');
    await assertWaiting(page, 'Eric aguarda corrida e rugido'); await assertProgress(page, 3, 5);
    for (const code of ['KeyZ', 'Space', 'KeyX']) {
      await page.evaluate(code => document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })), code);
    }
    await page.evaluate(() => document.getElementById('game').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, isPrimary: true, button: 0 })));
    await assertWaiting(page, 'teclado e toque também aguardam as imagens');
    assert.equal(await page.evaluate(() => __loadingState.distance), 0, 'tempo de espera não acumula distância');
    gates.release('eric-run.png'); await assertProgress(page, 4, 5);
    await assertWaiting(page, 'corrida pronta não basta se o especial ainda está pendente');
    gates.release('eric-roar-actions.png'); await assertProgress(page, 5, 5); await startReady(page);
    await page.waitForFunction(() => __loadingDraws.some(d => d.asset === 'eric-run.png' && d.running));
    await page.evaluate(() => RunnerEngine.roar(__loadingState));
    await page.waitForFunction(() => __loadingDraws.some(d => d.asset === 'eric-roar-actions.png' && d.running));
    console.log('PASS Eric: downloads atrasados, progresso e bloqueio de atalhos até as cinco imagens prontas');
  } finally { gates.releaseAll(); await page.close(); }
}

async function delayedDecode(browser, url) {
  const page = await browser.newPage(); await observe(page);
  await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode;
    globalThis.__loadingDecodeReleases = [];
    HTMLImageElement.prototype.decode = function(...args) {
      const pending = decode.apply(this, args);
      if (!this.src.split('?')[0].endsWith('/eric-run.png')) return pending;
      return pending.then(() => new Promise(resolve => { __loadingDecodeReleases.push(resolve); }));
    };
  });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => __loadingDecodeReleases.length > 0);
    await assertProgress(page, 4, 5);
    await page.evaluate(() => document.getElementById('start').click());
    await assertWaiting(page, 'download concluído ainda aguarda a decodificação do PNG');
    await page.evaluate(() => __loadingDecodeReleases.forEach(release => release()));
    await startReady(page);
    console.log('PASS decodificação: download sozinho não libera a aventura');
  } finally { await page.close(); }
}

// A primeira resposta falha; o botão de nova tentativa deve refazer só a folha
// quebrada e manter os PNGs que já foram validados e preparados para desenhar.
async function retryFailure(browser, url, kind) {
  const page = await browser.newPage(); await observe(page);
  const attempts = new Map();
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9ZkAAAAASUVORK5CYII=', 'base64');
  if (kind === 'dimensions') await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode;
    globalThis.__loadingDimensionChecks = [];
    HTMLImageElement.prototype.decode = function(...args) {
      return decode.apply(this, args).then(result => {
        if (this.src.split('?')[0].endsWith('/eric-run.png')) __loadingDimensionChecks.push([this.naturalWidth, this.naturalHeight]);
        return result;
      });
    };
  });
  if (kind === 'decode') await page.addInitScript(() => {
    const decode = HTMLImageElement.prototype.decode;
    globalThis.__failedLoadingDecode = false;
    HTMLImageElement.prototype.decode = function(...args) {
      return decode.apply(this, args).then(result => {
        if (!__failedLoadingDecode && this.src.split('?')[0].endsWith('/eric-run.png')) {
          __failedLoadingDecode = true; throw new Error('Falha de decodificação simulada');
        }
        return result;
      });
    };
  });
  await page.route('**/*.png*', async route => {
    const name = basename(route), count = (attempts.get(name) || 0) + 1;
    attempts.set(name, count);
    if (name === 'eric-run.png' && count === 1) {
      if (kind === 'network') { await route.abort('failed'); return; }
      if (kind === 'dimensions') { await route.fulfill({ status: 200, contentType: 'image/png', body: tinyPng }); return; }
    }
    await route.continue();
  });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('#loading-retry').waitFor({ state: 'visible' });
    await assertProgress(page, 4, 5); await assertWaiting(page, `${kind}: erro não inicia com personagem provisório`);
    if (kind === 'dimensions') assert.deepEqual(await page.evaluate(() => __loadingDimensionChecks), [[1, 1]], 'PNG válido de 1×1 é rejeitado pelas dimensões esperadas da folha, não por erro de download');
    assert.ok((await page.locator('#asset-loading').textContent()).trim().length > 10, 'falha explica a espera com texto legível');
    const healthyBefore = new Map(['eric-actions.png', 'eric-roar.png', 'eric-roar-actions.png'].map(name => [name, attempts.get(name)]));
    await page.locator('#loading-retry').click(); await startReady(page);
    assert.ok(attempts.get('eric-run.png') >= 2, 'nova tentativa realmente busca a folha que faltou');
    for (const [name, count] of healthyBefore) assert.equal(attempts.get(name), count, `retry preserva ${name} já pronto`);
    await page.waitForFunction(() => __loadingDraws.some(d => d.asset === 'eric-run.png' && d.running));
    console.log(`PASS retry ${kind}: erro visível, nova tentativa e reaproveitamento das imagens prontas`);
  } finally { await page.close(); }
}

async function timeoutRetry(browser, url) {
  const page = await browser.newPage(); await observe(page);
  await page.addInitScript(() => {
    const setTimeout = window.setTimeout;
    window.setTimeout = function(callback, delay, ...args) {
      // Um segundo deixa os PNGs saudáveis decodificarem mesmo com outras
      // suítes em paralelo, sem esperar os trinta segundos de produção.
      return setTimeout.call(window, callback, delay === 30000 ? 1000 : delay, ...args);
    };
  });
  const gates = await holdAssets(page, ['eric-run.png']);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.locator('#loading-retry').waitFor({ state: 'visible' });
    await assertProgress(page, 4, 5); await assertWaiting(page, 'download parado oferece retry após o limite de tempo');
    gates.releaseAll(); await page.locator('#loading-retry').click(); await startReady(page);
    console.log('PASS timeout: espera tem limite e a aventura recupera após nova tentativa');
  } finally { gates.releaseAll(); await page.close(); }
}

async function delayedCharacter(browser, url, id) {
  const page = await browser.newPage(); await observe(page, id);
  const gates = await holdAssets(page, [`${id}-run.png`, `${id}-special.png`, 'eric-run.png']);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!globalThis.__loadingState);
    assert.equal(await page.evaluate(() => __loadingState.characterId), id);
    await assertProgress(page, 2, 4);
    await page.evaluate(() => document.getElementById('start').click());
    await assertWaiting(page, `${id}: só usa o sprite próprio quando suas quatro imagens estão prontas`);
    gates.release(`${id}-run.png`); await assertProgress(page, 3, 4);
    await assertWaiting(page, `${id}: especial ainda pendente mantém a espera`);
    gates.release(`${id}-special.png`); await startReady(page);
    await page.waitForFunction(character => __loadingDraws.some(d => d.asset === character + '-run.png' && d.running), id);
    assert.ok(gates.requested('eric-run.png') > 0, 'Eric permanece com uma folha atrasada durante o teste');
    assert.equal(await running(page), true, 'um herói não escolhido com folha atrasada não bloqueia o escolhido');
    await page.evaluate(() => RunnerEngine.roar(__loadingState));
    await page.waitForFunction(character => __loadingDraws.some(d => d.asset === character + '-special.png' && d.running), id);
    console.log(`PASS ${id}: quatro imagens próprias, especial pronto e independência dos assets do Eric`);
  } finally { gates.releaseAll(); await page.close(); }
}

async function delayedRestart(browser, url) {
  const page = await browser.newPage(); await observe(page);
  const gates = await holdAssets(page, ['samuel-run.png', 'samuel-special.png']);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' }); await startReady(page);
    await page.evaluate(() => { __loadingState.health = 0; __loadingState.ended = true; });
    await page.locator('#end-screen').waitFor({ state: 'visible' });
    await page.locator('#end-character-picker [data-character="samuel"]').click();
    await assertProgress(page, 2, 4);
    assert.equal(await page.locator('#restart').isDisabled(), true, 'reinício espera os PNGs do novo herói');
    await page.evaluate(() => {
      document.getElementById('restart').click();
      document.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', bubbles: true }));
    });
    assert.equal(await page.evaluate(() => __loadingState.ended), true, 'vida e estado não reiniciam enquanto a folha falta');
    assert.equal(await running(page), false);
    gates.releaseAll();
    await page.waitForFunction(() => document.getElementById('asset-loading').hidden && !document.getElementById('restart').disabled);
    await page.locator('#restart').click();
    await page.waitForFunction(() => __loadingState.running && !__loadingState.ended && __loadingState.characterId === 'samuel');
    assert.equal(await page.evaluate(() => __loadingState.health), 20);
    await page.waitForFunction(() => __loadingDraws.some(d => d.asset === 'samuel-run.png' && d.running));
    console.log('PASS reinício: troca na tela final aguarda os assets e só então recupera as vinte vidas');
  } finally { gates.releaseAll(); await page.close(); }
}

async function mobileLoading(browser, url) {
  const page = await browser.newPage({ viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true });
  await observe(page, 'samuel');
  const gates = await holdAssets(page, ['samuel-special.png']);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await assertProgress(page, 3, 4);
    const overlay = page.locator('#asset-loading');
    assert.equal(await overlay.isVisible(), true, 'loading também aparece no celular em landscape');
    for (const locator of [overlay, page.locator('#loading-progress')]) {
      const rect = await locator.boundingBox();
      assert.ok(rect && rect.x >= -.5 && rect.y >= -.5 && rect.x + rect.width <= 740.5 && rect.y + rect.height <= 360.5, 'loading e progresso cabem na tela landscape de 740×360');
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'loading não cria rolagem horizontal');
    await page.screenshot({ path: path.join(output, 'loading-mobile.png'), fullPage: true });
    gates.releaseAll(); await ready(page);
    console.log('PASS mobile: carregamento legível e sem cortes em landscape');
  } finally { gates.releaseAll(); await page.close(); }
}

async function recoveredCharacterCards(browser, url) {
  const page = await browser.newPage(); await observe(page);
  let originalFailures = 0, successfulRetries = 0;
  await page.route('**/*.png*', async route => {
    const resource = new URL(route.request().url());
    if (basename(route) === 'eric.png') {
      if (!resource.searchParams.has('retry')) { originalFailures++; await route.abort('failed'); return; }
      successfulRetries++;
    }
    await route.continue();
  });
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    // A miniatura da tela final normalmente é lazy e está escondida. Aqui
    // também a carregamos para simular os dois cartões com download quebrado.
    await page.evaluate(() => {
      for (const image of document.querySelectorAll('[data-character="eric"] img')) image.loading = 'eager';
    });
    await page.locator('#loading-retry').waitFor({ state: 'visible' });
    await assertProgress(page, 4, 5);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-character="eric"] img')].every(image => image.complete && image.naturalWidth === 0));
    assert.ok(originalFailures >= 2, 'pose principal e cartões realmente sofreram falha na URL original');
    await page.locator('#loading-retry').click(); await ready(page);
    const sources = await page.locator('[data-character="eric"] img').evaluateAll(images => images.map(image => image.src));
    assert.equal(sources.length, 2, 'verifica o cartão inicial e o cartão da tela final');
    assert.ok(sources.every(src => new URL(src).searchParams.has('retry')), 'os dois cartões adotam a URL validada na nova tentativa');
    await page.waitForFunction(() => [...document.querySelectorAll('[data-character="eric"] img')].every(image => image.naturalWidth > 0));
    assert.ok(successfulRetries >= 1, 'imagem recuperada veio da nova URL liberada');
    await startReady(page);
    console.log('PASS cartões: retry recupera a pose e as duas miniaturas após falha da URL original');
  } finally { await page.close(); }
}

(async () => {
  const local = await server();
  const browser = await chromium.launch({ headless: true });
  try {
    await recoveredCharacterCards(browser, local.url);
    await delayedEric(browser, local.url);
    await delayedDecode(browser, local.url);
    for (const kind of ['network', 'dimensions', 'decode']) await retryFailure(browser, local.url, kind);
    await timeoutRetry(browser, local.url);
    for (const id of ['daniel', 'samuel']) await delayedCharacter(browser, local.url, id);
    await delayedRestart(browser, local.url);
    await mobileLoading(browser, local.url);
  }
  finally { await browser.close(); await local.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
