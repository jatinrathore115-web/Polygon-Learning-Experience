const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','opening-alignment');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'missing':data);});
});
(async()=>{
 fs.mkdirSync(out,{recursive:true}); await new Promise(r=>server.listen(9360,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:9360/index.html?intro=0');
 await page.waitForFunction(()=>window.__poly?.state.ready);
 await page.evaluate(()=>{const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);g._guideGreeted=true;g.enterScreen=()=>0;g.speak=(text,done)=>{window.finishVoice=done;};g.setState({storyContent:true,storyDialogue:true,drawn:true});g.setState({k:2});g.runStep(2);});
 await page.waitForFunction(()=>!!window.finishVoice);
 assert(await page.evaluate(()=>!__poly.state.zoomed));
 await page.evaluate(()=>finishVoice());
 await page.waitForFunction(()=>__poly.state.k===3);
 assert(await page.evaluate(()=>__poly.state.zoomed&&!__poly.state.tracing));
 await page.evaluate(()=>__poly.storyVoiceStart());
 await page.waitForFunction(()=>__poly.state.tracing);
 await page.evaluate(()=>finishVoice());
 await page.waitForTimeout(1000); assert.equal(await page.evaluate(()=>__poly.state.k),3);
 await page.waitForFunction(()=>__poly.state.k===4);
 await page.evaluate(()=>{__poly.storyVoiceStart();__poly.keyword('open');__poly.keyword('closed');finishVoice();});
 await page.waitForTimeout(900);
 for(const viewport of [{width:1440,height:810},{width:1024,height:768},{width:390,height:844}]){
 await page.setViewportSize(viewport);
 await page.waitForTimeout(150);
 const bounds=await page.evaluate(()=>{
 const svg=document.querySelector('.story-surface svg'),p=svg.querySelector('path:not([data-trace])');
 const bb=p.getBBox(),pt=svg.createSVGPoint();pt.x=bb.x;pt.y=bb.y;const a=pt.matrixTransform(p.getScreenCTM());
 pt.x=bb.x+bb.width;pt.y=bb.y+bb.height;const b=pt.matrixTransform(p.getScreenCTM());
 const board=document.querySelector('.story-board').getBoundingClientRect();
 const buttons=[...document.querySelectorAll('[data-oc-choice]')].map(e=>e.getBoundingClientRect());
 return{inside:a.x>board.left&&a.y>board.top&&b.x<board.right,clear:buttons.every(r=>r.top>b.y+4&&r.bottom<board.bottom),zoom:__poly.state.zoomed};
 });
 assert(bounds.inside&&bounds.clear&&bounds.zoom,JSON.stringify({viewport,bounds}));
 await page.screenshot({path:path.join(out,'sequence-'+viewport.width+'.png')});
 }
 assert.deepEqual(errors,[]);console.log('PASS: browser narration sequence, full trace gate, persistent zoom and button clearance at desktop, tablet and mobile sizes.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
