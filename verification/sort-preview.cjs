/* Renders the sort screens at real board size so the drop layout can be eyed,
   not just asserted: full tray, mid-sort, hover preview and both columns full. */
const fs=require('fs'),vm=require('vm'),cp=require('child_process');
const html=fs.readFileSync('index.html','utf8');
const ctx={window:{},document:{documentElement:{clientWidth:1920,clientHeight:1080}},React:{createRef:()=>({current:null})},DCLogic:class{setState(s,cb){Object.assign(this.state,typeof s==='function'?s(this.state):s);if(cb)cb();}},setTimeout,clearTimeout};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('polygon-data.js','utf8'),ctx);
vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]+'\nglobalThis.Game=Component;globalThis.SAFE=SAFE;',ctx);
const {SAFE}=ctx;const g=new ctx.Game();g.P=ctx.window.POLY;g.svgRefs={};g.state.ready=true;g.state.interactive=true;
const num=['zIndex','opacity','fontWeight','lineHeight'];
const css=o=>Object.entries(o||{}).filter(([,v])=>v!==undefined&&v!==null).map(([k,v])=>k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())+':'+(typeof v==='number'&&!num.includes(k)&&v!==0?v+'px':v)).join(';');
const card=c=>`<div style="${css(c.wrap)}"><svg viewBox="${c.vb}" style="${css(c.svgStyle)}"><path d="${c.d}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="${c.sw}" stroke-linejoin="round" stroke-linecap="round"></path><path d="${c.extra||''}" fill="none" stroke="${c.stroke}" stroke-width="${c.sw}" stroke-linecap="round"></path></svg></div>`;
const panel=(title,setup)=>{
  g.state.sortAt={};g.state.pickedFig=null;g.state.sortHover=null;g.state.justPlaced=null;g.state.wrong=null;setup();
  const v=g.renderVals();
  return `<figure><figcaption>${title}</figcaption><div class="safe">
    <div style="${css(v.zoneRowStyle)}">
      <div style="${css(v.zoneAStyle)}"><div style="font:900 30px Nunito,sans-serif;color:#1f6d4a;letter-spacing:.06em">${v.zoneAName}</div><div style="font:700 21px Nunito,sans-serif;color:#57907a;margin-top:2px">${v.zoneASub}</div></div>
      <div style="${css(v.zoneBStyle)}"><div style="font:900 30px Nunito,sans-serif;color:#a8395f;letter-spacing:.06em">${v.zoneBName}</div><div style="font:700 21px Nunito,sans-serif;color:#bd7a92;margin-top:2px">${v.zoneBSub}</div></div>
    </div>
    ${v.cards.map(card).join('')}
    ${v.callouts.map(o=>`<div style="${css(o.style)}">${o.text}</div>`).join('')}
  </div></figure>`;
};
const at=(step,pairs)=>()=>{g.state.k=g.steps().findIndex(s=>s.sc===step);pairs.forEach(([i,z])=>{g.state.sortAt[i]=z;});};
const panels=[
  panel('CFU 5 — full tray',at('C5',[])),
  panel('CFU 5 — one placed',at('C5',[[0,0]])),
  panel('CFU 5 — dragging shape 2 over HEPTAGON (slot open)',()=>{at('C5',[[0,0],[2,0]])();g.state.pickedFig=1;g.state.sortHover=1;}),
  panel('CFU 5 — all four sorted',at('C5',[[0,0],[1,1],[2,0],[3,1]])),
  panel('CFU 2 — three in POLYGONS, two in NOT',at('C2',[[0,0],[1,1],[2,0],[3,0],[4,1]])),
];
fs.writeFileSync('verification/sort-preview.html',`<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#0d2b46;font-family:Nunito,sans-serif}
figure{margin:0 0 26px}figcaption{color:#bfe6ff;font:700 22px Nunito,sans-serif;padding:10px 14px}
.safe{position:relative;width:${SAFE.w}px;height:${SAFE.h}px;background:#fdfeff;border-radius:26px;outline:2px solid #ff5da2}
.safe *{box-sizing:border-box}
</style>${panels.join('')}`);
const args=['--headless','--no-sandbox','--disable-gpu','--hide-scrollbars','--force-device-scale-factor=1','--no-first-run',
  '--user-data-dir='+process.env.TEMP+'/polygon-sort-preview','--window-size=1620,4000','--virtual-time-budget=1500',
  '--screenshot='+process.cwd()+'/verification/sort-preview.png',
  'file:///'+process.cwd().split(String.fromCharCode(92)).join('/')+'/verification/sort-preview.html'];
cp.execFileSync('C:/Program Files/Google/Chrome/Application/chrome.exe',args,{windowsHide:true,stdio:'ignore',timeout:40000});
console.log('wrote verification/sort-preview.png');
