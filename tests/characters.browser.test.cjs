const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

// Abre o arquivo completo, sem servidor, e observa somente através das APIs do navegador.
const url = process.env.GAME_URL || pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const output = path.join(__dirname, '..', 'output', 'verification');
fs.mkdirSync(output, { recursive: true });
async function instrument(page, saved) {
  await page.addInitScript(({ saved }) => {
    globalThis.__characterDraws = [];
    globalThis.__characterSamples = [];
    globalThis.__characterTones = 0;
    globalThis.__freezeCharacters = false;
    if (saved) {
      try { localStorage.setItem('eric-runner-character-v1', saved); } catch (_) {}
    }
    const originals = new WeakMap();
    let frames;
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(image, ...a) {
      const prior = originals.get(image);
      const asset = image.src?.split('?')[0].split('/').pop() || prior?.asset;
      if (asset && /^(eric|daniel|samuel)(-|\.)/.test(asset) && a.length === 8) {
        if (!frames && /^(daniel|samuel)-/.test(asset)) {
          const script = [...document.scripts].find(s => s.textContent.includes('CHARACTER_FRAMES_EMBED'));
          const match = script?.textContent.match(/const EXTRA_CHARACTER_FRAMES = (.*?); \/\/ CHARACTER_FRAMES_EMBED/);
          if (match) frames = JSON.parse(match[1]);
        }
        const [id, kind] = asset.split('.')[0].split('-');
        const frame = frames?.[id]?.[kind]?.frames.find(f => f.x === a[0] && f.y === a[1]);
        const info = prior || { asset, sx: a[0], sy: a[1], width: a[2], height: a[3], headWidth: frame?.headWidth, headOffset: frame ? frame.headX - frame.x : undefined };
        if (this.canvas.id === 'game') {
          const t = this.getTransform();
          __characterDraws.push({ ...info, localSole: a[5] + a[7], height: a[7], alpha: this.globalAlpha,
            lift: globalThis.__characterState?.player.lift || 0, character: globalThis.__characterState?.characterId,
            canvasSole: t.transformPoint({ x: 0, y: a[5] + a[7] }).y / t.d,
            helmetWidth: info.headWidth * a[6] / a[2], head: a[4] + info.headOffset * a[6] / a[2] });
          if (__characterDraws.length > 1200) __characterDraws.shift();
        } else originals.set(this.canvas, info);
      }
      return draw.call(this, image, ...a);
    };
    const audioStart = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function(...args) {
      __characterSamples.push({ duration: this.buffer?.duration, rate: this.playbackRate.value });
      return audioStart.apply(this, args);
    };
    const toneStart = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function(...args) { __characterTones++; return toneStart.apply(this, args); };
    let engine;
    Object.defineProperty(globalThis, 'RunnerEngine', { configurable: true, get: () => engine, set(value) {
      engine = value;
      const create = value.create, step = value.step;
      value.create = (...args) => { const state = create(...args); globalThis.__characterState = state; return state; };
      value.step = (...args) => { if (!globalThis.__freezeCharacters) return step(...args); };
    }});
  }, { saved });
}
async function quiet(page) {
  await page.evaluate(() => {
    const s = __characterState;
    s.items = []; s.mobs = []; s.obstacles = []; s.spawnIn = s.mobIn = s.obstacleIn = Infinity;
    s.shield = 0; s.hurt = 0;
  });
}
async function verifyPendingRoar(browser, nextCharacter) {
  const page = await browser.newPage(); await instrument(page);
  await page.addInitScript(() => {
    const decode = AudioContext.prototype.decodeAudioData;
    globalThis.__pendingCharacterDecodes = [];
    AudioContext.prototype.decodeAudioData = function(...args) {
      return decode.apply(this, args).then(buffer => new Promise(resolve => {
        __pendingCharacterDecodes.push(() => resolve(buffer));
      }));
    };
  });
  await page.goto(url); await page.waitForFunction(() => !!globalThis.__characterState);
  await page.getByRole('button', { name: 'Vamos correr!', exact: true }).click(); await quiet(page);
  await page.getByRole('button', { name: 'Ativar sons' }).click();
  await page.waitForFunction(() => __pendingCharacterDecodes.length === 7);
  await page.evaluate(() => { RunnerEngine.roar(__characterState); });
  await page.waitForFunction(() => __characterState.roar > 0 && __characterState.events.length === 0);
  if (nextCharacter === null) {
    await page.evaluate(() => { __pendingCharacterDecodes.forEach(release => release()); });
    await page.waitForTimeout(120);
    assert.ok(await page.evaluate(() => __characterSamples.some(s => Math.abs(s.duration - 2.58) < .005)), 'a gravação pendente ainda toca normalmente na mesma aventura do Eric');
    await page.close(); return;
  }
  await page.evaluate(() => { __characterState.ended = true; __characterState.health = 0; });
  await page.waitForFunction(() => !document.getElementById('end-screen').hidden);
  const announcement = await page.evaluate(id => {
    document.querySelector(`#end-character-picker [data-character="${id}"]`).click();
    document.getElementById('restart').click();
    __pendingCharacterDecodes.forEach(release => release());
    return document.getElementById('announcement').textContent;
  }, nextCharacter);
  await page.waitForTimeout(120);
  assert.ok(await page.evaluate(() => __characterSamples.every(s => Math.abs(s.duration - 2.58) > .005)), `rugido pendente da aventura anterior não toca após reiniciar com ${nextCharacter}`);
  const name = { eric: 'Eric', daniel: 'Daniel', samuel: 'Samuel' }[nextCharacter];
  assert.match(announcement, new RegExp(`Vamos de novo, ${name}!`), 'reinício anuncia o nome escolhido');
  await page.close();
}
async function verifyAllPoses(page, id) {
  await page.evaluate(() => { __freezeCharacters = true; __characterDraws = []; });
  const duration = id === 'daniel' ? 1.2 : 1.4;
  for (const pose of [
    ...Array.from({ length: 8 }, (_, i) => ({ stride: i / 2, lift: 0, vy: 0, kick: 0, roar: 0 })),
    ...[{ lift: 40, vy: -450 }, { lift: 80, vy: -80 }, { lift: 40, vy: 400 }].map(p => ({ ...p, kick: 0, roar: 0 })),
    ...[.28, .15, .04].map(kick => ({ lift: 0, vy: 0, kick, roar: 0 })),
    ...Array.from({ length: 6 }, (_, i) => ({ lift: 0, vy: 0, kick: 0, roar: duration * (1 - (i + .2) / 6) }))
  ]) {
    await page.evaluate(p => {
      const s = __characterState;
      Object.assign(s.player, { lift: p.lift, vy: p.vy });
      if (p.stride !== undefined) s.player.stride = p.stride;
      s.kick = p.kick; s.roar = p.roar; s.shake = 0; s.hurt = 0;
    }, pose);
    await page.waitForTimeout(40);
  }
  const draws = await page.evaluate(() => __characterDraws.filter(d => d.asset.startsWith(__characterState.characterId + '-')));
  for (const [kind, count] of [['run', 8], ['actions', 6], ['special', 6]]) {
    const poses = draws.filter(d => d.asset === `${id}-${kind}.png`);
    assert.equal(new Set(poses.map(d => `${d.sx},${d.sy}`)).size, count, `${id}: todas as poses da folha ${kind} aparecem`);
    assert.ok(poses.every(d => Math.abs(d.localSole) < .01), `${id}: solas alinhadas em ${kind}`);
  }
  const widths = draws.map(d => d.helmetWidth), heads = draws.map(d => d.head);
  assert.ok(Math.max(...widths) - Math.min(...widths) < .01, `${id}: capacete mantém a mesma escala entre os 20 quadros`);
  assert.ok(Math.max(...heads) - Math.min(...heads) < .01, `${id}: cabeça mantém a mesma âncora entre os 20 quadros`);
  await page.evaluate(() => { const s = __characterState; s.player.lift = s.player.vy = s.kick = s.roar = 0; __freezeCharacters = false; });
}
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const character of [null, 'eric', 'daniel', 'samuel']) await verifyPendingRoar(browser, character);
    // A abertura file:// comum pode impedir leitura dos pixels, mas ainda permite
    // desenhar o PNG. As poses frontais usam o recorte medido, sem getImageData.
    for (const id of ['daniel', 'samuel']) {
      const noPixels = await browser.newPage(); await instrument(noPixels, id);
      await noPixels.addInitScript(() => { CanvasRenderingContext2D.prototype.getImageData = () => { throw new DOMException('Canvas protegido', 'SecurityError'); }; });
      await noPixels.goto(url); await noPixels.waitForFunction(() => !!globalThis.__characterState);
      await noPixels.waitForTimeout(400);
      assert.ok(await noPixels.evaluate(character => __characterDraws.some(d => d.asset === character + '.png'), id), `${id}: pose frontal renderiza mesmo com leitura de pixels bloqueada`);
      await noPixels.getByRole('button', { name: 'Vamos correr!', exact: true }).click();
      await noPixels.getByRole('button', { name: 'Pausar aventura' }).click();
      await noPixels.evaluate(() => { __characterDraws = []; });
      await noPixels.waitForTimeout(60);
      assert.ok(await noPixels.evaluate(character => __characterDraws.some(d => d.asset === character + '.png' && Math.abs(d.localSole) < .01), id), `${id}: pausa usa o PNG frontal apoiado no chão, sem ler os pixels`);
      await noPixels.close();
    }
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await instrument(page); await page.goto(url); await page.waitForFunction(() => !!globalThis.__characterState);
    assert.equal(await page.locator('#character-picker button[data-character]').count(), 3, 'três heróis disponíveis na abertura');
    assert.equal(await page.evaluate(() => __characterState.characterId), 'eric', 'Eric continua sendo o herói padrão');
    await page.getByRole('button', { name: 'Escolher Daniel', exact: true }).click();
    assert.equal(await page.evaluate(() => __characterState.characterId), 'daniel');
    assert.match(await page.locator('#intro h2').textContent(), /Daniel/);
    assert.equal(await page.locator('#health-meter').getAttribute('aria-label'), 'Vida do Daniel');
    assert.equal(await page.evaluate(() => localStorage.getItem('eric-runner-character-v1')), 'daniel');
    await page.waitForFunction(() => __characterDraws.some(d => d.asset === 'daniel.png'));
    await page.screenshot({ path: path.join(output, 'daniel-start.png'), fullPage: true });
    await page.evaluate(() => { __characterDraws = []; });
    await page.getByRole('button', { name: 'Vamos correr!', exact: true }).click(); await quiet(page);
    assert.equal(await page.locator('#character-picker').isVisible(), false, 'a escolha não interrompe a corrida');
    assert.match(await page.locator('#roar-label').textContent(), /SOPRAR/);
    await page.waitForTimeout(620);
    let draws = await page.evaluate(() => __characterDraws.filter(d => d.asset === 'daniel-run.png'));
    assert.equal(new Set(draws.map(d => `${d.sx},${d.sy}`)).size, 8, 'Daniel percorre os oito passos');
    assert.ok(draws.every(d => Math.abs(d.localSole) < .01 && Math.abs(d.canvasSole - 436) < .6), 'solas de Daniel apoiadas no chão');
    const danielHeight = draws.reduce((sum, d) => sum + d.height, 0) / draws.length;
    await page.locator('canvas').focus(); await page.keyboard.press('z');
    await page.waitForFunction(() => __characterDraws.some(d => d.asset === 'daniel-actions.png' && d.lift > 20));
    await page.waitForTimeout(850);
    await page.getByRole('button', { name: 'Ativar sons' }).click(); await page.waitForTimeout(200);
    await page.evaluate(() => { __characterSamples = []; __characterDraws = []; __characterTones = 0; });
    await page.locator('canvas').focus(); await page.keyboard.press('x');
    await page.waitForFunction(() => __characterDraws.some(d => d.asset === 'daniel-special.png'));
    assert.ok(await page.evaluate(() => __characterState.wind > 0));
    await page.waitForTimeout(1100);
    draws = await page.evaluate(() => __characterDraws.filter(d => d.asset === 'daniel-special.png'));
    assert.equal(new Set(draws.map(d => `${d.sx},${d.sy}`)).size, 6, 'Daniel demonstra seis poses do sopro');
    assert.ok(draws.every(d => d.alpha === 1 && Math.abs(d.localSole) < .01), 'sopro tem uma pose por quadro, sem rostos sobrepostos');
    assert.ok(await page.evaluate(() => __characterSamples.every(s => Math.abs(s.duration - 2.58) > .005)), 'Daniel não toca a voz do Eric');
    assert.ok(await page.evaluate(() => __characterTones > 0), 'sopro tem som próprio');
    await verifyAllPoses(page, 'daniel');
    await page.getByRole('button', { name: 'Pausar aventura' }).click();
    assert.match(await page.locator('#pause-screen p').textContent(), /Daniel/);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.evaluate(() => { __characterState.health = 0; __characterState.ended = true; });
    await page.waitForFunction(() => !document.getElementById('end-screen').hidden);
    assert.match(await page.locator('#end-title').textContent(), /Daniel/);
    await page.locator('#end-character-picker [data-character="samuel"]').click();
    assert.equal(await page.evaluate(() => __characterState.characterId), 'samuel');
    await page.getByRole('button', { name: 'Vamos de novo!', exact: true }).click(); await quiet(page);
    assert.equal(await page.evaluate(() => __characterState.characterId), 'samuel', 'reinício preserva Samuel escolhido');
    assert.equal(await page.locator('#health').textContent(), '20');
    assert.match(await page.locator('#roar-label').textContent(), /BOLHAS/);
    await page.evaluate(() => { __characterDraws = []; __characterSamples = []; __characterTones = 0; });
    await page.waitForTimeout(650);
    draws = await page.evaluate(() => __characterDraws.filter(d => d.asset === 'samuel-run.png'));
    assert.equal(new Set(draws.map(d => `${d.sx},${d.sy}`)).size, 8, 'Samuel percorre os oito passos');
    assert.ok(draws.every(d => Math.abs(d.localSole) < .01), 'Samuel também encosta as solas no chão');
    assert.ok(draws.reduce((sum, d) => sum + d.height, 0) / draws.length < danielHeight * .95, 'Samuel tem aparência menor de criança de dois anos');
    await page.evaluate(() => { const s = __characterState; s.mobs.push({ type: 'slime', x: s.player.x + 140, phase: 0, width: 48, height: 48, lift: 0, resolved: false }); });
    await page.locator('canvas').focus(); await page.keyboard.press('x');
    await page.waitForFunction(() => __characterDraws.some(d => d.asset === 'samuel-special.png'));
    await page.waitForFunction(() => __characterState.mobs.some(m => m.bubbled && m.fleeLift > 0));
    await page.waitForTimeout(900);
    assert.ok(await page.evaluate(() => __characterSamples.every(s => Math.abs(s.duration - 2.58) > .005)), 'Samuel também não toca a voz do Eric');
    assert.ok(await page.evaluate(() => __characterTones > 0), 'bolhas têm sons suaves próprios');
    await page.screenshot({ path: path.join(output, 'samuel-bubbles.png'), fullPage: true });
    await verifyAllPoses(page, 'samuel');
    assert.deepEqual(errors, [], 'nenhum erro com troca de heróis e especiais');
    await page.reload(); await page.waitForFunction(() => !!globalThis.__characterState);
    assert.equal(await page.evaluate(() => __characterState.characterId), 'samuel', 'escolha persiste ao reabrir');
    await page.close();

    const mobile = await browser.newPage({ viewport: { width: 740, height: 360 }, isMobile: true, hasTouch: true });
    await instrument(mobile, 'daniel'); await mobile.goto(url);
    await mobile.waitForFunction(() => !!globalThis.__characterState);
    const cards = await mobile.locator('#character-picker').boundingBox();
    assert.ok(cards.x >= 0 && cards.x + cards.width <= 740, 'escolha cabe no celular em landscape');
    for (const button of await mobile.locator('#character-picker button').all()) {
      const b = await button.boundingBox(); assert.ok(b.width >= 62 && b.height >= 66, 'cartões têm alvos grandes');
    }
    await mobile.screenshot({ path: path.join(output, 'characters-mobile-start.png') });
    await mobile.close();

    const fallback = await browser.newPage(); await instrument(fallback, 'daniel');
    await fallback.route('**/daniel*.png*', route => route.abort());
    await fallback.goto(url); await fallback.waitForFunction(() => !!globalThis.__characterState);
    await fallback.waitForTimeout(250);
    assert.equal(await fallback.evaluate(() => __characterState.characterId), 'daniel');
    assert.equal(await fallback.evaluate(() => __characterDraws.filter(d => d.asset.startsWith('eric')).length), 0, 'falha da imagem de Daniel nunca usa rosto do Eric');
    await fallback.getByRole('button', { name: 'Vamos correr!', exact: true }).click(); await fallback.waitForTimeout(160);
    assert.ok(await fallback.evaluate(() => __characterState.time > 0), 'desenho de reserva próprio mantém o jogo');
    await fallback.close();

    const blocked = await browser.newPage(); await instrument(blocked);
    await blocked.addInitScript(() => { Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new DOMException('Bloqueado', 'SecurityError'); }; });
    await blocked.goto(url); await blocked.waitForFunction(() => !!globalThis.__characterState);
    await blocked.getByRole('button', { name: 'Escolher Samuel', exact: true }).click();
    assert.equal(await blocked.evaluate(() => __characterState.characterId), 'samuel', 'armazenamento bloqueado não impede escolher');
    await blocked.close();
    const invalid = await browser.newPage(); await instrument(invalid, 'personagem-inexistente');
    await invalid.goto(url); await invalid.waitForFunction(() => !!globalThis.__characterState);
    assert.equal(await invalid.evaluate(() => __characterState.characterId), 'eric', 'escolha gravada inválida volta ao Eric');
    await invalid.close();
    console.log('Personagens: seleção, persistência, sprites, especiais, sons próprios, mobile e reservas passaram.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
