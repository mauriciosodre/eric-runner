const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const url = process.env.GAME_URL || pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const output = path.join(__dirname, '..', 'output', 'verification');
fs.mkdirSync(output, { recursive: true });
const PETS = ['pipo','lili','tico','bubi','nino','zazu','fifi','duda','ravi','lola','mimo','kiko'];
async function open(page, saved) {
  page.setDefaultTimeout(10000);
  const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error('Erro de página:',e.message); });
  await page.addInitScript(saved => {
    if (saved && localStorage.getItem('eric-runner-album-v1')===null) localStorage.setItem('eric-runner-album-v1', JSON.stringify(saved));
    let albumAPI;
    Object.defineProperty(globalThis,'DinoAlbum',{configurable:true,get:()=>albumAPI,set(value){albumAPI={...value,create(storage){return value.create(storage,()=>0);}};}});
    let engine;
    Object.defineProperty(globalThis, 'RunnerEngine', { configurable:true, get:()=>engine, set(value) {
      engine=value; const create=value.create, step=value.step;
      value.create=(...args)=>{globalThis.__state=create(...args);return __state;};
      value.step=()=>{};
      globalThis.__advance=seconds=>{while(seconds>.000001){const dt=Math.min(.05,seconds);step(__state,dt);seconds-=dt;}};
    }});
  }, saved);
  await page.goto(url); await page.waitForFunction(()=>!document.getElementById('start').disabled);
  return errors;
}
async function quiet(page) {
  await page.evaluate(()=>{
    const s=__state;s.items=[];s.mobs=[];s.obstacles=[];
    s.spawnIn=s.mobIn=s.obstacleIn=s.festivalIn=s.rescueIn=s.letterIn=Infinity;
    s.festival=0;s.rescue=null;s.shield=s.hurt=0;s.companionCooldown=Infinity;
  });
}
async function fits(page, selector) {
  const r=await page.locator(selector).boundingBox(),v=page.viewportSize();
  assert.ok(r && r.x>=-1 && r.y>=-1 && r.x+r.width<=v.width+1 && r.y+r.height<=v.height+1,`${selector} deve caber na tela`);
}
async function separateWordHUD(page) {
  const word=await page.locator('#word-panel').boundingBox();
  for(const selector of ['#mission','#health-meter']) {
    const hud=await page.locator(selector).boundingBox();
    const overlap=word.x<hud.x+hud.width && word.x+word.width>hud.x && word.y<hud.y+hud.height && word.y+word.height>hud.y;
    assert.equal(overlap,false,`a palavra não cobre ${selector}`);
  }
}
async function paintedCone(page) {
  return page.evaluate(()=>{
    const c=document.getElementById('game'),r=c.getBoundingClientRect(),s=__state,pixels=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    const x=Math.round(s.obstacles[0].x*c.width/s.width),range=Math.ceil(c.width/c.clientWidth*8);
    let top=c.height,bottom=-1;
    for(let y=0;y<c.height;y++)for(let col=Math.max(0,x-range);col<Math.min(c.width,x+range);col++) {
      const i=(y*c.width+col)*4;
      if(Math.abs(pixels[i]-244)<7 && Math.abs(pixels[i+1]-138)<7 && Math.abs(pixels[i+2]-59)<7){top=Math.min(top,y);bottom=y;}
    }
    return bottom<0?null:{x:r.x+(x-range)*r.width/c.width,y:r.y+top*r.height/c.height,width:2*range*r.width/c.width,height:(bottom-top+1)*r.height/c.height};
  });
}
async function hazards(page, mobile) {
  await page.locator('#start').click();await quiet(page);
  await page.evaluate(()=>{
    const s=__state;s.obstacles=[{kind:'cone',width:60,height:60,x:s.player.x+260,hit:false}];__advance(.01);
  });
  if(mobile && page.viewportSize().height<290) await page.evaluate(()=>{__state.obstacles[0].x=__state.width/2;__advance(.01);});
  await page.waitForFunction(()=>document.getElementById('jump').classList.contains('jump-cue'));
  assert.equal(await page.locator('#jump-cue').isVisible(),true,'o obstáculo anuncia o salto antes de encostar');
  await fits(page,'#jump-cue');
  await separateWordHUD(page);
  if(mobile) {
    const letters=await page.locator('#word-panel').boundingBox(),mission=await page.locator('#mission').boundingBox();
    assert.ok(letters.y>=mission.y+mission.height+4,'a palavra tem espaço próprio abaixo da missão');
    const body=await paintedCone(page),paintedBottom=body && body.y+body.height;
    const buttonTop=Math.min((await page.locator('#jump').boundingBox()).y,(await page.locator('#roar').boundingBox()).y);
    assert.ok(paintedBottom!==null && paintedBottom<buttonTop-8,'o corpo do obstáculo fica inteiro acima dos botões de toque');
    assert.ok((await page.locator('#jump-cue').boundingBox()).y>paintedBottom+8,'o aviso do botão também fica abaixo da pista');
    if(page.viewportSize().height<290) {
      const album=await page.locator('#album').boundingBox();
      assert.ok(mission.x+mission.width<album.x,'a missão deixa o botão do álbum inteiro à vista');
      const cone=await page.evaluate(()=>{const c=document.getElementById('game').getBoundingClientRect(),o=__state.obstacles[0];return {x:c.x+o.x*c.width/__state.width,width:o.width*c.height/540,height:o.height*c.height/540};});
      const overlap=letters.x<cone.x+cone.width/2 && letters.x+letters.width>cone.x-cone.width/2 && letters.y<paintedBottom && letters.y+letters.height>paintedBottom-cone.height;
      assert.equal(overlap,false,'a palavra não esconde o cone mesmo com a barra do navegador reduzindo a altura');
    }
  }
  await page.screenshot({path:path.join(output,`refined-hazard-${page.viewportSize().width}.png`),fullPage:true});
  await page.locator('#pause').click();
  assert.equal(await page.locator('#jump-cue').isVisible(),false,'a pista não pede salto durante a pausa');
  await page.locator('#resume').click();
  await page.evaluate(()=>{__state.obstacles[0].x=__state.player.x+125;__advance(.01);});
  if(mobile)await page.locator('#jump').tap();else await page.keyboard.press('KeyZ');
  await page.evaluate(()=>__advance(.5));
  assert.equal(await page.evaluate(()=>__state.health),20,'um salto real evita o obstáculo');
  assert.equal(await page.evaluate(()=>__state.obstacles[0].cleared),true,'o salto resolve o obstáculo');
  await page.waitForFunction(()=>!document.getElementById('jump').classList.contains('jump-cue'));
  await quiet(page);
  await page.evaluate(()=>{
    const s=__state;
    s.obstacles=['block','cone','log','tire','crate'].map((kind,i)=>({kind,x:s.player.x+170+i*150,width:kind==='log'?80:62,height:54,hit:false}));
    s.mobs=['slime','robot','cloud','balloon','mushroom','car'].map((type,i)=>({type,x:s.player.x+110+i*145,lift:0,width:48,height:48,phase:i,resolved:false}));
    __advance(.01);
  });
  await page.screenshot({path:path.join(output,`refined-toys-${page.viewportSize().width}.png`),fullPage:true});
  await quiet(page);
  await page.evaluate(()=>{
    const s=__state;
    s.mobs=['rabbit','parrot','dino','turtle','butterfly'].map((type,i)=>({type,x:s.player.x+130+i*150,lift:type==='parrot'?126:type==='butterfly'?144:0,width:48,height:48,phase:i,resolved:false,friendly:true}));
    __advance(.01);
  });
  await page.screenshot({path:path.join(output,`refined-friends-${page.viewportSize().width}.png`),fullPage:true});
}
async function words(page) {
  await quiet(page);
  assert.equal(await page.locator('#word-panel').isVisible(),true);
  for(const letter of ['D','I','N','O']) {
    assert.equal(await page.locator('#word-panel').getAttribute('data-next-letter'),letter);
    await page.evaluate(letter=>{const s=__state;s.items.push({type:'letter',letter,x:s.player.x+40,lift:94,radius:30});__advance(.01);},letter);
    await page.waitForFunction(letter=>document.getElementById('word-panel').dataset.nextLetter!==letter,letter);
  }
  assert.equal(await page.evaluate(()=>__state.wordsCompleted),1);
  assert.equal(await page.evaluate(()=>__state.stars),1,'a palavra completa dá exatamente uma estrela');
  await page.locator('#word-celebration').waitFor({state:'visible'});
  assert.match(await page.locator('#word-celebration').textContent(),/DINO/);
  await page.evaluate(()=>{__state.obstacles=[{kind:'cone',width:60,height:60,x:__state.width/2,hit:false}];__advance(.01);});
  await page.screenshot({path:path.join(output,`word-obstacle-${page.viewportSize().width}.png`),fullPage:true});
  const body=await paintedCone(page),banner=await page.locator('#word-celebration').boundingBox();
  assert.ok(body,'o cone foi desenhado durante a comemoração');
  const overlap=banner.x<body.x+body.width && banner.x+banner.width>body.x && banner.y<body.y+body.height && banner.y+banner.height>body.y;
  assert.equal(overlap,false,'a comemoração da palavra deixa o cone inteiro visível');
  await fits(page,'#word-celebration');
  if(await page.evaluate(()=>matchMedia('(pointer:fine) and (max-width:800px)').matches)) assert.equal(await page.locator('#word-panel').isVisible(),false,'na janela estreita, a comemoração usa a faixa da palavra');
  else await fits(page,'#word-panel');
  await page.screenshot({path:path.join(output,`word-complete-${page.viewportSize().width}.png`),fullPage:true});
  await quiet(page);await page.evaluate(()=>{__state.wordIndex=4;__state.wordProgress=0;__advance(3.1);});
  await page.locator('#word-panel').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.getElementById('word-panel').dataset.nextLetter==='A');
  await separateWordHUD(page);await fits(page,'#word-panel');
  if(page.viewportSize().height<290) assert.ok((await page.locator('#word-panel').boundingBox()).x+(await page.locator('#word-panel').boundingBox()).width<(await page.locator('#roar').boundingBox()).x,'AMIGO cabe ao lado dos controles na tela baixa');
  await page.locator('#pause').click();
  assert.equal(await page.locator('#word-panel').isVisible(),false);
  assert.equal(await page.locator('#word-celebration').isVisible(),false);
  await page.locator('#home').click();
  assert.equal(await page.locator('#word-panel').isVisible(),false,'as letras não cobrem a seleção de herói');
}
async function album(page,mobile) {
  await page.locator('#album').click();
  assert.match(await page.locator('#album-count').textContent(),/12\s*\/\s*12/);
  assert.equal(await page.locator('#pet-grid [data-pet]').count(),6,'seis cartões grandes por página');
  assert.equal(await page.locator('#album-prev').isDisabled(),true);
  await page.locator('#album-next').click();
  assert.equal(await page.locator('[data-pet="mimo"]').isVisible(),true);
  assert.equal(await page.locator('#album-next').isDisabled(),true);
  assert.match(await page.locator('[data-pet="fifi"] .pet-count').textContent(),/3/,'os reencontros aparecem no cartão');
  if(mobile)await page.locator('[data-pet="mimo"]').tap();else await page.locator('[data-pet="mimo"]').click();
  assert.equal(await page.locator('[data-pet="mimo"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>__state.companionId),'mimo');
  await fits(page,'#album-close');await fits(page,'#companion-none');await fits(page,'#album-next');
  await page.screenshot({path:path.join(output,`album-twelve-${page.viewportSize().width}.png`),fullPage:true});
  await page.locator('#album-close').click();
  await page.reload();await page.waitForFunction(()=>!document.getElementById('start').disabled);
  await page.locator('#album').click();
  assert.equal(await page.locator('[data-pet="mimo"]').getAttribute('aria-pressed'),'true','a seleção restaura a página correta depois de recarregar');
  assert.match(await page.locator('[data-pet="fifi"] .pet-count').textContent(),/3/);
}
async function reunion(page) {
  await page.locator('#album-close').click();await page.locator('#start').click();await quiet(page);
  await page.evaluate(()=>{
    const s=__state;
    for(let i=0;i<3;i++){s.taskIndex=0;s.taskProgress=0;RunnerEngine.collect(s,'ball');RunnerEngine.collect(s,'ball');}
  });
  await page.locator('#hatch-screen').waitFor({state:'visible'});
  assert.match(await page.locator('#hatch-title').textContent(),/voltou/,'ovos repetidos celebram um reencontro');
  assert.equal(await page.locator('#hatch-name').textContent(),'Pipo');
  assert.match(await page.locator('#hatch-count').textContent(),/2 encontros/);
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('eric-runner-album-v1')));
  assert.equal(saved.counts.pipo,2);assert.equal(saved.unlocked.length,12,'reencontros não duplicam cartões');
  await page.locator('#hatch-play').click();
  assert.equal(await page.evaluate(()=>__state.companionId),'pipo','um amigo repetido também pode ser escolhido');
  assert.equal(await page.evaluate(()=>__state.paused),false);
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--allow-file-access-from-files']});
  try {
    for(const config of [{width:667,height:247,mobile:true},{width:568,height:247,mobile:true},{width:1280,height:850},{width:600,height:850},{width:700,height:850},{width:761,height:850},{width:667,height:320,mobile:true},{width:844,height:390,mobile:true}]) {
      const {width,height,mobile=false}=config,viewport={width,height},context=await browser.newContext({viewport,isMobile:mobile,hasTouch:mobile});
      const page=await context.newPage();
      const errors=await open(page,{version:1,unlocked:PETS,selected:null,eggProgress:0,rescues:2,counts:{fifi:3}});
      await hazards(page,mobile);await words(page);
      if(height>=290){await album(page,mobile);await reunion(page);}
      assert.deepEqual(errors,[]);await context.close();
    }
    console.log('PASS refinamento: salto indicado e funcional, novos amigos, letras, álbum de 12 com reencontros e seleção persistida em oito telas.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
