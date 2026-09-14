require('fs').mkdirSync('verification/output', { recursive: true });
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
const ctx={window:{},document:{documentElement:{clientWidth:1920,clientHeight:1080}},React:{createRef:()=>({current:null})},DCLogic:class {setState(s){Object.assign(this.state,typeof s==='function'?s(this.state):s);}},setTimeout,clearTimeout};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('polygon-data.js','utf8'),ctx);vm.runInContext(fs.readFileSync('assets/swiftee/swiftee-sheets.js','utf8'),ctx);vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]+'\nglobalThis.Game=Component;',ctx);
const g=new ctx.Game();g.P=ctx.window.POLY;g.svgRefs={};g.state.ready=true;
for(let k=0;k<g.steps().length;k++){g.state.k=k;g.state.phase=g.steps()[k].ph||'';for(const interactive of [false,true]){g.state.interactive=interactive;const v=g.renderVals();assert.equal(v.effectsEnabled,interactive);assert.equal(typeof v.activateKey,'function');}}
/* Swiftee escorts the learner on every screen, and the sheet table generated
   from the character pack's manifest is the single thing that turns her on:
   without it the guide layer must disappear rather than render a broken canvas. */
for(let k=0;k<g.steps().length;k++){g.state.k=k;assert.equal(g.renderVals().showGuide,true,'screen '+(k+1)+' does not render the guide');}
assert(html.includes('<sc-if value="{{ showGuide }}"'),'the guide sprite is not gated behind showGuide');
assert(html.includes('const GUIDE_VISIBLE = !!(window.SWIFTEE && window.SWIFTEE.clips)'),'GUIDE_VISIBLE no longer follows the generated sheet table');
const bare={...ctx,window:{POLY:ctx.window.POLY}};vm.createContext(bare);
vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]+'\nglobalThis.Game=Component;',bare);
const gb=new bare.Game();gb.P=bare.window.POLY;gb.svgRefs={};gb.state.ready=true;
assert.equal(gb.renderVals().showGuide,false,'the guide still renders with no sheet table loaded');
let clicks=0,prevented=0;const target={click:()=>clicks++};const event=key=>({key,target,currentTarget:target,preventDefault:()=>prevented++});
g.state.interactive=true;g.activateKey(event('Enter'));g.activateKey(event(' '));g.activateKey(event('Escape'));g.activateKey({...event('Enter'),repeat:true});assert.equal(clicks,2);assert.equal(prevented,2);
g.state.interactive=false;g.activateKey(event('Enter'));assert.equal(clicks,2);
g.state.interactive=true;g.narrate=()=>{};g.feedback('Try again');assert.equal(g.state.interactive,false);
assert(html.includes('prefers-reduced-motion:reduce'));assert(!html.includes("scale: '1 -1'"));
const luminance=hex=>{const channels=hex.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;};
for(const tone of ['primary','secondary']){
  const skin=g.buttonSkin(tone);
  for(const stop of skin.background.match(/#[0-9a-f]{6}/gi))
    assert((luminance(stop)+.05)/(luminance(skin.color)+.05)>=4.5,tone+' button text must remain readable across its actual gradient');
}
const css=o=>Object.entries(o).map(([k,v])=>k.replace(/[A-Z]/g,m=>'-'+m.toLowerCase())+':'+(typeof v==='number'&&!['zIndex','opacity','fontWeight','lineHeight'].includes(k)&&v!==0?v+'px':v)).join(';');
fs.writeFileSync('verification/output/interaction-preview.html',`<!doctype html><meta charset="utf-8"><style>${fs.readFileSync('styles/buttons.css','utf8')}${html.match(/<style>([\s\S]*?)<\/style>/)[1]}body{display:grid;place-items:center;background:#d9f2ff}.preview{display:flex;gap:74px;padding:70px;background:#f7fbfd;border-radius:35px}.game-action::before{animation-delay:-1.6s!important}</style><div class="preview" data-interactive="true"><div role="button" tabindex="0" class="game-action game-primary" style='${css(g.ocBtn('open')).replace('assets/','../../assets/')}'>Open</div><div role="button" tabindex="0" class="game-action game-primary" style='${css(g.ocBtn('closed')).replace('assets/','../../assets/')}'>Closed</div></div>`);
console.log('PASS: 47 screens in ready/locked states; keyboard activation, repeat protection, feedback lock, readable labels, upright hint and reduced-motion rules.');
