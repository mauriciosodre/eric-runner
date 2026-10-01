const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

// Integração de verdade: abre o HTML local no Chromium, sem servidor ou CDN.
// O estado é observado exclusivamente aqui; o HTML não tem modo de testes.
const output = path.join(__dirname, '..', 'output', 'verification');
fs.mkdirSync(output, { recursive: true });
async function observe(page) {
  await page.addInitScript(() => {
    globalThis.__spriteDraws=[];
    globalThis.__decodedAudio=[];globalThis.__sampleStarts=[];
    globalThis.__canvasErrors=[];
    addEventListener('error',()=>{
      __canvasErrors.push({state:JSON.parse(JSON.stringify(globalThis.__observedState || {})),rect:document.getElementById('stage')?.getBoundingClientRect().toJSON()});
    });
    const decode=AudioContext.prototype.decodeAudioData;
    AudioContext.prototype.decodeAudioData=function(...args){
      return decode.apply(this,args).then(buffer=>{
        let peak=0;for(const v of buffer.getChannelData(0))peak=Math.max(peak,Math.abs(v));
        __decodedAudio.push({duration:buffer.duration,peak});return buffer;
      });
    };
    const startAudio=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){
      __sampleStarts.push({duration:this.buffer?.duration,rate:this.playbackRate.value});
      return startAudio.apply(this,args);
    };
    const drawImage=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(image,...args) {
      if(image.src?.endsWith('/eric-actions.png') && args.length===8) {
        const transform=this.getTransform();
        const bottom=transform.transformPoint({x:0,y:args[5]+args[7]});
        __spriteDraws.push({sx:args[0],sy:args[1],sole:bottom.y/transform.d,lift:globalThis.__observedState?.player.lift || 0});
        if(__spriteDraws.length>1500)__spriteDraws.shift();
      }
      return drawImage.call(this,image,...args);
    };
    let engine;
    Object.defineProperty(globalThis, 'RunnerEngine', {
      configurable: true,
      get: () => engine,
      set(value) {
        engine = value;
        const create = value.create;
        value.create = (...args) => {
          const state = create(...args);
          globalThis.__observedState = state;
          return state;
        };
      }
    });
  });
}
const url = process.env.GAME_URL || pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await observe(page);
    await page.goto(url);
    await page.waitForFunction(() => !!globalThis.__observedState);
    const imageSize = await page.evaluate(() => new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve([image.naturalWidth, image.naturalHeight]);
      image.onerror = () => resolve([0, 0]);
      image.src = 'eric.png';
    }));
    assert.ok(imageSize[0] > 0 && imageSize[1] > 0, 'eric.png abre no HTML local');
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => __observedState.running), false);
    await page.screenshot({ path: path.join(output, 'desktop-start.png'), fullPage: true });
    assert.ok(await page.evaluate(()=>__spriteDraws.length>0),'folha de ações carregada de verdade');
    await page.evaluate(()=>{__spriteDraws=[];});
    await page.getByRole('button', { name: 'Vamos correr!' }).click();
    await page.waitForTimeout(600);
    const walking=await page.evaluate(()=>__spriteDraws.filter(d=>d.sy<10));
    assert.equal(new Set(walking.map(d=>d.sx)).size,4,'a corrida percorre os quatro passos');
    assert.ok(walking.every(d=>Math.abs(d.sole-436)<.5),'os pés dos quatro passos tocam o chão');
    await page.locator('canvas').focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => __observedState.player.lift > 20), 'Espaço pula de verdade');
    await page.waitForTimeout(850);
    assert.equal(await page.evaluate(() => __observedState.player.lift), 0);
    await page.getByRole('button', { name: 'Pausar aventura' }).click();
    const pausedTime = await page.evaluate(() => __observedState.time);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => __observedState.time), pausedTime);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.evaluate(() => {
      const s = __observedState;
      s.items=[];s.obstacles=[];s.mobs=[];
      s.spawnIn=s.obstacleIn=s.mobIn=Infinity;
      s.items.push({ type: 'ball', x: s.player.x + 5, lift: 20, radius: 23 });
    });
    await page.waitForFunction(() => __observedState.goals === 1);
    assert.equal(await page.locator('#goals').textContent(), '1');
    await page.waitForFunction(()=>__spriteDraws.some(d=>d.sx===457 && d.sy===449));
    await page.evaluate(() => {
      const s = __observedState;
      s.items.push({ type: 'fries', x: s.player.x + 5, lift: 100, radius: 25 });
    });
    await page.waitForFunction(() => __observedState.boost > 2);
    assert.equal(await page.locator('#boost-status').isVisible(), true);
    await page.evaluate(() => {
      const s = __observedState;
      s.items.push({ type: 'fossil', x: s.player.x + 5, lift: 100, radius: 25 });
    });
    await page.waitForFunction(() => __observedState.shield > 4);
    assert.equal(await page.locator('#shield-status').isVisible(), true);
    // Um painel oculto fornece 0 × 0 ao ResizeObserver por um instante.
    // A geometria anterior precisa continuar válida, inclusive com escudo.
    await page.evaluate(()=>{document.getElementById('stage').style.display='none';});
    await page.waitForTimeout(60);
    assert.ok(await page.evaluate(()=>Number.isFinite(__observedState.player.x)),'não dividir por zero ao medir um painel recolhido');
    await page.evaluate(()=>{document.getElementById('stage').style.display='';});
    await page.waitForTimeout(60);
    await page.getByRole('button', { name: 'Ativar sons' }).click();
    assert.equal(await page.locator('#sound').getAttribute('aria-pressed'), 'true');
    await page.waitForFunction(()=>__decodedAudio.length===7);
    assert.ok(await page.evaluate(()=>__decodedAudio.every(a=>a.duration>0 && a.peak>.01)),'sete gravações decodificam e têm áudio real');
    await page.evaluate(()=>{
      const s=__observedState;s.mobs=[];
      for(const [i,type] of ['slime','robot','cloud','rabbit','parrot'].entries())
        s.mobs.push({type,x:s.player.x+90+i*95,lift:type==='parrot'?126:0,width:48,height:48,phase:0,resolved:false});
      s.scared=0;s.shield=0;
    });
    await page.locator('canvas').focus();
    await page.keyboard.press('r');
    await page.waitForFunction(()=>__spriteDraws.some(d=>d.sx===905 && d.sy===450));
    await page.waitForFunction(()=>__observedState.scared===3);
    assert.ok(await page.evaluate(()=>__observedState.mobs.filter(m=>!RunnerEngine.isEnemy(m)).every(m=>!m.fleeing)),'rugido poupa os animais amigos');
    const playedSamples=await page.evaluate(()=>__sampleStarts);
    assert.ok(playedSamples.some(s=>s.duration>3 && Math.abs(s.rate-1.9)<.001),'o rugido usa a gravação com voz mais aguda: '+JSON.stringify(playedSamples));
    assert.equal(await page.locator('#roar').getAttribute('aria-disabled'),'true');
    await page.screenshot({ path: path.join(output, 'desktop-playing.png'), fullPage: true });
    await page.getByRole('button', { name: 'Desativar sons' }).click();
    await page.waitForTimeout(3200);
    assert.equal(await page.locator('#boost-status').isVisible(), false);
    assert.ok(await page.evaluate(() => __observedState.running));
    await page.evaluate(()=>{
      const s=__observedState;s.shield=0;s.roar=0;s.items=[];s.mobs=[];s.roarCooldown=0;
      s.obstacles.push({kind:'cone',x:s.player.x+175,width:46,height:43,hit:false});
      for(const [i,type] of ['slime','robot','cloud'].entries())
        s.mobs.push({type,x:s.player.x+315+i*185,lift:0,height:48,width:48,phase:0,resolved:false});
      s.mobs.push({type:'rabbit',x:s.player.x+560,lift:0,height:48,width:44,phase:0,resolved:false});
      s.mobs.push({type:'parrot',x:s.player.x+785,lift:126,height:48,width:44,phase:0,resolved:false});
    });
    await page.waitForTimeout(180);
    await page.screenshot({path:path.join(output,'desktop-encounters.png'),fullPage:true});
    await page.evaluate(()=>{
      const s=__observedState;s.obstacles=[];s.mobs=[];s.items=[];s.player.lift=0;s.player.vy=0;
      RunnerEngine.collect(s,'ball');
    });
    await page.waitForFunction(()=>document.getElementById('stars').textContent==='1');
    assert.equal(await page.locator('#stars').textContent(),'1');
    assert.match(await page.locator('#mission-text').textContent(),/superpulos/);
    assert.deepEqual(errors, []);

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const mobileErrors = [];
    mobile.on('pageerror', e => {mobileErrors.push(e.message);console.error('MOBILE:',e.stack);});
    await observe(mobile);
    await mobile.goto(url);
    await mobile.waitForTimeout(350);
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sem rolagem horizontal');
    await mobile.screenshot({ path: path.join(output, 'mobile-start.png'), fullPage: true });
    await mobile.getByRole('button', { name: 'Vamos correr!' }).tap();
    await mobile.locator('canvas').tap({ position: { x: 140, y: 260 } });
    await mobile.waitForTimeout(100);
    assert.ok(await mobile.evaluate(() => __observedState.player.lift > 20), 'toque pula de verdade');
    await mobile.waitForTimeout(900);
    await mobile.getByRole('button', { name: 'PULAR', exact: true }).tap();
    await mobile.waitForTimeout(80);
    assert.ok(await mobile.evaluate(() => __observedState.player.lift > 20));
    await mobile.screenshot({ path: path.join(output, 'mobile-playing.png'), fullPage: true });
    await mobile.evaluate(()=>{
      const s=__observedState;s.items=[];s.obstacles=[];s.mobs=[];
      s.spawnIn=s.obstacleIn=s.mobIn=Infinity;s.roarCooldown=0;
      s.mobs.push({type:'robot',x:s.player.x+95,lift:0,height:48,width:48,phase:0,resolved:false});
    });
    await mobile.getByRole('button',{name:'Rugir e afugentar os travessos'}).tap();
    await mobile.waitForFunction(()=>__observedState.scared>0);
    assert.ok(await mobile.evaluate(()=>__observedState.roarCooldown>5));
    await mobile.screenshot({path:path.join(output,'mobile-roar.png'),fullPage:true});
    await mobile.waitForTimeout(900);
    const beforeCooldown=await mobile.evaluate(()=>__observedState.roarCooldown);
    await mobile.locator('#roar').tap({force:true});
    assert.ok(await mobile.evaluate(()=>__observedState.roarCooldown)<=beforeCooldown,'toque durante recarga não dispara outra vez');
    assert.equal(await mobile.evaluate(()=>__observedState.player.lift),0,'rugir não aciona pulo sem querer');
    await mobile.setViewportSize({width:320,height:700});
    await mobile.waitForTimeout(100);
    const roarBounds=await mobile.locator('#roar').boundingBox(),jumpBounds=await mobile.locator('#jump').boundingBox();
    assert.ok(roarBounds.x+roarBounds.width<jumpBounds.x,'botões separados no celular estreito');
    assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    await mobile.setViewportSize({ width: 844, height: 390 });
    await mobile.waitForTimeout(200);
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.ok(await mobile.evaluate(() => Number.isFinite(__observedState.player.x)));
    assert.deepEqual(mobileErrors, [],JSON.stringify(await mobile.evaluate(()=>__canvasErrors)));
    console.log('PASS: HTML local; passos no chão; salto/chute/rugido; três inimigos fogem; animais continuam amigos; sete gravações reais; recarga; teclado R; toque; pausa; tarefas; celular 320px; rotação; nenhum erro de JavaScript.');
    console.log('Capturas:', output);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
