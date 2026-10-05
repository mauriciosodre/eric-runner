const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const sandbox = {};
vm.runInNewContext(html.match(/<script id="game-engine">([\s\S]*?)<\/script>/)[1], sandbox);
const Engine = sandbox.RunnerEngine;
const PETS = ['pipo','lili','tico','bubi','nino','zazu','fifi','duda','ravi','lola','mimo','kiko'];
const SHAPES = [['block',62,52],['cone',60,60],['log',80,48],['tire',58,58],['crate',66,54]];
function game() {
  const s=Engine.create();s.running=true;
  s.spawnIn=s.obstacleIn=s.mobIn=s.festivalIn=s.rescueIn=Infinity;
  return s;
}

test('os doze companheiros ajudam uma vez com o poder da sua família e conservam recarga no reinício', () => {
  for (const [index,id] of PETS.entries()) {
    const s=game(),family=index%6;
    assert.equal(Engine.setCompanion(s,id),true,id);
    s.companionCooldown=0;
    if(family===0)s.mobs.push({type:'robot',x:s.player.x+220,lift:0,width:48,height:48,phase:0,resolved:false});
    if(family===2)s.items.push({type:'fossil',x:s.player.x+220,lift:94,radius:25,kicked:false});
    if(family===3)s.obstacles.push({kind:'cone',x:s.player.x+220,width:60,height:60,hit:false});
    if(family===4)s.health=18;
    if(family===5)s.items.push({type:'ball',x:s.player.x+220,lift:21,radius:23,kicked:false});
    Engine.step(s,.01);
    assert.equal(s.companionAction,['roar','shield','treasure','clear','heal','kick'][family],id);
    assert.equal(s.events.filter(e=>e.type==='companion').length,1,id);
    assert.equal(s.events.find(e=>e.type==='companion').id,id,'o efeito pertence ao amigo escolhido');
    if(family===0)assert.equal(s.scared,1);
    if(family===1)assert.equal(s.shield,2);
    if(family===2)assert.equal(s.treasures,1);
    if(family===3)assert.equal(s.obstacles[0].cleared,true);
    if(family===4)assert.equal(s.health,19);
    if(family===5)assert.equal(s.goals,1);
    Engine.step(s,.1);
    assert.equal(s.events.filter(e=>e.type==='companion').length,1,id);
    s.eggProgress=2;Engine.restart(s);
    assert.equal(s.companionId,id);assert.equal(s.companionCooldown,12);
    assert.equal(s.companionEffect,0);assert.equal(s.eggProgress,2);
  }
});

test('os pedidos de ajuda recebem os doze amigos antes de repetir a sequência', () => {
  const s=game(),seen=[];
  for(let i=0;i<13;i++) {
    s.rescueIn=0;s.roarCooldown=0;s.events=[];
    Engine.step(s,.01);assert.ok(s.rescue);
    seen.push(s.rescue.petId);
    assert.equal(Engine.roar(s),true);assert.equal(s.rescue,null);assert.equal(s.rescued,i+1);
    assert.equal(s.events.filter(e=>e.type==='rescue-success').length,1);
  }
  assert.deepEqual(seen,[...PETS,'pipo']);
});

test('cinco brinquedos usam dimensões visíveis consistentes sem mudar o ritmo da pista', () => {
  const s=game(),seen=[];
  for(let i=0;i<6;i++) {
    s.obstacles=[];s.obstacleIn=0;Engine.step(s,.01);
    assert.equal(s.obstacles.length,1);
    const o=s.obstacles[0];seen.push([o.kind,o.width,o.height]);
    assert.ok(s.obstacleIn>=3.3 && s.obstacleIn<=4.2);
    assert.ok(o.x>s.width,'o brinquedo entra pela borda antes de chegar ao herói');
  }
  assert.deepEqual(seen,[...SHAPES,SHAPES[0]]);
});

test('a margem de colisão continua generosa e um salto alto passa pelos cinco brinquedos', () => {
  for(const [kind,width,height] of SHAPES) {
    const s=game();s.obstacles.push({kind,width,height,x:s.player.x+width/2+19+3,hit:false});
    Engine.step(s,.001);assert.equal(s.health,20,kind+' deixa espaço na lateral');
    s.obstacles[0].x=s.player.x;Engine.step(s,.001);
    assert.equal(s.health,19,kind+' só tira um coração');
    const jumping=game();jumping.player.lift=height+12;
    jumping.obstacles.push({kind,width,height,x:jumping.player.x,hit:false});
    Engine.step(jumping,.001);assert.equal(jumping.health,20);assert.equal(jumping.obstacles[0].cleared,true);
  }
});

test('dino, tartaruga e borboleta entram na corrida como amigos e a borboleta voa', () => {
  const s=game(),spawned=[];
  for(let i=0;i<30;i++) {
    s.mobs=[];s.mobIn=0;Engine.step(s,.01);
    const m=s.mobs[0];assert.ok(m);spawned.push({...m});
  }
  for(const type of ['dino','turtle','butterfly']) {
    const m=spawned.find(m=>m.type===type);assert.ok(m,type+' aparece na aventura');
    assert.equal(Engine.isEnemy(m),false);assert.equal(m.friendly,true);
    assert.equal(m.lift,type==='butterfly'?144:0);
  }
});

test('os três novos amigos aceitam contato e passes sem dano ou recompensa duplicada', () => {
  for(const type of ['dino','turtle','butterfly']) {
    const s=game(),m={type,x:s.player.x,lift:type==='butterfly'?144:0,width:48,height:48,phase:0,resolved:false};
    s.taskIndex=2;s.mobs.push(m);Engine.step(s,.01);
    assert.equal(s.health,20);assert.equal(s.hurt,0);assert.equal(s.friends,1);assert.equal(s.taskProgress,1);
    Engine.step(s,.1);assert.equal(s.friends,1);assert.equal(s.taskProgress,1);
    assert.equal(Engine.roar(s),true);Engine.step(s,.1);assert.equal(s.scared,0);
    const pass=game();pass.mobs.push({...m,x:pass.player.x+140,lift:0,resolved:false});
    pass.items.push({type:'ball',x:pass.player.x+95,lift:30,radius:23,kicked:true,vx:700,vy:0});
    Engine.step(pass,.1);assert.equal(pass.friends,1);assert.equal(pass.health,20);assert.equal(pass.scared,0);
    Engine.step(pass,.1);assert.equal(pass.friends,1);
  }
});
