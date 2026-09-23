const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),out=path.join(__dirname,'output','answer-feedback');
const server=http.createServer((req,res)=>{
 const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html'));
 if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
 fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.mp3':'audio/mpeg','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});
});
(async()=>{
 await new Promise(r=>server.listen(9388,'127.0.0.1',r));
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  fs.mkdirSync(out,{recursive:true});
  const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:9388/?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);
  await page.evaluate(()=>{
   const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);
   g.narrate=g.feedback=g.showBoundaryFeedback=()=>{};g.later=()=>0;g.armNudge=()=>{};
   window.sounds=[];g.sfx=name=>sounds.push(name);
  });
  const show=async k=>{
   await page.evaluate(k=>{
    const g=__poly;g.setState({k,sortAt:{},placed:{}});g.runStep(k,false);g._voiceLocked=false;g.prepareNarratorReveal(g.step().narr);
    g.setState({guideHidden:false,guideFlying:false,wordReveal:'complete',storyContent:true,storyDialogue:true,storyControls:true,interactive:true,speaking:false,magicReveal:false,drawn:true,ocWords:{open:true,closed:true}});window.sounds=[];
   },k);
   await page.waitForTimeout(1100);
   await page.evaluate(()=>{__poly._voiceLocked=false;__poly.setState({interactive:true,speaking:false,magicReveal:false,ocWords:{open:true,closed:true}});});
   await page.waitForFunction(()=>__poly.guide.sprite.ready(__poly.guide.d.states.happy.loop)&&__poly.guide.sprite.ready(__poly.guide.d.states.confused.loop));
  };
  const act=async code=>{
   const r=await page.evaluate(code=>{window.sounds=[];Function(code)();return{sound:[...sounds],pose:__poly.guide.sprite.seg.state,frames:__poly.guide.sprite.seg.frames,reaction:document.querySelector('.swiftee-wrap').dataset.answer};},code);
   await page.waitForTimeout(50);
   assert(!/[\u2713-\u2718\u2705\u274c\u00d7]/u.test(await page.locator('body').innerText()),'Learning feedback contains no tick or cross icons');
   assert.equal(await page.locator('.swiftee-wrap > :not(canvas)').count(),0,'Swiftee reacts with an expression only, without a swirl or caption');
   return r;
  };
  const expect=(r,correct)=>{assert.deepEqual(r.sound,[correct?'ok':'no'],'Exactly one answer SFX');assert.equal(r.pose,correct?'happy':'confused','Expression changes immediately');assert.equal(r.reaction,correct?'correct':'incorrect');assert.equal(r.frames,18);};
  const cases=[
   [4,"__poly.choose(__poly.step().ans)","__poly.choose(__poly.step().ans==='open'?'closed':'open')"],
   ...[5,6,7,8].map(k=>[k,"__poly.choose(__poly.step().ans)","__poly.choose(__poly.step().ans==='open'?'closed':'open')"]),
   [13,"__poly.ddPick(0,'Straight')()","__poly.ddPick(0,'Curved')()"],
   [15,"__poly.tapCard(0)()","__poly.tapCard(2)()"],
   [18,"__poly.tapCard(1)()","__poly.tapCard(0)()"],
   [23,"__poly.state.cnt=[5,0];__poly.checkCount()","__poly.state.cnt=[3,0];__poly.checkCount()"],
   [30,"__poly.state.cnt=[5,5];__poly.checkCount()","__poly.state.cnt=[3,5];__poly.checkCount()"],
   [35,"__poly.tapCard(0)()","__poly.tapCard(1)()"],
   [42,"__poly.tapCard(0)()","__poly.tapCard(1)()"],
   [44,"__poly.tapCard(3)()","__poly.tapCard(0)()"],
   [45,"__poly.tapCard(0)()","__poly.tapCard(2)()"],
   [43,"__poly.state.pickedFig=0;__poly.dropInto(0)()","__poly.state.pickedFig=0;__poly.dropInto(1)()"],
   [46,"__poly.state.pickedFig=0;__poly.dropInto(0)()","__poly.state.pickedFig=0;__poly.dropInto(1)()"]
  ];
  for(const[k,right,wrong]of cases){
   await show(k);console.log('Checking screen',k+1);expect(await act(wrong),false);
   if(k===44)await page.screenshot({path:path.join(out,'incorrect.png')});
   await show(k);expect(await act(right),true);
   if(k===44)await page.screenshot({path:path.join(out,'correct.png')});
  }
  await show(22);
  assert.deepEqual((await act("__poly.state.chip='Vertex';__poly.hitTarget('side')()")).sound,['no'],'Incorrect label gives only trial-and-error SFX');
  assert.equal(await page.evaluate(()=>__poly.state.placed.side),undefined);
  await show(45);
  const cards=page.locator('.story-surface .game-action').filter({has:page.locator('svg')});
  const face=()=>cards.first().evaluate(e=>({background:getComputedStyle(e).background,border:getComputedStyle(e).borderColor,shape:e.querySelector('svg').innerHTML}));
  /* Right and wrong are meant to be unmistakable from across a room: the card
     takes a coloured rim and face AND a halo, rather than the older treatment
     of an unchanged card with a soft shadow under it. The figure itself is
     what must survive -- feedback dresses the card, never the artwork. */
  const before=await face();expect(await act('__poly.tapCard(0)()'),true);
  const after=await face();
  assert.equal(after.shape,before.shape,'Correct feedback leaves the figure untouched');
  assert.notEqual(after.border,before.border,'A correct card is plainly marked, not left as it was');
  const glow=c=>cards.nth(c).evaluate(e=>getComputedStyle(e).boxShadow);
  const chan=s=>(s.match(/rgba?\([0-9]+, [0-9]+, [0-9]+/g)||[]).map(m=>m.split(/[^0-9]+/).filter(Boolean).map(Number));
  assert(chan(await glow(0)).some(c=>c[1]>140&&c[1]-c[0]>60&&c[1]-c[2]>40),'and is ringed in green');
  expect(await act('__poly.tapCard(2)()'),false);
  assert(chan(await glow(2)).some(c=>c[0]>170&&c[0]-c[1]>80&&c[0]-c[2]>80),'A wrong card is ringed in red');
  await page.waitForTimeout(1100);assert.equal(await page.locator('.swiftee-wrap').getAttribute('data-answer'),null,'Reaction cleans up');
  await show(18);expect(await act('__poly.tapCard(1)()'),true);assert.deepEqual((await act('__poly.tapCard(1)()')).sound,[],'Accepted answer cannot replay reward');
  await page.emulateMedia({reducedMotion:'reduce'});await show(45);expect(await act('__poly.tapCard(0)()'),true);
  assert(await page.evaluate(()=>__poly.guide.sprite.seg.still));
  await page.setViewportSize({width:390,height:844});await show(45);expect(await act('__poly.tapCard(2)()'),false);
  const guide=await page.locator('.swiftee-wrap').boundingBox();assert(guide.x>=0&&guide.x+guide.width<=390&&guide.y>=0&&guide.y+guide.height<=844);
  await page.screenshot({path:path.join(out,'portrait-incorrect.png')});assert.deepEqual(errors,[]);
  console.log(`PASS: icon-free, immediate single-SFX feedback across ${cases.length} screens plus label retry, preserved artwork, glow, cleanup, repeat taps, reduced motion and portrait.`);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
