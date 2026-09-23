const fs=require('fs'), path=require('path'), http=require('http'), assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream'});res.end(err?'':data);});
});
(async()=>{
 await new Promise(r=>server.listen(9379,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:9379/?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);
 await page.evaluate(()=>{const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);g._guideGreeted=true;g.narrate=(text,o)=>{g._voiceLocked=false;g.prepareNarratorReveal(text);g.setState({speaking:false,interactive:true,storyContent:true,storyDialogue:true,storyControls:true,wordReveal:'complete'},()=>o?.then?.());};const k=g.steps().findIndex(s=>s.q==='recall');g.setState({k});g.runStep(k);});
 await page.waitForFunction(()=>!__poly.locked()&&__poly.step().q==='recall');
 const plus=page.getByRole('button',{name:'Increase number of sides',exact:true});
 const activityNext=page.locator('.story-surface').getByRole('button',{name:'Next',exact:true});
 assert.equal(await activityNext.count(),0);
 await page.waitForFunction(()=>!!__poly.state.nudge,{},{timeout:12000});
 assert(await page.evaluate(()=>{const b=document.querySelector('[aria-label="Increase number of sides"]').getBoundingClientRect(),s=__poly.safeRef.current.getBoundingClientRect(),scale=s.width/__poly.safeRef.current.offsetWidth;return Math.abs(__poly.state.nudge.x-(b.x+b.width/2-s.x)/scale)<1;}),'Hand points to Plus');
 for(let n=4;n<=8;n++){
 await plus.click();assert(await page.evaluate(()=>!__poly.state.nudge),'Interaction removes idle cue');
 await page.waitForFunction(n=>__poly.state.n===n&&!__poly.state.morph,n);
 }
 assert(await page.evaluate(()=>__poly.state.recallComplete));
 assert.equal(await activityNext.count(),1,'Only one activity Next');
 const p=await plus.boundingBox(),n=await activityNext.boundingBox();assert(n.x>p.x+p.width+10,'Next clears Plus');
 await page.evaluate(()=>{__poly._qaSounds=[];const sfx=__poly.sfx;__poly.sfx=function(kind){this._qaSounds.push(kind);sfx.call(this,kind);};});
 await page.getByRole('button',{name:'Decrease number of sides',exact:true}).click();
 await page.waitForFunction(()=>!__poly.state.morph);
 await plus.click();await page.waitForFunction(()=>!__poly.state.morph);
 assert(await page.evaluate(()=>!__poly._qaSounds.includes('done')),'Revisiting does not replay completion');
 await activityNext.click();
 await page.waitForFunction(()=>__poly.step().sc==='SUMMARY'&&!__poly.locked());
 assert.equal(await page.locator('.story-surface svg').count(),6);
 const names=['Triangle','Quadrilateral','Pentagon','Hexagon','Heptagon','Octagon'];
 for(const name of names)assert(await page.getByText(name,{exact:true}).isVisible());
 assert(await page.getByText('A polygon is a closed figure made only of straight sides.',{exact:true}).isVisible());
 const out=path.join(__dirname,'output','recall-summary');fs.mkdirSync(out,{recursive:true});
 for(const viewport of [{width:1440,height:810},{width:1024,height:768},{width:390,height:844}]){
 await page.setViewportSize(viewport);await page.waitForTimeout(350);
 const next=await activityNext.boundingBox();assert(next&&next.y>=0&&next.y+next.height<=viewport.height);
 const safe=await page.evaluate(()=>{const b=document.querySelector('.story-board').getBoundingClientRect();return [...document.querySelectorAll('.story-surface svg')].every(s=>{const r=s.getBoundingClientRect();return r.left>b.left&&r.right<b.right&&r.top>b.top&&r.bottom<b.bottom;});});assert(safe);
 await page.screenshot({path:path.join(out,viewport.width+'.png')});
 }
 await activityNext.click();await page.waitForFunction(()=>__poly.step().sc==='C1');
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.evaluate(()=>{const g=__poly,k=g.steps().findIndex(s=>s.q==='recall');g.setState({k});g.runStep(k);});await page.waitForFunction(()=>!__poly.locked());
 for(let n=4;n<=8;n++){await plus.click();await page.waitForFunction(n=>__poly.state.n===n&&!__poly.state.morph,n);}
 await activityNext.click();
 await page.waitForFunction(()=>__poly.step().sc==='SUMMARY'&&!__poly.locked());
 assert.deepEqual(errors,[]);console.log('PASS: idle Plus cue, dismissal, six polygons, one spaced activity Next, completion sound once, summary, three viewports and reduced motion.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
