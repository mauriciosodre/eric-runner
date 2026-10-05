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
  s.spawnIn = s.obstacleIn = s.mobIn = s.festivalIn = s.rescueIn = Infinity;
  return s;
}
function advance(s, seconds) {
  while (seconds > .000001) {
    const dt = Math.min(.05, seconds); Engine.step(s, dt); seconds -= dt;
  }
}
function letter(s, value, offset = 0) {
  return {type:'letter', letter:value, x:s.player.x+offset, lift:94, radius:30, phase:0};
}
function spell(s, text) {
  assert.equal(typeof Engine.collectLetter, 'function', 'a coleta de letras precisa existir');
  for (const value of text) assert.equal(Engine.collectLetter(s, value), true);
}

// Catches advancing a word from a wrong glyph or from the generic item handler.
test('só a próxima letra avança a palavra e coletas genéricas não inventam letras', () => {
  const s = game();
  assert.equal(typeof Engine.collectLetter, 'function', 'a coleta de letras precisa existir');
  assert.equal(Engine.collectLetter(s, 'X'), false);
  assert.equal(s.wordProgress, 0);
  Engine.collect(s, 'letter');
  assert.equal(s.wordProgress, 0);
  assert.equal(Engine.collectLetter(s, 'D'), true);
  assert.equal(s.wordProgress, 1);
  assert.equal(Engine.collectLetter(s, 'D'), false);
  assert.equal(Engine.collectLetter(s, undefined), false);
  assert.equal(s.wordProgress, 1);
  const e = s.events.find(e => e.type === 'letter');
  assert.equal(e.text, 'D'); assert.equal(e.word, 'DINO'); assert.equal(e.progress, 1);
});

// Catches repeated characters being counted globally rather than in word order.
test('palavras completam na ordem, incluindo as duas letras O de OVO', () => {
  const s = game();
  spell(s, 'DINO'); spell(s, 'BOLA');
  assert.equal(typeof Engine.word, 'function');
  assert.equal(Engine.word(s).text, 'OVO');
  spell(s, 'O');
  assert.equal(Engine.collectLetter(s, 'O'), false);
  assert.equal(s.wordProgress, 1);
  spell(s, 'VO'); spell(s, 'GOL'); spell(s, 'AMIGO');
  assert.equal(s.wordsCompleted, 5); assert.equal(s.wordProgress, 0);
  assert.equal(Engine.word(s).text, 'DINO');
  assert.deepEqual(Array.from(s.events.filter(e => e.type === 'word'), e => [e.word,e.icon]),
    [['DINO','dino'],['BOLA','ball'],['OVO','egg'],['GOL','goal'],['AMIGO','heart']]);
});

// Catches repeated rewards, uncapped healing, or accidental mission/egg rewards.
test('uma palavra concede uma estrela e um coração uma vez e respeita o limite de vida', () => {
  const s = game(); s.health = 18;
  const baseScore = Engine.score(s);
  spell(s, 'DINO');
  assert.equal(s.stars, 1); assert.equal(s.health, 19);
  assert.equal(Engine.score(s), baseScore+100);
  assert.equal(s.eggProgress, 0); assert.equal(s.taskProgress, 0);
  assert.equal(s.wordCelebrate, 3);
  const e = s.events.find(e => e.type === 'word');
  assert.equal(e.text, 'DINO'); assert.equal(e.count, 1);
  assert.equal(Engine.collectLetter(s, 'O'), false);
  assert.equal(s.stars, 1); assert.equal(s.health, 19);
  s.health = 20; spell(s, 'BOLA');
  assert.equal(s.health, 20); assert.equal(s.stars, 2);
  advance(s, 3.1); assert.equal(s.wordCelebrate, 0);
});

// Catches counting the same last glyph twice when two items overlap in one frame.
test('letras sobrepostas usam a coleta real e uma duplicata não completa duas palavras', () => {
  const s = game(); spell(s, 'DIN');
  const first = letter(s, 'O'), duplicate = letter(s, 'O');
  s.items.push(first, duplicate); Engine.step(s, .016);
  assert.equal(first.collected, true); assert.equal(duplicate.collected, true);
  assert.equal(s.wordsCompleted, 1); assert.equal(s.wordProgress, 0); assert.equal(s.stars, 1);
  assert.equal(s.events.filter(e => e.type === 'word').length, 1);
  Engine.step(s, .016); assert.equal(s.wordsCompleted, 1);
});

// Catches spawning wrong choices, inaccessible height, or a queue of letters.
test('nasce somente a letra esperada ao alcance do chão e nunca há uma fila de letras', () => {
  const s = game();
  advance(s, 4.9); assert.equal(s.items.filter(i => i.type === 'letter').length, 0);
  advance(s, .2);
  const pending = s.items.filter(i => i.type === 'letter');
  assert.equal(pending.length, 1); assert.equal(pending[0].letter, 'D');
  assert.ok(pending[0].x > s.player.x+100);
  assert.ok(Math.abs(pending[0].lift-88) < 90+pending[0].radius, 'quem fica no chão consegue coletar');
  pending[0].x = s.width+100;
  s.speed = 0; s.slow = 1000;
  // Keeping the item ahead during updates exercises the one-letter limit.
  for (let i = 0; i < 160; i++) {
    pending[0].x = s.width+100; Engine.step(s, .05);
  }
  assert.equal(s.items.filter(i => i.type === 'letter').length, 1);
  pending[0].x = s.player.x; Engine.step(s, .016);
  assert.equal(s.wordProgress, 1);
});

// Catches treating an offscreen miss as lost progress or advancing to another glyph.
test('uma letra perdida volta depois e a palavra mantém as letras já coletadas', () => {
  const s = game(); spell(s, 'D'); s.letterIn = 0;
  Engine.step(s, .01);
  const pending = s.items.find(i => i.type === 'letter');
  assert.ok(pending); assert.equal(pending.letter, 'I');
  pending.x = -100; Engine.step(s, .01);
  assert.equal(s.items.filter(i => i.type === 'letter').length, 0);
  assert.equal(s.wordProgress, 1);
  advance(s, 6.1);
  assert.equal(s.items.filter(i => i.type === 'letter').length, 1);
  assert.equal(s.items.find(i => i.type === 'letter').letter, 'I');
  assert.equal(s.wordProgress, 1);
});

// Catches letters spawning behind a mobile player or outside the world's item bounds.
test('uma tela estreita ainda cria uma letra adiante e dentro dos limites do mundo', () => {
  const s = game(); s.width = 160; s.player.x = 114; s.letterIn = 0;
  Engine.step(s, .01);
  const pending = s.items.find(i => i.type === 'letter');
  assert.ok(pending); assert.ok(pending.x >= s.player.x+140);
  assert.ok(pending.x < s.width+400); assert.equal(pending.letter, 'D');
  advance(s, 2); assert.equal(s.wordProgress, 1);
});

// Catches advancing letters/timers in pause/menu/end or preserving an old word on restart.
test('pausa, menu e fim congelam letras; uma nova corrida recomeça a primeira palavra', () => {
  for (const flag of ['paused','ended','running']) {
    const s = game(); spell(s, 'DINO'); spell(s, 'B');
    s.items.push(letter(s, 'O')); s.letterIn = 2; s.wordCelebrate = 2;
    s[flag] = flag !== 'running';
    advance(s, 3);
    assert.equal(s.wordProgress, 1); assert.equal(s.wordsCompleted, 1);
    assert.equal(s.letterIn, 2); assert.equal(s.wordCelebrate, 2);
    assert.equal(Engine.collectLetter(s, 'O'), false);
    Engine.restart(s);
    assert.equal(Engine.word(s).text, 'DINO'); assert.equal(s.wordProgress, 0);
    assert.equal(s.wordsCompleted, 0); assert.equal(s.wordCelebrate, 0);
    assert.equal(s.items.length, 0); assert.equal(s.events.length, 0);
  }
});

// Catches new letters cluttering special scenes or existing letters becoming uncollectable.
test('resgate e festa suspendem novas letras mas permitem coletar a letra que já está na pista', () => {
  for (const scene of ['festival','rescue']) {
    const s = game(); s.letterIn = 0;
    if (scene === 'festival') s.festival = 8;
    else s.rescue = {x:s.player.x+200, ttl:8, petId:'pipo', variant:'bubble'};
    advance(s, 1);
    assert.equal(s.items.filter(i => i.type === 'letter').length, 0);
    s.items.push(letter(s, 'D')); Engine.step(s, .01);
    assert.equal(s.wordProgress, 1);
    assert.equal(s.events.filter(e => e.type === 'letter').length, 1);
  }
});

// Catches the wind going through the generic handler and losing the glyph metadata.
test('o sopro traz a próxima letra e a fila de eventos continua limitada', () => {
  const s = game(); s.characterId = 'daniel';
  s.items.push(letter(s, 'D', 300)); Engine.roar(s); advance(s, .8);
  assert.equal(s.wordProgress, 1);
  for (let i = 0; i < 10; i++) {
    spell(s, 'INOBOLAOVOGOLAMIGOD');
  }
  assert.ok(s.events.length <= 32);
  assert.ok(s.wordsCompleted > 40);
});
