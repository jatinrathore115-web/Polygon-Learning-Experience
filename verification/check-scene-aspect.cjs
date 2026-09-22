const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/$/,'/index.html'));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
  fs.readFile(file,(err,data)=>{res.writeHead(err?404:200,{'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream'});res.end(err?'':data);});
});
(async()=>{
  await new Promise(r=>server.listen(9380,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try {
    const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:9380/?intro=0');await page.waitForFunction(()=>window.__poly?.state.ready);
    await page.evaluate(()=>{const g=__poly;g._stopRecordedVoice?.();g.timers.forEach(clearTimeout);g._guideGreeted=true;g.later=()=>0;g.narrate=()=>{};});
    const out=path.join(__dirname,'output','scene-aspect');fs.mkdirSync(out,{recursive:true});
    let checked=0;
    for(const [width,height] of [[1440,810],[1024,768],[2560,1080],[320,568],[390,844],[768,1024],[844,390]]) {
      await page.setViewportSize({width,height});
      for(let k=0;k<47;k++) {
        await page.evaluate(k=>{
          const g=__poly;g.setState({k});g.runStep(k,false);g.prepareNarratorReveal(g.step().narr);
          g.setState({storyContent:true,storyDialogue:true,storyControls:true,magicReveal:false,boundaryTravel:false,polygonTravel:false,
            speaking:false,interactive:true,ocWords:{open:true,closed:true},wordReveal:'complete'});
        },k);
        const result=await page.evaluate(()=>{
          const stage=document.querySelector('[data-lesson]'),r=stage.getBoundingClientRect();
          const rect=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom};};
          const dialogue=document.querySelector('.dialogue-box'),board=document.querySelector('.story-board');
          return {contentHeight:stage.parentElement.clientHeight,layout:stage.dataset.layout,dialogue:rect(dialogue),board:rect(board),
            font:parseFloat(getComputedStyle(document.querySelector('.narrator-text')).fontSize)*r.width/1980,
            labels:[...document.querySelectorAll('.story-surface div')].filter(e=>!e.childElementCount&&e.textContent.trim()&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).opacity!=='0').map(e=>({...rect(e),text:e.textContent})).filter(r=>r.w>0&&r.h>0),
            cards:[...document.querySelectorAll('.story-surface svg')].map(e=>rect(e.parentElement)),
            x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,
            backgrounds:[...stage.querySelectorAll(':scope > img')].map(e=>{const b=e.getBoundingClientRect();return {w:b.width,h:b.height,x:b.x,y:b.y};}),
            backdrop:getComputedStyle(stage.parentElement).backgroundImage,
            overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight};
        });
        const tag=`Screen ${k+1} at ${width}x${height}`;
        const compact=width<900&&height>width;
        if(!compact)assert(Math.abs(result.w/result.h-16/9)<.001,tag+': 16:9 stage');
        assert(result.x>=-.5&&result.y>=-.5&&result.right<=width+.5&&result.bottom<=(compact?result.contentHeight:height)+.5,tag+': entire frame fits');
        assert(Math.abs(result.x-(width-result.w)/2)<.5&&(compact?Math.abs(result.y)<.5:Math.abs(result.y-(height-result.h)/2)<.5),tag+': centred');
        assert.equal(result.backgrounds.length,1,tag+': one scenic background');
        const bg=result.backgrounds[0];
        assert(Math.abs(bg.w/bg.h-16/9)<.001,tag+': background artwork stays 16:9');
        if(compact){
          assert(result.font>=17.9,tag+': readable dialogue');
          assert(result.dialogue.x>=0&&result.dialogue.right<=width,tag+': dialogue fits');
          assert(result.dialogue.bottom<result.board.y,tag+': dialogue clears the activity');
          assert(result.board.bottom<=result.contentHeight+.5,tag+': board fits');
          for(const label of result.labels)assert(label.x>=-1&&label.right<=width+1&&label.bottom<=result.contentHeight+1,tag+': text fits: '+label.text);
          for(const card of result.cards)assert(card.x>=-1&&card.right<=width+1&&card.y>=result.board.y-1&&card.bottom<=result.contentHeight+1,tag+': figures fit');
        }
        assert(result.backdrop==='none'&&!result.overflow,tag+': no stretched backdrop or scrolling');
        if([1,7,13,22,40,42,44].includes(k)) {await page.waitForTimeout(350);await page.screenshot({path:path.join(out,`screen-${k+1}-${width}x${height}.png`)});}
        checked++;
      }
    }
    await page.setViewportSize({width:390,height:844});
    const show=async k=>{
      await page.evaluate(k=>{
        const g=__poly;g.setState({k});g.runStep(k,false);g.prepareNarratorReveal(g.step().narr);
        g._voiceLocked=false;g.advance=()=>{};g.feedback=()=>{};
        g.setState({storyContent:true,storyDialogue:true,storyControls:true,magicReveal:false,
          interactive:true,speaking:false,wordReveal:'complete',ocWords:{open:true,closed:true}});
      },k);
      await page.waitForTimeout(350);
    };
    await show(7);
    await page.getByRole('button',{name:'Open',exact:true}).click();
    assert.equal(await page.evaluate(()=>__poly.state.ok),'open');
    await show(13);
    const straight=page.getByRole('button',{name:'Figure 1: Straight',exact:true});
    assert((await straight.boundingBox()).height>=44);
    await straight.click();assert.equal(await page.evaluate(()=>__poly.state.dd[0]),'Straight');
    await show(40);
    const plus=page.getByRole('button',{name:'Increase number of sides',exact:true});
    assert((await plus.boundingBox()).width>=43.9);
    await plus.click();assert.equal(await page.evaluate(()=>__poly.state.n),4);
    await show(22);
    await page.getByRole('button',{name:'Side',exact:true}).dragTo(page.locator('[data-label-target="side"]'));
    await page.waitForFunction(()=>__poly.state.placed.side==='Side');
    await show(26);
    const handle=await page.locator('.game-handle').first().boundingBox();
    await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();
    await page.mouse.move(handle.x+handle.width/2-35,handle.y+handle.height/2+25,{steps:12});await page.mouse.up();
    await page.waitForFunction(()=>__poly.state.dragged);
    await show(42);
    await page.emulateMedia({reducedMotion:'no-preference'});
    const source=page.locator('.story-surface .game-action').filter({has:page.locator('svg')}).first();
    const a=await source.boundingBox(),b=await page.getByRole('button',{name:'POLYGON',exact:true}).boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:15});await page.mouse.up();
    await page.waitForFunction(()=>__poly.state.sortAt[0]===0);
    await page.waitForTimeout(450);
    const placed=await page.locator('.story-surface svg').first().evaluate(e=>{const r=e.parentElement.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};});
    const zone=await page.getByRole('button',{name:'POLYGON',exact:true}).boundingBox();
    assert(placed.x>zone.x&&placed.right<zone.x+zone.width&&placed.y>zone.y&&placed.bottom<zone.y+zone.height,'Drag lands inside its responsive zone');
    await show(44);
    const cards=page.locator('.story-surface .game-action').filter({has:page.locator('svg')});
    await cards.nth(0).click();await cards.nth(1).click();await page.getByRole('button',{name:'Check',exact:true}).click();
    assert(await page.evaluate(()=>__poly.state.checked));
    await page.setViewportSize({width:844,height:390});await page.waitForTimeout(350);
    assert.equal(await page.locator('[data-lesson]').getAttribute('data-layout'),'landscape');
    assert.deepEqual(errors,[]);
    console.log(`PASS: ${checked} screen/viewport combinations; one 16:9 scenic image, readable portrait dialogue, no horizontal clipping; mobile choices, classification, counter, drag/drop, Check and rotation work.`);
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
