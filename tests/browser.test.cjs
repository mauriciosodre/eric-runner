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
    globalThis.__roarBubbles=[];
    const fillText=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){
      if(this.canvas.id==='game' && text==='ROAAAAR!') {
        const t=this.getTransform(),r=this.canvas.getBoundingClientRect();
        __roarBubbles.push({top:r.top+(t.f-28*t.d)/this.canvas.height*r.height});
        if(__roarBubbles.length>100)__roarBubbles.shift();
      }
      return fillText.call(this,text,...args);
    };
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
      __sampleStarts.push({duration:this.buffer?.duration,rate:this.playbackRate.value,offset:args[1],limit:args[2]});
      return startAudio.apply(this,args);
    };
    const drawImage=CanvasRenderingContext2D.prototype.drawImage;
    const atlasBuffers=new WeakMap(),edges=new Map();
    CanvasRenderingContext2D.prototype.drawImage=function(image,...args) {
      let info=atlasBuffers.get(image);
      const asset=image.src?.split('?')[0].split('/').pop() || info?.asset;
      if(['eric.png','eric-actions.png','eric-run.png','eric-roar.png','eric-roar-actions.png'].includes(asset) && args.length===8) {
        const transform=this.getTransform();
        if(!info) {
          const faces={'68,1':[297,97],'498,1':[710.5,98],'934,1':[1154,101],'1386,1':[1598.5,98],'59,448':[274,97],'491,444':[699.5,98],'491,448':[699.5,98],'955,444':[1152.5,98],'955,449':[1152.5,98],'1386,444':[1603,97],'1386,448':[1603,97],'110,11':[628.5,266],'112,9':[309.5,106],'581,10':[785.5,106],'1056,13':[1271.5,110],'83,514':[313,115],'588,520':[791.5,110],'1091,516':[1276.5,108]};
          const face=faces[`${args[0]},${args[1]}`];
          let blackTop=0;
          if(asset==='eric-run.png') {
            const key=`${args[0]},${args[1]}`;
            if(!edges.has(key)) {
              const probe=document.createElement('canvas');probe.width=args[2];probe.height=3;
              const pc=probe.getContext('2d');pc.imageSmoothingEnabled=false;
              drawImage.call(pc,image,args[0],args[1],args[2],3,0,0,args[2],3);
              const pixels=pc.getImageData(0,0,args[2],3).data;
              for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>100 && Math.max(pixels[i],pixels[i+1],pixels[i+2])<100)blackTop++;
              edges.set(key,blackTop);
            }
            blackTop=edges.get(key);
          }
          info={asset,sx:args[0],sy:args[1],head:face?.[0],faceWidth:face?.[1],sole:args[1]+args[3],blackTop};
        }
        const scaleX=args[6]/args[2],scaleY=args[7]/args[3];
        const localSole=args[5]+(info.sole-args[1])*scaleY;
        const bottom=transform.transformPoint({x:0,y:localSole});
        const head=info.head===undefined?null:transform.transformPoint({x:args[4]+(info.head-args[0])*scaleX,y:0}).x;
        if(this.canvas.id==='game') {
          for(const layer of info.layers || [info]) {
            const sole= args[5]+(layer.sole-args[1])*scaleY;
            const point=transform.transformPoint({x:0,y:sole});
            const hx=layer.head===undefined?null:transform.transformPoint({x:args[4]+(layer.head-args[0])*scaleX,y:0}).x;
            __spriteDraws.push({...layer,head:hx===null?null:hx/transform.a,faceWidth:layer.faceWidth*scaleX,localSole:sole,sole:point.y/transform.d,lift:globalThis.__observedState?.player.lift || 0});
          }
          if(__spriteDraws.length>1500)__spriteDraws.shift();
        } else {
          const mapped={...info,head,faceWidth:info.faceWidth*scaleX*transform.a,sole:bottom.y};
          delete mapped.layers;
          const previous=atlasBuffers.get(this.canvas);
          if(this.globalCompositeOperation==='lighter' && previous)mapped.layers=[...(previous.layers || [previous]),{...mapped}];
          atlasBuffers.set(this.canvas,mapped);
        }
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
  const browser = await chromium.launch({ headless: true, args:['--allow-file-access-from-files'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await observe(page);
    await page.goto(url);
    await page.waitForFunction(() => !!globalThis.__observedState);
    assert.equal(await page.getByRole('button',{name:'Entrar em tela cheia'}).isVisible(),true,'há controle de tela cheia');
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
    assert.ok(await page.evaluate(()=>__spriteDraws.some(d=>d.asset==='eric.png')),'início usa a imagem frontal aprovada, não a pose diferente da folha');
    assert.ok(await page.evaluate(()=>__spriteDraws.filter(d=>d.asset==='eric.png').every(d=>Math.abs(d.localSole)<.001)),'imagem frontal aprovada fica apoiada no chão');
    await page.evaluate(()=>{__spriteDraws=[];});
    await page.getByRole('button', { name: 'Vamos correr!' }).click();
    await page.waitForTimeout(600);
    const walking=await page.evaluate(()=>__spriteDraws.filter(d=>d.asset==='eric-run.png'));
    assert.equal(new Set(walking.map(d=>`${d.sx},${d.sy}`)).size,8,'a corrida percorre as oito fases novas');
    assert.ok(walking.every(d=>Math.abs(d.sole-436)<.5),'as solas das oito fases tocam o chão');
    assert.ok(walking.every(d=>d.blackTop===0),'nenhum quadro contém sola preta do vizinho acima do capacete: '+JSON.stringify(walking.map(d=>({sx:d.sx,sy:d.sy,blackTop:d.blackTop}))));
    const heads=walking.map(d=>d.head);
    assert.ok(Math.max(...heads)-Math.min(...heads)<.5,'a cabeça mantém a mesma âncora durante todo o ciclo');
    await page.locator('canvas').focus();
    await page.keyboard.press('z');
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(()=>__observedState.player.lift>20),'Z pula de verdade');
    await page.waitForTimeout(850);
    await page.keyboard.press('Space');
    await page.waitForTimeout(100);
    assert.ok(await page.evaluate(() => __observedState.player.lift > 20), 'Espaço pula de verdade');
    await page.waitForTimeout(850);
    assert.equal(await page.evaluate(() => __observedState.player.lift), 0);
    await page.getByRole('button', { name: 'Pausar aventura' }).click();
    await page.evaluate(()=>{__spriteDraws=[];});
    const pausedTime = await page.evaluate(() => __observedState.time);
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(() => __observedState.time), pausedTime);
    assert.ok(await page.evaluate(()=>__spriteDraws.some(d=>d.asset==='eric.png')),'pausa também mantém o rosto frontal aprovado');
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.evaluate(() => {
      const s = __observedState;
      s.items=[];s.obstacles=[];s.mobs=[];
      s.spawnIn=s.obstacleIn=s.mobIn=Infinity;
      s.items.push({ type: 'ball', x: s.player.x + 5, lift: 20, radius: 23 });
    });
    await page.waitForFunction(() => __observedState.goals === 1);
    assert.equal(await page.locator('#goals').textContent(), '1');
    await page.waitForFunction(()=>__spriteDraws.some(d=>d.sx===455 && d.sy===449));
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
    await page.waitForFunction(() => __observedState.shield > 1.3);
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
    await page.keyboard.press('x');
    await page.waitForFunction(()=>__spriteDraws.some(d=>d.asset==='eric-roar-actions.png'));
    // O rugido move toda a câmera em até 1,8 px na vertical. A sola precisa
    // estar na origem local do personagem, acompanhando o chão que treme.
    assert.ok(await page.evaluate(()=>__spriteDraws.filter(d=>d.asset==='eric-roar-actions.png').every(d=>Math.abs(d.localSole)<.001 && Math.abs(d.sole-436)<2.3)),'rugido agachado mantém as solas no chão durante o tremor');
    await page.waitForTimeout(450);
    await page.screenshot({path:path.join(output,'desktop-roar-sequence.png'),fullPage:true});
    await page.waitForTimeout(400);
    const roarDraws=await page.evaluate(()=>__spriteDraws.filter(d=>d.asset==='eric-roar-actions.png'));
    assert.equal(new Set(roarDraws.map(d=>`${d.sx},${d.sy}`)).size,6,'preparação, força e retorno percorrem seis poses');
    const runningFace=walking.reduce((sum,d)=>sum+d.faceWidth,0)/walking.length;
    assert.ok(roarDraws.every(d=>Math.abs(d.faceWidth-runningFace)/runningFace<.05),'rosto mantém a mesma escala da corrida, sem afastar o Eric');
    await page.waitForFunction(()=>__observedState.scared===3);
    assert.ok(await page.evaluate(()=>__observedState.mobs.filter(m=>!RunnerEngine.isEnemy(m)).every(m=>!m.fleeing)),'rugido poupa os animais amigos');
    const playedSamples=await page.evaluate(()=>__sampleStarts);
    assert.ok(playedSamples.some(s=>s.duration>2.37 && Math.abs(s.rate-1.9)<.001 && Math.abs(s.offset-.12)<.001 && Math.abs(s.limit-2.25)<.001),'o especial toca o áudio anterior com o mesmo trecho e velocidade: '+JSON.stringify(playedSamples));
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
    // Os novos travessos têm desenhos e continuam sendo alvos do rugido.
    await page.evaluate(()=>{
      const s=__observedState;s.items=[];s.obstacles=[];s.mobs=[];s.shield=0;s.hurt=0;
      for(const [i,type] of ['balloon','mushroom','car'].entries())
        s.mobs.push({type,x:s.player.x+200+i*170,lift:0,width:48,height:48,phase:0,resolved:false});
    });
    await page.waitForTimeout(80);
    await page.screenshot({path:path.join(output,'desktop-new-mobs.png'),fullPage:true});
    const initialHealth=await page.evaluate(()=>__observedState.health);
    await page.evaluate(()=>{
      const s=__observedState;s.mobs=[];s.items=[];s.obstacles=[];
      s.health=20;s.hurt=0;s.shield=0;s.player.lift=0;s.player.vy=0;
      s.spawnIn=s.obstacleIn=s.mobIn=Infinity;
      RunnerEngine.collect(s,'coin');
    });
    await page.waitForTimeout(2000);
    await page.evaluate(()=>{const s=__observedState;s.obstacles=[{kind:'cone',x:s.player.x,width:46,height:43,hit:false}];});
    await page.waitForFunction(()=>__observedState.health===19);
    assert.equal(initialHealth,20);
    assert.equal(await page.locator('#health').textContent(),'19');
    await page.evaluate(()=>{
      const s=__observedState;s.health=1;s.hurt=0;s.shield=0;s.items=[];s.mobs=[];
      s.obstacles=[{kind:'cone',x:s.player.x,width:46,height:43,hit:false}];
      s.goals=12;s.treasures=5;s.distance=1000;
    });
    await page.waitForFunction(()=>__observedState.ended);
    assert.equal(await page.getByRole('button',{name:'Vamos de novo!'}).isVisible(),true);
    const record=Number(await page.locator('#highscore').textContent());
    assert.ok(record>=2325,'recorde inclui a última pontuação');
    assert.equal(await page.locator('#end-score').textContent(),await page.locator('#points').textContent());
    const frozenScore=await page.locator('#points').textContent();
    await page.keyboard.press('r');await page.waitForTimeout(120);
    assert.equal(await page.locator('#points').textContent(),frozenScore);
    await page.screenshot({path:path.join(output,'desktop-end.png'),fullPage:true});
    await page.getByRole('button',{name:'Vamos de novo!'}).click();
    assert.equal(await page.evaluate(()=>__observedState.health),20);
    assert.equal(await page.evaluate(()=>__observedState.ended),false);
    assert.equal(await page.locator('#end-screen').isVisible(),false);
    assert.equal(Number(await page.locator('#highscore').textContent()),record,'recomeçar preserva recorde');
    await page.reload();
    await page.waitForFunction(()=>!!__observedState);
    assert.equal(Number(await page.locator('#highscore').textContent()),record,'recorde sobrevive a recarregar a página');
    await page.getByRole('button',{name:'Entrar em tela cheia'}).click();
    await page.waitForFunction(()=>document.fullscreenElement?.id==='stage');
    assert.ok(await page.evaluate(()=>{
      const r=document.getElementById('stage').getBoundingClientRect();
      return r.width===innerWidth && r.height===innerHeight;
    }),'tela cheia nativa ocupa o viewport');
    await page.getByRole('button',{name:'Vamos correr!'}).click();
    await page.getByRole('button',{name:'Sair da tela cheia'}).click();
    await page.waitForFunction(()=>!document.fullscreenElement && __observedState.paused);
    assert.equal(await page.locator('#pause-screen').isVisible(),true,'sair da tela cheia pausa a partida');
    assert.deepEqual(errors, []);

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const mobileErrors = [];
    mobile.on('pageerror', e => {mobileErrors.push(e.message);console.error('MOBILE:',e.stack);});
    await observe(mobile);
    await mobile.goto(url);
    await mobile.waitForTimeout(350);
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'sem rolagem horizontal');
    assert.equal(await mobile.locator('#rotate-screen').isVisible(),true,'celular na vertical orienta a virar');
    await mobile.keyboard.press('Space');
    assert.equal(await mobile.evaluate(()=>__observedState.running),false,'não iniciar corrida atrás do aviso');
    await mobile.screenshot({path:path.join(output,'mobile-portrait.png')});
    await mobile.setViewportSize({width:844,height:390});
    await mobile.waitForTimeout(150);
    assert.equal(await mobile.locator('#rotate-screen').isVisible(),false);
    const stageBounds=await mobile.locator('#stage').boundingBox();
    assert.ok(stageBounds.x===0 && stageBounds.y===0 && Math.abs(stageBounds.width-844)<1 && Math.abs(stageBounds.height-390)<1,'jogo preenche o celular em landscape');
    await mobile.screenshot({ path: path.join(output, 'mobile-start.png') });
    assert.ok(await mobile.evaluate(()=>__spriteDraws.some(d=>d.asset==='eric.png')),'início no celular usa o mesmo rosto aprovado');
    await mobile.getByRole('button', { name: 'Vamos correr!' }).tap();
    await mobile.waitForFunction(()=>document.fullscreenElement?.id==='stage');
    assert.equal(await mobile.getByRole('button',{name:'Sair da tela cheia'}).getAttribute('aria-pressed'),'true','começar no celular ativa tela cheia real');
    await mobile.locator('canvas').tap({ position: { x: 140, y: 260 } });
    await mobile.waitForTimeout(100);
    assert.ok(await mobile.evaluate(() => __observedState.player.lift > 20), 'toque pula de verdade');
    await mobile.waitForTimeout(900);
    await mobile.getByRole('button', { name: 'PULAR', exact: true }).tap();
    await mobile.waitForTimeout(80);
    assert.ok(await mobile.evaluate(() => __observedState.player.lift > 20));
    await mobile.screenshot({ path: path.join(output, 'mobile-playing.png') });
    await mobile.evaluate(()=>{
      const s=__observedState;s.items=[];s.obstacles=[];s.mobs=[];
      s.spawnIn=s.obstacleIn=s.mobIn=Infinity;s.roarCooldown=0;
      s.mobs.push({type:'robot',x:s.player.x+95,lift:0,height:48,width:48,phase:0,resolved:false});
    });
    await mobile.getByRole('button',{name:'Rugir e afugentar os travessos'}).tap();
    await mobile.waitForFunction(()=>__observedState.scared>0);
    assert.ok(await mobile.evaluate(()=>__observedState.roarCooldown>5));
    await mobile.screenshot({path:path.join(output,'mobile-roar.png')});
    await mobile.waitForTimeout(900);
    const beforeCooldown=await mobile.evaluate(()=>__observedState.roarCooldown);
    await mobile.locator('#roar').tap({force:true});
    assert.ok(await mobile.evaluate(()=>__observedState.roarCooldown)<=beforeCooldown,'toque durante recarga não dispara outra vez');
    assert.equal(await mobile.evaluate(()=>__observedState.player.lift),0,'rugir não aciona pulo sem querer');
    await mobile.evaluate(()=>{__observedState.roarCooldown=0;});
    await mobile.getByRole('button',{name:'Rugir e afugentar os travessos'}).tap();
    await mobile.waitForTimeout(450);
    assert.ok(await mobile.evaluate(()=>{
      const bottom=document.querySelector('.record-line').getBoundingClientRect().bottom;
      return __roarBubbles.slice(-10).every(b=>b.top>bottom+3);
    }),'balão do rugido fica abaixo da vida e do recorde');
    await mobile.screenshot({path:path.join(output,'mobile-ground-roar-sequence.png')});
    assert.ok(await mobile.evaluate(()=>__spriteDraws.some(d=>d.asset==='eric-roar-actions.png' && d.lift===0)),'sequência de rugido também aparece no celular');
    // O Chromium não permite redimensionar a janela nativa enquanto está
    // em tela cheia. Saímos pelo mesmo botão disponível para os pais.
    await mobile.getByRole('button',{name:'Sair da tela cheia'}).tap();
    await mobile.waitForFunction(()=>!document.fullscreenElement && __observedState.paused);
    await mobile.setViewportSize({width:320,height:700});
    await mobile.waitForTimeout(100);
    assert.equal(await mobile.locator('#rotate-screen').isVisible(),true);
    assert.equal(await mobile.evaluate(()=>__observedState.paused),true,'virar para vertical pausa a corrida');
    const frozen=await mobile.evaluate(()=>({time:__observedState.time,cooldown:__observedState.roarCooldown}));
    await mobile.waitForTimeout(150);
    assert.deepEqual(await mobile.evaluate(()=>({time:__observedState.time,cooldown:__observedState.roarCooldown})),frozen,'rotação preserva corrida e poderes');
    assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    await mobile.setViewportSize({ width: 844, height: 390 });
    await mobile.waitForTimeout(200);
    assert.equal(await mobile.locator('#rotate-screen').isVisible(),false);
    await mobile.getByRole('button',{name:'Continuar',exact:true}).tap();
    assert.equal(await mobile.evaluate(()=>__observedState.paused),false);
    await mobile.setViewportSize({width:667,height:320});
    await mobile.waitForTimeout(150);
    const roarBounds=await mobile.locator('#roar').boundingBox(),jumpBounds=await mobile.locator('#jump').boundingBox();
    assert.ok(roarBounds.x+roarBounds.width<jumpBounds.x,'botões separados no celular pequeno em landscape');
    const controlGap=jumpBounds.x-(roarBounds.x+roarBounds.width);
    assert.ok(controlGap>=8 && controlGap<=18,'botões vizinhos, com espaço para não tocar no outro sem querer');
    assert.ok(roarBounds.height>=74 && jumpBounds.height>=74,'botões maiores para os dedinhos');
    const compactStage=await mobile.locator('#stage').boundingBox();
    assert.ok(compactStage.width===667 && compactStage.height===320);
    await mobile.screenshot({path:path.join(output,'mobile-landscape-small.png')});
    assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.ok(await mobile.evaluate(() => Number.isFinite(__observedState.player.x)));
    assert.ok(await mobile.evaluate(()=>{
      const health=document.getElementById('health-meter').getBoundingClientRect(),tools=document.querySelector('.tools').getBoundingClientRect(),mission=document.getElementById('mission').getBoundingClientRect();
      return health.left>=0 && health.right<=innerWidth && tools.left>=mission.right;
    }),'vida e controles cabem no celular pequeno');
    assert.deepEqual(mobileErrors, [],JSON.stringify(await mobile.evaluate(()=>__canvasErrors)));
    // Safari ou política de navegador podem impedir fullscreen e storage.
    // As recusas precisam manter a brincadeira funcionando.
    const fallback=await browser.newPage({viewport:{width:667,height:320},isMobile:true,hasTouch:true});
    const fallbackErrors=[];fallback.on('pageerror',e=>fallbackErrors.push(e.message));
    await observe(fallback);
    await fallback.addInitScript(()=>{
      Element.prototype.requestFullscreen=function(){return Promise.reject(new DOMException('Indisponível','NotAllowedError'));};
      Storage.prototype.getItem=function(){throw new DOMException('Bloqueado','SecurityError');};
      Storage.prototype.setItem=function(){throw new DOMException('Bloqueado','SecurityError');};
    });
    await fallback.goto(url);
    await fallback.getByRole('button',{name:'Vamos correr!'}).tap();
    await fallback.waitForFunction(()=>document.body.classList.contains('immersive'));
    await fallback.evaluate(()=>{
      const s=__observedState;s.goals=3;s.health=1;s.shield=0;s.hurt=0;
      s.items=[];s.mobs=[];s.spawnIn=s.obstacleIn=s.mobIn=Infinity;
      s.obstacles=[{kind:'cone',x:s.player.x,width:46,height:43,hit:false}];
    });
    await fallback.getByRole('button',{name:'Vamos de novo!'}).waitFor();
    await fallback.screenshot({path:path.join(output,'mobile-end.png')});
    await fallback.getByRole('button',{name:'Vamos de novo!'}).tap();
    assert.equal(await fallback.evaluate(()=>__observedState.health),20);
    assert.ok(Number(await fallback.locator('#highscore').textContent())>=300,'sem storage, recorde ainda vale durante a aba');
    assert.deepEqual(fallbackErrors,[],'recusas de tela cheia e armazenamento são tratadas');
    const pointerStart=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
    await pointerStart.goto(url);
    await pointerStart.locator('canvas').tap({position:{x:120,y:240}});
    await pointerStart.waitForTimeout(200);
    assert.equal(await pointerStart.evaluate(()=>document.fullscreenElement?.id),'stage','toque inicial no cenário também entra em tela cheia');
    await pointerStart.close();
    console.log('PASS:',url,'; dano após escudo breve; Z pula e X ruge; controles vizinhos de 76px; tela cheia real; 20 corações; fim e reinício; recorde no reload; storage bloqueado; corrida e rugido; landscape 844×390 e 667×320; nenhum erro de JavaScript.');
    console.log('Capturas:', output);
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
