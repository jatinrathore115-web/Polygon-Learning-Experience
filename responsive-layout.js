/* Responsive presentation only. Lesson answers, audio cues and SVG geometry stay
   in their authored coordinates; pointer handling reads the rendered rectangles. */
(function () {
  'use strict';
  const W=1980,H=W*9/16;
  const num=(v,fallback=0)=>Number.isFinite(parseFloat(v))?parseFloat(v):fallback;
  const px=v=>v+'px';
  // Cover the viewport with one undistorted 16:9 image. Content keeps its own
  // fit/reflow calculation, so filling the background never crops an activity.
  const background=(width,height)=>{
    const w=Math.max(width,height*16/9),h=w*9/16;
    return {left:px((width-w)/2),top:px((height-h)/2),width:px(w),height:px(h)};
  };
  const frame=(width,height)=>{
    const compact=width<900&&height>width;
    const scale=compact?width/W:Math.min(width/W,height/H);
    return {width,height,compact,scale,stageHeight:compact?height/scale:H};
  };
  function apply(game,V,step,f) {
    if(!f.compact)return;
    const scale=f.scale;
    // Keep the scenic artwork at 16:9. Only decorative edges are cropped in
    // portrait; the activity itself is laid out inside the visible viewport.
    const text=V.narratorParts.map(p=>p.text).join('');
    const font=f.width<360?18:20;
    const dialogueWidth=f.width-120;
    const context=document.createElement('canvas').getContext('2d');
    context.font='900 '+font+'px Nunito,sans-serif';
    let lines=1,line='';
    for(const word of text.split(/\s+/)) {
      const next=line?line+' '+word:word;
      if(line&&context.measureText(next).width>dialogueWidth-28){lines++;line=word;}else line=next;
    }
    const dialogueHeight=lines*font*1.2+30;
    const top=80;
    const activityTop=top+Math.max(96,dialogueHeight)+26;
    Object.assign(V.signStyle,{
      left:px(14/scale),top:px(top/scale),bottom:'auto',width:px(dialogueWidth/scale),maxWidth:px(dialogueWidth/scale),
      padding:px(10/scale)+' '+px(12/scale),borderWidth:px(2/scale),borderRadius:px(18/scale),
      '--dialogue-tail-x':'calc(100% - '+px(5/scale)+')','--dialogue-tail-top':'calc(50% - '+px(15/scale)+')',
      '--responsive-tail-size':px(30/scale),
      '--dialogue-tail-transform':'rotate(-90deg)',transform:'none',transition:'opacity 160ms ease-out'
    });
    V.narrStyle.fontSize=px(font/scale);
    for(const part of V.narratorParts) if(part.style.fontSize)part.style.fontSize=px(font/scale);
    Object.assign(V.guideViewport,{left:px((f.width-102)/scale),top:px((top+Math.max(0,dialogueHeight-94)/2)/scale),width:px(96/scale),height:px(96/scale),transition:'none'});

    // A comparison row becomes two columns. Move each figure's answer buttons
    // with it, so Straight/Curved remain attached to the figure being classified.
    if(V.cards.length>=4&&!V.showZones) {
      const original=V.cards.map(c=>({x:num(c.wrap.left),y:num(c.wrap.top),w:num(c.wrap.width),h:num(c.wrap.height)}));
      const tile=Math.max(...original.map(r=>r.w));
      const rowGap=step.sc==='S6'?300:48;
      V.cards.forEach((c,i)=>{
        const x=(i%2)*(tile+48),y=Math.floor(i/2)*(tile+rowGap);
        Object.assign(c.wrap,{left:px(x),top:px(y),transition:'opacity 240ms, transform 160ms'});
        V.targets.filter(t=>(t.label||'').startsWith('Figure '+(i+1)+':')).forEach((t,j)=>{
          Object.assign(t.style,{left:px(x),top:px(y+tile+28+j*126),width:px(tile),height:'112px'});
        });
      });
    }

    const nativeWidth=/100%/.test(String(V.safeStyle.width))?W:1570;
    const nativeHeight=nativeWidth===W?H:701;
    const boxes=[];
    const add=(style,text)=>{
      if(!style||style.display==='none')return;
      const w=String(style.width||'').includes('%')?nativeWidth*num(style.width)/100:num(style.width,Math.min(900,(text||'').length*28+40));
      const h=num(style.height,num(style.fontSize,46)*1.3+24);
      let x=num(style.left),y=style.top===undefined?nativeHeight-num(style.bottom)-h:num(style.top);
      if(String(style.translate||'').startsWith('-50%'))x-=w/2;
      x+=num(style.marginLeft);y+=num(style.marginTop);
      boxes.push({x,y,w,h});
    };
    V.cards.forEach(c=>add(c.wrap));V.targets.forEach(t=>add(t.style,t.text));
    V.callouts.forEach(c=>add(c.style,c.text));
    if(!V.cards.length)V.leaders.forEach(l=>add(l.style));
    if(V.showZones)boxes.push({x:game.sortBandX(),y:0,w:930,h:1040});
    if(step.sc==='S6')boxes.push({x:0,y:0,w:772,h:1264});
    if(!boxes.length)boxes.push({x:0,y:0,w:800,h:650});
    let left=Math.min(...boxes.map(b=>b.x)),right=Math.max(...boxes.map(b=>b.x+b.w));
    let minY=Math.min(...boxes.map(b=>b.y)),bottom=Math.max(...boxes.map(b=>b.y+b.h));
    // Controls get their own full-width band, instead of retaining a desktop
    // offset or sitting beside a counter where a phone has no room for them.
    const rows=[];
    if(V.showChoice)rows.push(['choiceRowStyle',100]);
    if(V.showChips)rows.push(['chipRowStyle',110]);
    if(V.showCounter)rows.push(['counterRowStyle',118]);
    if(V.showCheck)rows.push(['checkRowStyle',100]);
    if(rows.length) { const needed=V.showChoice?600:V.showChips?750:V.showCounter?510:300;
      const centre=(left+right)/2;left=Math.min(left,centre-needed/2);right=Math.max(right,centre+needed/2); }
    for(const [key,h] of rows) {
      bottom+=38;
      V[key]=Object.assign({},V[key],{left:px(left),top:px(bottom),bottom:'auto',width:px(right-left),height:px(h),
        translate:'none',display:'flex',justifyContent:'center',alignItems:'center',gap:'24px',transition:'none'});
      bottom+=h;
    }
    if(V.showCounter&&V.checkStyle.display!=='none')Object.assign(V.checkStyle,{position:'relative',left:'auto',top:'auto'});
    const padding=Math.max(24,...V.cards.map(c=>num(c.wrap.width)*.08));
    left-=padding;minY-=padding;right+=padding;bottom+=padding;
    const width=right-left,height=bottom-minY;
    const space=Math.max(180,f.height-activityTop-20);
    // Short portrait screens may scroll vertically rather than shrinking words
    // and touch targets into unreadability. The full width always fits.
    const physicalScale=(f.width-32)/width;
    const localScale=physicalScale/scale;
    const x=(f.width-width*physicalScale)/2;
    const y=activityTop+Math.min(28,Math.max(0,(space-height*physicalScale)/2));
    Object.assign(V.safeStyle,{left:px(x/scale-left*localScale),top:px(y/scale-minY*localScale),
      width:px(nativeWidth),height:px(nativeHeight),transform:'scale('+localScale+')',transformOrigin:'0 0',transition:'opacity 200ms'});
    Object.assign(V.boardStyle,{left:px(8/scale),top:px((y-10)/scale),width:px((f.width-16)/scale),height:px((height*physicalScale+20)/scale),borderRadius:px(24/scale),transition:'opacity 200ms'});
    const contentHeight=Math.max(f.height,y+height*physicalScale+22);
    f.stageHeight=contentHeight/scale;
    V.frameStyle.height=px(contentHeight);
    Object.assign(V.viewportStyle,{overflowY:'auto',overflowX:'hidden',overscrollBehavior:'contain'});
    Object.assign(V.scalerStyle,{height:px(f.stageHeight),top:0,transform:'translateX(-50%) scale('+scale+')',transformOrigin:'top center'});
    Object.assign(V.bgStyle,background(f.width,contentHeight),{transition:'none'});
    // Titles and button labels remain readable after the activity is fitted.
    // Font changes are confined to text: illustrations keep their own colours.
    const readable=style=>{
      if(!style||style.display==='none')return;
      const authored=num(style.fontSize,(String(style.font||'').match(/([\d.]+)px/)||[])[1]||30);
      const width=num(style.width,500);
      style.fontSize=px(Math.max(authored,Math.min(18/physicalScale,width/4.8)));
      style['--choice-font-size']=style.fontSize;
    };
    V.targets.filter(t=>t.text).forEach(t=>readable(t.style));
    V.callouts.filter(t=>t.text).forEach(t=>readable(t.style));
    if(V.showChoice){readable(V.btnOpen);readable(V.btnClosed);}
    if(V.showCheck||V.showCounter)readable(V.checkStyle);
    V.chips.forEach(c=>readable(c.style));
    V.counters.forEach(c=>{
      for(const key of ['btnM','btnP','box'])Object.assign(c[key],{width:px(44/physicalScale),height:px(44/physicalScale),fontSize:px(22/physicalScale)});
      c.hitStyle={position:'absolute',inset:0};
    });
    V.safeStyle['--compact-label-size']=px(16/physicalScale);
  }
  window.PolygonResponsive={frame,background,apply};
})();
