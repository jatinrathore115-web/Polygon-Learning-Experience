/* The speech bubble and its tail are one component, checked as geometry.
     node verification/check-dialogue-tail.cjs
   The tail used to be a shape parked under the bubble: its mouth stopped short
   of the body, so the bubble's own bottom border was painted straight across
   the join and the two read as separate pieces. Three things keep them one
   silhouette, and all three are numbers here so a later change cannot quietly
   undo them. The tail has to overlap the body far enough to cover that border.
   It has to be drawn in the body's colour. And its outline has to be the same
   weight as the body's border -- a non-scaling stroke once made the tail
   visibly heavier than the bubble at most screen sizes. */
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const R=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg','.json':'application/json'};
const server=http.createServer((q,s)=>{const f=path.resolve(R,'.'+decodeURIComponent(new URL(q.url,'http://x').pathname));
  fs.readFile(f,(e,d)=>{s.writeHead(e?404:200,{'Content-Type':mime[path.extname(f)]||'application/octet-stream'});s.end(e?'m':d);});});
const fail=[];
const check=(ok,msg)=>{console.log((ok?'PASS ':'FAIL ')+msg); if(!ok) fail.push(msg);};
(async()=>{
  await new Promise(r=>server.listen(9430,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:810}});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:9430/index.html?intro=0');
    await page.waitForFunction(()=>window.__poly?.state.ready);
    await page.evaluate(()=>{const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);g.later=()=>0;g.narrate=()=>{};g.locked=()=>false;});
    const total=await page.evaluate(()=>__poly.steps().length);
    /* Screens chosen to cover every tail placement the lesson uses: under the
       bubble on the opening and naming runs, and turned on its side where the
       guide stands beside the panel instead of below it. */
    for(const viewport of [{width:1440,height:810},{width:1024,height:768},{width:390,height:844}]){
      await page.setViewportSize(viewport);
      let seen=0, joined=0, coloured=0, weighted=0;
      for(let k=0;k<total;k++){
        await page.evaluate(k=>{__poly.setState({k});__poly.runStep(k,false);},k);
        await page.evaluate(()=>{const g=__poly;const line=g.step().narr||'';g.prepareNarratorReveal(line);
          g.setState({storyContent:true,storyDialogue:true,storyControls:true,wordReveal:'complete',narr:line,drawn:true,interactive:true});});
        await page.waitForTimeout(35);
        const m=await page.evaluate(()=>{
          const box=document.querySelector('.comic-dialogue'),tail=document.querySelector('.dialogue-tail');
          if(!box||!tail) return null;
          const br=box.getBoundingClientRect(),tr=tail.getBoundingClientRect();
          if(!br.width||!tr.width) return null;
          const bs=getComputedStyle(box);
          const stroke=getComputedStyle(document.querySelector('.dialogue-tail-stroke'));
          const fill=getComputedStyle(document.querySelector('.dialogue-tail-fill'));
          /* How deep the tail reaches into the body, on whichever axis it hangs
             off. The border it has to hide is at that edge. */
          const overlapY=Math.min(br.bottom,tr.bottom)-Math.max(br.top,tr.top);
          const overlapX=Math.min(br.right,tr.right)-Math.max(br.left,tr.left);
          const scale=tr.width/60;   /* the tail is authored 60px wide */
          return {overlap:Math.min(overlapX,overlapY), border:parseFloat(bs.borderBottomWidth)*scale,
            edge:bs.borderBottomColor, paper:bs.backgroundColor,
            strokeColor:stroke.stroke, strokeW:parseFloat(stroke.strokeWidth)*scale, fillColor:fill.fill};
        });
        if(!m) continue;
        seen++;
        /* Deep enough to bury the body's border rather than meet its edge. */
        if(m.overlap>=m.border+1) joined++;
        if(m.strokeColor===m.edge&&m.fillColor===m.paper) coloured++;
        if(Math.abs(m.strokeW-m.border)<=0.6) weighted++;
      }
      check(seen>10,viewport.width+'px: the bubble is on screen to be checked — '+seen+' screens');
      check(joined===seen,viewport.width+'px: the tail reaches into the body far enough to cover its border on every screen ('+joined+'/'+seen+')');
      check(coloured===seen,viewport.width+'px: and is drawn in the body\'s own paper and edge colours ('+coloured+'/'+seen+')');
      check(weighted===seen,viewport.width+'px: with an outline the same weight as that border ('+weighted+'/'+seen+')');
    }
    check(errors.length===0,'no page errors: '+errors.slice(0,2).join(' | '));
  } finally { await browser.close(); server.close(); }
  if(fail.length){console.error('\n'+fail.length+' check(s) failed');process.exit(1);}
  console.log('\nall checks passed');
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
