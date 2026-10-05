const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const http=require('node:http');
const path=require('node:path');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
// Download real dos arquivos publicados. Um herói não escolhido não pode
// disputar a conexão com as folhas que liberam a próxima aventura.
async function server(){
 const app=http.createServer((req,res)=>{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.join(root,pathname==='/'?'index.html':pathname.slice(1));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
   res.writeHead(200,{'Content-Type':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(fs.readFileSync(file));
 });
 await new Promise(r=>app.listen(0,'127.0.0.1',r));
 return {url:`http://127.0.0.1:${app.address().port}/`,close:()=>new Promise(r=>app.close(r))};
}
const canonical=name=>name.replace(/\.webp$/,'.png');
async function isolatedChoice(browser,url,id){
 const page=await browser.newPage();
 const requested=[];
 await page.addInitScript(id=>localStorage.setItem('eric-runner-character-v1',id),id);
 page.on('request',request=>{const name=new URL(request.url()).pathname.split('/').pop();if(/\.(?:png|webp)$/.test(name))requested.push(name);});
 try{
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!document.getElementById('start').disabled);
   const foreign=requested.filter(name=>/-(?:run|actions|special|roar)(?:-actions)?\.(?:png|webp)$/.test(name)&&!name.startsWith(id+'-'));
   assert.deepEqual(foreign,[],`entrada de ${id} não baixa folhas de outros heróis`);
   const bytes=requested.reduce((sum,name)=>sum+fs.statSync(path.join(root,name)).size,0);
   assert.ok(bytes<4_000_000,`entrada de ${id} deve transferir menos de 4 MB de imagens; observado ${bytes}`);
   await page.locator('#start').click();
   assert.equal(await page.locator('#asset-loading').isVisible(),false,'todos os sprites escolhidos estão prontos antes de jogar');
   console.log(`PASS cold ${id}: ${requested.length} imagens, ${(bytes/1e6).toFixed(2)} MB, sem folhas de outro herói`);
 }finally{await page.close();}
}
async function readyHeroSurvivesForeignOutage(browser,url){
 const page=await browser.newPage();const attempted=[];
 await page.addInitScript(()=>localStorage.setItem('eric-runner-character-v1','samuel'));
 await page.route(/\/eric-(?:run|actions|roar|roar-actions)\.(?:png|webp)(?:\?.*)?$/,async route=>{attempted.push(canonical(new URL(route.request().url()).pathname.split('/').pop()));await route.abort('failed');});
 try{
   await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!document.getElementById('start').disabled);
   assert.deepEqual(attempted,[],'folhas do Eric não são requisitadas para jogar com Samuel');
   await page.locator('#start').click();
   assert.equal(await page.locator('#asset-loading').isVisible(),false,'falha dos arquivos não escolhidos não gera loading ou retry');
   console.log('PASS isolamento: arquivos de outro herói indisponíveis não são baixados nem bloqueiam a aventura');
 }finally{await page.close();}
}
async function coldMobileConnection(browser,url){
 const page=await browser.newPage({viewport:{width:667,height:320},isMobile:true,hasTouch:true});
 await page.addInitScript(()=>localStorage.setItem('eric-runner-character-v1','eric'));
 const session=await page.context().newCDPSession(page);
 await session.send('Network.enable');await session.send('Network.setCacheDisabled',{cacheDisabled:true});
 await session.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:625000,uploadThroughput:125000});
 try{
   const start=Date.now();await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!document.getElementById('start').disabled,null,{timeout:12000});
   const elapsed=Date.now()-start;
   assert.ok(elapsed<12000,`rede fria de 5 Mb/s prepara todas as poses em menos de 12 s; observado ${elapsed} ms`);
   await page.locator('#start').tap();
   assert.equal(await page.locator('#asset-loading').isVisible(),false,'o toque começa com todas as ações prontas');
   console.log(`PASS mobile cold 5 Mb/s: ${elapsed} ms para preparar o Eric completo`);
 }finally{await page.close();}
}
async function unchangedArtwork(browser,url){
 const page=await browser.newPage();
 try{
   await page.goto(url,{waitUntil:'domcontentloaded'});
   const results=await page.evaluate(async()=>{
     const names=['eric','eric-actions','eric-run','eric-roar','eric-roar-actions','daniel','daniel-actions','daniel-run','daniel-special','samuel','samuel-actions','samuel-run','samuel-special'];
     const load=async src=>{const image=new Image();image.src=src;await image.decode();return image;};
     const pixels=image=>{const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,canvas.width,canvas.height).data;};
     const rows=[];
     for(const name of names){
       const [original,optimized]=await Promise.all([load(name+'.png'),load(name+'.webp')]);
       // O Canvas pré-multiplica alfa ao desenhar: desmultiplicar contornos
       // semitransparentes pode arredondar um canal mesmo com arquivo lossless.
       // O rosto opaco deve permanecer exato; alfa é comparado em todos os pixels.
       const a=pixels(original),b=pixels(optimized);let alpha=true,opaqueExact=true;
       for(let i=0;i<a.length;i+=4){if(a[i+3]!==b[i+3])alpha=false;if(a[i+3]===255&&(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2]))opaqueExact=false;}
       rows.push({name,sameDimensions:original.naturalWidth===optimized.naturalWidth&&original.naturalHeight===optimized.naturalHeight,alpha,opaqueExact});
     }
     return rows;
   });
   assert.equal(results.length,13,'compara todas as poses e folhas aprovadas');
   for(const row of results){assert.equal(row.sameDimensions,true,`${row.name} mantém dimensões e recortes`);assert.equal(row.alpha,true,`${row.name} mantém transparência pixel a pixel`);if(['eric','daniel','samuel'].includes(row.name))assert.equal(row.opaqueExact,true,`${row.name} mantém todos os pixels opacos do rosto aprovado`);}
   console.log('PASS arte: 13 arquivos com dimensões/alfa intactos e três rostos frontais pixel a pixel');
 }finally{await page.close();}
}
(async()=>{
 const local=await server(),browser=await chromium.launch({headless:true});
 try{for(const id of ['samuel','daniel','eric'])await isolatedChoice(browser,local.url,id);await readyHeroSurvivesForeignOutage(browser,local.url);await coldMobileConnection(browser,local.url);await unchangedArtwork(browser,local.url);}
 finally{await browser.close();await local.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
