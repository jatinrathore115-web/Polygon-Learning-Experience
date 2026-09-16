const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','launch');
const target=process.argv[2];
let server;
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  if(!target){
    server=http.createServer((req,res)=>{
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
      if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
      fs.readFile(file,(err,data)=>{
        res.writeHead(err?404:200,{'Content-Type':({'.js':'text/javascript','.css':'text/css','.html':'text/html','.mp3':'audio/mpeg','.woff2':'font/woff2','.png':'image/png'})[path.extname(file)]||'application/octet-stream'});
        res.end(err?'Not found':data);
      });
    });
    await new Promise(r=>server.listen(9352,'127.0.0.1',r));
  }
  const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=document-user-activation-required']});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[],failed=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('requestfailed',r=>failed.push(r.url()));
    await page.addInitScript(()=>{let blocked=false;const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){this.playbackRate=6;if(!blocked){blocked=true;return Promise.reject(new DOMException('Test autoplay gate','NotAllowedError'));}return play.call(this);};});
    await page.goto(target||'http://127.0.0.1:9352/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>window.__poly?.state.voiceError,null,{timeout:45000}).catch(async e=>{console.log('BOOT',await page.evaluate(()=>({intro:!!document.querySelector('#ice-intro'),state:window.__poly?.state,text:document.body.innerText})),errors,failed);throw e;});
    assert.equal(await page.locator('.narrator-text').innerText(),'Tap anywhere to continue.');
    assert.equal(await page.locator('#ice-intro').count(),0,'Intro must release the lesson');
    assert.equal(await page.locator('#polygon-screen-navigator').count(),1,'Screen navigation must be available');
    await page.mouse.click(700,200);
    await page.waitForFunction(()=>__poly.state.k===4&&!__poly.locked(),{},{timeout:60000});
    await page.getByRole('button',{name:'Closed',exact:true}).waitFor();
    await page.screenshot({path:path.join(out,target?'production.png':'smoke.png')});
    assert(!errors.length,errors.join('\n'));
    assert(!failed.length,failed.join('\n'));
    fs.writeFileSync(path.join(out,target?'production.json':'smoke.json'),JSON.stringify({url:page.url(),introHandoff:true,autoplayRecovery:true,firstQuestion:true,errors,failed},null,2));
    console.log('PASS intro handoff, visible autoplay recovery, first question, local assets and no browser errors: '+page.url());
  }finally{await browser.close();server?.close();}
})().catch(e=>{console.error(e);server?.close();process.exitCode=1;});
