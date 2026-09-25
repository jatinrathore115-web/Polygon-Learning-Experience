const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(err?'missing':data);});
});
(async()=>{
  await new Promise(r=>server.listen(9362,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:810}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:9362/index.html?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);
    await page.evaluate(()=>{const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);g.later=()=>0;g.narrate=()=>{};});
    const dots=page.locator('circle[data-dot="gap"]');
    const show=async(k,resolved)=>{
      await page.evaluate(k=>{__poly.setState({k});__poly.runStep(k,false);},k);
      await page.evaluate(resolved=>{const g=__poly;g._voiceLocked=false;g.setState({storyContent:true,storyControls:true,magicReveal:false,drawn:true,interactive:true,speaking:false,ok:resolved});},resolved);
    };
    const cases=[];
    for(const k of [5,7]){
      await show(k,null);assert.equal(await dots.count(),0,'Do not reveal the answer early');
      await page.evaluate(()=>__poly.setState({ok:'open'}));
      await page.waitForFunction(()=>document.querySelectorAll('circle[data-dot="gap"]').length>=5);
      // Sample the real CSS animations at exact times to avoid timing flakiness.
      const timeline=await dots.evaluateAll(es=>{
        const sample=t=>{es.forEach(e=>e.getAnimations().forEach(a=>{a.pause();a.currentTime=t;}));return es.map(e=>Number(getComputedStyle(e).opacity));};
        /* The dots do not start with the feedback: they pick up where the
           boundary trace lands, so the whole thing reads as one pen going
           round the shape and then carrying on across the missing piece.
           Sampled after the trace rather than at the very beginning. */
        return {early:sample(1120),middle:sample(1350),finished:sample(1800)};
      });
      const visible=xs=>xs.filter(n=>n>.01).length;
      assert(visible(timeline.early)>0&&visible(timeline.early)<await dots.count());
      assert(visible(timeline.middle)>visible(timeline.early));
      assert(timeline.finished.every(n=>n===1));
      /* The explanation is now a movement: the boundary is traced from one
         loose end round to the other, and the dots carry that motion on across
         the gap. Two things have to stay true however it is dressed.
         First, the trace follows the figure's OWN path -- it must never bridge
         the opening, or the shape would read as closed while it drew.
         Second, the dots stop short of both ends, so there is always a visible
         break. The endpoint rings are deliberate: unfilled, sitting on the two
         loose ends, marking where the boundary stops. */
      assert(await page.evaluate(()=>{
        const g=__poly,fig=g.step().fig,m=g.ocMarks(fig),ends=g.gapEnds(fig),F=g.fig(fig);
        /* The solid half is the screen's own boundary trace, so nothing is
           stroked over the figure a second time. Two strokes was what made
           this read as a blue animation plus an unrelated dotted one. */
        const oneStrokeOnly=m.hl.length===0;
        const gapDots=m.dots.filter(d=>d.dot==='gap');
        const clearOfEnds=gapDots.every(d=>d.stroke==='none'&&ends.every(p=>Math.hypot(d.x-p[0],d.y-p[1])>d.r));
        const rings=m.dots.filter(d=>d.dot==='gap-end');
        const markEnds=rings.length===2&&rings.every(r=>r.fill==='none'&&ends.some(p=>Math.hypot(r.x-p[0],r.y-p[1])<1));
        return oneStrokeOnly&&clearOfEnds&&markEnds&&gapDots.every(x=>x.fill===rings[0].stroke);
      }),'One stroke only, the dots stop short of both ends in the same blue, and the ends are ringed');
      cases.push({screen:k+1,dots:await dots.count()});
    }
    await show(5,null);await page.evaluate(()=>__poly.setState({ocReveal:'open'}));
    assert((await dots.count())>0,'Correction feedback also uses dots');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert(await dots.evaluateAll(es=>es.every(e=>getComputedStyle(e).animationName==='none'&&getComputedStyle(e).opacity==='1')));
    for(const k of [4,6,8]){await show(k,'closed');assert.equal(await dots.count(),0);}
    assert.deepEqual(errors,[]);console.log(JSON.stringify({cases,sequentialReveal:true,endpointsRinged:true,oneContinuousStroke:true,reducedMotion:true,closedFiguresUnchanged:true,errors}));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
