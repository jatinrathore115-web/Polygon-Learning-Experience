const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','polish');
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html'));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});
});
(async()=>{
 fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(9399,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[],issues=[],screens=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:9399/?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);
 await page.evaluate(()=>{const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);g._guideGreeted=true;g.later=()=>0;g.narrate=()=>{};});
 const total=await page.evaluate(()=>__poly.steps().length);
 for(let k=0;k<total;k++){
  await page.evaluate(k=>{const g=__poly;g.setState({k});g.runStep(k,false);g.prepareNarratorReveal(g.step().narr);g._voiceLocked=false;g.setState({storyContent:true,storyDialogue:g.step().sc!=='SUMMARY',storyControls:true,interactive:true,speaking:false,magicReveal:false,boundaryTravel:false,polygonTravel:false,drawn:true,guideFlying:false,wordReveal:'complete',ocWords:{open:true,closed:true}});},k);
  await page.waitForTimeout(1050);
  const result=await page.evaluate(()=>{
   const visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0;};
   const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};};
   const items=[...document.querySelectorAll('.story-surface [role="button"]')].filter(visible);
   const issues=[],stage=box(document.querySelector('[data-lesson]'));
   items.forEach((e,i)=>{const a=box(e),name=e.getAttribute('aria-label')||e.textContent.trim();
    if(a.x<stage.x-1||a.right>stage.right+1||a.y<stage.y-1||a.bottom>stage.bottom+1)issues.push('Clipped control: '+name);
    items.slice(i+1).forEach(f=>{if(e.contains(f)||f.contains(e))return;const b=box(f);if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>2)issues.push('Overlapping controls: '+name+' / '+(f.getAttribute('aria-label')||f.textContent.trim()));});
   });
   return {screen:__poly.state.k+1,scene:__poly.step().sc,issues};
  });
  screens.push(result);issues.push(...result.issues.map(s=>'Screen '+(k+1)+': '+s));
  await page.screenshot({path:path.join(out,'screen-'+(k+1)+'.png')});
 }
 for(let start=1;start<=total;start+=12){
  await page.setViewportSize({width:1440,height:1160});
  await page.setContent('<style>body{margin:0;background:#082854;display:grid;grid-template-columns:repeat(3,1fr);gap:8px;color:white;font:16px sans-serif}figure{margin:0}img{width:100%}</style>'+Array.from({length:Math.min(12,total-start+1)},(_,i)=>'<figure>Screen '+(start+i)+'<img src="http://127.0.0.1:9399/verification/output/polish/screen-'+(start+i)+'.png"></figure>').join(''));
  await page.locator('img').evaluateAll(es=>Promise.all(es.map(e=>e.decode())));await page.screenshot({path:path.join(out,'overview-'+start+'.png'),fullPage:true});
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({screens,errors,issues},null,2));
 assert.deepEqual(errors,[]);assert.deepEqual(issues,[]);console.log('PASS: all '+total+' screens, visible control bounds and overlap checks; screenshots and contact sheets saved.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
