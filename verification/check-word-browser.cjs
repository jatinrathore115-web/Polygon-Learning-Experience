const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html'));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});});
(async()=>{await new Promise(r=>server.listen(9391,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});try{
 const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:9391/?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);
 await page.evaluate(()=>{const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);g.narrate=()=>{};g.setState({k:17});g.runStep(17,false);window.Audio=class{constructor(){this.currentTime=0;this.duration=NaN;this.paused=true;window.testAudio=this;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}removeAttribute(){}load(){}};});
 await page.waitForTimeout(1200);
 const start=()=>page.evaluate(()=>{const g=__poly;window.entry=POLYGON_RECORDINGS.find(e=>e.text.startsWith('A closed figure'));window.starts=PolygonRecordedVoice.wordStarts(entry,entry.text);g.setState({narr:entry.text,storyContent:true,storyDialogue:true,storyControls:true,guideHidden:false});g.speak(entry.text,()=>window.ended=true);testAudio.duration=entry.duration;testAudio.onplaying();return starts;});
 const visible=()=>page.locator('.narrator-text > span').evaluateAll(es=>es.filter(e=>e.textContent.trim()&&getComputedStyle(e).opacity==='1').map(e=>e.textContent));
 const clock=async time=>{const expected=await page.evaluate(time=>{testAudio.currentTime=time;testAudio.ontimeupdate();return __poly.state.revealedWords;},time);await page.waitForTimeout(35);assert.equal((await visible()).length,expected,'Rendered words follow media time');};
 let starts=await start();await page.waitForTimeout(35);assert.deepEqual(await visible(),[]);
 for(const time of starts){await clock(Math.max(0,time-.005));await clock(time);}
 await start();await clock(starts[2]);await page.evaluate(()=>{testAudio.paused=true;testAudio.onpause();});const paused=await visible();
 await page.waitForTimeout(3500);assert.deepEqual(await visible(),paused,'Long pause never exposes unspoken words');
 await page.evaluate(()=>{testAudio.paused=false;testAudio.onplaying();});await clock(starts.at(-1));
 await page.evaluate(()=>{testAudio.currentTime=testAudio.duration;testAudio.onended();});await page.waitForTimeout(35);assert(await page.evaluate(()=>window.ended));
 await page.emulateMedia({reducedMotion:'reduce'});starts=await start();await clock(starts[0]);assert.equal((await visible()).length,1,'Reduced motion does not reveal the full sentence early');
 await page.setViewportSize({width:390,height:844});await clock(starts[3]);await clock(starts.at(-1));
 assert.deepEqual(errors,[]);console.log('PASS: Chrome renders complete-sentence word cues without fade delay, pauses for 3.5 seconds without advancing, finishes on audio end, and preserves timing in reduced motion and portrait.');
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
