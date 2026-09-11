// Import locally generated Whisper DTW timestamps; fail on unexpected transcript changes.
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync('voiceovers/recordings.js', 'utf8'), context);
vm.runInNewContext(fs.readFileSync('voiceovers/recorded-player.js', 'utf8'), context);
const normalize = text => text.toLowerCase().replace(/[^a-z0-9]/g, '');
for (const [index, row] of context.window.POLYGON_RECORDINGS.entries()) {
  const raw = JSON.parse(fs.readFileSync(path.join(process.env.TEMP, 'polygon-align', String(index + 1).padStart(2, '0') + '.json')));
  const segments = raw.transcription.filter(segment => /[a-z]/i.test(segment.text));
  const words = row.text.match(/\S+/g).filter(word => /[a-z0-9]/i.test(word));
  assert.equal(segments.length, words.length, row.text);
  row.words = words.map((word, i) => {
    const segment = segments[i];
    // The recognizer substitutes "the" for the supplied "this" in recording 3.
    assert(normalize(word) === normalize(segment.text) || (index === 2 && word === 'this' && segment.text.trim() === 'the'), row.text + ': ' + segment.text);
    const token = segment.tokens.find(token => !token.text.startsWith('[_') && /[a-z]/i.test(token.text) && token.t_dtw >= 0);
    assert(token, word);
    const start = token.t_dtw / 100;
    assert(start < row.duration, row.text);
    return { word, start };
  });
  assert(context.window.PolygonRecordedVoice.wordStarts(row, row.text), row.text);
}
fs.writeFileSync('voiceovers/recordings.js', '// Local MP3 catalogue with Whisper base.en DTW word timings (seconds).\nwindow.POLYGON_RECORDINGS = ' + JSON.stringify(context.window.POLYGON_RECORDINGS, null, 2) + ';\n');
console.log('Validated and imported word timings for all 75 recordings.');
