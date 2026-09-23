const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','opening-feedback');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.wav':'audio/wav','.woff2':'font/woff2','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'missing':data);});
});
(async()=>{
 await new Promise(r=>server.listen(9363,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:810}}), errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
 window.testMedia=[];
 window.Audio=class {
 constructor(src){this.src=src;this.currentTime=0;this.paused=true;this.duration=NaN;testMedia.push(this);}
 play(){this.paused=false;return Promise.resolve();}
 pause(){this.paused=true;this.onpause?.();}
 removeAttribute(){} load(){}
 };
 });
 await page.goto('http://127.0.0.1:9363/index.html?intro=0');
 await page.waitForFunction(()=>window.__poly?.state.ready);
 await page.evaluate(()=>{const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);g.enterScreen=()=>60000;g.advance=()=>window.advanced=true;});
 const show=async k=>{
 await page.evaluate(k=>{
 const g=__poly;g.setState({k});g.runStep(k);g._voiceLocked=false;
 g.setState({guideHidden:false,storyContent:true,storyDialogue:true,storyControls:true,interactive:true,speaking:false,magicReveal:false,drawn:true,ocWords:{open:true,closed:true}});
 window.advanced=false;
 },k);
 await page.waitForTimeout(550);
 };
 const positions=()=>page.locator('[data-oc-choice]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,w:r.width};}));
 for(const reduced of [false,true]){
 await page.emulateMedia({reducedMotion:reduced?'reduce':'no-preference'});
 for(let k=4;k<=8;k++){
 await show(k);const before=await positions();
 await page.evaluate(()=>{const g=__poly;window.mediaCount=testMedia.length;g.choose(g.step().ans==='open'?'closed':'open');});
 await page.waitForFunction(()=>testMedia.length>window.mediaCount);
 await page.evaluate(()=>testMedia.at(-1).onplaying());
 await page.waitForTimeout(1200);
 assert(await page.evaluate(()=>!__poly.state.ocRetire&&!window.advanced),'Do not merge on the old one-second timer');
 assert.deepEqual(await positions(),before,'Both choices retain their positions during narration');
 await page.evaluate(()=>{const a=testMedia.at(-1),entry=PolygonRecordedVoice.find(__poly.state.narr);a.currentTime=entry.words.at(-1).start;a.ontimeupdate();});
 assert(await page.evaluate(()=>!__poly.state.ocRetire),'Wait until the final word finishes, not its onset');
 await page.evaluate(()=>testMedia.at(-1).onended());
 assert(await page.evaluate(()=>__poly.state.ocRetire&&!window.advanced),'Merge follows real media completion');
 await page.waitForTimeout(550);
 const settled=await page.evaluate(()=>{
 const right=document.querySelector('[data-oc-choice][aria-label="'+(__poly.step().ans==='open'?'Open':'Closed')+'"]');
 const r=right.getBoundingClientRect(),b=document.querySelector('.story-board').getBoundingClientRect();
 return Math.abs(r.x+r.width/2-b.x-b.width/2)<1;
 });
 assert(settled,'Correct answer settles at the center');
 assert(await page.evaluate(()=>!window.advanced),'Allow time to read the centered answer');
 await page.waitForFunction(()=>window.advanced);
 }
 }
 // A callback captured on an old screen must not collapse the new screen's choices.
 await show(4);
 await page.evaluate(()=>{__poly.feedback=(text,done)=>window.staleFeedback=done;__poly.choose('open');});
 await show(5);await page.evaluate(()=>staleFeedback());
 assert(await page.evaluate(()=>!__poly.state.ocRetire&&!window.advanced));
 assert.deepEqual(errors,[]);
 console.log('PASS: screens 5–9 hold both buttons until recorded feedback ends, then merge, pause and advance; reduced motion and stale completion covered.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
