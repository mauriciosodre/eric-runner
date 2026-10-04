const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const url = process.env.GAME_URL || pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const output = path.join(__dirname, '..', 'output', 'verification');
fs.mkdirSync(output, { recursive: true });
const viewports = [
  { name: 'computador', width: 1280, height: 900 },
  { name: 'celular', width: 844, height: 390, mobile: true },
  { name: 'celular pequeno', width: 667, height: 320, mobile: true }
];
async function prepare(browser, viewport, beforeLoad) {
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height },
    isMobile: !!viewport.mobile, hasTouch: !!viewport.mobile });
  page.setDefaultTimeout(5000);
  if (beforeLoad) await beforeLoad(page);
  await page.addInitScript(() => {
    try {
      localStorage.setItem('eric-runner-character-v1', 'eric');
      localStorage.setItem('eric-runner-highscore-v1', '9999');
    } catch (_) {}
    let engine;
    Object.defineProperty(globalThis, 'RunnerEngine', { configurable: true, get: () => engine, set(value) {
      engine = value;
      const create = value.create;
      value.create = (...args) => { const state = create(...args); globalThis.__navigationState = state; return state; };
    }});
  });
  await page.goto(url);
  await page.waitForFunction(() => globalThis.__navigationState && !document.getElementById('start').disabled,
    null, { timeout: 30000 });
  await activate(page, page.getByRole('button', { name: 'Vamos correr!', exact: true }), viewport);
  await quiet(page);
  return page;
}
async function quiet(page) {
  await page.evaluate(() => {
    const s = __navigationState;
    s.items = []; s.obstacles = []; s.mobs = [];
    s.spawnIn = s.obstacleIn = s.mobIn = Infinity;
  });
}
async function activate(page, button, viewport) {
  await button.waitFor({ state: 'visible' });
  const bounds = await button.boundingBox();
  assert.ok(bounds && bounds.x >= -1 && bounds.y >= -1 &&
    bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1,
  `${viewport.name}: o botão ${await button.getAttribute('aria-label') || await button.textContent()} aparece inteiro`);
  // Interação real, sem force nem DOM.click(): detecta controles tapados por overlays.
  if (viewport.mobile) await button.tap();
  else await button.click();
}
async function endFromCollision(page) {
  await page.evaluate(() => {
    const s = __navigationState;
    s.health = 1; s.shield = s.hurt = 0; s.player.lift = s.player.vy = 0;
    s.obstacles.push({ kind: 'cone', x: s.player.x, width: 50, height: 44, hit: false });
  });
  await page.locator('#end-screen').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => __navigationState.health), 0, 'a colisão encerra a aventura');
}
async function choose(page, picker, id, viewport) {
  const name = { eric: 'Eric', daniel: 'Daniel', samuel: 'Samuel' }[id];
  const button = page.locator(picker).getByRole('button', { name: 'Escolher ' + name, exact: true });
  await activate(page, button, viewport);
  await page.waitForFunction(character => __navigationState.characterId === character, id);
  assert.equal(await button.getAttribute('aria-pressed'), 'true', 'a escolha aparece selecionada');
  await page.waitForFunction(() => document.getElementById('asset-loading').hidden, null, { timeout: 30000 });
}
async function verifyEnd(browser, viewport) {
  const page = await prepare(browser, viewport);
  try {
    await endFromCollision(page);
    await page.screenshot({ path: path.join(output, `navigation-end-${viewport.width}.png`) });
    await choose(page, '#end-character-picker', 'daniel', viewport);
    await choose(page, '#end-character-picker', 'samuel', viewport);
    await activate(page, page.getByRole('button', { name: 'Vamos de novo!', exact: true }), viewport);
    assert.deepEqual(await page.evaluate(() => ({ id: __navigationState.characterId,
      health: __navigationState.health, running: __navigationState.running, ended: __navigationState.ended })),
    { id: 'samuel', health: 20, running: true, ended: false }, 'a nova aventura usa o herói escolhido e vinte corações');
    assert.equal(await page.locator('#end-screen').isVisible(), false);
    await quiet(page);
    await endFromCollision(page);
    await activate(page, page.getByRole('button', { name: 'Trocar personagem', exact: true }), viewport);
    assert.equal(await page.locator('#intro').isVisible(), true, 'Trocar personagem retorna ao menu completo');
    assert.deepEqual(await page.evaluate(() => ({ id: __navigationState.characterId,
      running: __navigationState.running, ended: __navigationState.ended })),
    { id: 'samuel', running: false, ended: false }, 'voltar ao menu preserva a última escolha sem começar a corrida');
    await choose(page, '#character-picker', 'eric', viewport);
    await activate(page, page.getByRole('button', { name: 'Vamos correr!', exact: true }), viewport);
    await quiet(page);
    assert.deepEqual(await page.evaluate(() => ({ id: __navigationState.characterId,
      health: __navigationState.health, running: __navigationState.running })),
    { id: 'eric', health: 20, running: true }, 'a troca pelo menu inicia uma aventura limpa com Eric');
  } finally { await page.close(); }
}
async function verifyHome(browser, viewport) {
  const page = await prepare(browser, viewport);
  try {
    await activate(page, page.getByRole('button', { name: 'Ativar sons', exact: true }), viewport);
    await activate(page, page.getByRole('button', { name: 'Pausar aventura', exact: true }), viewport);
    assert.equal(await page.evaluate(() => __navigationState.paused), true);
    await activate(page, page.getByRole('button', { name: 'Continuar', exact: true }), viewport);
    assert.equal(await page.evaluate(() => __navigationState.paused), false, 'Continuar mantém a partida atual');
    await page.evaluate(() => {
      const s = __navigationState;
      s.health = 7; s.distance = 100; s.goals = 2; s.boost = 2; s.shield = 2;
      s.wind = 1; s.bubble = 1; s.roar = .7; s.roarWave = 1; s.hurt = 1;
      s.roarCooldown = 5; s.player.lift = 35; s.player.vy = -120;
      s.items.push({ type: 'coin', x: s.width + 100, y: 220 });
      s.mobs.push({ type: 'car', x: s.width + 100, y: 400 });
    });
    await activate(page, page.getByRole('button', { name: 'Pausar aventura', exact: true }), viewport);
    const fullscreenBefore = await page.evaluate(() => !!document.fullscreenElement);
    const widthBefore = await page.evaluate(() => __navigationState.width);
    await page.screenshot({ path: path.join(output, `navigation-pause-${viewport.width}.png`) });
    await activate(page, page.getByRole('button', { name: 'Voltar ao início', exact: true }), viewport);
    assert.equal(await page.locator('#intro').isVisible(), true, 'voltar mostra a seleção inicial');
    assert.equal(await page.locator('#pause-screen').isVisible(), false);
    assert.equal(await page.locator('#end-screen').isVisible(), false);
    assert.equal(await page.evaluate(() => !!document.fullscreenElement), fullscreenBefore, 'a navegação preserva a tela cheia');
    const reset = await page.evaluate(() => {
      const s = __navigationState;
      return { running: s.running, paused: s.paused, ended: s.ended, id: s.characterId,
        health: s.health, score: RunnerEngine.score(s), items: s.items.length, mobs: s.mobs.length,
        obstacles: s.obstacles.length, boost: s.boost, shield: s.shield, wind: s.wind, bubble: s.bubble,
        roar: s.roar, roarWave: s.roarWave, hurt: s.hurt, roarCooldown: s.roarCooldown,
        lift: s.player.lift, vy: s.player.vy, events: s.events.length, width: s.width };
    });
    assert.deepEqual(reset, { running: false, paused: false, ended: false, id: 'eric', health: 20,
      score: 0, items: 0, mobs: 0, obstacles: 0, boost: 0, shield: 0, wind: 0, bubble: 0,
      roar: 0, roarWave: 0, hurt: 0, roarCooldown: 0, lift: 0, vy: 0, events: 0, width: widthBefore },
    'o início aguarda uma nova partida, sem efeitos ou pontuação da anterior');
    assert.equal(await page.locator('#highscore').textContent(), '9999', 'o recorde sobrevive à volta ao início');
    assert.equal(await page.getByRole('button', { name: 'Desativar sons', exact: true }).isVisible(), true,
      'a preferência de som sobrevive à navegação');
    await choose(page, '#character-picker', 'daniel', viewport);
    assert.equal(await page.evaluate(() => __navigationState.running), false, 'selecionar não começa sozinho');
    await activate(page, page.getByRole('button', { name: 'Vamos correr!', exact: true }), viewport);
    await quiet(page);
    assert.deepEqual(await page.evaluate(() => ({ id: __navigationState.characterId, health: __navigationState.health,
      running: __navigationState.running, goals: __navigationState.goals })),
    { id: 'daniel', health: 20, running: true, goals: 0 }, 'a nova partida começa com Daniel e vida completa');
  } finally { await page.close(); }
}
async function verifyPendingRoar(browser) {
  const viewport = viewports[0];
  const page = await prepare(browser, viewport, async page => {
    await page.addInitScript(() => {
      globalThis.__navigationPendingAudio = [];
      globalThis.__navigationSamples = [];
      const decode = AudioContext.prototype.decodeAudioData;
      AudioContext.prototype.decodeAudioData = function(...args) {
        return decode.apply(this, args).then(buffer => new Promise(resolve => {
          __navigationPendingAudio.push(() => resolve(buffer));
        }));
      };
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function(...args) {
        __navigationSamples.push(this.buffer?.duration);
        return start.apply(this, args);
      };
    });
  });
  try {
    await activate(page, page.getByRole('button', { name: 'Ativar sons', exact: true }), viewport);
    await page.waitForFunction(() => __navigationPendingAudio.length === 7);
    await page.evaluate(() => {
      globalThis.__navigationRoarTriggered = performance.now();
      RunnerEngine.roar(__navigationState);
    });
    await page.waitForFunction(() => __navigationState.roar > 0 && __navigationState.events.length === 0);
    await activate(page, page.getByRole('button', { name: 'Pausar aventura', exact: true }), viewport);
    await activate(page, page.getByRole('button', { name: 'Voltar ao início', exact: true }), viewport);
    await activate(page, page.getByRole('button', { name: 'Vamos correr!', exact: true }), viewport);
    await quiet(page);
    const elapsed = await page.evaluate(() => {
      const elapsed = performance.now() - __navigationRoarTriggered;
      __navigationPendingAudio.forEach(release => release());
      return elapsed;
    });
    assert.ok(elapsed < 400, `o caso exercita o rugido pendente dentro da janela de 400 ms (${elapsed.toFixed(0)} ms)`);
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => __navigationSamples.every(duration => Math.abs(duration - 2.58) > .005)),
      'o rugido solicitado antes de voltar ao início não vaza para a nova aventura');
  } finally { await page.close(); }
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  try {
    for (const viewport of viewports) for (const [name, verify] of [['troca após perder', verifyEnd], ['pausa e início', verifyHome]]) {
      try { await verify(browser, viewport); console.log(`PASS ${viewport.name}: ${name}`); }
      catch (error) { failures.push(`${viewport.name}: ${name}: ${error.message}`); console.error(`FAIL ${failures.at(-1)}`); }
    }
    try { await verifyPendingRoar(browser); console.log('PASS rugido pendente não atravessa a volta ao início'); }
    catch (error) { failures.push(`rugido pendente: ${error.message}`); console.error(`FAIL ${failures.at(-1)}`); }
    assert.equal(failures.length, 0, failures.join('\n'));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
