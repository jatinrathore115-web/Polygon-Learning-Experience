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
  fs.mkdirSync(out,{recursive:true});await new Promise(r=>server.listen(9360,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:810},reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:9360/index.html?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);
    await page.evaluate(()=>{const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);g.later=()=>0;g.narrate=()=>{};});
    const results=[];
    for(const viewport of [{width:1440,height:810},{width:1024,height:768},{width:390,height:844}]){
      await page.setViewportSize(viewport);
      for(let k=0;k<9;k++){
        await page.evaluate(k=>{__poly.setState({k});__poly.runStep(k,false);},k);
        await page.evaluate(()=>{const g=__poly;g._voiceLocked=false;g.prepareNarratorReveal(g.step().narr);g.setState({wordReveal:'complete',drawn:true,drawing:false,penAt:null,tracing:false,magicReveal:false,storyContent:true,storyDialogue:true,storyControls:true,interactive:true,speaking:false});});
        await page.waitForTimeout(50);
        const result=await page.evaluate(()=>{
          const g=__poly,v=g.renderVals(),board=document.querySelector('.story-board').getBoundingClientRect();
          const cx=board.x+board.width/2,cy=board.y+board.height/2,scale=board.width/992;
          let sx,sy;
          if(g.state.k===0){
            const dot=v.leaders.find(l=>l.style.width==='62px'),safe=document.querySelector('.story-surface').getBoundingClientRect();
            sx=safe.x+parseFloat(dot.style.left)*scale;sy=safe.y+parseFloat(dot.style.top)*scale;
          }else{
            const svg=document.querySelector('.story-surface svg'),probe=document.createElementNS(svg.namespaceURI,'path');
            probe.setAttribute('d',v.cards[0].d+' '+v.cards[0].extra);svg.append(probe);
            const bb=probe.getBBox(),pt=svg.createSVGPoint();pt.x=bb.x+bb.width/2;pt.y=bb.y+bb.height/2;
            const center=pt.matrixTransform(probe.getScreenCTM());sx=center.x;sy=center.y;probe.remove();
          }
          const open=[...document.querySelectorAll('.story-surface [role="button"]')].find(e=>e.textContent==='Open');
          const closed=[...document.querySelectorAll('.story-surface [role="button"]')].find(e=>e.textContent==='Closed');
          let buttons=null;
          if(open&&closed){const a=open.getBoundingClientRect(),b=closed.getBoundingClientRect();buttons={dx:(a.left+b.right)/2-cx,gap:(a.top-board.bottom)/scale,level:a.top-b.top};}
          return {screen:g.state.k+1,dx:sx-cx,dy:sy-cy,buttons};
        });
        assert(Math.abs(result.dx)<1&&Math.abs(result.dy)<1,'Visible figure center: '+JSON.stringify(result));
        if(result.buttons)assert(Math.abs(result.buttons.dx)<1&&Math.abs(result.buttons.gap-28)<1&&Math.abs(result.buttons.level)<1,'Button alignment: '+JSON.stringify(result));
        results.push(result);
        if(viewport.width===1440&&[1,4,5,8].includes(k))await page.screenshot({path:path.join(out,'screen-'+(k+1)+'.png')});
      }
    }
    assert.deepEqual(errors,[]);console.log(JSON.stringify({screens:9,viewports:3,measurements:results.length,visibleOutlineCenters:true,buttonGap:28,errors}));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
