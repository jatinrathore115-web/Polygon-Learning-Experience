const fs=require('fs'),vm=require('vm'),assert=require('assert');
const html=fs.readFileSync('index.html','utf8');
const ctx={window:{},document:{documentElement:{clientWidth:1440,clientHeight:810}},React:{createRef:()=>({current:null})},DCLogic:class{setState(s){Object.assign(this.state,s);}},setTimeout,clearTimeout};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('polygon-data.js','utf8'),ctx);
vm.runInContext(html.match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1]+'\nglobalThis.Game=Component;globalThis.themes=CONCEPT_THEME;',ctx);
const g=new ctx.Game();g.P=ctx.window.POLY;Object.assign(g.state,{ready:true,wordReveal:'complete'});
const cases=[
 [0,'Look! A point.',['point']], [1,'It drew a shape.',['shape']],
 [4,'Is it OPEN or CLOSED?',['open','closed']],
 [13,'Which boundaries are straight and which are curved?',['straight','curved']],
 [19,'These line segments are the sides of the polygon.',['side']],
 [20,'The point where two sides meet is called a vertex.',['vertex']],
 [21,'When two sides meet, they also form an angle.',['angle']],
 [22,'Side, vertices and angles.',['side','vertex','angle']],
 [23,'A polygon has SIDES and VERTICES.',['side','vertex']],
 [33,'A polygon with three sides is called a triangle.',['triangle']],
 [45,'Hexagons have six sides and heptagons have seven sides.',['hexagon','heptagon']]
];
for(const [k,text,want] of cases){
 Object.assign(g.state,{k,narrPage:text,wordReveal:'complete'});
 const parts=g.narratorParts(),got=[...new Set(parts.map(p=>p.concept).filter(Boolean))];
 assert.deepEqual(got,want,text);
 for(const p of parts.filter(p=>p.style.display)){
  assert.equal(p.style.fontWeight,p.concept?900:800);
  if(!p.concept)assert.equal(p.style.color,'#174b52');
 }
}
g.state.k=4;g.state.narrPage='Is it open or closed?';g.state.wordReveal='recorded';
g.state.revealedWords=3;let parts=g.narratorParts();assert.equal(parts.find(p=>p.active).concept,'open');
g.state.revealedWords=4;assert(!g.narratorParts().some(p=>p.active));
g.state.revealedWords=5;parts=g.narratorParts();assert.equal(parts.find(p=>p.active).concept,'closed');
assert.notEqual(parts.find(p=>p.concept==='open').style.color,parts.find(p=>p.concept==='closed').style.color);
g.state.wordReveal='complete';assert(!g.narratorParts().some(p=>p.active));
for(const concept of ['Side','Vertex','Angle'])assert.equal(g.labelTheme(concept).ink,ctx.themes[concept.toLowerCase()].ink);
const lum=hex=>{const rgb=hex.slice(1).match(/../g).map(n=>parseInt(n,16)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
for(const theme of Object.values(ctx.themes))for(const bg of ['#fffbea',theme.light])assert((lum(bg)+.05)/(lum(theme.ink)+.05)>=4.5,'Keyword contrast on cream and marker fill');
console.log('PASS primary concepts, contrasting pairs, plurals, punctuation, bold weights, voice word cues, matching label colors and 4.5:1 contrast.');
