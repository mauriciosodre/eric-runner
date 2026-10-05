const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sandbox = {};
vm.runInNewContext(html.match(/<script id="game-engine">([\s\S]*?)<\/script>/)[1], sandbox);
const Engine = sandbox.RunnerEngine;
function game() {
  const s = Engine.create(); s.running = true;
  s.spawnIn = s.obstacleIn = s.mobIn = s.festivalIn = s.rescueIn = s.letterIn = Infinity;
  return s;
}
function advance(s, seconds) {
  while (seconds > .000001) {
    const dt = Math.min(.05, seconds); Engine.step(s, dt); seconds -= dt;
  }
}
function begin(s = game()) {
  s.rainbowIn = 0; Engine.step(s, .01);
  assert.ok(s.rainbow > 11.9, 'o arco-íris precisa começar');
  return s;
}
function color(s, id, offset = 0, lift = 94) {
  return {type:'colorStar',color:id,x:s.player.x+offset,lift,radius:30,phase:0};
}

// Catches using elapsed world time instead of quiet, active time for the event.
test('a primeira trilha espera trinta e cinco segundos calmos, dura doze e a próxima espera cinquenta', () => {
  const s = game(); advance(s, 34.9);
  assert.equal(s.rainbow, 0);
  advance(s, .2);
  assert.ok(s.rainbow > 11.8 && s.rainbow <= 12);
  assert.equal(s.events.filter(e => e.type === 'rainbow-start').length, 1);
  assert.equal(typeof Engine.rainbow, 'function');
  const info = Engine.rainbow(s);
  assert.equal(info.active, true); assert.equal(info.collected, 0); assert.equal(info.target, 3);
  advance(s, 12.1);
  assert.equal(s.rainbow, 0); assert.ok(s.rainbowIn > 49.7);
  assert.equal(s.events.filter(e => e.type === 'rainbow-end').length, 1);
  assert.equal(s.items.some(i => i.type === 'colorStar'), false, 'estrelas da cena terminada não ficam na pista');
});

// Catches starting over an existing festival/rescue or spending the quiet timer there.
test('festas e resgates adiam a chegada sem gastar a espera do arco-íris', () => {
  for (const scene of ['festival','rescue']) {
    const s = game(); s.rainbowIn = .5;
    if (scene === 'festival') s.festival = 5;
    else s.rescue = {x:s.player.x+200,ttl:8,petId:'pipo',variant:'bubble'};
    advance(s, 1);
    assert.equal(s.rainbowIn, .5); assert.equal(s.rainbow, 0);
    s.festival = 0; s.rescue = null;
    advance(s, .6); assert.ok(s.rainbow > 0);
  }
});

// Catches counting duplicate colors, enforcing a reading-dependent order, or granting twice.
test('três cores em qualquer ordem dão uma única estrela e um coração', () => {
  const s = begin(); s.health = 18;
  assert.equal(typeof Engine.collectColor, 'function');
  assert.equal(Engine.collectColor(s, 'yellow'), true);
  assert.equal(Engine.collectColor(s, 'yellow'), true);
  assert.equal(Engine.rainbow(s).collected, 1); assert.equal(s.stars, 0);
  assert.equal(Engine.collectColor(s, 'purple'), false);
  Engine.collect(s, 'colorStar'); assert.equal(Engine.rainbow(s).collected, 1);
  Engine.collectColor(s, 'red'); Engine.collectColor(s, 'blue');
  assert.equal(Engine.rainbow(s).collected, 3); assert.equal(Engine.rainbow(s).complete, true);
  assert.equal(s.rainbowLastColor, 'blue'); assert.equal(s.rainbowMask, 7);
  assert.equal(s.stars, 1); assert.equal(s.health, 19); assert.equal(s.rainbowCompleted, 1);
  assert.equal(s.rainbowCelebrate, 3);
  assert.equal(s.eggProgress, 0); assert.equal(s.taskProgress, 0);
  Engine.collectColor(s, 'red'); Engine.collectColor(s, 'blue'); Engine.collectColor(s, 'yellow');
  assert.equal(s.stars, 1); assert.equal(s.health, 19);
  assert.equal(s.events.filter(e => e.type === 'rainbow-success').length, 1);
  assert.equal(s.events.find(e => e.type === 'rainbow-success').count, 1);
  const colors = s.events.filter(e => e.type === 'rainbow-color');
  assert.equal(colors[0].unique, true); assert.equal(colors[1].unique, false);
});

// Catches healing past 20 or keeping completed color bits for the next event.
test('a recompensa respeita vinte corações e uma nova trilha começa sem cores', () => {
  const s = begin();
  for (const id of ['red','blue','yellow']) Engine.collectColor(s, id);
  assert.equal(s.health, 20); assert.equal(s.stars, 1);
  advance(s, 12.1); begin(s);
  assert.equal(s.rainbowMask, 0); assert.equal(s.rainbowLastColor, null);
  assert.equal(s.rainbowCompleted, 1); assert.equal(s.rainbowCelebrate, 0);
  for (const id of ['blue','red','yellow']) Engine.collectColor(s, id);
  assert.equal(s.rainbowCompleted, 2); assert.equal(s.stars, 2);
});

// Catches punishing incomplete play or leaving a damaging scene after the timer.
test('terminar com uma só cor conserva vida e pontos e convida a continuar brincando', () => {
  const s = begin(); s.health = 17; Engine.collectColor(s, 'red');
  s.rainbowSpawnIn = Infinity; s.items = [];
  const score = Engine.score(s); advance(s, 12.1);
  assert.equal(s.health, 17); assert.equal(s.stars, 0); assert.equal(s.rainbowCompleted, 0);
  assert.ok(Engine.score(s) >= score);
  const end = s.events.find(e => e.type === 'rainbow-end');
  assert.equal(end.complete, false); assert.equal(end.collected, 1);
  assert.equal(end.text, 'SIGA BRINCANDO!');
  assert.equal(Engine.collectColor(s, 'blue'), false);
});

// Catches dangerous leftovers, new hazard spawning, or other surprise timers colliding.
test('a trilha retira perigos, mantém amigos e suspende novas cenas e obstáculos', () => {
  const s = game();
  s.obstacles.push({x:s.player.x,width:62,height:52,hit:false,kind:'block'});
  for (const type of ['rabbit','robot','parrot']) s.mobs.push({type,x:s.width,lift:0,width:48,height:48,phase:0,resolved:false});
  begin(s);
  assert.equal(s.obstacles.length, 0);
  assert.deepEqual(Array.from(s.mobs, m => m.type), ['rabbit','parrot']);
  s.spawnIn = s.obstacleIn = s.mobIn = s.rescueIn = s.festivalIn = s.letterIn = 0;
  const before = s.items.length; advance(s, 1);
  assert.equal(s.festival, 0); assert.equal(s.rescue, null);
  assert.equal(s.obstacles.length, 0); assert.equal(s.mobs.some(Engine.isEnemy), false);
  assert.equal(s.items.some(i => i.type === 'letter'), false);
  assert.ok(s.items.length > before, 'as estrelas continuam nascendo');
  s.obstacles.push({x:s.player.x,width:62,height:52,hit:false,kind:'block'});
  s.mobs.push({type:'robot',x:s.player.x,lift:0,width:48,height:48,phase:0,resolved:false});
  Engine.step(s, .01); assert.equal(s.health, 20, 'mesmo uma colisão injetada não machuca na trilha');
});

// Catches losing glyph metadata when using the shared generous item collision.
test('colisões e sopro recolhem as cores uma vez e mantêm letras existentes', () => {
  const s = begin(); s.characterId = 'daniel'; s.items = [];
  const red = color(s, 'red'), blue = color(s, 'blue', 300);
  s.items.push(red, color(s, 'red'), blue, {type:'letter',letter:'D',x:s.player.x,lift:94,radius:30,phase:0});
  Engine.roar(s); advance(s, .8);
  assert.equal(red.collected, true); assert.equal(blue.collected, true);
  assert.equal(Engine.rainbow(s).collected, 2); assert.equal(s.stars, 0);
  assert.equal(s.wordProgress, 1, 'uma letra que já estava na pista continua valendo');
  Engine.step(s, .01); assert.equal(Engine.rainbow(s).collected, 2);
});

// Catches treasure helpers treating color stars as coins or double-rewarding them.
test('companheiros de tesouro ignoram estrelas coloridas e suas cópias sobrepostas', () => {
  const s = begin(); s.items = [];
  Engine.setCompanion(s, 'tico'); s.companionCooldown = 0;
  const red = color(s, 'red', 220); s.items.push(red);
  Engine.step(s, .01);
  assert.equal(red.collected, undefined); assert.equal(s.treasures, 0);
  assert.equal(s.companionCooldown, 0); assert.equal(s.rainbowMask, 0);
  s.items.push(color(s, 'blue'),color(s, 'yellow'),color(s, 'yellow')); red.x = s.player.x;
  Engine.step(s, .01);
  assert.equal(s.rainbowCompleted, 1); assert.equal(s.stars, 1); assert.equal(s.treasures, 0);
});

// Catches an inaccessible one-color trail, runaway item queues, or desktop-only spawning.
test('todas as cores passam pelo chão e pelo pulo e cabem em uma tela estreita', () => {
  const s = game(); s.width = 160; s.player.x = 114; begin(s);
  const seen = new Set();
  for (let i = 0; i < 7; i++) {
    const stars = s.items.filter(item => item.type === 'colorStar');
    assert.ok(stars.length <= 10);
    for (const item of stars) {
      assert.ok(item.x > s.player.x+100 && item.x < s.width+400);
      assert.ok(item.radius >= 30);
      seen.add(`${item.color}:${item.lift > 200 ? 'jump' : 'floor'}`);
    }
    s.items = []; advance(s, .81);
  }
  assert.deepEqual([...seen].sort(), ['blue:floor','blue:jump','red:floor','red:jump','yellow:floor','yellow:jump']);
  const floor = color(s, 'red', 0, 94), high = color(s, 'blue', 0, 220);
  s.items = [floor, high]; Engine.step(s, .01);
  assert.equal(floor.collected, true); assert.equal(high.collected, undefined);
  assert.equal(Engine.jump(s), true); advance(s, .15);
  assert.equal(high.collected, true, 'o botão de pulo existente alcança a estrela alta');
});

// Catches boosted travel skipping every reachable color, especially on narrow screens.
test('ficar no chão durante o turbo ainda permite descobrir as três cores', () => {
  for (const width of [160,1120]) {
    const s = game(); s.width = width; s.player.x = Math.max(114,width*.22);
    s.boost = 20; s.speed = 363; begin(s); advance(s,11.8);
    assert.equal(s.rainbowCompleted,1); assert.equal(s.rainbowMask,7);
    assert.equal(s.stars,1); assert.equal(s.health,20);
  }
});

// Catches spending time, spawning, or collecting behind a pause/menu/result screen.
test('menu, pausa e fim congelam a espera, trilha, coleta e comemoração', () => {
  for (const flag of ['paused','ended','running']) {
    const waiting = game(); waiting.rainbowIn = 7; waiting[flag] = flag !== 'running';
    advance(waiting, 2); assert.equal(waiting.rainbowIn, 7); assert.equal(waiting.rainbow, 0);
    const s = begin(); s.rainbowCelebrate = 2; s.items = [color(s,'red')];
    const remaining = s.rainbow, spawn = s.rainbowSpawnIn;
    s[flag] = flag !== 'running'; advance(s, 3);
    assert.equal(s.rainbow, remaining); assert.equal(s.rainbowSpawnIn, spawn);
    assert.equal(s.rainbowCelebrate, 2); assert.equal(s.rainbowMask, 0);
    assert.equal(Engine.collectColor(s,'red'), false);
  }
});

// Catches reviving a previous event or losing album/hero preferences on restart.
test('reiniciar limpa cores e recompensas da corrida mas conserva herói, ovo e companheiro', () => {
  const s = begin(); s.characterId = 'samuel'; Engine.setCompanion(s,'kiko'); s.eggProgress = 2;
  for (const id of ['red','blue','yellow']) Engine.collectColor(s,id);
  s.paused = true; Engine.restart(s);
  assert.equal(s.rainbow, 0); assert.equal(s.rainbowIn, 35); assert.equal(s.rainbowMask, 0);
  assert.equal(s.rainbowCompleted, 0); assert.equal(s.rainbowLastColor, null); assert.equal(s.rainbowCelebrate, 0);
  assert.equal(s.items.length, 0); assert.equal(s.events.length, 0);
  assert.equal(s.characterId,'samuel'); assert.equal(s.eggProgress,2); assert.equal(s.companionId,'kiko');
});

// Catches an event becoming permanent invulnerability or accumulating unbounded objects.
test('depois da trilha o dano volta e muitas brincadeiras mantêm memória limitada', () => {
  const s = begin(); s.health = 20; advance(s, 12.1);
  s.obstacles.push({x:s.player.x,width:62,height:52,hit:false,kind:'block'}); Engine.step(s,.01);
  assert.equal(s.health,19);
  s.hurt = 0;
  for (let i = 0; i < 30; i++) {
    begin(s); advance(s,12.1);
    assert.ok(s.items.length <= 10); assert.ok(s.events.length <= 32);
  }
});
