const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const url = process.env.GAME_URL || pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const output = path.join(__dirname, '..', 'output', 'verification');
fs.mkdirSync(output, { recursive: true });

async function open(page) {
  page.setDefaultTimeout(12000);
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    globalThis.__playtimeEvents = [];
    const seen = new WeakSet();
    const record = state => {
      for (const event of state.events) if (!seen.has(event)) { seen.add(event); __playtimeEvents.push({ ...event }); }
    };
    let engine;
    Object.defineProperty(globalThis, 'RunnerEngine', { configurable:true, get:()=>engine, set(value) {
      engine = value;
      const create = value.create, step = value.step;
      value.create = (...args) => { globalThis.__playtimeState = create(...args); return __playtimeState; };
      value.step = () => {};
      globalThis.__advancePlaytime = seconds => {
        while (seconds > .000001) {
          const dt = Math.min(.05,seconds); step(__playtimeState,dt); record(__playtimeState); seconds -= dt;
        }
      };
    }});
  });
  await page.goto(url, { waitUntil:'domcontentloaded' });
  // This first assertion runs before waiting for the image pipeline.
  assert.equal(await page.locator('#rainbow-panel').count(),1,'a trilha precisa de um painel próprio para as três cores');
  assert.equal(await page.locator('#rainbow-panel').isVisible(),false,'o painel não cobre o menu');
  for (const id of ['red','blue','yellow']) {
    assert.equal(await page.locator(`#rainbow-panel [data-color="${id}"]`).count(),1,`a pista visual oferece a cor ${id}`);
  }
  await page.waitForFunction(() => !!globalThis.__playtimeState && !document.getElementById('start').disabled);
  return errors;
}
async function quiet(page) {
  await page.evaluate(() => {
    const s = __playtimeState; s.items = []; s.mobs = []; s.obstacles = [];
    s.spawnIn = s.obstacleIn = s.mobIn = s.festivalIn = s.rescueIn = s.letterIn = Infinity;
    s.festival = 0; s.rescue = null; s.shield = s.hurt = 0; s.companionCooldown = Infinity;
  });
}
async function start(page, mobile = false) {
  if (mobile) await page.locator('#start').tap(); else await page.locator('#start').click();
  await quiet(page);
}
function overlaps(a,b) {
  return a.x<b.x+b.width && a.x+a.width>b.x && a.y<b.y+b.height && a.y+a.height>b.y;
}
async function fits(page, selector) {
  const rect = await page.locator(selector).boundingBox(), viewport = page.viewportSize();
  assert.ok(rect && rect.x>=-1 && rect.y>=-1 && rect.x+rect.width<=viewport.width+1 && rect.y+rect.height<=viewport.height+1,
    `${selector} cabe em ${viewport.width}×${viewport.height}`);
  return rect;
}
async function completeColors(page) {
  await page.evaluate(() => {
    const s = __playtimeState; s.items = []; s.rainbowSpawnIn = Infinity; s.health = 18;
    for (const color of ['yellow','red','blue','blue']) s.items.push({type:'colorStar',color,x:s.player.x,lift:94,radius:30,phase:0});
    __advancePlaytime(.01);
  });
  await page.waitForFunction(() => __playtimeState.rainbowCompleted===1 && __playtimeState.events.length===0);
  assert.equal(await page.evaluate(() => __playtimeState.stars),1,'as três cores e a cópia sobreposta dão uma única estrela');
  assert.equal(await page.evaluate(() => __playtimeState.health),19,'o prêmio devolve um único coração');
  assert.equal(await page.evaluate(() => __playtimeEvents.filter(e => e.type==='rainbow-success').length),1);
  assert.match(await page.locator('#rainbow-panel').textContent(),/Todas as cores!/i);
  for (const id of ['red','blue','yellow']) {
    const dot = page.locator(`#rainbow-panel [data-color="${id}"]`);
    assert.equal(await dot.evaluate(element => element.classList.contains('done')),true,`${id} fica marcado depois da coleta real`);
    assert.ok((await dot.getAttribute('aria-label') || '').trim(),`${id} tem uma descrição acessível`);
  }
  await page.evaluate(() => {
    const s = __playtimeState;
    s.items.push({type:'colorStar',color:'blue',x:s.player.x,lift:94,radius:30,phase:0});
    __advancePlaytime(.01);
  });
  assert.equal(await page.evaluate(() => __playtimeState.stars),1,'mais uma cor repetida não repete o prêmio');
}
async function verifyLifecycle(page) {
  await start(page);
  await page.locator('#word-panel').waitFor({state:'visible'});
  await page.evaluate(() => __advancePlaytime(34.9));
  assert.equal(await page.locator('#rainbow-panel').isVisible(),false,'a primeira trilha aguarda trinta e cinco segundos calmos');
  await page.evaluate(() => {
    const s = __playtimeState;
    s.obstacles.push({kind:'cone',x:s.player.x+500,width:60,height:60,hit:false});
    s.mobs.push({type:'robot',x:s.player.x+500,lift:0,width:48,height:48,phase:0,resolved:false});
    __advancePlaytime(.2);
  });
  await page.locator('#rainbow-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#word-panel').isVisible(),false,'as cores têm espaço próprio durante a trilha');
  assert.equal(await page.evaluate(() => __playtimeState.obstacles.length),0);
  assert.equal(await page.evaluate(() => __playtimeState.mobs.some(RunnerEngine.isEnemy)),false);
  assert.equal(await page.evaluate(() => __playtimeEvents.filter(e => e.type==='rainbow-start').length),1);
  await page.evaluate(() => { __playtimeState.boost=2; __playtimeState.shield=1.5; });
  await page.locator('#pause').click();
  const paused = await page.evaluate(() => ({time:__playtimeState.time,rainbow:__playtimeState.rainbow,boost:__playtimeState.boost,shield:__playtimeState.shield}));
  assert.equal(await page.locator('#rainbow-panel').isVisible(),false,'a pausa esconde a brincadeira');
  await page.evaluate(() => __advancePlaytime(5));
  assert.deepEqual(await page.evaluate(() => ({time:__playtimeState.time,rainbow:__playtimeState.rainbow,boost:__playtimeState.boost,shield:__playtimeState.shield})),paused,
    'a pausa congela o arco-íris e os poderes');
  await page.locator('#resume').click();
  await page.locator('#rainbow-panel').waitFor({state:'visible'});
  await completeColors(page);
  await page.evaluate(() => { __playtimeState.rainbow=.15; __advancePlaytime(.2); });
  await page.locator('#rainbow-panel').waitFor({state:'hidden'});
  await page.locator('#word-panel').waitFor({state:'visible'});
  await page.locator('#mission').waitFor({state:'visible'});
  assert.equal(await page.evaluate(() => __playtimeState.ended),false,'os segundos finais terminam a brincadeira e mantêm a corrida');
  assert.equal(await page.evaluate(() => __playtimeState.health),19);
  assert.equal(await page.evaluate(() => __playtimeEvents.filter(e => e.type==='rainbow-end' && e.complete).length),1);
  await page.evaluate(() => { __playtimeState.rainbowIn=0; __advancePlaytime(.01); });
  await page.locator('#rainbow-panel').waitFor({state:'visible'});
  await page.locator('#pause').click(); await page.locator('#home').click();
  assert.equal(await page.locator('#rainbow-panel').isVisible(),false,'voltar ao menu esconde a trilha');
  await start(page);
  assert.equal(await page.evaluate(() => __playtimeState.rainbowCompleted),0,'uma nova corrida começa sem recompensas antigas');
  await page.evaluate(() => { __playtimeState.rainbowIn=0; __advancePlaytime(.01); __playtimeState.ended=true; __playtimeState.health=0; });
  await page.locator('#end-screen').waitFor({state:'visible'});
  assert.equal(await page.locator('#rainbow-panel').isVisible(),false,'o resultado esconde a trilha');
}
async function paintedStar(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('game'), rect = canvas.getBoundingClientRect(), s = __playtimeState;
    const item = s.items.find(i=>i.type==='colorStar');
    const color = RunnerEngine.RAINBOW_COLORS.find(c=>c.id===item.color).color;
    const rgb = [1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
    const pixels = canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    const centerX = item.x*canvas.width/s.width;
    const spanX = 65*canvas.width/s.width;
    let left=canvas.width,right=-1,top=canvas.height,bottom=-1;
    // O piso responde à altura dos controles; procura a estrela na coluna real.
    for (let y=0;y<canvas.height;y++) {
      for (let x=Math.max(0,Math.floor(centerX-spanX));x<Math.min(canvas.width,centerX+spanX);x++) {
        const index=(y*canvas.width+x)*4;
        if(rgb.every((value,c)=>Math.abs(pixels[index+c]-value)<10)) {
          left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        }
      }
    }
    return right<0?null:{x:rect.x+left*rect.width/canvas.width,y:rect.y+top*rect.height/canvas.height,
      width:(right-left+1)*rect.width/canvas.width,height:(bottom-top+1)*rect.height/canvas.height};
  });
}
async function verifyViewport(page, mobile) {
  await start(page,mobile);
  await page.evaluate(() => { __playtimeState.rainbowIn=0; __advancePlaytime(.01); });
  await page.locator('#rainbow-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#mission').isVisible(),false,'durante as cores, a missão deixa as estrelas altas livres');
  const panel = await fits(page,'#rainbow-panel');
  const controls = [];
  for (const selector of ['#jump','#roar','#pause','#album','#health-meter']) {
    const rect = await fits(page,selector); controls.push([selector,rect]);
    assert.equal(overlaps(panel,rect),false,`o painel das cores deixa ${selector} inteiro à vista`);
  }
  const jump=controls.find(([id])=>id==='#jump')[1], roar=controls.find(([id])=>id==='#roar')[1];
  assert.equal(overlaps(jump,roar),false,'pular e rugir mantêm áreas de toque separadas');
  for (const lift of [94,220]) {
    await page.evaluate(lift => {
      const s = __playtimeState; s.rainbowSpawnIn=Infinity;
      s.items=[{type:'colorStar',color:'red',x:s.width*.52,lift,radius:30,phase:0}];
    },lift);
    await page.waitForTimeout(40); // Permite pintar um quadro completo do Canvas real.
    const painted = await paintedStar(page);
    assert.ok(painted && painted.width>=14 && painted.height>=14,'a estrela colorida aparece grande no Canvas');
    for (const [selector,rect] of [...controls,['#rainbow-panel',panel]]) {
      assert.equal(overlaps(painted,rect),false,`os pixels da estrela na altura ${lift} ficam visíveis fora de ${selector}`);
    }
    await page.screenshot({path:path.join(output,`playtime-${page.viewportSize().width}-${lift}.png`),fullPage:true});
  }
  await completeColors(page);
  await page.evaluate(() => { __playtimeState.rainbow=.1; __advancePlaytime(.2); });
  await page.locator('#rainbow-panel').waitFor({state:'hidden'});
  assert.equal(await page.evaluate(() => __playtimeState.ended),false,'terminar as cores não encerra o jogo no celular');
}

(async () => {
  const browser = await chromium.launch({headless:true,args:['--allow-file-access-from-files']});
  try {
    const desktop = await browser.newContext({viewport:{width:1280,height:900}});
    const page = await desktop.newPage(), errors = await open(page);
    await verifyLifecycle(page); assert.deepEqual(errors,[],'a nova brincadeira não gera erros de página');
    await desktop.close();
    for (const [width,height,mobile] of [[1280,900,false],[761,700,false],[568,247,true],[667,320,true],[844,390,true]]) {
      const context = await browser.newContext({viewport:{width,height},isMobile:mobile,hasTouch:mobile});
      const viewportPage = await context.newPage(), viewportErrors = await open(viewportPage);
      await verifyViewport(viewportPage,mobile); assert.deepEqual(viewportErrors,[]);
      await context.close();
    }
    console.log('PASS arco-íris: painel, cores por colisão, prêmio único, pausas, retorno às letras e pixels separados dos controles em cinco tamanhos.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
