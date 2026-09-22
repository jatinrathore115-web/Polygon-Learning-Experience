const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const server = http.createServer((req, res) => {
  const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/$/, '/index.html'));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, data) => {
    res.writeHead(error ? 404 : 200, { 'Content-Type': ({ '.html':'text/html', '.js':'text/javascript', '.css':'text/css' })[path.extname(file)] || 'application/octet-stream' });
    res.end(error ? '' : data);
  });
});
(async () => {
  await new Promise(resolve => server.listen(9378, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel:'chrome', headless:true });
  try {
    const page = await browser.newPage({ viewport:{ width:1440, height:810 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      window.testMedia = [];
      // Exercise the real recorded player deterministically with its own MP3 alignments.
      window.Audio = class {
        constructor(src) { this.src=src; this.currentTime=0; this.paused=true; this.duration=NaN; testMedia.push(this); }
        play() { this.paused=false; return Promise.resolve(); }
        pause() { this.paused=true; this.onpause?.(); }
        removeAttribute() {} load() {}
      };
    });
    await page.goto('http://127.0.0.1:9378/?intro=0');
    await page.waitForFunction(() => window.__poly?.state.ready);
    await page.evaluate(() => { __poly.timers.forEach(clearTimeout); __poly.later=()=>0; });
    const setup = async screen => page.evaluate(screen => {
      const g=__poly; g._guideGreeted=true; g.setState({ k:screen-1 }); g.runStep(screen-1, false);
      g.timers.forEach(clearTimeout); g._stopRecordedVoice?.();
      g.setState({ storyContent:true, storyDialogue:true, magicReveal:false });
      g.narrate(g.step().narr);
    }, screen);
    const read = async () => page.locator('[data-oc-choice]').evaluateAll(elements => elements.map(e => {
      const css=getComputedStyle(e), r=e.getBoundingClientRect();
      return { visible:css.visibility==='visible', opacity:css.opacity, filter:css.filter, animation:css.animationName,
        background:css.backgroundImage, shadow:css.boxShadow, hidden:e.getAttribute('aria-hidden'),
        disabled:e.getAttribute('aria-disabled'), tab:e.tabIndex, x:r.x, width:r.width };
    }));
    for (let screen=5; screen<=9; screen++) {
      await setup(screen);
      assert.deepEqual((await read()).map(e=>e.visible), [false,false], `Screen ${screen}: no loading flash`);
      if (screen>=7) {
        await page.evaluate(() => testMedia.at(-1).onplaying());
        assert.deepEqual((await read()).map(e=>e.visible), [false,false], 'Short lead-in has no premature choices');
        await page.evaluate(() => testMedia.at(-1).onended());
      }
      const cues = await page.evaluate(() => {
        const a=testMedia.at(-1), entry=POLYGON_RECORDINGS.find(e=>e.src===a.src);
        a.duration=entry.duration; a.onplaying();
        return { open:entry.words.find(w=>/^open\b/i.test(w.word)).start,
          closed:entry.words.find(w=>/^closed\b/i.test(w.word)).start };
      });
      const tick = time => page.evaluate(time => { const a=testMedia.at(-1); a.currentTime=time; a.ontimeupdate(); }, time);
      await tick(cues.open-.001);
      assert.deepEqual((await read()).map(e=>e.visible), [false,false], 'Both hidden before Open');
      const before=await read();
      await tick(cues.open);
      assert.deepEqual((await read()).map(e=>e.visible), [true,false], 'Only Open at its timestamp');
      assert((await read()).filter(e=>e.visible).every(e=>e.opacity==='1' && e.filter==='none' && e.animation==='none'), 'Open is crisp on its first visible frame');
      assert((await read()).every(e=>e.disabled==='true' && e.tab===-1), 'Narration input gate retained');
      await page.evaluate(() => { testMedia.at(-1).pause(); });
      await tick(cues.closed);
      assert.deepEqual((await read()).map(e=>e.visible), [true,false], 'Pause cannot reveal the next cue');
      await page.evaluate(time => { const a=testMedia.at(-1); a.currentTime=time; a.paused=false; a.onplaying(); }, cues.closed-.001);
      assert.deepEqual((await read()).map(e=>e.visible), [true,false], 'Closed hidden immediately before its cue');
      await tick(cues.closed);
      assert.deepEqual((await read()).map(e=>e.visible), [true,true], 'Closed appears at its timestamp');
      assert((await read()).every(e=>e.opacity==='1' && e.filter==='none' && e.animation==='none'), 'Both choices are immediately opaque and unblurred');
      const after=await read();
      assert(after.every(e=>e.background.includes('rgb(255, 241, 106)')), 'Final yellow face is visible during narration');
      assert(after.every(e=>+e.opacity>.99), 'Entrance finishes fully visible');
      assert(after.every((e,i)=>Math.abs(e.x-before[i].x)<1 && Math.abs(e.width-before[i].width)<1), 'No horizontal layout shift');
      await page.evaluate(() => testMedia.at(-1).onended());
      assert.deepEqual((await read()).map(e=>[e.background,e.shadow]),after.map(e=>[e.background,e.shadow]),'Unlocking input does not change the revealed button design');
      assert((await read()).every(e=>e.disabled==='false' && e.tab===0 && e.hidden==='false'), 'Choices accessible after question');
      if (screen===5) {
        const out=path.join(__dirname,'output','choice-voice-cues'); fs.mkdirSync(out,{recursive:true});
        await page.screenshot({path:path.join(out,'screen-5.png')});
      }
      await page.evaluate(() => __poly.replay());
      assert.deepEqual((await read()).map(e=>e.visible), [false,false], 'Replay resets both cues');
    }
    await page.emulateMedia({ reducedMotion:'reduce' }); await setup(5);
    await page.evaluate(() => { const a=testMedia.at(-1); a.onplaying(); a.currentTime=3; a.ontimeupdate(); });
    assert((await read()).every(e=>e.animation==='none'), 'Reduced motion has no entrance animation');
    const oldEnded=await page.evaluate(() => { window.staleEnded=testMedia.at(-1).onended; return true; });
    await setup(6); await page.evaluate(() => staleEnded());
    assert(oldEnded && (await read()).every(e=>!e.visible), 'Old screen completion cannot reveal new choices');
    await page.evaluate(() => testMedia.at(-1).onerror());
    assert((await read()).every(e=>e.visible), 'Unavailable audio shows readable choices instead of blocking the lesson');
    assert.deepEqual(errors, []);
    console.log('PASS: Screens 5–9 exact word cues, loading, pause/resume, replay, input gate, stable layout, reduced motion, stale callbacks and audio failure.');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exitCode=1; server.close(); });
