require('fs').mkdirSync('verification/output', { recursive: true });
/* Real-browser scene check. Uses local HTTP and Chrome's debugging protocol. */
const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),assert=require('assert');
const root=process.cwd(),port=9347,debug=9348;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mime={'.html':'text/html','.js':'text/javascript','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.svg':'image/svg+xml','.css':'text/css'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  const target=file===root?path.join(root,'index.html'):file;
  if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(target,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(target)]||'application/octet-stream'});res.end(err?'Not found':data);});
});
let chrome,ws;
(async()=>{
await new Promise(r=>server.listen(port,'127.0.0.1',r));
chrome=cp.spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless','--no-sandbox','--disable-gpu','--disable-software-rasterizer','--ignore-certificate-errors','--no-first-run','--mute-audio','--autoplay-policy=no-user-gesture-required','--remote-debugging-port='+debug,'--user-data-dir='+path.join(process.env.TEMP,'polygon-story-cdp'),'about:blank'],{windowsHide:true,stdio:'ignore'});
let tab;
for(let i=0;i<40;i++){try{tab=(await(await fetch('http://127.0.0.1:'+debug+'/json')).json()).find(t=>t.type==='page');if(tab)break;}catch{}await sleep(150);}
assert(tab,'Chrome did not start');ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map(),errors=[];
ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(m.error):p.resolve(m.result);}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text+': '+m.params.exceptionDetails.exception?.description);});
const call=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evaluate=async expression=>{const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description);return r.result.value;};
await call('Runtime.enable');await call('Page.enable');await call('Emulation.setDeviceMetricsOverride',{width:1440,height:810,deviceScaleFactor:1,mobile:false});
// Optional local copies keep the visual test usable when the CDN is unavailable.
const runtimeMap={};
for(const [url,file] of [['https://unpkg.com/react@18.3.1/umd/react.production.min.js','react-test-runtime.js'],['https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js','react-dom-test-runtime.js'],['https://unpkg.com/@babel/standalone@7.29.0/babel.min.js','babel-test-runtime.js']])if(fs.existsSync('verification/runtime/'+file))runtimeMap[url]='/verification/runtime/'+file;
await call('Page.addScriptToEvaluateOnNewDocument',{source:'window.__resources='+JSON.stringify(runtimeMap)+';window.__storyFlightSeen=false;(function watch(){if(window.__poly&&__poly.state.guideFlying){window.__storyFlightSeen=true;return;}requestAnimationFrame(watch);})()'});
await call('Page.navigate',{url:'http://127.0.0.1:'+port+'/index.html?intro=0'});
for(let i=0;i<60;i++){if(await evaluate('!!(window.__poly && window.__poly.state.ready)'))break;await sleep(100);}
assert(await evaluate('!!window.__poly'),'Lesson failed to boot: '+JSON.stringify(errors)+' '+await evaluate('document.body.innerText.slice(0,1200)'));
const initial=await evaluate('({content:__poly.state.storyContent,flying:__poly.state.guideFlying})');
assert(!initial.content,'Activity flashed before introduction');
await sleep(700);
assert(await evaluate('window.__storyFlightSeen'),'Bird must play its flight before landing');
await call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFileSync('verification/output/story-flight.png',Buffer.from(r.data,'base64')));
// Wait for the scheduled 1740ms dialogue reveal; screenshot time varies by machine.
for(let i=0;i<20;i++){if(await evaluate('__poly.state.storyDialogue'))break;await sleep(100);}
assert(await evaluate('!__poly.state.guideFlying && __poly.state.storyDialogue'),'Dialogue follows landing');
for(let i=0;i<60;i++){if(await evaluate('__poly.state.storyContent || __poly.state.voiceError'))break;await sleep(100);}
assert(await evaluate('__poly.state.storyContent'),'Real narration reveals activity: '+JSON.stringify(await evaluate('({voiceError:__poly.state.voiceError,speaking:__poly.state.speaking,pose:__poly.guide.sprite.seg,active:__poly.guide.voiceActive,reading:__poly._voiceReading,started:__poly._voiceStarted,recorded:!!window.PolygonRecordedVoice,queue:__poly._voiceQueue})'))+' '+JSON.stringify(errors));
await evaluate(`window.__storySavedLater=__poly.later; __poly.timers.forEach(clearTimeout); if(__poly._stopRecordedVoice)__poly._stopRecordedVoice(); __poly.later=()=>0;`);
const weather=await evaluate(`(()=>{const layer=document.querySelector('.scene-weather'),snow=document.querySelector('.scene-snow i'),star=document.querySelector('.scene-sparkles i');return {hidden:layer.getAttribute('aria-hidden'),input:getComputedStyle(layer).pointerEvents,behind:+getComputedStyle(layer).zIndex<+getComputedStyle(document.querySelector('.story-board')).zIndex,snow:getComputedStyle(snow).animationName,star:getComputedStyle(star).animationName,position:snow.getBoundingClientRect().top};})()`);
assert(weather.hidden==='true'&&weather.input==='none'&&weather.behind,'Weather must remain decorative behind gameplay');
assert(weather.snow==='snowDrift'&&weather.star==='skyTwinkle','Ambient animations must load');
await sleep(200);
assert(await evaluate(`document.querySelector('.scene-snow i').getBoundingClientRect().top`)!==weather.position,'Snow must actually move');
const results=[];
for(let k=0;k<47;k++){
  const result=await evaluate(`(()=>{const g=__poly,s=g.steps()[${k}];g.setState({k:${k}});g.runStep(${k},false);g.prepareNarratorReveal(g.instructionPages(s.narr)[0]);g.setState({narr:s.narr,wordReveal:'complete',storyContent:true,storyDialogue:true,storyControls:true,guideHidden:false,guideFlying:false,interactive:true,speaking:false,reveal:true,nums:s.count||((s.ph==='five')?5:0),voiceElapsedMs:10000});return {step:${k+1},flying:g.state.guideFlying};})()`);
  await sleep(25);results.push(result);
  if([4,5,16,20,22,23,42,46].includes(k)){
    // The boundary scene moves the guide and board over 950ms on entry/exit.
    await sleep(1100);
    const layout=await evaluate(`(()=>{const n=document.querySelector('.narrator-text'),b=document.querySelector('.dialogue-box'),a=n.getBoundingClientRect(),c=b.getBoundingClientRect();return {text:a.bottom<=c.bottom-8&&a.top>=c.top&&a.left>=c.left&&a.right<=c.right,content:!!document.querySelector('.story-surface'),bird:(()=>{const canvas=document.querySelector('.swiftee-wrap canvas'),r=canvas.getBoundingClientRect(),pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let edge=0;for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++)if(pixels[(y*canvas.width+x)*4+3]>32)edge=Math.max(edge,x);return r.left+(edge+1)/canvas.width*r.width<document.querySelector('.story-board').getBoundingClientRect().left;})()};})()`);
    assert(layout.text,'Dialogue overflow on screen '+(k+1));
    assert(layout.bird,'Visible guide overlaps the activity card on screen '+(k+1));
    if(k===4||k===5){
      const compact=await evaluate(`(()=>{const board=document.querySelector('.story-board').getBoundingClientRect(),safe=document.querySelector('.story-surface').getBoundingClientRect(),buttons=[...document.querySelectorAll('.story-controls > div')].map(e=>e.getBoundingClientRect());return {small:board.width<safe.width*.5,outside:buttons.length===2&&buttons.every(b=>b.top>=board.bottom+12&&b.bottom<=innerHeight),centered:buttons.length===2&&Math.abs((buttons[0].left+buttons[1].right)/2-(board.left+board.right)/2)<2};})()`);
      assert(compact.small&&compact.outside&&compact.centered,'Compact card and external buttons: '+JSON.stringify(compact));
    }
    await call('Page.captureScreenshot',{format:'png'}).then(r=>fs.writeFileSync('verification/output/story-screen-'+(k+1)+'.png',Buffer.from(r.data,'base64')));
  }
}
assert(results.every(r=>!r.flying),'Bird replayed its entrance between screens');assert(!errors.length,errors.join('\n'));
// Measure actual text, including feedback pages, rather than trusting width estimates.
const pages=await evaluate(`(()=>{const g=__poly,texts=g.steps().flatMap(s=>[s.narr,...Object.values(s.fb||{})]);return [...new Set(texts)].flatMap(t=>g.instructionPages(t));})()`);
const dialogueSizes=[];
for(const page of pages){
  await evaluate(`__poly.prepareNarratorReveal(${JSON.stringify(page)});__poly.setState({wordReveal:'complete',storyDialogue:true});`);await sleep(20);
  const box=await evaluate(`(()=>{const a=document.querySelector('.narrator-text').getBoundingClientRect(),b=document.querySelector('.dialogue-box').getBoundingClientRect(),scale=__poly.state.scale;return {fits:a.top>=b.top&&a.bottom<=b.bottom&&a.left>=b.left&&a.right<=b.right&&[...document.querySelectorAll('.narrator-text span')].every(e=>{const r=e.getBoundingClientRect();return r.left>=b.left&&r.right<=b.right;}),width:b.width/scale,height:b.height/scale,padding:(b.height-a.height)/scale,bottom:b.bottom,noTag:!document.querySelector('.dialogue-name'),font:getComputedStyle(document.querySelector('.narrator-text')).fontSize};})()`);
  assert(box.fits,'Dialogue overflow: '+page);
  assert(box.padding>=59&&box.padding<=61,'Dialogue has excess empty space: '+page);
  assert(box.noTag,'Name tag must be absent');
  assert(box.font==='46px','Keep the enlarged dialogue text readable');
  dialogueSizes.push(box);
}
assert(new Set(dialogueSizes.map(b=>Math.round(b.height))).size>=3,'Dialogue height should follow passage length');
assert(new Set(dialogueSizes.map(b=>Math.round(b.width))).size>=2,'Short passages should have a narrower bubble');
assert(Math.max(...dialogueSizes.map(b=>b.bottom))-Math.min(...dialogueSizes.map(b=>b.bottom))<1,'Dialogue tail should stay anchored');
await call('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
assert(await evaluate(`getComputedStyle(document.querySelector('.scene-snow')).display==='none'&&getComputedStyle(document.querySelector('.scene-sparkles i')).animationName==='none'`),'Reduced motion must stop ambient weather');
const rm=await evaluate(`(()=>{const g=__poly;g._guideGreeted=false;g.enterScreen(true);return {flying:g.state.guideFlying,content:g.guideStyle().animation,dialogue:g.state.storyDialogue};})()`);
assert(!rm.flying&&rm.dialogue&&rm.content==='none','Reduced motion must skip the flight');
await call('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false});await sleep(200);
assert(await evaluate(`(()=>{const a=document.querySelector('.story-board').getBoundingClientRect();return a.left>=0&&a.right<=innerWidth+1&&a.top>=0&&a.bottom<=innerHeight+1;})()`),'Tablet board is clipped');
// Keep the dialogue visible on phones without moving its bird anchor.
for(const width of [320,390,768]){
  await call('Emulation.setDeviceMetricsOverride',{width,height:740,deviceScaleFactor:1,mobile:false});await sleep(150);
  for(const k of [0,16]){
    await evaluate(`(()=>{const g=__poly;g.setState({k:${k}});g.runStep(${k},false);g.prepareNarratorReveal(g.instructionPages(g.steps()[${k}].narr)[0]);g.setState({wordReveal:'complete',storyDialogue:true,storyContent:true});})()`);await sleep(60);
    assert(await evaluate(`(()=>{const r=document.querySelector('.dialogue-box').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight&&!document.querySelector('.comic-accent');})()`),'Responsive dialogue bounds at '+width+'px on screen '+(k+1));
  }
}
await evaluate(`__poly.later=window.__storySavedLater;`);
fs.writeFileSync('verification/output/story-scene-results.json',JSON.stringify({intro:true,dialoguePages:pages.length,tabletFits:true,reducedMotion:true,steps:results.length,errors},null,2));
console.log('PASS: real flight, landing, playback-led reveal, 47 screens, '+pages.length+' dynamic dialogue pages, no name tag, tablet bounds, and reduced motion.');
await call('Browser.close');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{if(ws)ws.close();if(chrome)chrome.kill();server.close();});
