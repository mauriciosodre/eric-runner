const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {pathToFileURL}=require('node:url');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const url=process.env.GAME_URL || pathToFileURL(path.join(__dirname,'..','index.html')).href;
const output=path.join(__dirname,'..','output','verification');fs.mkdirSync(output,{recursive:true});
async function coneBody(page) {
  return page.evaluate(()=>{
    const c=document.getElementById('game'),s=__state,r=c.getBoundingClientRect(),data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    const x=Math.round(s.obstacles[0].x*c.width/s.width),range=Math.ceil(6*c.width/r.width);
    let bottom=-1;
    for(let y=0;y<c.height;y++)for(let col=x-range;col<x+range;col++){
      const i=(y*c.width+col)*4;
      if(Math.abs(data[i]-244)<7 && Math.abs(data[i+1]-138)<7 && Math.abs(data[i+2]-59)<7)bottom=y;
    }
    return bottom<0?null:r.y+bottom*r.height/c.height;
  });
}
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--allow-file-access-from-files']});
  try {
    for(const viewport of [{width:568,height:247},{width:667,height:320},{width:844,height:390}]){
      const context=await browser.newContext({viewport,isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
      await page.addInitScript(()=>{
        Element.prototype.requestFullscreen=()=>Promise.reject(new DOMException('Sem fullscreen','NotAllowedError'));
        let engine;
        Object.defineProperty(globalThis,'RunnerEngine',{configurable:true,get:()=>engine,set(value){
          engine=value;const create=value.create,step=value.step;
          value.create=(...args)=>{globalThis.__state=create(...args);return __state;};value.step=()=>{};
          globalThis.__advance=seconds=>{while(seconds>.000001){const dt=Math.min(.04,seconds);step(__state,dt);seconds-=dt;}};
        }});
      });
      await page.goto(url);await page.waitForFunction(()=>!document.getElementById('start').disabled);
      await page.locator('#start').tap();
      await page.evaluate(()=>{
        const s=__state;s.spawnIn=s.obstacleIn=s.mobIn=s.festivalIn=s.rescueIn=s.letterIn=s.rainbowIn=Infinity;
        s.obstacles=[{kind:'cone',width:60,height:60,x:s.width/2,hit:false}];s.items=[];s.mobs=[];
      });
      await page.waitForFunction(()=>document.getElementById('jump').classList.contains('jump-cue'));
      const jump=await page.locator('#jump').boundingBox(),roar=await page.locator('#roar').boundingBox(),v=page.viewportSize();
      for(const r of [jump,roar]){
        assert.ok(r.width>=118 && r.height>=54,'o alvo de toque continua grande');
        assert.ok(r.x>=0 && r.y>=0 && r.x+r.width<=v.width && r.y+r.height<=v.height,'controles inteiros dentro da tela');
        if(v.height<=350)assert.ok(r.height<=v.height*.24,'os controles não consomem um quarto da altura da tela pequena');
      }
      assert.ok(jump.x-roar.x-roar.width>=8 && jump.x-roar.x-roar.width<=14,'dois botões vizinhos com intervalo seguro');
      if(v.height<=350)assert.ok(roar.x>v.width*.49,'na tela pequena, os controles liberam a metade esquerda');
      const bottom=await coneBody(page),buttonTop=Math.min(jump.y,roar.y);
      assert.ok(bottom!==null && bottom<buttonTop-8,'o cone inteiro fica acima dos controles');
      // O último trecho laranja fica acima da faixa branca e da base do cone.
      if(v.height<=350)assert.ok(bottom>=v.height*(v.height<290?.65:.70)-12,`a pista conserva mais área vertical para enxergar os brinquedos: cone=${bottom}, botão=${buttonTop}, tela=${v.height}`);
      const cue=await page.locator('#jump-cue').boundingBox();
      assert.ok(cue.x>=jump.x && cue.x+cue.width<=jump.x+jump.width && cue.y>=jump.y && cue.y+cue.height<=jump.y+jump.height,'o aviso de pulo ocupa o botão, sem cobrir a pista');
      await page.screenshot({path:path.join(output,`mobile-space-${v.width}.png`)});
      await page.locator('#jump').tap();await page.evaluate(()=>{__state.obstacles=[];__advance(.2);});
      assert.ok(await page.evaluate(()=>__state.player.lift)>40,'o botão compacto ainda pula por toque real');
      await page.locator('#roar').tap();assert.ok(await page.evaluate(()=>__state.roar)>0,'o especial continua funcionando');
      assert.deepEqual(errors,[]);await context.close();
    }
    console.log('PASS espaço mobile: pista livre, controles grandes e vizinhos, aviso dentro do botão e toque funcional em três telas.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
