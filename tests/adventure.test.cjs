const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Estes testes exercitam o mesmo motor que o Canvas utiliza.
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sandbox = {};
vm.runInNewContext(html.match(/<script id="game-engine">([\s\S]*?)<\/script>/)[1], sandbox);
const Engine = sandbox.RunnerEngine;

function game() {
  const state = Engine.create();
  state.running = true;
  state.spawnIn = state.obstacleIn = state.mobIn = Infinity;
  return state;
}
function advance(state, seconds) {
  while (seconds > 0.000001) {
    const dt = Math.min(.05, seconds);
    Engine.step(state, dt);
    seconds -= dt;
  }
}
function completeFirstThreeMissions(state) {
  Engine.collect(state, 'ball');
  Engine.collect(state, 'ball');
  for (let i = 0; i < 2; i++) {
    assert.equal(Engine.jump(state), true);
    advance(state, 1);
  }
  for (let i = 0; i < 2; i++) {
    state.mobs.push({type:'rabbit', x:state.player.x, lift:0, height:48, width:48, phase:0, resolved:false});
    Engine.step(state, .01);
  }
}

test('cada missão abre uma rachadura e a terceira faz nascer exatamente um filhote', () => {
  const state = game();
  assert.equal(state.eggProgress, 0);
  Engine.collect(state, 'ball');
  assert.equal(state.eggProgress, 0, 'uma ação isolada ainda não completa a missão');
  Engine.collect(state, 'ball');
  assert.equal(state.eggProgress, 1);
  assert.equal(state.events.filter(e => e.type === 'egg').length, 1);
  assert.equal(state.events.find(e => e.type === 'egg').progress, 1);
  assert.equal(state.stars, 1, 'a recompensa existente continua valendo');
  Engine.jump(state); advance(state, 1);
  Engine.jump(state); advance(state, 1);
  assert.equal(state.eggProgress, 2);
  assert.equal(state.events.filter(e => e.type === 'egg').at(-1).progress, 2);
  for (let i = 0; i < 2; i++) {
    state.mobs.push({type:'rabbit', x:state.player.x, lift:0, height:48, width:48, phase:0, resolved:false});
    Engine.step(state, .01);
  }
  assert.equal(state.eggProgress, 0);
  assert.equal(state.stars, 3);
  assert.equal(state.events.filter(e => e.type === 'hatch').length, 1);
  advance(state, 3);
  assert.equal(state.events.filter(e => e.type === 'hatch').length, 1, 'a animação não concede outro filhote');
});

test('reiniciar guarda o ovo e o herói, mas começa uma corrida e uma festa novas', () => {
  const state = game();
  Engine.collect(state, 'ball'); Engine.collect(state, 'ball');
  state.characterId = 'samuel'; state.width = 900; state.player.x = 210;
  state.health = 1; state.paused = true; state.ended = true;
  state.festival = 5; state.festivalKind = 'volcano'; state.festivalCount = 9;
  Engine.restart(state);
  assert.equal(state.eggProgress, 1);
  assert.equal(state.characterId, 'samuel');
  assert.equal(state.width, 900); assert.equal(state.player.x, 210);
  assert.equal(state.health, 20); assert.equal(state.paused, false); assert.equal(state.ended, false);
  assert.equal(state.goals, 0); assert.equal(state.taskProgress, 0);
  assert.equal(state.festival, 0); assert.equal(state.festivalIn, 20); assert.equal(state.festivalCount, 0);
  assert.equal(state.events.length, 0);
});

test('a festa aparece aos vinte segundos, dura dez e alterna depois de trinta segundos de calma', () => {
  const state = game();
  advance(state, 19.95);
  assert.equal(state.festival, 0);
  advance(state, .1);
  assert.ok(state.festival > 9.8 && state.festival <= 10);
  assert.equal(state.festivalKind, 'balls');
  assert.equal(state.festivalCount, 1);
  assert.equal(state.events.find(e => e.type === 'festival').kind, 'balls');
  advance(state, 10.1);
  assert.equal(state.festival, 0);
  assert.ok(state.festivalIn <= 30 && state.festivalIn > 29.8);
  advance(state, 29.7);
  assert.equal(state.festival, 0);
  advance(state, .4);
  assert.ok(state.festival > 0);
  assert.equal(state.festivalKind, 'volcano');
  assert.equal(state.festivalCount, 2);
});

test('pausa, derrota e menu congelam a chegada e a duração das festas', () => {
  for (const flag of ['paused', 'ended', 'running']) {
    const state = game();
    state[flag] = flag !== 'running';
    const waiting = state.festivalIn;
    assert.equal(waiting, 20);
    advance(state, 2);
    assert.equal(state.festivalIn, waiting);
    state.festival = 7; state.festivalSpawnIn = .3;
    advance(state, 2);
    assert.equal(state.festival, 7);
    assert.equal(state.festivalSpawnIn, .3);
    assert.equal(state.items.length, 0);
  }
});

test('a chegada da festa retira só perigos e mantém os amigos na pista', () => {
  const state = game();
  state.festivalIn = .01;
  state.obstacles.push({x:state.player.x, width:50, height:44, hit:false});
  for (const type of ['rabbit', 'parrot', 'slime', 'robot']) {
    state.mobs.push({type, x:700, lift:type === 'parrot' ? 126 : 0, width:48, height:48, phase:0, resolved:false});
  }
  Engine.step(state, .05);
  assert.equal(state.obstacles.length, 0);
  assert.deepEqual(Array.from(state.mobs, m => m.type), ['rabbit', 'parrot']);
  assert.equal(state.health, 20);
});

test('durante a festa nenhum perigo nasce e colisões não tiram corações', () => {
  const state = game();
  state.festivalIn = .01;
  Engine.step(state, .05);
  state.obstacleIn = state.mobIn = 0;
  state.obstacles.push({x:state.player.x, width:50, height:44, hit:false});
  state.mobs.push({type:'robot', x:state.player.x, lift:0, width:48, height:48, phase:0, resolved:false});
  Engine.step(state, .05);
  assert.equal(state.health, 20);
  assert.equal(state.hurt, 0);
  advance(state, 8);
  assert.ok(state.obstacles.every(o => o.x < state.player.x), 'nenhum obstáculo novo entra pela direita');
  assert.ok(state.mobs.every(m => m.resolved), 'nenhum travesso novo entra');
});

test('chuva de bolas oferece gols próximos e festa do vulcão oferece tesouros fáceis', () => {
  for (const kind of ['balls', 'volcano']) {
    const state = game();
    state.width = 700;
    state.festivalIn = .01;
    state.festivalCount = kind === 'volcano' ? 1 : 0;
    Engine.step(state, .05);
    assert.equal(state.festivalKind, kind);
    advance(state, 6);
    if (kind === 'balls') {
      assert.ok(state.goals >= 4, 'o primeiro evento dá vários gols mesmo sem saltar');
      assert.ok(state.items.every(item => item.type === 'ball'));
      const incoming = state.items.filter(item => !item.kicked);
      for (let i = 1; i < incoming.length; i++) {
        assert.ok(incoming[i].x - incoming[i-1].x >= 80, 'bolas têm espaço visível');
      }
    } else {
      assert.ok(state.treasures >= 2, 'tesouros ficam ao alcance de uma criança no chão');
      assert.ok(state.items.every(item => ['coin', 'fries'].includes(item.type)));
    }
    assert.ok(state.items.length < 30, 'a festa não acumula centenas de itens');
  }
});

test('os obstáculos voltam a causar dano depois que a festa termina', () => {
  const state = game();
  state.festivalIn = .01;
  Engine.step(state, .05);
  assert.ok(state.festival > 0);
  advance(state, 10.1);
  assert.equal(state.festival, 0);
  state.shield = 0; state.hurt = 0;
  state.obstacles.push({x:state.player.x, width:50, height:44, hit:false});
  Engine.step(state, .01);
  assert.equal(state.health, 19);
  assert.ok(state.hurt > 0);
});

test('missões do próximo ovo podem ser cumpridas normalmente depois do nascimento', () => {
  const state = game();
  completeFirstThreeMissions(state);
  for (let i = 0; i < 3; i++) Engine.collect(state, 'coin');
  assert.equal(state.eggProgress, 1);
  assert.equal(state.stars, 4);
  assert.equal(state.events.filter(e => e.type === 'hatch').length, 1);
});
