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
function mob(s, offset, type = 'robot') {
  return {type, x:s.player.x+offset, lift:0, width:48, height:48, phase:0, resolved:false};
}
function item(s, offset, type = 'coin') {
  return {type, x:s.player.x+offset, lift:type === 'ball' ? 21 : 94, radius:25, kicked:false};
}
function obstacle(s, offset) {
  return {kind:'cone', x:s.player.x+offset, width:46, height:43, hit:false};
}
function selectReady(s, id) {
  assert.equal(Engine.setCompanion(s, id), true); s.companionCooldown = 0;
}
function startRescue(s, time = 0) {
  s.time = time; s.rescueIn = 0; Engine.step(s, .01);
  assert.ok(s.rescue, 'o amigo pede ajuda'); return s.rescue;
}

test('mundos mudam uma vez a cada quarenta segundos e voltam ao jardim', () => {
  assert.equal(typeof Engine.world, 'function');
  const s = game();
  for (const [time, expected] of [[0,0],[39.99,0],[40,1],[79.99,1],[80,2],[119.99,2],[120,0],[160,1]]) {
    s.time = time; assert.equal(Engine.world(s), expected);
  }
  const names = ['Praia dos Brinquedos','Vale das Estrelas','Jardim Dino'];
  s.events = [];
  for (const [i, boundary] of [40,80,120].entries()) {
    s.time = boundary - .01; Engine.step(s, .02); Engine.step(s, .02);
    const e = s.events.filter(e => e.type === 'world');
    assert.equal(e.length, i+1); assert.equal(e[i].index, [1,2,0][i]); assert.equal(e[i].text, names[i]);
  }
});

test('tempo dos mundos congela no menu, na pausa e ao terminar; reinício volta ao jardim', () => {
  for (const flag of ['paused','ended','running']) {
    const s = game(); s.time = 39.99; s[flag] = flag !== 'running';
    Engine.step(s, .1); assert.equal(s.time, 39.99); assert.equal(Engine.world(s), 0);
    assert.equal(s.events.length, 0);
  }
  const s = game(); s.time = 91; Engine.restart(s);
  assert.equal(s.time, 0); assert.equal(Engine.world(s), 0);
});

test('escolha de companheiro aceita seis amigos durante a corrida e preserva recarga ao repetir a escolha', () => {
  const s = game(); assert.equal(typeof Engine.setCompanion, 'function');
  for (const id of ['pipo','lili','tico','bubi','nino','zazu']) {
    assert.equal(Engine.setCompanion(s, id), true); assert.equal(s.companionId, id);
    assert.equal(s.companionCooldown, 12); assert.equal(s.companionEffect, 0);
    s.companionCooldown = 4; s.companionEffect = .5;
    assert.equal(Engine.setCompanion(s, id), true);
    assert.equal(s.companionCooldown, 4); assert.equal(s.companionEffect, .5);
  }
  assert.equal(Engine.setCompanion(s, 'intruso'), false); assert.equal(s.companionId, 'zazu');
  assert.equal(Engine.setCompanion(s, null), true); assert.equal(s.companionId, null);
});

test('Pipo afugenta só o travesso visível mais próximo e espera doze segundos para ajudar outra vez', () => {
  const s = game(); selectReady(s, 'pipo');
  const close = mob(s, 230), far = mob(s, 380), friend = mob(s, 170, 'rabbit');
  s.mobs.push(far, friend, close); Engine.step(s, .01);
  assert.equal(close.resolved, true); assert.equal(far.resolved, false); assert.equal(friend.resolved, false);
  assert.equal(s.scared, 1); assert.equal(s.companionCooldown, 12); assert.equal(s.companionEffect, 1.2);
  assert.ok(Math.abs(s.companionTargetX - (s.player.x+230)) < 3);
  const e = s.events.find(e => e.type === 'companion'); assert.equal(e.id, 'pipo'); assert.ok(e.action && e.text);
  Engine.step(s, .1); assert.equal(s.scared, 1); assert.equal(far.resolved, false);
});

test('companheiros ignoram alvos atrás, distantes, resolvidos e fora da tela sem gastar a ajuda pronta', () => {
  for (const id of ['pipo','tico','bubi']) {
    const s = game(); selectReady(s, id); s.width = 700;
    if (id === 'pipo') s.mobs.push(mob(s,-100),mob(s,470),{...mob(s,180),resolved:true});
    if (id === 'tico') s.items.push(item(s,-180),item(s,470),{...item(s,180),collected:true});
    if (id === 'bubi') s.obstacles.push(obstacle(s,-100),obstacle(s,470),{...obstacle(s,180),hit:true});
    Engine.step(s,.01); assert.equal(s.companionCooldown,0); assert.equal(s.companionEffect,0);
    assert.equal(s.events.filter(e => e.type === 'companion').length,0);
    s.width = 400;
    if (id === 'pipo') s.mobs = [mob(s,200)];
    if (id === 'tico') s.items = [item(s,200)];
    if (id === 'bubi') s.obstacles = [obstacle(s,200)];
    Engine.step(s,.01); assert.equal(s.companionCooldown,0);
    assert.equal(s.events.filter(e => e.type === 'companion').length,0);
  }
});

test('Lili oferece dois segundos de escudo sem encurtar proteção maior nem tornar o herói invulnerável', () => {
  const s = game(); selectReady(s,'lili'); s.shield = 3;
  Engine.step(s,.01); assert.ok(s.shield > 2); assert.equal(s.companionCooldown,0);
  s.shield = 0; Engine.step(s,.01); assert.equal(s.shield,2); assert.equal(s.companionCooldown,12);
  advance(s,2.1); assert.equal(s.shield,0);
  s.obstacles.push(obstacle(s,0)); Engine.step(s,.01); assert.equal(s.health,19);
});

test('Tico coleta um tesouro próximo uma única vez e preserva moedas distantes e bolas chutadas', () => {
  const s = game(); selectReady(s,'tico');
  const close = item(s,200,'fossil'), far = item(s,300), ball = {...item(s,150,'ball'),kicked:true,vx:700,vy:-290};
  s.items.push(far,ball,close); Engine.step(s,.01);
  assert.equal(s.treasures,1); assert.equal(close.collected,true); assert.equal(far.collected,undefined);
  assert.equal(s.goals,0); assert.equal(s.shield,1.5); assert.equal(s.roarCooldown,0);
  Engine.step(s,.1); assert.equal(s.treasures,1);
});

test('Bubi resolve somente o primeiro obstáculo e a animação não concede outro prêmio', () => {
  const s = game(); selectReady(s,'bubi');
  const close = obstacle(s,210), far = obstacle(s,320); s.obstacles.push(far,close);
  Engine.step(s,.01); assert.equal(close.hit,true); assert.equal(close.cleared,true); assert.equal(far.hit,false);
  assert.equal(s.health,20); assert.equal(s.companionCooldown,12);
  Engine.step(s,.1); assert.equal(far.hit,false); assert.equal(s.events.filter(e => e.type === 'companion').length,1);
});

test('Nino devolve um coração ou deixa uma moeda alcançável quando a vida está cheia', () => {
  const s = game(); selectReady(s,'nino'); s.health = 18;
  Engine.step(s,.01); assert.equal(s.health,19); assert.equal(s.items.length,0);
  s.companionCooldown = 0; s.health = s.maxHealth; Engine.step(s,.01);
  assert.equal(s.health,20); assert.equal(s.items.length,1); assert.equal(s.items[0].type,'coin');
  assert.ok(s.items[0].x>s.player.x && s.items[0].x<=s.width && s.items[0].lift<=110);
  assert.equal(s.treasures,0); advance(s,1.1); assert.equal(s.treasures,1);
});

test('Zazu chuta uma bola visível exatamente uma vez ou cria uma bola perto do herói', () => {
  const s = game(); selectReady(s,'zazu');
  const close = item(s,220,'ball'), far = item(s,350,'ball'); s.items.push(far,close);
  Engine.step(s,.01); assert.equal(s.goals,1); assert.equal(close.kicked,true); assert.equal(far.kicked,false);
  assert.equal(close.vx,700); assert.ok(close.vy<0); Engine.step(s,.1); assert.equal(s.goals,1);
  const fresh = game(); selectReady(fresh,'zazu'); Engine.step(fresh,.01);
  assert.equal(fresh.goals,0); assert.equal(fresh.items.length,1); assert.equal(fresh.items[0].type,'ball');
  assert.ok(fresh.items[0].x>fresh.player.x && fresh.items[0].x<=fresh.width);
  advance(fresh,1.1); assert.equal(fresh.goals,1);
});

test('poder pronto espera alvo útil e recarga depende só dos segundos ativos', () => {
  const s = game(); Engine.setCompanion(s,'pipo'); advance(s,12.05);
  assert.equal(s.companionCooldown,0); assert.equal(s.events.filter(e=>e.type==='companion').length,0);
  s.mobs.push(mob(s,250)); Engine.step(s,.01); assert.equal(s.scared,1);
  advance(s,.5); const cooldown = s.companionCooldown, effect = s.companionEffect;
  for (const flag of ['paused','ended','running']) {
    s[flag] = flag !== 'running'; Engine.step(s,.1);
    assert.equal(s.companionCooldown,cooldown); assert.equal(s.companionEffect,effect);
    s[flag] = flag === 'running';
  }
  s.mobs = []; advance(s,11.6); assert.equal(s.companionCooldown,0);
  s.mobs.push(mob(s,250)); Engine.step(s,.01); assert.equal(s.scared,2);
});

test('reinício conserva companheiro e ovo, limpa ajuda e recomeça o resgate', () => {
  const s = game(); Engine.setCompanion(s,'bubi'); s.eggProgress = 2;
  startRescue(s,85); s.companionCooldown=1;s.companionEffect=1;s.companionAction='clear';s.companionTargetX=500;
  s.rescued=7; Engine.restart(s);
  assert.equal(s.companionId,'bubi'); assert.equal(s.companionCooldown,12); assert.equal(s.companionEffect,0);
  assert.equal(s.companionAction,null); assert.equal(s.companionTargetX,null); assert.equal(s.eggProgress,2);
  assert.equal(s.rescue,null); assert.equal(s.rescueIn,12); assert.equal(s.rescueCount,0); assert.equal(s.rescued,0);
});

test('primeiro pedido de ajuda chega aos doze segundos e usa o mundo atual e amigos sem repetir a sequência', () => {
  const s = game(); s.rescueIn=12; advance(s,11.95); assert.equal(s.rescue,null);
  advance(s,.1); assert.equal(s.rescue.variant,'bubble'); assert.equal(s.rescue.petId,'pipo');
  const start = s.events.find(e => e.type === 'rescue-start'); assert.equal(start.variant,'bubble'); assert.equal(start.petId,'pipo');
  Engine.roar(s); assert.equal(s.rescue,null); assert.equal(s.rescueCount,1);
  for (const [time,variant,petId,count] of [[41,'castle','lili',2],[81,'balloon','tico',3],[121,'bubble','bubi',4],[161,'castle','nino',5],[201,'balloon','zazu',6],[241,'bubble','fifi',7]]) {
    const r = startRescue(s,time); assert.equal(r.variant,variant); assert.equal(r.petId,petId); assert.equal(s.rescueCount,count);
    s.roarCooldown=0; Engine.roar(s);
  }
});

test('pedido de ajuda retira perigos, mantém amigos e permite itens e encontros sem dano', () => {
  const s = game(); const rabbit = mob(s,250,'rabbit'); s.mobs.push(rabbit,mob(s,200));
  s.obstacles.push(obstacle(s,200)); startRescue(s);
  assert.equal(s.obstacles.length,0); assert.deepEqual(Array.from(s.mobs,m=>m.type),['rabbit']);
  s.obstacleIn=s.mobIn=s.spawnIn=0;
  s.obstacles.push(obstacle(s,0)); s.mobs.push(mob(s,0)); s.mobs.push(mob(s,0,'parrot'));
  Engine.step(s,.01); assert.equal(s.health,20); assert.equal(s.hurt,0); assert.ok(s.friends>=1);
  assert.ok(s.items.length>=1); assert.equal(s.obstacles.filter(o=>o.x>s.player.x+60).length,0);
  assert.equal(s.mobs.filter(m=>Engine.isEnemy(m) && m.x>s.player.x+60).length,0);
  advance(s,2); assert.ok(s.rescue); assert.equal(s.health,20);
});

test('rugido de qualquer herói salva qualquer variante visível e recompensa uma única vez', () => {
  for (const characterId of ['eric','daniel','samuel']) {
    for (const time of [0,41,81]) {
      const s=game(); s.characterId=characterId;s.health=17;s.taskIndex=2;
      const r=startRescue(s,time); const variant=r.variant, petId=r.petId;
      assert.equal(Engine.roar(s),true); assert.equal(s.rescue,null);
      assert.equal(s.rescued,1); assert.equal(s.friends,1); assert.equal(s.stars,1); assert.equal(s.health,19);
      assert.equal(s.taskProgress,1); assert.equal(s.rescueIn,32);
      const e=s.events.find(e=>e.type==='rescue-success');
      assert.equal(e.text,'OBRIGADO!'); assert.equal(e.variant,variant);assert.equal(e.petId,petId);assert.equal(e.reason,'special');assert.equal(e.count,1);
      advance(s,1); Engine.roar(s); assert.equal(s.rescued,1); assert.equal(s.friends,1); assert.equal(s.stars,1);
    }
  }
});

test('salto ajuda castelo e balão próximos; bolha espera especial e saltos recusados não salvam', () => {
  for (const time of [41,81]) {
    const s=game();const r=startRescue(s,time);r.x=s.player.x+390;
    assert.equal(Engine.jump(s),true);assert.equal(s.rescue,null);assert.equal(s.events.find(e=>e.type==='rescue-success').reason,'jump');
    const far=game();const target=startRescue(far,time);target.x=far.player.x+410;
    assert.equal(Engine.jump(far),true);assert.ok(far.rescue);
    target.x=far.player.x+200; assert.equal(Engine.jump(far),false);assert.ok(far.rescue);
  }
  const s=game();startRescue(s);Engine.jump(s);assert.ok(s.rescue);
});

test('ajuda gentil termina aos dois segundos restantes sem falha nem prêmios duplicados', () => {
  const s=game();s.health=19;const r=startRescue(s,81);advance(s,5.9);
  assert.ok(s.rescue);assert.ok(r.ttl>2);assert.ok(r.x>=s.player.x+120);
  advance(s,.2);assert.equal(s.rescue,null);assert.equal(s.rescued,1);assert.equal(s.health,20);
  assert.equal(s.events.find(e=>e.type==='rescue-success').reason,'helper');
  advance(s,1);assert.equal(s.rescued,1);assert.equal(s.friends,1);assert.equal(s.stars,1);
});

test('menu, pausa e derrota congelam espera, alvo e duração do resgate e bloqueiam ações', () => {
  for (const flag of ['paused','ended','running']) {
    const s=game();s.rescueIn=12;s[flag]=flag!=='running';advance(s,1);assert.equal(s.rescueIn,12);
    s[flag]=flag==='running';const r=startRescue(s);const x=r.x,ttl=r.ttl;
    s[flag]=flag!=='running';advance(s,1);assert.equal(r.ttl,ttl);assert.equal(r.x,x);
    assert.equal(Engine.roar(s),false);assert.equal(Engine.jump(s),false);assert.equal(s.rescued,0);
  }
});

test('festa suspende novos pedidos de ajuda mas permite concluir um resgate que já começou', () => {
  const s=game();s.rescueIn=.05;s.festival=1;s.festivalSpawnIn=Infinity;
  advance(s,.5);assert.equal(s.rescue,null);assert.equal(s.rescueIn,.05);
  advance(s,.6);assert.ok(s.rescue);
  s.festival=1; s.festivalSpawnIn=Infinity;Engine.roar(s);assert.equal(s.rescued,1);
  const wait=s.rescueIn;advance(s,.5);assert.equal(s.rescueIn,wait);
  const active=game();startRescue(active);active.festivalIn=0;Engine.step(active,.01);
  assert.ok(active.rescue && active.festival>0);Engine.roar(active);assert.equal(active.rescued,1);
});

test('dano volta ao normal depois do resgate e nenhuma ajuda automática é escudo permanente', () => {
  for (const id of ['pipo','tico','bubi','nino','zazu']) {
    const s=game();selectReady(s,id);startRescue(s);s.rescue.ttl=2;Engine.step(s,.01);
    s.shield=0;s.hurt=0;s.companionCooldown=12;s.obstacles.push(obstacle(s,0));
    Engine.step(s,.01);assert.equal(s.health,19,id+' conserva as colisões normais');
  }
});
