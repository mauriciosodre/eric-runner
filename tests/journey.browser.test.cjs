const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const url = process.env.GAME_URL || pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const output = path.join(__dirname, '..', 'output', 'verification');
fs.mkdirSync(output, { recursive: true });
const PETS = [['pipo', 'Pipo'], ['lili', 'Lili'], ['tico', 'Tico'], ['bubi', 'Bubi'], ['nino', 'Nino'], ['zazu', 'Zazu']];
const FAMILY = { 'eric-runner-album-v1': JSON.stringify({ version: 1, eggProgress: 0, unlocked: PETS.map(p => p[0]), selected: null, rescues: 0 }) };

async function observe(page, saved = {}) {
  await page.addInitScript(saved => {
    try { for (const [key, value] of Object.entries(saved)) if (localStorage.getItem(key) === null) localStorage.setItem(key, value); } catch (_) {}
    globalThis.__freezeJourney = true;
    globalThis.__holdJourneyFrame = false;
    const requestFrame = requestAnimationFrame, heldFrames = [];
    requestAnimationFrame = callback => requestFrame(time => {
      if (__holdJourneyFrame) heldFrames.push(() => callback(performance.now()));
      else callback(time);
    });
    globalThis.__releaseJourneyFrames = () => {
      __holdJourneyFrame = false; heldFrames.splice(0).forEach(callback => callback());
    };
    globalThis.__journeyEvents = [];
    const seen = new WeakSet();
    const record = state => {
      for (const event of state.events) if (!seen.has(event)) { seen.add(event); __journeyEvents.push({ ...event }); }
    };
    let engine;
    Object.defineProperty(globalThis, 'RunnerEngine', { configurable: true, get: () => engine, set(value) {
      engine = value;
      const create = value.create, step = value.step;
      value.create = (...args) => { const state = create(...args); globalThis.__journeyState = state; return state; };
      value.step = (...args) => { if (!__freezeJourney) { const result = step(...args); record(args[0]); return result; } };
      for (const command of ['jump', 'roar']) {
        const original = value[command];
        value[command] = (...args) => { const result = original(...args); record(args[0]); return result; };
      }
      globalThis.__advanceJourney = seconds => {
        while (seconds > .000001) { const dt = Math.min(.1, seconds); step(__journeyState, dt); record(__journeyState); seconds -= dt; }
      };
    }});
  }, saved);
}
async function open(page, saved) {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await observe(page, saved); await page.goto(url);
  await page.waitForFunction(() => !!globalThis.__journeyState);
  await page.waitForFunction(() => !document.getElementById('start').disabled);
  return errors;
}
async function quiet(page, { rescue = false, companion = false } = {}) {
  await page.evaluate(({ rescue, companion }) => {
    const s = __journeyState;
    s.items = []; s.mobs = []; s.obstacles = [];
    s.spawnIn = s.mobIn = s.obstacleIn = s.festivalIn = s.letterIn = s.rainbowIn = Infinity;
    s.festival = 0; s.shield = s.hurt = 0;
    if (!rescue) { s.rescue = null; s.rescueIn = Infinity; }
    if (!companion) s.companionCooldown = Infinity;
  }, { rescue, companion });
}
async function start(page, options) {
  await page.getByRole('button', { name: 'Vamos correr!', exact: true }).click(); await quiet(page, options);
}
async function stored(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('eric-runner-album-v1')));
}
async function insideViewport(page, selector) {
  const rect = await page.locator(selector).boundingBox(), viewport = page.viewportSize();
  assert.ok(rect && rect.x >= -1 && rect.y >= -1 && rect.x + rect.width <= viewport.width + 1 && rect.y + rect.height <= viewport.height + 1, `${selector} cabe em ${viewport.width}×${viewport.height}`);
}
async function verifyWorlds(page) {
  await start(page);
  assert.equal(await page.locator('#stage').getAttribute('data-world'), 'garden');
  await page.screenshot({ path: path.join(output, 'journey-garden.png'), fullPage: true });
  await page.evaluate(() => __advanceJourney(39.8));
  assert.equal(await page.locator('#stage').getAttribute('data-world'), 'garden', 'o jardim ocupa os primeiros quarenta segundos');
  await page.evaluate(() => __advanceJourney(.3));
  await page.waitForFunction(() => document.getElementById('stage').dataset.world === 'beach');
  assert.equal(await page.evaluate(() => RunnerEngine.world(__journeyState)), 1);
  await page.locator('#journey-banner').waitFor({ state: 'visible' });
  assert.match(await page.locator('#journey-banner').textContent(), /praia/i);
  const time = await page.evaluate(() => __journeyState.time);
  await page.getByRole('button', { name: 'Pausar aventura', exact: true }).click();
  await page.evaluate(() => __advanceJourney(5));
  assert.equal(await page.evaluate(() => __journeyState.time), time, 'a pausa não avança os mundos');
  assert.equal(await page.locator('#journey-banner').isVisible(), false, 'a pausa dá lugar ao diálogo');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.locator('#journey-banner').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Abrir álbum de dinos', exact: true }).click();
  assert.equal(await page.locator('#journey-banner').isVisible(), false, 'o álbum também limpa o anúncio do mundo');
  await page.locator('#album-close').click();
  await page.evaluate(() => __advanceJourney(1.2));
  await page.waitForTimeout(40); // Um quadro completo depois do fim da transição suave.
  await page.screenshot({ path: path.join(output, 'journey-beach.png'), fullPage: true });
  await page.evaluate(() => __advanceJourney(1.9));
  await page.locator('#journey-banner').waitFor({ state: 'hidden' });
  await page.evaluate(() => __advanceJourney(36.9));
  await page.waitForFunction(() => document.getElementById('stage').dataset.world === 'stars');
  assert.equal(await page.evaluate(() => RunnerEngine.world(__journeyState)), 2);
  assert.match(await page.locator('#journey-banner').textContent(), /estrela/i);
  await page.evaluate(() => __advanceJourney(1.2));
  await page.waitForTimeout(40);
  await page.screenshot({ path: path.join(output, 'journey-stars.png'), fullPage: true });
  await page.evaluate(() => { __journeyState.festival = .8; __advanceJourney(.1); });
  await page.locator('#journey-banner').waitFor({ state: 'hidden' });
  await page.evaluate(() => { __advanceJourney(.8); __journeyState.festivalIn = Infinity; __journeyState.items = []; });
  await page.locator('#journey-banner').waitFor({ state: 'visible' });
  await page.evaluate(() => { __journeyState.rescueIn = .1; __advanceJourney(.1); });
  await page.locator('#rescue-banner').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#journey-banner').isVisible(), false, 'o pedido de ajuda tem prioridade sobre o anúncio do mundo');
  await page.keyboard.press('r');
  await page.waitForFunction(() => __journeyState.rescued === 1 && __journeyState.events.length === 0);
  await page.evaluate(() => { __journeyState.rescueIn = Infinity; });
  await page.evaluate(() => __advanceJourney(40));
  await page.waitForFunction(() => document.getElementById('stage').dataset.world === 'garden');
  assert.equal(await page.evaluate(() => RunnerEngine.world(__journeyState)), 0, 'o passeio volta ao jardim depois dos três mundos');
  const worlds = await page.evaluate(() => __journeyEvents.filter(e => e.type === 'world'));
  assert.equal(worlds.length, 3, 'cada mudança de mundo anuncia uma única vez');
}
async function beginRescue(page, world = 0, natural = false) {
  await start(page, { rescue: true });
  await page.evaluate(world => {
    const s = __journeyState; s.health = 16; s.taskIndex = 2; s.taskProgress = 0;
    if (world) { s.rescueIn = Infinity; __advanceJourney(world * 40); s.rescueIn = .1; }
  }, world);
  if (natural) {
    await page.evaluate(() => __advanceJourney(11.8));
    assert.equal(await page.evaluate(() => __journeyState.rescue), null, 'o primeiro resgate aguarda doze segundos');
    await page.evaluate(() => __advanceJourney(.3));
  } else await page.evaluate(() => { if (__journeyState.rescueIn !== .1) __journeyState.rescueIn = .1; __advanceJourney(.2); });
  await page.locator('#rescue-banner').waitFor({ state: 'visible' });
  assert.ok((await page.locator('#rescue-banner').textContent()).trim().length > 4, 'o resgate oferece uma ação para a criança');
  const rescue = await page.evaluate(() => __journeyState.rescue);
  assert.equal(rescue.variant, ['bubble', 'castle', 'balloon'][world]);
  assert.equal(rescue.petId, 'pipo');
  await page.evaluate(() => __advanceJourney(2));
  return rescue;
}
async function verifyRescues(page) {
  await beginRescue(page, 0, true);
  await page.getByRole('button', { name: 'Pausar aventura', exact: true }).click();
  const remaining = await page.evaluate(() => __journeyState.rescue.ttl);
  await page.evaluate(() => __advanceJourney(20));
  assert.equal(await page.evaluate(() => __journeyState.rescue.ttl), remaining, 'a pausa não gasta o tempo para ajudar o amigo');
  assert.equal(await page.locator('#rescue-banner').isVisible(), false, 'a pausa limpa o pedido de ajuda');
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
  await page.locator('#rescue-banner').waitFor({ state: 'visible' });
  await page.evaluate(() => {
    const s = __journeyState;
    s.obstacles.push({ x: s.player.x + 10, width: 46, height: 36, kind: 'block', hit: false });
    s.mobs.push({ type: 'robot', x: s.player.x + 10, lift: 0, height: 48, width: 48, phase: 0, resolved: false, friendly: false, celebrate: 0 });
    __advanceJourney(.1);
  });
  assert.equal(await page.evaluate(() => __journeyState.health), 16, 'um resgate protege a criança dos perigos da pista');
  await page.keyboard.press('x');
  await page.waitForFunction(() => __journeyState.rescued === 1 && __journeyState.events.length === 0);
  assert.equal(await page.evaluate(() => __journeyState.health), 18, 'ajudar devolve dois corações');
  assert.equal(await page.evaluate(() => __journeyState.stars), 1, 'ajudar ganha uma estrela');
  assert.equal(await page.evaluate(() => __journeyState.taskProgress), 1, 'ajudar conta na missão de amigos');
  assert.equal((await stored(page)).rescues, 1);
  await page.locator('#rescue-banner').waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Abrir álbum de dinos', exact: true }).click();
  assert.match(await page.locator('#rescue-total').textContent(), /1/, 'o álbum mostra quantos amigos foram ajudados');
  await page.locator('#album-close').click();
  await page.evaluate(() => {
    const s = __journeyState; s.items = []; s.mobs = []; s.obstacles = []; s.taskIndex = 0; s.taskProgress = 0;
    __advanceJourney(31.8);
  });
  assert.equal(await page.evaluate(() => __journeyState.rescue), null, 'há tempo de corrida livre entre os pedidos');
  await page.evaluate(() => __advanceJourney(.3));
  await page.locator('#rescue-banner').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => __journeyState.rescue.petId), 'lili', 'o próximo pedido pertence a outro amigo');
  assert.equal(await page.evaluate(() => __journeyState.rescue.variant), 'castle');
  await page.evaluate(() => __advanceJourney(3));
  assert.ok(await page.evaluate(() => __journeyState.rescue.x - __journeyState.player.x <= 400), 'o amigo chega ao alcance do salto');
  await page.keyboard.press('z');
  await page.waitForFunction(() => __journeyState.rescued === 2 && __journeyState.events.length === 0);
  assert.equal((await stored(page)).rescues, 2);
  assert.equal(await page.evaluate(() => __journeyEvents.filter(e => e.type === 'rescue-success' && e.reason === 'jump').length), 1, 'um salto válido resgata o amigo do castelo');
}
async function verifyHelperAndParty(page) {
  await start(page, { rescue: true });
  await page.evaluate(() => { const s = __journeyState; s.health = 16; s.festival = 2; s.rescueIn = .1; });
  await page.evaluate(() => __advanceJourney(1));
  assert.equal(await page.evaluate(() => __journeyState.rescue), null, 'não aparece um pedido novo durante uma festa');
  await page.evaluate(() => __advanceJourney(1.2));
  await page.locator('#rescue-banner').waitFor({ state: 'visible' });
  await page.evaluate(() => __advanceJourney(5.6));
  assert.ok(await page.evaluate(() => Math.abs(__journeyState.rescue.x - __journeyState.player.x - 120) < .001), 'o amigo espera à frente do herói');
  await page.evaluate(() => __advanceJourney(.5));
  await page.waitForFunction(() => __journeyState.rescued === 1 && __journeyState.events.length === 0);
  assert.equal(await page.evaluate(() => __journeyEvents.filter(e => e.type === 'rescue-success' && e.reason === 'helper').length), 1, 'o amigo recebe ajuda mesmo sem um comando');
  assert.equal((await stored(page)).rescues, 1);
  await page.evaluate(() => {
    const s = __journeyState;
    for (const kind of ['ball', 'treasure', 'ball']) {
      s.taskIndex = kind === 'ball' ? 0 : 3; s.taskProgress = 0;
      for (let i = 0; i < (kind === 'ball' ? 2 : 3); i++) RunnerEngine.collect(s, kind === 'ball' ? 'ball' : 'coin');
    }
  });
  await page.locator('#hatch-screen').waitFor({ state: 'visible' });
  assert.ok((await page.locator('#hatch-help').textContent()).trim().length > 8, 'o nascimento explica como o filhote pode ajudar');
  await page.locator('#hatch-continue').click();
}
async function verifyStarRescue(page) {
  await beginRescue(page, 2);
  await page.keyboard.press('z');
  await page.waitForFunction(() => __journeyState.rescued === 1 && __journeyState.events.length === 0);
  assert.equal(await page.evaluate(() => __journeyEvents.filter(e => e.type === 'rescue-success' && e.variant === 'balloon' && e.reason === 'jump').length), 1, 'o salto resgata o amigo do balão nas estrelas');
  assert.equal((await stored(page)).rescues, 1);
}
async function verifyRescueSave(browser, hook) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    const page = await context.newPage(); await open(page); await beginRescue(page);
    await page.evaluate(() => { __holdJourneyFrame = true; });
    await page.keyboard.press('x');
    if (hook === 'manual') await page.getByRole('button', { name: 'Pausar aventura', exact: true }).click();
    else await page.evaluate(hook => {
      if (hook === 'visibility') {
        Object.defineProperty(document, 'hidden', { configurable: true, value: true });
        document.dispatchEvent(new Event('visibilitychange')); delete document.hidden;
      } else dispatchEvent(hook === 'pagehide' ? new PageTransitionEvent('pagehide') : new Event('blur'));
    }, hook);
    assert.equal((await stored(page)).rescues, 1, `${hook}: a ajuda fica guardada antes do próximo desenho`);
    await page.evaluate(() => __releaseJourneyFrames());
    if (await page.locator('#pause-screen').isVisible()) await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.waitForFunction(() => __journeyState.events.length === 0);
    assert.equal((await stored(page)).rescues, 1, `${hook}: o desenho não conta a ajuda duas vezes`);
    await page.reload(); await page.waitForFunction(() => !!globalThis.__journeyState);
    assert.equal((await stored(page)).rescues, 1, `${hook}: a ajuda sobrevive ao recarregamento`);
  } finally { await context.close(); }
}
async function selectPet(page, id, name) {
  await page.getByRole('button', { name: 'Abrir álbum de dinos', exact: true }).click();
  await page.getByRole('button', { name: 'Brincar com ' + name, exact: true }).click();
  assert.ok((await page.locator('#companion-help').textContent()).trim().length > 8, 'o álbum explica o poder escolhido');
  await page.locator('#album-close').click();
  assert.equal(await page.evaluate(() => __journeyState.companionId), id, 'a escolha visível também configura a ajuda na pista');
}
async function verifyCompanions(page) {
  await start(page, { companion: true });
  for (const [id, name] of PETS) {
    await selectPet(page, id, name); await quiet(page, { companion: true });
    await page.evaluate(id => {
      const s = __journeyState; s.companionCooldown = id === 'pipo' ? 12 : .1;
      s.companionEffect = 0; s.companionAction = ''; s.taskIndex = 4; s.taskProgress = 0;
      s.roarWave = 0; s.player.lift = s.player.vy = 0; s.health = id === 'nino' ? 16 : 20;
      if (id === 'pipo') s.mobs.push({ type: 'robot', x: s.player.x + 2800, lift: 0, height: 48, width: 48, phase: 0, resolved: false, friendly: false, celebrate: 0 });
      if (id === 'tico') s.items.push({ type: 'coin', x: s.player.x + 180, lift: 94, radius: 25, kicked: false, phase: 0 });
      if (id === 'bubi') s.obstacles.push({ x: s.player.x + 180, width: 46, height: 36, kind: 'block', hit: false });
      if (id === 'zazu') s.items.push({ type: 'ball', x: s.player.x + 180, lift: 21, radius: 23, kicked: false, phase: 0 });
      globalThis.__petTarget = id === 'pipo' ? s.mobs[0] : id === 'bubi' ? s.obstacles[0] : s.items[0];
      globalThis.__petTreasureBefore = s.treasures; globalThis.__petGoalsBefore = s.goals;
    }, id);
    if (id === 'pipo') {
      // A espera acontece em tempo de jogo; aproxima o inimigo apenas no final.
      await page.evaluate(() => __advanceJourney(11.8));
      assert.equal(await page.evaluate(() => __journeyState.companionEffect), 0, 'o companheiro espera doze segundos entre ajudas');
      await page.evaluate(() => { __petTarget.x = __journeyState.player.x + 180; });
    }
    await page.evaluate(() => __advanceJourney(.3));
    await page.waitForFunction(() => __journeyState.events.length === 0);
    const action = await page.evaluate(() => __journeyState.companionAction);
    assert.equal(action, { pipo: 'roar', lili: 'shield', tico: 'treasure', bubi: 'clear', nino: 'heal', zazu: 'kick' }[id]);
    assert.ok(await page.evaluate(() => __journeyState.companionEffect > 0 && __journeyState.companionCooldown > 11), `${name} mostra a ajuda e volta a esperar`);
    if (id === 'pipo') assert.equal(await page.evaluate(() => __petTarget.fleeing), true, 'Pipo afugenta um travesso');
    if (id === 'lili') assert.ok(await page.evaluate(() => __journeyState.shield >= 1.7), 'Lili oferece proteção');
    if (id === 'tico') assert.equal(await page.evaluate(() => __journeyState.treasures - __petTreasureBefore), 1, 'Tico encontra um tesouro real');
    if (id === 'bubi') assert.equal(await page.evaluate(() => __petTarget.cleared || __petTarget.hit), true, 'Bubi abre o caminho');
    if (id === 'nino') assert.equal(await page.evaluate(() => __journeyState.health), 17, 'Nino recupera um coração');
    if (id === 'zazu') assert.equal(await page.evaluate(() => __journeyState.goals - __petGoalsBefore), 1, 'Zazu chuta uma bola real');
    if (id === 'tico') {
      await page.getByRole('button', { name: 'Pausar aventura', exact: true }).click();
      const remaining = await page.evaluate(() => __journeyState.companionCooldown);
      await page.evaluate(() => __advanceJourney(20));
      assert.equal(await page.evaluate(() => __journeyState.companionCooldown), remaining, 'a pausa não dispara poderes');
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    }
  }
  await selectPet(page, 'nino', 'Nino'); await quiet(page, { companion: true });
  await page.evaluate(() => { __journeyState.health = 20; __journeyState.companionCooldown = .1; __advanceJourney(.2); });
  assert.equal(await page.evaluate(() => __journeyState.companionAction), 'coin', 'Nino oferece tesouro quando os corações já estão cheios');
  await selectPet(page, 'zazu', 'Zazu'); await quiet(page, { companion: true });
  await page.evaluate(() => { __journeyState.companionCooldown = .1; __advanceJourney(.2); });
  assert.equal(await page.evaluate(() => __journeyState.companionAction), 'ball', 'Zazu traz uma bola quando não há uma para chutar');
  await page.getByRole('button', { name: 'Abrir álbum de dinos', exact: true }).click();
  await page.getByRole('button', { name: 'Sem companheiro', exact: true }).click();
  await page.locator('#album-close').click();
  assert.equal(await page.evaluate(() => __journeyState.companionId), null);
  await page.evaluate(() => __advanceJourney(15));
  assert.equal(await page.evaluate(() => __journeyState.companionEffect), 0, 'brincar sem companheiro desativa a ajuda');
  await selectPet(page, 'lili', 'Lili');
  await page.reload(); await page.waitForFunction(() => !!globalThis.__journeyState);
  assert.equal(await page.evaluate(() => __journeyState.companionId), 'lili', 'recarregar mantém o companheiro e seu poder');
  await start(page, { companion: true });
  await page.evaluate(() => { __journeyState.health = 0; __journeyState.ended = true; });
  await page.locator('#end-screen').waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Vamos de novo!', exact: true }).click();
  assert.equal(await page.evaluate(() => __journeyState.companionId), 'lili', 'reiniciar mantém o companheiro e seu poder');
}
async function verifyMobile(page, width, world) {
  await open(page);
  await beginRescue(page, world);
  await page.screenshot({ path: path.join(output, `rescue-mobile-${width}.png`), fullPage: true });
  for (const id of ['jump', 'roar', 'pause', 'album', 'rescue-banner']) await insideViewport(page, `#${id}`);
  if (world) {
    await page.evaluate(() => __advanceJourney(1));
    await page.locator('#jump').tap();
  } else await page.locator('#roar').tap();
  await page.waitForFunction(() => __journeyState.rescued === 1 && __journeyState.events.length === 0);
  assert.equal((await stored(page)).rescues, 1, 'o toque do celular realiza e guarda o resgate');
  if (world && await page.locator('#journey-banner').isVisible()) await insideViewport(page, '#journey-banner');
  await page.getByRole('button', { name: 'Pausar aventura', exact: true }).tap();
  await page.getByRole('button', { name: 'Voltar ao início', exact: true }).tap();
  await page.getByRole('button', { name: 'Escolher Daniel', exact: true }).tap();
  await page.getByRole('button', { name: 'Vamos correr!', exact: true }).tap();
  assert.equal((await stored(page)).rescues, 1, 'trocar de herói no celular mantém os amigos ajudados');
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [check, saved] of [[verifyWorlds, {}], [verifyRescues, {}], [verifyHelperAndParty, {}], [verifyStarRescue, {}], [verifyCompanions, FAMILY]]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await context.newPage(); const errors = await open(page, saved);
      const missing = [];
      for (const id of ['journey-banner', 'rescue-banner']) if (await page.locator(`#${id}`).count() !== 1) missing.push(id);
      assert.deepEqual(missing, [], 'mundos e resgates possuem pistas visuais na aventura');
      await check(page); assert.deepEqual(errors, [], 'sem erros no navegador'); await context.close();
    }
    for (const hook of ['blur', 'visibility', 'pagehide', 'manual']) await verifyRescueSave(browser, hook);
    for (const [width, height, world] of [[667, 320, 0], [844, 390, 1]]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true });
      const page = await context.newPage(); await verifyMobile(page, width, world); await context.close();
    }
    console.log('PASS jornada: três mundos, resgates com teclas/toque/ajuda, salvamento imediato e seis poderes de companheiros.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
