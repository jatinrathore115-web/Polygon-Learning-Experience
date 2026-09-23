/* Sort screens (CFU 2 / 5): the tray row and both drop columns must stay
   centred, gapless and inside the ice board at every stage of the sort, and a
   tile must land exactly where its hover slot promised. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
const ctx={window:{},document:{documentElement:{clientWidth:1920,clientHeight:1080}},React:{createRef:()=>({current:null})},DCLogic:class{setState(s,cb){Object.assign(this.state,typeof s==='function'?s(this.state):s);if(cb)cb();}},setTimeout,clearTimeout};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('polygon-data.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('responsive-layout.js','utf8'),ctx);
vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]+'\nglobalThis.Game=Component;globalThis.SAFE=SAFE;globalThis.SORT=SORT;',ctx);
const {SAFE,SORT}=ctx;
const g=new ctx.Game();g.P=ctx.window.POLY;g.svgRefs={};g.state.ready=true;g.state.interactive=true;
const px=v=>parseFloat(v);
const near=(a,b,t,msg)=>assert(Math.abs(a-b)<=(t||0.51),msg+' ('+a.toFixed(2)+' vs '+b.toFixed(2)+')');
const boxes=()=>{const v=g.renderVals();return v.cards.map(c=>({key:c.key,x:px(c.wrap.left),y:px(c.wrap.top),w:px(c.wrap.width),h:px(c.wrap.height),snap:!c.wrap.transition.includes('left')}));};
const zoneW=g.sortZoneW();
let checks=0;
for(const sc of ['C2','C5']){
  const k=g.steps().findIndex(s=>s.sc===sc);g.state.k=k;
  const SORT=g.sortLayout();
  const s=g.steps()[k],n=s.maxPlacements||s.answer.length;

  /* columns live inside the safe area, side by side, evenly split */
  assert(SORT.zoneTop>=0&&SORT.zoneTop+SORT.zoneH<=SAFE.h,sc+': columns overflow the board');
  near(g.sortZoneX(1)+zoneW,SAFE.w,0.51,sc+': columns do not fill the safe width');

  /* walk the whole sort: every prefix of the correct placement order */
  for(let done=0;done<=n;done++){
    g.state.sortAt={};for(let i=0;i<done;i++)g.state.sortAt[i]=s.answer[i];
    g.state.pickedFig=null;g.state.sortHover=null;g.state.justPlaced=null;
    const cards=boxes(),queue=[];
    cards.forEach((c,i)=>{if(g.state.sortAt[i]===undefined)queue.push(c);});
    /* tray: one centred, evenly gapped row with no holes where cards left */
    if(queue.length){
      near(queue[0].x+queue[queue.length-1].x+queue[0].w,SAFE.w,0.51,sc+': tray row off centre');
      queue.forEach((c,i)=>{assert.equal(c.w,SORT.trayW);assert.equal(c.y,SORT.trayY);
        if(i)near(c.x-(queue[i-1].x+queue[i-1].w),SORT.trayGap,0.51,sc+': uneven tray gap');});
    }
    /* columns: one centred row of equal tiles, clear of the title and edges */
    for(const zone of [0,1]){
      const row=cards.filter((c,i)=>g.state.sortAt[i]===zone).sort((a,b)=>a.x-b.x);
      if(!row.length)continue;
      const left=g.sortZoneX(zone),right=left+zoneW;
      near(row[0].x-left,right-(row[row.length-1].x+row[0].w),0.51,sc+' zone'+zone+': row off centre');
      assert(row[0].x-left>=18,sc+' zone'+zone+': row touches the column edge');
      row.forEach((c,i)=>{
        assert.equal(c.w,SORT.tile);assert.equal(c.w,c.h);
        assert(c.y>=SORT.zoneTop+g.sortHeadH(),sc+' zone'+zone+': tile overlaps the column title');
        assert(c.y+c.h<=SORT.zoneTop+SORT.zoneH-24,sc+' zone'+zone+': tile past the column floor');
        near(c.y+c.h/2,SORT.zoneTop+g.sortHeadH()+(SORT.zoneH-g.sortHeadH())/2,0.51,sc+' zone'+zone+': row not vertically centred');
        if(i)near(c.x-(row[i-1].x+row[i-1].w),SORT.tileGap,0.51,sc+' zone'+zone+': uneven tile gap');
      });
      checks++;
    }
    if(done===n)continue;

    /* hovering a column opens a slot: the promised spot is where the tile
       actually ends up, and the tiles already there make room for it */
    const i=done,zone=s.answer[i];
    g.state.pickedFig=i;g.state.sortHover=zone;
    const v=g.renderVals(),slot=v.callouts[v.callouts.length-1];
    assert(v.callouts.length===1&&slot.style.border.includes('dashed'),sc+': no drop slot while hovering');
    const promised=g.sortPlaces(Object.assign({},g.state.sortAt,{[i]:zone}))[i];
    near(px(slot.style.left),promised.x,0.51,sc+': slot left != landing spot');
    near(px(slot.style.top),promised.y,0.51,sc+': slot top != landing spot');
    const shifted=boxes();
    assert(v.targets.every(t=>t.enter&&t.click),sc+': columns are not hoverable targets');
    /* commit the drop the way the drag does, then confirm the tile took the slot */
    g.state.sortAt[i]=zone;g.state.pickedFig=null;g.state.sortHover=null;g.state.justPlaced=i;
    const after=boxes();
    near(after[i].x,promised.x,0.51,sc+': tile missed its slot');
    near(after[i].y,promised.y,0.51,sc+': tile missed its slot');
    assert(after[i].snap,sc+': landed tile re-slides instead of holding the slot');
    shifted.forEach((c,j)=>{if(g.state.sortAt[j]!==undefined&&j!==i){near(c.x,after[j].x,0.51,sc+': neighbours moved after the drop');}});
    /* no tile ever overlaps another */
    const placed=after.filter((c,j)=>g.state.sortAt[j]!==undefined);
    placed.forEach((a,p)=>placed.slice(p+1).forEach(b=>assert(a.x+a.w<=b.x+0.5||b.x+b.w<=a.x+0.5||a.y+a.h<=b.y+0.5||b.y+b.h<=a.y+0.5,sc+': tiles overlap')));
    checks++;
  }
  /* holding without hovering a column (tap to pick, drag released off target,
     keyboard pick) draws no slot and must not throw */
  for(const hover of [null,-1,undefined]){
    g.state.sortAt={};g.state.pickedFig=1;g.state.sortHover=hover;g.state.hoverK=null;
    const v=g.renderVals();
    assert.equal(v.callouts.length,0,sc+': extra text or slot drawn with no column hovered');
    for(const zone of [v.zoneAStyle,v.zoneBStyle]) {
      assert(zone.border.includes('solid'),sc+': solid category borders');
      assert.equal(zone.boxShadow,'none',sc+': no container shadow');
      assert.equal(zone.animation,'none',sc+': no animated outer ring');
    }
    checks++;
  }
  /* tap a figure, then hover a column: same slot preview as the drag path */
  g.state.sortAt={};g.state.pickedFig=0;g.state.sortHover=null;g.state.hoverK='tg'+s.answer[0];
  {const v=g.renderVals();assert.equal(v.callouts.length,1,sc+': tap-then-hover shows no slot');
   const promised=g.sortPlaces({[0]:s.answer[0]})[0];
   near(px(v.callouts[0].style.left),promised.x,0.51,sc+': tap-path slot off');}
  g.state.hoverK=null;checks++;

  /* Settled tiles preserve their original surface and use only a success glow. */
  g.state.sortAt={};g.state.pickedFig=null;g.state.hoverK=null;g.state.sortHover=null;
  s.answer.slice(0,n).forEach((z,i)=>{g.state.sortAt[i]=z;});g.state.tick=1;
  {const v=g.renderVals(),base=g.cardStyleFor(null);
   v.cards.forEach((c,i)=>{
     if(g.state.sortAt[i]===undefined)return;
     assert.equal(c.wrap.pointerEvents,'none',sc+': placed tile still swallows taps meant for its column');
     /* No badge is stamped on a tile at all. A tick parked in NOT POLYGONS
        used to read as "this one IS a polygon", and the column a tile has
        landed in already says everything the badge was saying. */
     assert.equal(c.mark,'',sc+': tiles carry no badge');
     /* A tile that has landed in the right column now says so the way every
        other correct answer in the lesson does: green rim, pale green face and
        the success halo. The old treatment kept the neutral rim and put a soft
        shadow underneath, which a child reading the board from a distance did
        not register as an answer being right at all. */
     const ok=g.cardStyleFor('ok');
     assert.equal(c.wrap.borderColor,sc==='C2'?'#16834c':ok.borderColor,sc+': placed tile takes the success rim');
     assert.equal(c.wrap.background,sc==='C2'?'#e1f7eb':ok.background,sc+': placed tile takes the success surface');
     assert(c.wrap.boxShadow.includes('rgba(46,204,113'),sc+': and is ringed by the success halo');
   });
   v.targets.forEach((t,zone)=>{
     assert.equal(t.nudge,'',sc+': idle hint points at the correct column, which gives the answer away');
     assert(t.label&&t.label.length,sc+': drop column has no accessible name');
     assert(t.enter&&t.leave,sc+': drop column does not respond to hover or focus');
   });
   checks++;}
  /* every unplaced tile still takes taps and drags */
  g.state.sortAt={};
  {const v=g.renderVals();v.cards.forEach(c=>{
     assert(c.wrap.pointerEvents!=='none',sc+': tray tile cannot be tapped');
     assert(c.click&&c.down,sc+': tray tile lost its tap or drag handler');});
   checks++;}

  /* each drop is announced, for a learner who cannot hear the guide */
  {const quiet={sfx(){},react(){},burstHere(){},confetti(){},narrate(){},later(){},clearNudge(){},save(){}};
   const real={};Object.keys(quiet).forEach(k=>{real[k]=g[k];g[k]=quiet[k];});
   /* feedback() locks the stage while the guide talks, so unlock before use */
   g.state.sortAt={};g.state.pickedFig=0;g.state.attempts=0;g.state.speaking=false;g.state.interactive=true;
   g.dropInto(s.answer[0])();
   assert(/^Correct./.test(g.state.say)&&/1 of /.test(g.state.say),sc+': a correct drop says nothing useful ('+g.state.say+')');
   assert.equal(g.renderVals().liveMsg,g.state.say,sc+': the announcement never reaches the live region');
   g.state.pickedFig=1;g.dropInto(1-s.answer[1])();
   assert(/^Not the /.test(g.state.say),sc+': a wrong drop says nothing useful ('+g.state.say+')');
   assert.equal(Object.keys(g.state.sortAt).length,1,sc+': a wrong drop was accepted');
   Object.keys(real).forEach(k=>{g[k]=real[k];});
   g.state.wrong=null;g.state.attempts=0;g.state.speaking=false;g.state.interactive=true;checks++;}

  /* Finished: the two columns glide inward and settle as one centred result.
     The band stays centred, the outer edges pull in by the same amount on both
     sides, and every tile re-centres inside its narrower column — the boxes and
     their contents move as one because both read the same geometry. */
  {
    g.state.sortAt={};s.answer.slice(0,n).forEach((z,i)=>{g.state.sortAt[i]=z;});
    g.state.pickedFig=null;g.state.sortHover=null;g.state.tick=null;
    g.state.united=false;
    const apart={band:g.sortBandX(),w:g.sortZoneW(),gap:g.sortGap(),
      outerL:g.sortZoneX(0),outerR:g.sortZoneX(1)+g.sortZoneW(),tiles:boxes()};
    const row=g.renderVals().zoneRowStyle;
    near(apart.band,0,0.51,sc+': the sorting layout moved');
    near(apart.gap,SORT.zoneGap,0.51,sc+': the sorting gap changed');
    near(parseFloat(row.width),SAFE.w,0.51,sc+': the sorting band is not full width');
    g.state.united=true;
    const together={band:g.sortBandX(),w:g.sortZoneW(),gap:g.sortGap(),
      outerL:g.sortZoneX(0),outerR:g.sortZoneX(1)+g.sortZoneW(),tiles:boxes()};
    const united=g.renderVals();
    near(together.band*2+2*together.w+together.gap,SAFE.w,0.51,sc+': the finished pair is off centre');
    assert(together.gap<apart.gap,sc+': the columns did not come together');
    assert(together.w<apart.w,sc+': the columns did not give up width');
    near(together.outerL-apart.outerL,apart.outerR-together.outerR,0.51,sc+': the pair converges lopsidedly');
    assert(/left .*ms/.test(united.zoneRowStyle.transition||''),sc+': the band jumps instead of gliding');
    assert(/width .*ms/.test(united.zoneAStyle.transition||''),sc+': the columns jump instead of gliding');
    assert(united.zoneAStyle.border.includes('solid'),sc+': a finished column still asks to be dropped into');
    /* tiles keep their row centred inside the column they belong to */
    for(const zone of [0,1]){
      const row2=together.tiles.filter((c,i)=>g.state.sortAt[i]===zone).sort((a,b)=>a.x-b.x);
      if(!row2.length)continue;
      const left=g.sortZoneX(zone),right=left+g.sortZoneW();
      near(row2[0].x-left,right-(row2[row2.length-1].x+row2[0].w),0.51,sc+' zone'+zone+': tiles off centre once together');
      assert(row2[0].x-left>=18,sc+' zone'+zone+': tiles touch the column edge once together');
    }
    /* and they actually travelled with their column */
    together.tiles.forEach((c,i)=>{if(g.state.sortAt[i]===undefined)return;
      assert(Math.abs(c.x-apart.tiles[i].x)>1,sc+': a tile stayed behind when the columns moved');});
    g.state.united=false;checks++;
  }

  /* wrong column: the tile stays in the tray and shakes, nothing is placed */
  g.state.sortAt={};g.state.pickedFig=0;g.state.wrong=0;g.state.sortHover=1-s.answer[0];
  const wrong=boxes();assert.equal(wrong[0].y,SORT.trayY,sc+': wrong drop moved the tile');
  g.state.wrong=null;
  console.log('PASS '+sc+': tray and both columns stay centred, gapless and inside the board through every drop.');
}
/* Keep category headers readable on the column background and its hover tint. */
{const page=fs.readFileSync('index.html','utf8');
 const lum=h=>{const c=h.replace('#','').match(/../g).map(x=>parseInt(x,16)/255).map(v=>v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4));return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];};
 const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);};
 /* Read the header ink off the rendered style rather than scraping it out of
    the markup. The colour used to be typed into the template beside a hard
    -coded font, so a regex could find it; both columns now take the lesson's
    one button-label style, and what renders is the thing worth testing. */
 g.state.k=g.steps().findIndex(x=>x.sc==='C5');g.state.pickedFig=null;g.state.sortHover=null;
 const heads=g.renderVals();
 const found=[heads.zoneATitleStyle&&heads.zoneATitleStyle.color,heads.zoneBTitleStyle&&heads.zoneBTitleStyle.color].filter(Boolean);
 assert.equal(found.length,2,'expected two column headers, found '+found.length);
 /* One label style for every button in the lesson, headers included. */
 [heads.zoneATitleStyle,heads.zoneBTitleStyle].forEach((st,i)=>
   assert(/^600 \d+px "Baloo 2"/.test(st.font),'column header '+i+' is off the shared label style: '+st.font));
 const rest=g.renderVals();g.state.pickedFig=0;
 [[0,'A'],[1,'B']].forEach(([zone,tag])=>{
   const cold=(zone?rest.zoneBStyle:rest.zoneAStyle).background;
   g.state.sortHover=zone;const hovered=g.renderVals();
   const hot=(zone?hovered.zoneBStyle:hovered.zoneAStyle).background;
   [[cold,'resting'],[hot,'hovered']].forEach(([bg,when])=>{
     const r=ratio(found[zone],bg);
     assert(r>=4.5,'column '+tag+' caption '+found[zone]+' on '+when+' '+bg+' is only '+r.toFixed(2)+':1');
   });
 });
 g.state.sortHover=null;g.state.pickedFig=null;
 console.log('PASS headers: both category headers clear 4.5:1 on resting and hovered columns.');}

assert(checks>10);
console.log('PASS: '+checks+' layout states verified; hover slot, landing spot and drag settle all agree.');
