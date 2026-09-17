const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = path.join(__dirname, 'output', 'boundary-story');
fs.mkdirSync(out, { recursive: true });
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.mp3':'audio/mpeg','.woff2':'font/woff2'};
const server = http.createServer((req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const file = path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if (!file.startsWith(root+path.sep)) {res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'Missing':data);});
});
(async()=>{
  await new Promise(r=>server.listen(9356,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:810}}), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
    await page.addInitScript(()=>{
      const play=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(){this.playbackRate=2;return play.call(this);};
    });
    await page.goto('http://127.0.0.1:9356/?intro=0');
    await page.waitForFunction(()=>window.__poly?.state.ready);
    await page.mouse.click(700,100);
    await page.evaluate(()=>{
      const g=__poly;
      window.boundaryEvents=[];
      const keyword=g.keyword.bind(g);
      g.keyword=(w,timing)=>{
        keyword(w,timing);
        if(g.boundaryScene()) boundaryEvents.push({phase:g.step().ph,word:w,focus:g.state.boundaryFocus,
          lit:g.renderVals().cards.map(c=>c.traceStyle.opacity===1),
          pulse:g.renderVals().cards.map(c=>c.wrap.animation.includes('boundaryCardPulse')),
          chips:g.renderVals().cards.map(c=>c.chip),
          pulseMs:g.state.boundaryPulseMs,remainingMs:timing ? timing.durationMs-timing.wordStartMs : null,
          screen:g.state.k+1,travel:g.state.boundaryTravel,guide:g.guideViewportStyle(),dialogue:g.dialogueLayout(),
          wrong:g.state.wrong,overlays:g.renderVals().cards.map(c=>c.hl.length)});
      };
      g._guideGreeted=true;g._boundaryAt=false;
      g.setState({k:9,storyContent:true,storyDialogue:true});g.runStep(9,false);
    });
    await page.waitForFunction(()=>__poly.state.k===9&&__poly.state.boundaryTravel&&!__poly.state.storyDialogue,null,{timeout:20000});
    await page.screenshot({path:path.join(out,'transition.png')});
    await page.waitForFunction(()=>boundaryEvents.some(e=>e.phase==='sc'&&e.focus==='straight'),null,{timeout:25000});
    await page.screenshot({path:path.join(out,'straight.png')});
    await page.waitForFunction(()=>boundaryEvents.some(e=>e.phase==='sc'&&e.focus==='curved'),null,{timeout:12000});
    await page.screenshot({path:path.join(out,'curved.png')});
    await page.waitForFunction(()=>__poly.state.k===13&&!__poly.locked()&&__poly.state.storyControls,{timeout:20000});
    await page.waitForTimeout(350);
    await page.screenshot({path:path.join(out,'question.png')});
    const events=await page.evaluate(()=>boundaryEvents);
    assert(events.some(e=>e.phase==='open')&&events.some(e=>e.phase==='closed'));
    assert(events.every(e=>!e.travel),'Narration begins only after the flight settles');
    assert(events.every(e=>e.guide.left===events[0].guide.left&&e.guide.top===events[0].guide.top&&e.dialogue.x===610&&e.dialogue.y===780),'Keep the bottom-right composition across Screens 10–14');
    assert(events.some(e=>e.phase==='bound'&&e.focus==='all'&&e.pulse.every(Boolean)));
    for (const phase of ['sc']) {
      assert(events.some(e=>e.phase===phase&&e.focus==='straight'&&String(e.pulse)==='true,true,false,false'));
      assert(events.some(e=>e.phase===phase&&e.focus==='curved'&&String(e.pulse)==='false,false,true,true'));
    }
    assert(events.some(e=>e.phase==='classify'&&e.focus==='straight'&&String(e.pulse)==='true,false,false,false'));
    assert(events.filter(e=>e.phase==='classify').every(e=>!e.pulse.slice(1).some(Boolean)),'Upcoming figures remain out of focus');
    assert(events.every(e=>!e.lit.some(Boolean)),'Voice cues must not trace the figure lines');
    assert(events.filter(e=>/curved[.?]?$/i.test(e.word)).every(e=>e.pulseMs<e.remainingMs),'Final curved cue must finish within the recording');
    assert(events.filter(e=>e.screen>=12).every(e=>e.chips.every(c=>c!=='Open'&&c!=='Closed')),'No Open/Closed labels from Screen 12');
    assert(await page.evaluate(()=>!__poly.state.boundaryFocus),'Clear the pulse after narration');
    // Sample the actual card styling at a known media time, then hold that clock still.
    const samplePulse=()=>page.locator('.story-surface svg').evaluateAll(svgs=>svgs.slice(0,4).map(svg=>{
      const card=svg.parentElement,style=getComputedStyle(card);
      return {outline:parseFloat(style.outlineWidth),shadow:style.boxShadow,
        paths:[...svg.querySelectorAll('path')].map(p=>[p.getAttribute('d'),getComputedStyle(p).stroke,getComputedStyle(p).fill])};
    }));
    const figuresBefore=await samplePulse();
    await page.evaluate(()=>{__poly.keyword('straight',{wordStartMs:1000,mediaTimeMs:1000,durationMs:2200});__poly.syncBoundaryPulse(1300);});
    const peak=await samplePulse();
    assert.deepEqual(peak.map(c=>c.outline),[7,figuresBefore[1].outline,figuresBefore[2].outline,figuresBefore[3].outline],'Pulse only the current figure');
    assert.deepEqual(peak.map(c=>c.paths),figuresBefore.map(c=>c.paths),'Keep figure strokes and fills unchanged');
    assert(await page.evaluate(()=>document.querySelector('.dialogue-box').getBoundingClientRect().right<document.querySelector('.swiftee-wrap').getBoundingClientRect().left),'Dialogue clears the guide during teaching gestures');
    await page.waitForTimeout(220);
    assert.deepEqual(await samplePulse(),peak,'Pulse holds while the media clock is paused');
    await page.evaluate(()=>{__poly.keyword('curved',{wordStartMs:2300,mediaTimeMs:2300,durationMs:2800});__poly.syncBoundaryPulse(2440);});
    assert.deepEqual((await samplePulse()).map(c=>c.outline),figuresBefore.map(c=>c.outline),'Upcoming curved cards stay out of focus');
    await page.screenshot({path:path.join(out,'curved-card-pulse.png')});
    await page.evaluate(()=>__poly.setState({boundaryFocus:null}));
    await page.waitForTimeout(400); // Allow the guide's teaching gesture to settle.
    const layout=await page.evaluate(()=>{
      const board=document.querySelector('.story-board').getBoundingClientRect();
      const bubble=document.querySelector('.dialogue-box').getBoundingClientRect();
      const bird=document.querySelector('.swiftee-wrap').getBoundingClientRect();
      return {centred:Math.abs((board.left+board.right)/2-innerWidth/2)<1,
        bubbleBelow:bubble.top>board.bottom,bubbleClear:bubble.right<bird.left,
        birdRight:bird.left>innerWidth*.75,birdFits:bird.bottom<=innerHeight+1};
    });
    assert(Object.values(layout).every(Boolean),JSON.stringify(layout));
    assert(await page.evaluate(()=>{
      const nav=document.querySelector('#polygon-screen-navigator').shadowRoot.querySelector('#step-navigation').getBoundingClientRect();
      return document.querySelector('.story-board').getBoundingClientRect().top>nav.bottom+10;
    }),'Navigation has clear space above the board');
    assert.equal(await page.evaluate(()=>__poly.renderVals().cards.length),4);
    assert.equal(await page.getByRole('button',{name:/^Figure \d: /}).count(),8);
    assert.equal(await page.getByRole('button',{name:'Select',exact:true}).count(),0);
    await page.getByRole('button',{name:'Figure 1: Curved',exact:true}).click();
    assert(await page.evaluate(()=>__poly.state.ddWrong[0]));
    await page.waitForFunction(()=>!__poly.locked()&&__poly.state.dd[0]===null,null,{timeout:25000});
    const correction=await page.evaluate(()=>boundaryEvents.filter(e=>e.wrong===0));
    assert(correction.some(e=>e.focus==='figure0'&&String(e.pulse)==='true,false,false,false'),'Corrective voice points only to the selected figure');
    assert(correction.every(e=>e.overlays.every(n=>n===0)&&!e.lit.some(Boolean)),'Incorrect feedback must not draw over figure lines');
    await page.getByRole('button',{name:'Figure 1: Straight',exact:true}).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>__poly.state.dd[0]),'Straight');
    assert(await page.evaluate(()=>!__poly.state.fx.some(f=>f.kind==='conf')),'Save full celebration for completing the activity');
    await page.evaluate(()=>__poly.ddPick(0,'Curved')());
    assert.equal(await page.evaluate(()=>__poly.state.dd[0]),'Straight','Settled answers cannot be overwritten');
    await page.waitForFunction(()=>!__poly.locked());
    await page.screenshot({path:path.join(out,'reference-options-success.png')});
    for(const viewport of [{width:1024,height:768},{width:390,height:844},{width:1440,height:810}]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(500);
      assert(await page.evaluate(()=>{
        const buttons=[...document.querySelectorAll('.story-surface > [role="button"]')].map(e=>e.getBoundingClientRect());
        return buttons.length===7&&buttons.every(b=>b.height>=44&&b.width>=44)&&buttons.every((b,i)=>i===0||b.left>buttons[i-1].right);
      }),'One settled answer and six separate choices at '+viewport.width);
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    assert(await page.locator('.story-board').evaluate(e=>getComputedStyle(e).transitionDuration==='0s'));
    await page.emulateMedia({reducedMotion:'no-preference'});
    for (const [i,answer] of [[1,'Straight'],[2,'Curved'],[3,'Curved']]) {
      await page.waitForFunction(()=>!__poly.locked());
      await page.getByRole('button',{name:'Figure '+(i+1)+': '+answer,exact:true}).click();
    }
    await page.waitForFunction(()=>__poly.state.k===15&&__poly.state.narr===__poly.step().narr&&__poly.state.storyControls&&!__poly.state.speaking&&!__poly.locked(),null,{timeout:25000});
    await page.waitForTimeout(350);
    assert(await page.evaluate(()=>__poly.boundaryScene()&&!__poly.state.boundaryFocus&&!__poly.state.boundaryTravel));
    assert(await page.evaluate(()=>{
      const g=__poly,style=g.guideViewportStyle(),first=boundaryEvents[0];
      return style.left===first.guide.left&&style.top===first.guide.top&&style.width===first.guide.width&&style.height===first.guide.height&&g.dialogueLayout().x===first.dialogue.x;
    }),'Screen 16 keeps Swiftee and dialogue in the same composition');
    assert.equal(await page.locator('.story-board').evaluate(e=>getComputedStyle(e).opacity),'1','No board fade between comparison activities');
    await page.screenshot({path:path.join(out,'screen-16-continuity.png')});
    const choices=page.locator('.story-surface > [role="button"]');
    assert.equal(await choices.count(),4);
    await choices.nth(2).click();
    await page.waitForFunction(()=>!__poly.locked()&&__poly.state.wrong===null);
    await choices.first().focus();await page.keyboard.press('Enter');
    await page.waitForFunction(()=>__poly.state.k===16);
    assert(!await page.evaluate(()=>__poly.boundaryScene()),'Later lesson layouts remain unchanged');
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({layout,events,errors},null,2));
    console.log('PASS: real audio cues, centred scene, guide/dialogue clearance, gated choices, all four answers, return to lesson and reduced motion.');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
