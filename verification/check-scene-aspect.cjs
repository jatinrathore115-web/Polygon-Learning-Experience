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
    await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'});
    let checked=0;const reference=[];
    for(const [width,height] of [[1440,810],[1024,768],[2560,1080],[320,568],[390,844],[768,1024],[844,390]]) {
      await page.setViewportSize({width,height});
      for(let k=0;k<await page.evaluate(()=>__poly.steps().length);k++) {
        await page.evaluate(k=>{
          const g=__poly;g.setState({k});g.runStep(k,false);g.prepareNarratorReveal(g.step().narr);
          g.setState({storyContent:true,storyDialogue:true,storyControls:true,magicReveal:false,boundaryTravel:false,polygonTravel:false,
            drawn:true,guideFlying:false,speaking:false,interactive:true,ocWords:{open:true,closed:true},wordReveal:'complete'});
        },k);
        await page.waitForFunction(k=>document.querySelector('#polygon-screen-navigator').shadowRoot.querySelector('#toggle').textContent.endsWith(' '+(k+1)),k);
        const result=await page.evaluate(()=>{
          const stage=document.querySelector('[data-lesson]'),r=stage.getBoundingClientRect();
          const rect=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom};};
          const dialogue=document.querySelector('.dialogue-box'),board=document.querySelector('.story-board');
          const normalized=e=>{const b=e.getBoundingClientRect(),scale=r.width/1980;return b.width&&b.height?[(b.x-r.x)/scale,(b.y-r.y)/scale,b.width/scale,b.height/scale]:[0,0,0,0];};
          const nav=document.querySelector('#polygon-screen-navigator').shadowRoot;
          const geometry=[dialogue,board,document.querySelector('.swiftee-wrap').parentElement,document.querySelector('.story-surface'),
            ...document.querySelectorAll('.story-surface svg,.story-controls .game-action'),nav.querySelector('#toggle'),nav.querySelector('#back'),nav.querySelector('#next')]
            .map(normalized);
          const fonts=[...document.querySelectorAll('.narrator-text,.story-controls .game-action')].map(e=>getComputedStyle(e).fontSize);
          return {geometry,fonts,contentHeight:stage.parentElement.clientHeight,layout:stage.dataset.layout,dialogue:rect(dialogue),board:rect(board),
            font:parseFloat(getComputedStyle(document.querySelector('.narrator-text')).fontSize)*r.width/1980,
            labels:[...document.querySelectorAll('.story-surface div')].filter(e=>!e.childElementCount&&e.textContent.trim()&&getComputedStyle(e).display!=='none'&&getComputedStyle(e).visibility!=='hidden'&&getComputedStyle(e).opacity!=='0').map(e=>({...rect(e),text:e.textContent})).filter(r=>r.w>0&&r.h>0),
            cards:[...document.querySelectorAll('.story-surface svg')].map(e=>rect(e.parentElement)),
            x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom,
            backgrounds:[...document.querySelectorAll('.lesson-background')].map(e=>{const b=e.getBoundingClientRect();return {w:b.width,h:b.height,x:b.x,y:b.y,right:b.right,bottom:b.bottom};}),
            backdrop:getComputedStyle(stage.parentElement).backgroundImage,
            overflow:document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight};
        });
        const tag=`Screen ${k+1} at ${width}x${height}`;
        assert(Math.abs(result.w/result.h-16/9)<.001,tag+': 16:9 canvas on every device');
        assert(result.x>=-.5&&result.y>=-.5&&result.right<=width+.5&&result.bottom<=height+.5,tag+': entire composition fits');
        assert(Math.abs(result.x-(width-result.w)/2)<.5&&Math.abs(result.y-(height-result.h)/2)<.5,tag+': centred');
        assert.equal(result.backgrounds.length,1,tag+': one scenic background');
        const bg=result.backgrounds[0];
        for(const [a,b]of [[bg.x,result.x],[bg.y,result.y],[bg.w,result.w],[bg.h,result.h]])assert(Math.abs(a-b)<.5,tag+': background is anchored to the content canvas');
        if(!reference[k])reference[k]=result;
        assert.equal(result.geometry.length,reference[k].geometry.length,tag+': same composition');
        result.geometry.forEach((box,i)=>box.forEach((value,j)=>assert(Math.abs(value-reference[k].geometry[i][j])<.2,tag+': anchor '+i+'/'+j+' shifted '+value+' vs '+reference[k].geometry[i][j])));
        assert.deepEqual(result.fonts,reference[k].fonts,tag+': canvas typography never reflows by device');
        assert(result.backdrop==='none'&&!result.overflow,tag+': no stretched backdrop or scrolling');
        if([4,22,42,44].includes(k)) {await page.waitForTimeout(350);await page.screenshot({path:path.join(out,`screen-${k+1}-${width}x${height}.png`)});}
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
    assert((await straight.boundingBox()).height>0);
    await straight.click();assert.equal(await page.evaluate(()=>__poly.state.dd[0]),'Straight');
    await show(40);
    const plus=page.getByRole('button',{name:'Increase number of sides',exact:true});
    assert((await plus.boundingBox()).width>0);
    await plus.click();assert.equal(await page.evaluate(()=>__poly.state.n),4);
    await show(22);
    await page.getByRole('button',{name:'Side',exact:true}).dragTo(page.locator('[data-label-target="side"]'));
    await page.waitForFunction(()=>__poly.state.placed.side==='Side');
    await show(26);
    const handle=await page.locator('.game-handle').first().boundingBox();
    await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();
    await page.mouse.move(handle.x+handle.width/2-35,handle.y+handle.height/2+25,{steps:12});await page.mouse.up();
    await page.waitForFunction(()=>__poly.state.dragged);
    await show(43);
    await page.emulateMedia({reducedMotion:'no-preference'});
    const source=page.locator('.story-surface .game-action').filter({has:page.locator('svg')}).first();
    const a=await source.boundingBox(),b=await page.getByRole('button',{name:'Polygon',exact:true}).boundingBox();
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:15});await page.mouse.up();
    await page.waitForFunction(()=>__poly.state.sortAt[0]===0);
    await page.waitForTimeout(450);
    const placed=await page.locator('.story-surface svg').first().evaluate(e=>{const r=e.parentElement.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};});
    const zone=await page.getByRole('button',{name:'Polygon',exact:true}).boundingBox();
    assert(placed.x>zone.x&&placed.right<zone.x+zone.width&&placed.y>zone.y&&placed.bottom<zone.y+zone.height,'Drag lands inside its responsive zone');
    await show(45);
    const cards=page.locator('.story-surface .game-action').filter({has:page.locator('svg')});
    await cards.nth(0).click();await cards.nth(1).click();
    assert(await page.evaluate(()=>__poly.state.sel.includes(0)&&__poly.state.sel.includes(1)));
    await page.setViewportSize({width:844,height:390});await page.waitForTimeout(350);
    assert.equal(await page.locator('[data-lesson]').getAttribute('data-layout'),'canvas');
    assert.deepEqual(errors,[]);
    console.log(`PASS: ${checked} screen/viewport combinations; invariant canvas-relative geometry and typography, one shared 16:9 background, no clipping; mobile choices, classification, counter, drag/drop, Check and rotation work.`);
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
