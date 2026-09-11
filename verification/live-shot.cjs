/* Screenshots the real lesson page on one screen, so layout and type can be
   judged with the actual fonts, board art and runtime in place.
     node verification/live-shot.cjs <screen> <out.png> [stateJSON] [WxH]
   e.g. node verification/live-shot.cjs C5 live-sort.png "{\"sortAt\":{\"0\":0}}"
   Drives the component through window.__poly, the handle boot() publishes, so
   this works without the preview navigator (which the lesson no longer loads).
   State is applied well after runStep so it wins over the narration the screen
   starts for itself, and the per-word reveal is held open — headless Chrome
   blocks audio, which otherwise leaves the tail of every line invisible. */
const fs = require('fs'), cp = require('child_process');
const [screen, out, patch, size] = process.argv.slice(2);
if (!screen || !out) { console.error('usage: live-shot.cjs <screen> <out.png> [stateJSON] [WxH]'); process.exit(1); }
const [w, h] = (size || '1920x1080').split('x');
const q = String.fromCharCode(39);
const shown = '{wordReveal:' + q + 'complete' + q + ',revealedWords:99}';
const hook = '<script>(function(){var wait=setInterval(function(){var g=window.__poly;'
  + 'if(!g||!g.steps||!g.state.ready)return;clearInterval(wait);'
  + (screen.charAt(0)==='#'
     ? 'var k=' + (parseInt(screen.slice(1),10)-1) + ';'   /* a step number, 1-based, as shown in the HUD */
     : 'var k=g.steps().findIndex(function(x){return x.sc===' + q + screen + q + ';});')
  + 'g.setState({k:k,sortAt:{}},function(){g.runStep(k,false);setTimeout(function(){'
  + 'g.setState(Object.assign(' + shown + ',' + (patch || '{}') + '));'
  + 'setInterval(function(){g.setState(' + shown + ');},120);'
  + '},2600);});},120);})();<\/script>';
fs.writeFileSync('live-shot.html', fs.readFileSync('index.html', 'utf8').replace('</body>', hook + '</body>'));
try {
  cp.execFileSync('C:/Program Files/Google/Chrome/Application/chrome.exe',
    ['--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
     '--no-first-run', '--mute-audio', '--user-data-dir=' + process.env.TEMP + '/polygon-live-shot',
     '--window-size=' + w + ',' + h, '--virtual-time-budget=11000',
     '--screenshot=' + process.cwd() + '/verification/' + out,
     'file:///' + process.cwd().split(String.fromCharCode(92)).join('/') + '/live-shot.html'],
    { windowsHide: true, stdio: 'ignore', timeout: 60000 });
} finally { fs.unlinkSync('live-shot.html'); }
console.log('wrote verification/' + out);
