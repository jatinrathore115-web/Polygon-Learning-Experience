const fs = require('fs'), path = require('path'), http = require('http');
const assert = require('assert');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(__dirname, 'output', 'background-transition');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server = http.createServer((req,res) => {
  const file = path.resolve(root, '.' + (decodeURIComponent(new URL(req.url,'http://localhost').pathname) || '/'));
  if (!file.startsWith(root + path.sep)) {res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data) => {res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'Not found':data);});
});
(async () => {
  fs.mkdirSync(out,{recursive:true});
  await new Promise(resolve => server.listen(9357,'127.0.0.1',resolve));
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1440,height:810}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const boot = async p => {
      await p.goto('http://127.0.0.1:9357/index.html?intro=0');
      await p.waitForFunction(()=>window.__poly?.state.ready);
      await p.evaluate(()=>{const g=__poly;g.timers.forEach(clearTimeout);g._stopRecordedVoice?.();g.later=()=>0;});
    };
    const show = async k => page.evaluate(k=>{
      const g=__poly;g.setState({k});g.runStep(k,false);g._voiceLocked=false;
      g.prepareNarratorReveal(g.instructionPages(g.step().narr)[0]);
      g.setState({wordReveal:'complete',storyContent:true,storyDialogue:true,storyControls:true,interactive:true,speaking:false});
    },k);
    const opacity = ()=>page.locator('.boundary-background').evaluate(e=>Number(getComputedStyle(e).opacity));
    await boot(page);
    await page.waitForFunction(()=>__poly.state.boundaryBackgroundReady);
    await show(12);await page.waitForTimeout(1300);
    assert.equal(await opacity(),0);
    const before=await page.locator('.story-board').boundingBox();
    await show(13);await page.waitForTimeout(400);
    const midway=await opacity();assert(midway>0&&midway<1,'Entry must crossfade; opacity='+midway);
    await page.waitForTimeout(900);
    assert.equal(await opacity(),1);
    assert.deepEqual(await page.locator('.story-board').boundingBox(),before,'Board stays steady');
    assert.equal(await page.getByRole('button',{name:/Figure [1-4]: (Straight|Curved)/}).count(),8);
    assert(await page.locator('.boundary-background').evaluate(e=>e.naturalWidth>0&&getComputedStyle(e).pointerEvents==='none'));
    await page.screenshot({path:path.join(out,'screen-14.png')});
    await page.getByRole('button',{name:'Figure 1: Straight',exact:true}).click();
    await page.waitForFunction(()=>__poly.state.dd[0]==='Straight');
    await show(14);await page.waitForTimeout(400);
    const exit=await opacity();assert(exit>0&&exit<1,'Exit must crossfade');
    await show(13);await page.waitForTimeout(1300);assert.equal(await opacity(),1,'Rapid reentry settles');
    await show(14);await page.waitForTimeout(1300);assert.equal(await opacity(),0);
    await page.emulateMedia({reducedMotion:'reduce'});
    await show(13);await page.waitForTimeout(50);assert.equal(await opacity(),1);
    assert.equal(await page.locator('.boundary-background').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
    for (const viewport of [{width:1024,height:768},{width:390,height:844}]) {
      await page.setViewportSize(viewport);
      const boxes=await page.locator('.boundary-background').evaluate(e=>{
        const a=e.getBoundingClientRect(),b=e.previousElementSibling.getBoundingClientRect();
        return [a.x-b.x,a.y-b.y,a.width-b.width,a.height-b.height];
      });
      assert(boxes.every(n=>Math.abs(n)<1),'Background layers remain aligned at '+viewport.width);
    }
    const broken=await browser.newPage();
    await broken.route('**/backgound*',route=>route.abort());
    await boot(broken);
    await broken.evaluate(()=>__poly.setState({k:13}));await broken.waitForTimeout(100);
    assert(await broken.locator('.boundary-background').evaluate(e=>getComputedStyle(e).opacity==='0'&&e.previousElementSibling.naturalWidth>0),'Failed image keeps original');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({entryMidpoint:midway,exitMidpoint:exit,stableBoard:true,answerClickable:true,reentry:true,reducedMotion:true,responsive:true,loadFailureFallback:true,errors}));
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
