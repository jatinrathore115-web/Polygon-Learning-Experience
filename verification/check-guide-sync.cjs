/* Exercise guide events against real sprite queues without image/network timing. */
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const utterances = [], timers = new Map(); let timerId = 0, reduced = false;
const ctx = {
  window: { matchMedia: () => ({ matches: reduced }), speechSynthesis: { cancel() {}, speak(u) { utterances.push(u); } } },
  SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
  React: { createRef: () => ({ current: null }) },
  DCLogic: class { setState(s, cb) { Object.assign(this.state, typeof s === 'function' ? s(this.state) : s); if (cb) cb(); } },
  setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id)
};
vm.createContext(ctx);
for (const file of ['polygon-data.js', 'assets/swiftee/swiftee-sheets.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
vm.runInContext(fs.readFileSync('index.html', 'utf8').match(/<script[^>]*data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1] + '\nglobalThis.Game=Component;', ctx);
const game = new ctx.Game(); game.P = ctx.window.POLY; game.state.ready = true;
game.state.k = 16; game.timers = []; game.armNudge = () => {};
const guide = game.guide, sprite = guide.sprite;
sprite.draw = () => {}; guide.reset();
const finishReaction = () => { const last = sprite.queue.at(-1) || sprite.seg; assert(last.onEnd); last.onEnd(); };
const queued = state => [sprite.seg, ...sprite.queue].some(s => s.state === state);

game.narrate('We call this a polygon.', {});
assert.equal(sprite.seg.state, 'blinking', 'No talking while audio is queued');
let voice = utterances.at(-1); voice.onstart();
assert(guide.voiceActive && queued('talking'));
voice.onpause(); assert(!guide.voiceActive && guide.resting === 'blinking');
voice.onresume(); assert(guide.voiceActive && guide.resting === 'talking');
voice.onboundary({ name: 'word', charIndex: 15 });
assert(queued('surprised'), 'The spoken polygon reveal should get a matching expression');
const reveal = guide.reaction; voice.onboundary({ name: 'word', charIndex: 15 });
assert.strictEqual(guide.reaction, reveal, 'Do not replay a cue on duplicate word events');
voice.onend(); finishReaction(); assert.equal(guide.resting, 'blinking');

guide.reset(); guide.onWrongAttempt(); assert(queued('confused'));
const wrong = guide.reaction; guide.onHint(); guide.onInteractionStart();
assert.strictEqual(guide.reaction, wrong, 'A hint or drag cannot replace mistake feedback');
guide.onInstructionStart(); finishReaction(); assert(queued('talking'));
guide.onInstructionComplete(false); guide.onWrongAttempt(); assert(queued('puzzleing'));
guide.onCorrectAnswer(); assert(queued('relieved'), 'Recovery after a mistake gets relief');
guide.reset(); guide.onCorrectAnswer(); assert(queued('happy'));
guide.reset(); guide.onCorrectProgress(); finishReaction(); guide.onCorrectProgress(); finishReaction(); guide.onCorrectProgress(); assert(queued('proud'));

const staleEnd = sprite.queue.at(-1).onEnd;
guide.reset(); staleEnd(); assert.equal(sprite.seg.state, 'blinking', 'Navigation cancels old expressions');
game.narrate('Old instruction', {}); const old = utterances.at(-1);
game.narrate('New instruction', {}); old.onstart(); assert(!guide.voiceActive);
voice = utterances.at(-1); voice.onstart(); voice.onerror();
assert(!guide.voiceActive && game.locked(), 'Audio failure stops talking without unlocking the question');

// Recorded narration must use its media clock, including pauses and repeated playing events.
const media = [];
ctx.requestAnimationFrame = () => 1; ctx.cancelAnimationFrame = () => {};
ctx.Audio = class {
  constructor() { this.currentTime = 0; this.duration = 2.5; this.paused = true; media.push(this); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute() {} load() {}
};
ctx.window.POLYGON_RECORDINGS = [{ text: 'We call this a polygon.', src: 'test.mp3', duration: 2.5,
  words: ['We', 'call', 'this', 'a', 'polygon.'].map((word, i) => ({ word, start: .2 + i * .4 })) }];
vm.runInContext(fs.readFileSync('voiceovers/recorded-player.js', 'utf8'), ctx);
guide.reset(); game.narrate('We call this a polygon.', {});
const audio = media.at(-1); assert(!guide.voiceActive);
audio.onplaying(); assert(guide.voiceActive && !guide.reaction);
audio.currentTime = 1.79; audio.ontimeupdate(); assert(!guide.reaction);
audio.currentTime = 1.81; audio.ontimeupdate(); assert(queued('surprised'));
const timedCue = guide.reaction;
audio.onwaiting(); assert(!guide.voiceActive && game.locked());
audio.onplaying(); assert(guide.voiceActive); assert.strictEqual(guide.reaction, timedCue);
audio.onended(); assert(!guide.voiceActive); finishReaction();

guide.reset(); game.state.interactive = true; game.state.speaking = false; game._voiceLocked = false;
guide.armIdle(); timers.get(guide._idle)(); assert(guide.dozing);
guide.onActivity(); assert(!guide.dozing && guide.resting === 'blinking');
guide.onInstructionStart(); guide.armIdle(); timers.get(guide._idle)(); assert(!guide.dozing, 'Never daydream during speech');
guide.reset(); guide.onScreenComplete(); assert(queued('proud')); finishReaction(); assert(queued('celebrating'));
reduced = true; guide.reset(); guide.onWrongAttempt();
assert([sprite.seg, ...sprite.queue].every(s => s.still), 'Reduced motion retains expression without animated frames');
console.log('PASS: playback, pause, failure, word cues, reaction priority, recovery, progress, idle, finale, stale events and reduced motion.');
