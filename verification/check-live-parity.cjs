// Exercise a fresh origin with production-like case-sensitive paths and slow assets.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
const missing=[];
function exactFile(relative){
  let current=root;
  for(const part of relative.split('/')){
    if(!part||part==='.'||part==='..'||!fs.existsSync(current)||!fs.statSync(current).isDirectory()||!fs.readdirSync(current).includes(part))return null;
    current=path.join(current,part);
  }
  return fs.statSync(current).isFile()?current:null;
}
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg','.wav':'audio/wav'};
const catalog={window:{}};
require('vm').runInNewContext(fs.readFileSync(path.join(root,'voiceovers/recordings.js'),'utf8'),catalog);
for(const entry of catalog.window.POLYGON_RECORDINGS)assert(exactFile(decodeURIComponent(entry.src)),'Recording path matches exact production filename: '+entry.src);
const server=http.createServer((req,res)=>{
  let relative=decodeURIComponent(new URL(req.url,'http://localhost').pathname).slice(1)||'index.html';
  if(relative==='favicon.ico'){res.writeHead(204);return res.end();}
  const file=exactFile(relative);
  if(!file){missing.push(relative);res.writeHead(404);return res.end('Missing');}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'public, max-age=0, must-revalidate'});
  fs.createReadStream(file).pipe(res);
});
(async()=>{
  await new Promise(r=>server.listen(9394,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=document-user-activation-required']});
  try{
    const page=await browser.newPage({viewport:{width:1893,height:907}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.testMedia=[];const NativeAudio=Audio;
      // Some headless Chrome builds exempt localhost from autoplay policy.
      // Reproduce the browser's NotAllowedError deterministically until a real tap.
      window.testActivated=false;
      addEventListener('pointerup',event=>{if(event.isTrusted)window.testActivated=true;},true);
      window.Audio=class extends NativeAudio{
        constructor(...args){super(...args);testMedia.push(this);this.attempts=0;}
        play(){this.attempts++;return testActivated?super.play():Promise.reject(new DOMException('User activation required','NotAllowedError'));}
      };
      window.testSpeechCalls=0;
      const speak=speechSynthesis.speak.bind(speechSynthesis);
      speechSynthesis.speak=u=>{testSpeechCalls++;return speak(u);};
    });
    let releaseCatalog;const catalogGate=new Promise(r=>releaseCatalog=r);
    await page.route('**/voiceovers/recordings.js',async route=>{await catalogGate;await route.continue();});
    await page.route('**/assets/fonts/nunito-latin.woff2',async route=>{await new Promise(r=>setTimeout(r,900));await route.continue();});
    const navigation=page.goto('http://127.0.0.1:9394/?intro=0');
    await page.waitForTimeout(1500);
    // Playwright evaluate normally grants user activation; keep this a truly fresh origin.
    const cdp=await page.context().newCDPSession(page);
    const ready=await cdp.send('Runtime.evaluate',{expression:'!!window.__poly?.state.ready',returnByValue:true,userGesture:false});
    assert(!ready.result.value,'Startup waits for the voice catalog');
    releaseCatalog();await navigation;
    await page.waitForFunction(()=>window.__poly?.state.voiceError,{},{timeout:20000}).catch(async error=>{
      console.log(await page.evaluate(()=>({ready:window.__poly?.state.ready,k:window.__poly?.state.k,voiceError:window.__poly?.state.voiceError,media:window.testMedia.map(a=>({src:a.src,paused:a.paused,time:a.currentTime,attempts:a.attempts})),text:document.body.innerText})),errors,missing);throw error;
    });
    assert.equal(await page.evaluate(()=>testSpeechCalls),0,'Slow catalog must not switch recorded narration to TTS');
    assert(await page.evaluate(()=>document.fonts.check('800 46px Nunito')),'Font is loaded before layout');
    const initial=await page.evaluate(()=>({k:__poly.state.k,narr:__poly.state.narr}));
    await page.waitForTimeout(8000);
    assert.deepEqual(await page.evaluate(()=>({k:__poly.state.k,narr:__poly.state.narr})),initial,'Blocked autoplay never skips a screen');
    assert(await page.evaluate(()=>__poly.locked()),'The unheard instruction remains pending');
    const before=await page.evaluate(()=>testMedia.length);
    await page.getByRole('button',{name:'Tap to play audio',exact:true}).click();
    await page.waitForFunction(()=>!__poly.state.voiceError&&testMedia.at(-1).currentTime>.1);
    assert.equal(await page.evaluate(()=>testMedia.length),before+1,'A pointer-up plus click starts just one retry');
    assert.equal(await page.evaluate(()=>__poly.state.k),initial.k,'Recovery resumes the same screen');
    assert(await page.evaluate(()=>__poly.state.revealedWords>0||__poly.state.wordReveal==='recorded'));
    const rect=await page.locator('.lesson-background').boundingBox();
    assert(rect.x<=0&&rect.y<=0&&rect.x+rect.width>=1893&&rect.y+rect.height>=907,'Single background covers a non-16:9 viewport');
    assert(Math.abs(rect.width/rect.height-16/9)<.001,'Artwork is not stretched');
    // A transient failed download must offer recovery without invoking its completion callback.
    await page.route('**/*.mp3',route=>route.fulfill({status:503,body:'Temporary failure'}));
    await page.evaluate(()=>{const g=__poly;g.timers.forEach(clearTimeout);g._stopRecordedVoice?.();g.spkId++;window.testCompleted=false;g.speak('Look! A point.',()=>window.testCompleted=true);});
    await page.waitForFunction(()=>!!__poly.state.voiceError);
    await page.waitForTimeout(2500);
    assert.equal(await page.evaluate(()=>testCompleted),false,'A failed download never counts as completed narration');
    await page.unroute('**/*.mp3');
    await page.getByRole('button',{name:'Tap to play audio',exact:true}).click();
    await page.waitForFunction(()=>testCompleted,{},{timeout:15000});
    assert.deepEqual(missing,[],'All requested assets exist with production-safe filename casing');
    assert.deepEqual(errors,[]);
    console.log('PASS: delayed voice catalog and fonts, cold-origin autoplay block, no silent skips, single-gesture real MP3 recovery, transient download retry, exact asset paths and full-viewport 16:9 artwork.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
