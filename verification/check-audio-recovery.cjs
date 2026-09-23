const fs=require('fs'),vm=require('vm'),assert=require('assert');
const fixture=fs.readFileSync('verification/check-voice-gate.cjs','utf8').split('let g=game(4);')[0];
const context={require,console,setTimeout,clearTimeout};vm.createContext(context);
vm.runInContext(fixture+`
let g=game(4);g.narrate('Read this instruction.',{});
const failed=spoken.at(-1);failed.onerror();failed.onend();
assert(g.locked()&&g.state.voiceError&&g._voiceRetry);
g.continueWithoutVoice();assert(!g.locked());assert.equal(g.state.voiceError,'');
g.continueWithoutVoice();assert(!g.locked(),'Continuation is one-shot');
g.narrate('Old line.',{});spoken.at(-1).onerror();const oldContinue=g._voiceContinue;
g.narrate('New line.',{});oldContinue();assert(g.locked(),'Stale recovery cannot release a new instruction');
spoken.at(-1).onerror();g.retryVoice();assert(!g._voiceContinue);drain(g);assert(!g.locked());
g.narrate('Unavailable.',{});spoken.at(-1).onerror();
const attempts=spoken.length;
g.unlockAudio({isTrusted:true,type:'pointerup',target:{closest:()=>true}});
assert.equal(spoken.length,attempts,'Recovery controls do not also trigger the global retry gesture');
g.continueWithoutVoice();assert(!g.locked());
console.log('PASS: explicit continue, retry, duplicate/stale callbacks and recovery gesture isolation.');
`,context);
