const fs = require('fs');
// Export only narration and feedback shown in the brown narrator panel.
const rows = JSON.parse(fs.readFileSync('voiceovers/narrator-lines.json', 'utf8'))
  .filter(row => /^[NF]\d{3}$/.test(row.id));
const quote = value => '"' + String(value).replaceAll('"', '""') + '"';
fs.writeFileSync('voiceovers/narrator-lines.json', JSON.stringify(rows, null, 2));
fs.writeFileSync('voiceovers/narrator-lines.csv', '\ufeff' + [
  ['ID', 'Type', 'Usage / recording context', 'Exact spoken text', 'Suggested audio filename'],
  ...rows.map(row => [row.id, row.type, row.uses.join('; '), row.text, row.audioFilename])
].map(row => row.map(quote).join(',')).join('\r\n'));
let script = `Polygon lesson - complete voiceover recording script

${rows.length} recording entries: 47 main narration, 27 feedback, and 1 generic fallback.

Only text displayed inside the brown narrator panel receives a voiceover.
Board labels (including Shape), options, buttons, numbers and secondary prompts are not spoken.
Record one file per ID; existing N/F IDs are unchanged. Reused feedback needs one recording.
Read numerals naturally as words. Read NOT with emphasis.
Current playback uses the supplied MP3 recordings where transcript wording matches.
N016, F003 and F023 use speech synthesis because their supplied recordings contain older instructions.
Recorded text reveal follows the audio clock using locally generated word-level alignment timestamps.
Long instructions display in natural single-line phrases while the complete recording plays continuously; record each complete N/F line as listed.
Tap, drag and keyboard actions remain locked until the entire instruction finishes.
Errors do not count as completion: the Play voiceover control retries the blocked line.

`;
for (const [title, prefix] of [['MAIN NARRATION - IN LESSON ORDER', 'N'], ['FEEDBACK AND RETRY LINES', 'F']]) {
  script += title + '\n\n';
  for (const row of rows.filter(row => row.id.startsWith(prefix))) {
    script += `${row.id} | ${row.type} | ${row.uses.join('; ')}\n${row.text}\n\n`;
  }
}
fs.writeFileSync('voiceovers/narrator-script.txt', script);
console.log(`Exported ${rows.length} narrator-panel recordings.`);
