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
      g.keyword=w=>{
        keyword(w);
        if(g.boundaryScene()) boundaryEvents.push({phase:g.step().ph,word:w,focus:g.state.boundaryFocus,
          lit:g.renderVals().cards.map(c=>c.traceStyle.opacity===1)});
      };
      g._guideGreeted=true;g._boundaryAt=false;
      g.setState({k:10,storyContent:true,storyDialogue:true});g.runStep(10,false);
    });
    await page.waitForFunction(()=>__poly.state.k===11&&__poly.state.boundaryTravel&&!__poly.state.storyDialogue,null,{timeout:20000});
    await page.screenshot({path:path.join(out,'transition.png')});
    await page.waitForFunction(()=>__poly.state.k===12&&__poly.state.boundaryFocus==='straight',{timeout:25000});
    await page.screenshot({path:path.join(out,'straight.png')});
    await page.waitForFunction(()=>__poly.state.k===12&&__poly.state.boundaryFocus==='curved',{timeout:12000});
    await page.screenshot({path:path.join(out,'curved.png')});
    await page.waitForFunction(()=>__poly.state.k===13&&!__poly.locked()&&__poly.state.storyControls,{timeout:20000});
    await page.waitForTimeout(350);
    await page.screenshot({path:path.join(out,'question.png')});
    const events=await page.evaluate(()=>boundaryEvents);
    assert(events.some(e=>e.phase==='bound'&&e.focus==='all'&&e.lit.every(Boolean)));
    assert(events.some(e=>e.phase==='sc'&&e.focus==='straight'&&String(e.lit)==='true,true,false,false'));
    assert(events.some(e=>e.phase==='sc'&&e.focus==='curved'&&String(e.lit)==='false,false,true,true'));
    assert(events.filter(e=>e.phase==='classify').every(e=>!e.lit.some(Boolean)),'Question must not reveal the answers');
    const layout=await page.evaluate(()=>{
      const board=document.querySelector('.story-board').getBoundingClientRect();
      const bubble=document.querySelector('.dialogue-box').getBoundingClientRect();
      const bird=document.querySelector('.swiftee-wrap').getBoundingClientRect();
      return {centred:Math.abs((board.left+board.right)/2-innerWidth/2)<1,
        bubbleBelow:bubble.top>board.bottom,bubbleClear:bubble.right<bird.left,
        birdRight:bird.left>innerWidth*.75,birdFits:bird.bottom<=innerHeight+1};
    });
    assert(Object.values(layout).every(Boolean),JSON.stringify(layout));
    assert.equal(await page.evaluate(()=>__poly.renderVals().cards.length),4);
    assert.equal(await page.getByRole('button',{name:/^Figure \d: /}).count(),8);
    assert.equal(await page.getByRole('button',{name:'Select',exact:true}).count(),0);
    await page.getByRole('button',{name:'Figure 1: Curved',exact:true}).click();
    assert(await page.evaluate(()=>__poly.state.ddWrong[0]));
    await page.waitForFunction(()=>!__poly.locked()&&__poly.state.dd[0]===null,null,{timeout:25000});
    await page.getByRole('button',{name:'Figure 1: Straight',exact:true}).focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(()=>__poly.state.dd[0]),'Straight');
    await page.evaluate(()=>__poly.ddPick(0,'Curved')());
    assert.equal(await page.evaluate(()=>__poly.state.dd[0]),'Straight','Settled answers cannot be overwritten');
    await page.waitForFunction(()=>!__poly.locked());
    await page.screenshot({path:path.join(out,'reference-options-success.png')});
    for(const viewport of [{width:1024,height:768},{width:390,height:844},{width:1440,height:810}]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(500);
      assert(await page.evaluate(()=>{
        const buttons=[...document.querySelectorAll('.story-surface > [role="button"]')].map(e=>e.getBoundingClientRect());
        return buttons.length===8&&buttons.every(b=>b.height>=44&&b.width>=44)&&buttons.every((b,i)=>i===0||b.left>buttons[i-1].right);
      }),'Eight separate, usable choices at '+viewport.width);
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    assert(await page.locator('.story-board').evaluate(e=>getComputedStyle(e).transitionDuration==='0s'));
    await page.emulateMedia({reducedMotion:'no-preference'});
    for (const [i,answer] of [[3,'Curved'],[1,'Straight'],[2,'Curved']]) {
      await page.waitForFunction(()=>!__poly.locked());
      await page.getByRole('button',{name:'Figure '+(i+1)+': '+answer,exact:true}).click();
    }
    await page.waitForFunction(()=>__poly.state.k===15&&!__poly.locked(),{timeout:25000});
    assert(await page.evaluate(()=>!__poly.boundaryScene()&&!__poly.state.boundaryFocus&&!__poly.state.boundaryTravel));
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({layout,events,errors},null,2));
    console.log('PASS: real audio cues, centred scene, guide/dialogue clearance, gated choices, all four answers, return to lesson and reduced motion.');
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
