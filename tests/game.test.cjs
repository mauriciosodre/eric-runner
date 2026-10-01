const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Exercita a mesma física usada pelo HTML, sem depender de um navegador.
// Renderização e entradas reais são verificadas separadamente no navegador.
const file = path.join(__dirname, '..', 'index.html');
const html = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const script = html.match(/<script id="game-engine">([\s\S]*?)<\/script>/)?.[1];
const sandbox = {};
if (script) vm.runInNewContext(script, sandbox);
const Engine = sandbox.RunnerEngine;

test('o HTML entrega a física que a aventura utiliza', () => {
  assert.equal(typeof Engine?.create, 'function', 'a física do jogo ainda não existe');
});

function game(spawn=false) {
  assert.ok(Engine, 'a física do jogo ainda não existe');
  const state = Engine.create();
  state.running = true;
  // Testes de poderes usam um mundo controlado, sem novas coletas no caminho.
  if(!spawn)state.spawnIn=state.obstacleIn=state.mobIn=Infinity;
  return state;
}

test('Espaço/toque inicia um salto, não permite saltar no ar e volta ao chão', () => {
  const state = game();
  assert.equal(Engine.jump(state), true);
  assert.ok(state.player.vy < 0);
  assert.equal(Engine.jump(state), false);
  let peak = 0;
  for (let i = 0; i < 100; i++) { Engine.step(state, .016); peak = Math.max(peak, state.player.lift); }
  assert.ok(peak > 90, 'o salto deve alcançar os coletáveis elevados');
  assert.equal(state.player.lift, 0);
  assert.equal(state.player.vy, 0);
});

test('bolas são chutadas uma vez e continuam avançando no mundo', () => {
  const state = game();
  const ball = { type: 'ball', x: state.player.x + 20, lift: 18, radius: 22, kicked: false };
  state.items.push(ball);
  Engine.step(state, .016);
  assert.equal(state.goals, 1);
  assert.equal(ball.kicked, true);
  assert.ok(ball.vx > 0);
  const initialX = ball.x;
  for (let i = 0; i < 12; i++) Engine.step(state, .016);
  assert.ok(ball.x > initialX);
  assert.equal(state.goals, 1);
});

test('batatas aceleram por três segundos e depois a velocidade retorna', () => {
  const state = game();
  Engine.collect(state, 'fries');
  assert.equal(state.boost, 3);
  Engine.step(state, .1);
  assert.ok(state.speed > 220);
  for (let i = 0; i < 32; i++) Engine.step(state, .1);
  assert.equal(state.boost, 0);
  for (let i = 0; i < 15; i++) Engine.step(state, .1);
  assert.ok(Math.abs(state.speed - 220) < 1);
});

test('dinossauro protege por cinco segundos e absorve um obstáculo', () => {
  const state = game();
  Engine.collect(state, 'fossil');
  assert.equal(state.shield, 5);
  state.obstacles.push({ x: state.player.x, width: 45, height: 40, hit: false });
  Engine.step(state, .016);
  assert.equal(state.slow, 0);
  assert.equal(state.hurt, 0);
  assert.equal(state.obstacles[0].hit, true);
  for (let i = 0; i < 51; i++) Engine.step(state, .1);
  assert.equal(state.shield, 0);
});

test('bater sem escudo reduz velocidade temporariamente sem parar ou perder progresso', () => {
  const state = game();
  state.goals = 3;
  state.obstacles.push({ x: state.player.x, width: 50, height: 44, hit: false });
  Engine.step(state, .016);
  assert.ok(state.hurt > 0);
  assert.ok(state.slow > 0);
  assert.equal(state.running, true);
  assert.equal(state.goals, 3);
  const before = state.distance;
  for (let i = 0; i < 40; i++) Engine.step(state, .1);
  assert.ok(state.distance > before);
  assert.equal(state.hurt, 0);
  assert.ok(Math.abs(state.speed - 220) < 1);
});

test('hitbox de coleta perdoa distâncias que seriam difíceis para uma criança', () => {
  const state = game();
  state.items.push({ type: 'coin', x: state.player.x + 55, lift: 120, radius: 22 });
  Engine.step(state, .016);
  assert.equal(state.treasures, 1);
  assert.ok(state.shield > 4);
});

test('pausa congela física, distância e duração dos poderes', () => {
  const state = game();
  Engine.collect(state, 'fries');
  Engine.jump(state);
  state.paused = true;
  Engine.step(state, 1);
  assert.equal(state.boost, 3);
  assert.equal(state.player.lift, 0);
  assert.equal(state.distance, 0);
});

test('sequência longa protegida mantém memória limitada', () => {
  const state = game(true);
  state.shield=1000;
  for (let i = 0; i < 18000; i++) Engine.step(state, 1 / 30);
  assert.equal(state.running, true);
  assert.ok(state.distance > 1000);
  assert.ok(state.items.length < 30);
  assert.ok(state.obstacles.length < 15);
  assert.ok(state.events.length < 40);
  assert.ok(state.mobs.length<15);
  assert.ok(Number.isFinite(state.player.lift));
});

test('vinte corações e proteção de dois segundos evitam danos em sequência',()=>{
  const s=game();
  assert.equal(s.health,20);
  assert.equal(s.maxHealth,20);
  s.obstacles.push({x:s.player.x,width:50,height:44,hit:false});
  s.mobs.push({type:'slime',x:s.player.x,lift:0,width:48,height:48,phase:0,resolved:false});
  Engine.step(s,.016);
  assert.equal(s.health,19,'duas colisões juntas tiram apenas um coração');
  assert.equal(s.hurt,2);
  s.obstacles.push({x:s.player.x,width:50,height:44,hit:false});
  Engine.step(s,.1);
  assert.equal(s.health,19);
  for(let i=0;i<20;i++)Engine.step(s,.1);
  s.obstacles.push({x:s.player.x,width:50,height:44,hit:false});
  Engine.step(s,.016);
  assert.equal(s.health,18,'outro dano só depois da proteção');
});

test('escudo, salto e amigos preservam os corações',()=>{
  for(const type of ['slime','robot','cloud','balloon','mushroom','car','rabbit','parrot']) {
    for(const protection of ['shield','jump']) {
      const s=game();
      if(protection==='shield')s.shield=3;else s.player.lift=90;
      s.mobs.push({type,x:s.player.x,lift:0,width:48,height:48,phase:0,resolved:false});
      Engine.step(s,.016);
      assert.equal(s.health,20,type+' '+protection);
    }
  }
});

test('vida zero congela a partida e impede novos comandos ou pontos',()=>{
  const s=game();s.health=1;s.goals=5;s.treasures=3;
  s.obstacles.push({x:s.player.x,width:50,height:44,hit:false});
  Engine.step(s,.016);
  assert.equal(s.health,0);assert.equal(s.ended,true);
  const finalScore=Engine.score(s),distance=s.distance,time=s.time;
  assert.equal(Engine.jump(s),false);assert.equal(Engine.roar(s),false);
  Engine.collect(s,'ball');
  Engine.step(s,.1);
  assert.equal(Engine.score(s),finalScore);
  assert.equal(s.distance,distance);assert.equal(s.time,time);
  assert.equal(Engine.spriteFrame(s),7);
});

test('vamos de novo restaura a vida e a pista, preservando as dimensões',()=>{
  const s=game();s.width=750;s.player.x=165;s.health=0;s.ended=true;
  s.goals=7;s.distance=240;s.paused=true;s.boost=3;s.shield=5;
  s.mobs.push({type:'car',x:160});s.obstacles.push({x:160});
  assert.equal(typeof Engine.restart,'function');
  Engine.restart(s);
  assert.equal(s.health,20);assert.equal(s.ended,false);
  assert.equal(s.running,true);assert.equal(s.paused,false);
  assert.equal(s.width,750);assert.equal(s.player.x,165);
  assert.equal(Engine.score(s),0);assert.equal(s.boost,0);assert.equal(s.shield,0);
  assert.equal(s.mobs.length+s.items.length+s.obstacles.length,0);
});

test('placar premia distância, gols e tesouros sem depender da velocidade do quadro',()=>{
  const s=game();s.distance=123.7;s.goals=2;s.treasures=3;
  assert.equal(typeof Engine.score,'function');
  assert.equal(Engine.score(s),398);
  s.stars=1;s.scared=2;s.friends=1;
  assert.equal(Engine.score(s),558);
});

test('novos travessos causam um dano e fogem do rugido, bola ou escudo',()=>{
  for(const type of ['balloon','mushroom','car']) {
    assert.equal(Engine.isEnemy({type}),true,type);
    const s=game();
    s.mobs.push({type,x:s.player.x,lift:0,width:48,height:48,phase:0,resolved:false});
    Engine.step(s,.016);assert.equal(s.health,19,type);
    const protectedGame=game();
    protectedGame.mobs.push({type,x:protectedGame.player.x+80,lift:0,width:48,height:48,phase:0,resolved:false});
    Engine.roar(protectedGame);Engine.step(protectedGame,.016);
    assert.equal(protectedGame.mobs[0].fleeing,true,type);
    assert.equal(protectedGame.health,20);
    const ballGame=game();
    ballGame.mobs.push({type,x:ballGame.player.x+90,lift:0,width:48,height:48,phase:0,resolved:false});
    ballGame.items.push({type:'ball',x:ballGame.player.x+88,lift:25,radius:23,kicked:true,vx:700,vy:0});
    Engine.step(ballGame,.016);assert.equal(ballGame.mobs[0].fleeing,true,type+' foge da bola');
    const shieldGame=game();shieldGame.shield=3;
    shieldGame.mobs.push({type,x:shieldGame.player.x,lift:0,width:48,height:48,phase:0,resolved:false});
    Engine.step(shieldGame,.016);assert.equal(shieldGame.mobs[0].fleeing,true,type+' foge do escudo');
  }
});

test('a pista gera todos os seis travessos e mantém os dois amigos',()=>{
  const s=game(true);s.shield=1000;const types=new Set();
  for(let i=0;i<3600;i++){
    Engine.step(s,.05);
    for(const mob of s.mobs)types.add(mob.type);
  }
  for(const type of ['slime','robot','cloud','balloon','mushroom','car','rabbit','parrot'])
    assert.ok(types.has(type),'precisa aparecer na aventura: '+type);
});

test('a corrida troca os passos, usa salto no ar e volta aos pés no chão', () => {
  const state = game();
  assert.equal(typeof Engine.spriteFrame, 'function', 'falta selecionar os quadros de animação');
  const frames = new Set();
  for (let i=0;i<24;i++) { Engine.step(state,.016); frames.add(Engine.spriteFrame(state)); }
  assert.equal(frames.size,4);
  Engine.jump(state); Engine.step(state,.016);
  assert.equal(Engine.spriteFrame(state),4);
  state.paused=true;
  assert.equal(Engine.spriteFrame(state),7);
});

test('um chute e um rugido ativam poses de ação antes de voltar à corrida', () => {
  const state=game();
  assert.equal(typeof Engine.spriteFrame,'function');
  Engine.collect(state,'ball'); assert.equal(Engine.spriteFrame(state),5);
  for(let i=0;i<8;i++)Engine.step(state,.1);
  assert.ok(Engine.spriteFrame(state)<4);
  Engine.roar(state); assert.equal(Engine.spriteFrame(state),6);
});

test('rugido percorre seis fases, pausa a animação e retorna à corrida', () => {
  const state=game();
  assert.equal(typeof Engine.roarPhase,'function');
  Engine.roar(state);
  assert.equal(Engine.roarPhase(state),0);
  const phases=new Set();
  for(let i=0;i<42;i++) {
    phases.add(Math.floor(Engine.roarPhase(state)));
    if(i===12) {
      const phase=Engine.roarPhase(state);
      state.paused=true;Engine.step(state,.1);
      assert.equal(Engine.roarPhase(state),phase);
      state.paused=false;
    }
    Engine.step(state,.025);
  }
  assert.deepEqual([...phases],[0,1,2,3,4,5]);
  Engine.step(state,.05);
  assert.equal(state.roar,0);
  assert.ok(Engine.spriteFrame(state)<4);
  assert.ok(state.shield>3);
});

test('há obstáculos e mobs logo no começo com tempo para vê-los chegar', () => {
  const state=game(true);state.width=440;state.player.x=97;
  let seenObstacle=false,seenMob=false;
  for(let i=0;i<80;i++) { Engine.step(state,.05); seenObstacle ||= state.obstacles.length>0; seenMob ||= (state.mobs?.length || 0)>0; }
  assert.ok(seenObstacle,'o começo precisa de obstáculos');
  assert.ok(seenMob,'o começo precisa de mobs');
});

test('pular por cima do coelho rende um encontro feliz sem penalidade', () => {
  const state=game();assert.ok(Array.isArray(state.mobs),'faltam mobs interativos');
  state.player.lift=65;state.player.vy=0;
  state.mobs.push({type:'rabbit',x:state.player.x+2,lift:0,height:48,width:44,phase:0,resolved:false});
  Engine.step(state,.016);
  assert.equal(state.friends,1);assert.equal(state.hurt,0);assert.equal(state.mobs[0].friendly,true);
});

test('coelho e papagaio são sempre amigos, mesmo sem pular ou ter escudo', () => {
  const state=game();assert.ok(Array.isArray(state.mobs));
  for(const type of ['rabbit','parrot']) {
    state.mobs.push({type,x:state.player.x+2,lift:0,height:48,width:44,phase:0,resolved:false});
    Engine.step(state,.016);
    assert.equal(state.hurt,0);assert.equal(state.slow,0);
  }
  assert.equal(state.friends,2);assert.equal(state.running,true);
});

test('bola chutada faz o mob brincar sem aumentar o placar duas vezes', () => {
  const state=game();assert.ok(Array.isArray(state.mobs));
  state.goals=1;
  state.mobs.push({type:'rabbit',x:state.player.x+160,lift:0,height:48,width:44,phase:0,resolved:false});
  state.items.push({type:'ball',x:state.player.x+157,lift:30,radius:23,kicked:true,vx:700,vy:0});
  Engine.step(state,.016);
  assert.equal(state.friends,1);assert.equal(state.goals,1);assert.equal(state.mobs[0].friendly,true);
});

test('poder dino transforma o encontro com o papagaio em festa', () => {
  const state=game();assert.ok(Array.isArray(state.mobs));
  Engine.collect(state,'fossil');
  state.mobs.push({type:'parrot',x:state.player.x+5,lift:126,height:40,width:42,phase:0,resolved:false});
  Engine.step(state,.016);
  assert.equal(state.friends,1);assert.equal(state.hurt,0);
});

test('tarefas curtas dão estrelas e trocam de brincadeira sem cronômetro', () => {
  const state=game();
  Engine.collect(state,'ball');Engine.collect(state,'ball');
  assert.equal(state.stars,1,'dois gols completam a primeira brincadeira');
  Engine.jump(state);
  for(let i=0;i<100;i++)Engine.step(state,.016);
  Engine.jump(state);
  assert.equal(state.stars,2,'dois pulos completam a segunda brincadeira');
  assert.equal(state.taskProgress,0);
});

test('mobs e brinquedos deixam espaço de reação mesmo com turbo no celular', () => {
  const state=game(true);state.width=440;state.player.x=97;state.boost=100;
  for(let i=0;i<1200;i++) {
    Engine.step(state,.025);
    const hazards=[...state.mobs.filter(m=>Engine.isEnemy(m)),...state.obstacles].filter(h=>!h.resolved && !h.hit).sort((a,b)=>a.x-b.x);
    for(let j=1;j<hazards.length;j++)assert.ok(hazards[j].x-hazards[j-1].x>250,'não juntar obstáculos');
  }
});

test('rugido afugenta os três inimigos visíveis e deixa os amigos tranquilos',()=>{
  const s=game();
  for(const [i,type] of ['slime','robot','cloud','rabbit','parrot'].entries())
    s.mobs.push({type,x:s.player.x+90+i*70,lift:0,width:48,height:48,phase:0,resolved:false});
  assert.equal(Engine.roar(s),true);
  for(let i=0;i<10;i++)Engine.step(s,.1);
  assert.ok(s.mobs.filter(m=>Engine.isEnemy(m)).every(m=>m.fleeing));
  assert.ok(s.mobs.filter(m=>!Engine.isEnemy(m)).every(m=>!m.fleeing));
  assert.equal(s.scared,3);assert.ok(s.shield>3);assert.equal(s.hurt,0);
});

test('o especial recarrega sozinho, tesouros antecipam a recarga e pausa preserva tudo',()=>{
  const s=game();
  assert.equal(Engine.roar(s),true);assert.equal(Engine.roar(s),false);
  const cd=s.roarCooldown;
  s.paused=true;Engine.step(s,2);assert.equal(s.roarCooldown,cd);assert.equal(Engine.roar(s),false);
  s.paused=false;for(let i=0;i<61;i++)Engine.step(s,.1);
  assert.equal(Engine.roar(s),true);
  Engine.collect(s,'coin');assert.equal(s.roarCooldown,0);
  assert.equal(Engine.roar(s),true);
});

test('inimigos causam dano leve, e podem ser saltados ou afastados pelo escudo',()=>{
  for(const type of ['slime','robot','cloud']) {
    for(const mode of ['ground','jump','shield']) {
      const s=game();
      if(mode==='jump')s.player.lift=85;
      if(mode==='shield')s.shield=2;
      s.mobs.push({type,x:s.player.x+2,lift:0,width:48,height:48,phase:0,resolved:false});
      Engine.step(s,.016);
      assert.equal(s.running,true);
      assert.equal(s.goals,0);
      if(mode==='ground')assert.ok(s.hurt>0 && s.slow>0);
      else assert.equal(s.hurt,0);
      if(mode==='shield')assert.ok(s.mobs[0].fleeing);
    }
  }
});

test('bola chutada afugenta inimigo, não duplica gol nem o conta como amigo',()=>{
  const s=game();s.goals=1;
  s.mobs.push({type:'slime',x:s.player.x+160,lift:0,height:48,width:48,phase:0,resolved:false});
  s.items.push({type:'ball',x:s.player.x+157,lift:30,radius:23,kicked:true,vx:700,vy:0});
  Engine.step(s,.016);
  assert.ok(s.mobs[0].fleeing);assert.equal(s.goals,1);assert.equal(s.friends,0);
});

test('onda é finita, inimigo foge para a frente e sai da memória',()=>{
  const s=game();s.width=440;
  s.mobs.push({type:'robot',x:s.player.x+70,lift:0,height:48,width:48,phase:0,resolved:false});
  s.mobs.push({type:'slime',x:2000,lift:0,height:48,width:48,phase:0,resolved:false});
  Engine.roar(s);Engine.step(s,.016);
  const x=s.mobs[0].x;Engine.step(s,.1);assert.ok(s.mobs[0].x>x);
  assert.equal(s.mobs[1].fleeing,undefined,'o rugido não atinge inimigos fora da tela');
  for(let i=0;i<20;i++)Engine.step(s,.1);
  assert.ok(!s.mobs.some(m=>m.type==='robot'));
});

test('brincadeira do rugido premia a fuga dos travessos com uma estrela',()=>{
  const s=game();s.taskIndex=4;
  for(const [i,type] of ['slime','robot'].entries())s.mobs.push({type,x:s.player.x+85+i*80,lift:0,width:48,height:48,phase:0,resolved:false});
  Engine.roar(s);for(let i=0;i<6;i++)Engine.step(s,.1);
  assert.equal(s.stars,1);assert.equal(Engine.task(s).key,'ball');
});
