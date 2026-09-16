/* Shared recording playback. The media clock owns phrase and word progress. */
(function () {
  'use strict';
  const numbers = ['zero','one','two','three','four','five','six','seven','eight','nine'];
  const normalize = text => text.toLowerCase().replace(/[0-9]/g, n => numbers[+n])
    .replace(/[’']/g, '').replace(/[^a-z]+/g, ' ').trim();
  window.PolygonRecordedVoice = {
    wordStarts(entry, text) {
      if (!Array.isArray(entry.words) || !entry.words.length) return null;
      let previous = -1;
      const spoken = [];
      for (const item of entry.words) {
        if (typeof item.word !== 'string' || !Number.isFinite(item.start) || item.start < 0 || item.start < previous) return null;
        previous = item.start;
        normalize(item.word).split(' ').filter(Boolean).forEach(word => spoken.push({ word, start: item.start }));
      }
      if (spoken.map(item => item.word).join(' ') !== normalize(text)) return null;
      let index = 0, last = 0;
      return (text.match(/\S+/g) || []).map(token => {
        const size = normalize(token).split(' ').filter(Boolean).length;
        if (size) { last = spoken[index].start; index += size; }
        return last;
      });
    },
    find(text) {
      return (window.POLYGON_RECORDINGS || []).find(row => normalize(row.text) === normalize(text));
    },
    play(game, text, entry, current, done, fail) {
      if (game._stopRecordedVoice) game._stopRecordedVoice();
      const audio = new Audio(entry.src);
      audio.preload = 'auto';
      const pages = game.instructionPages(text);
      const counts = pages.map(page => (page.match(/\S+/g) || []).length);
      const total = counts.reduce((a, b) => a + b, 0);
      const wordStarts = this.wordStarts(entry, text);
      const words = text.match(/\S+/g) || [];
      let spoken = 0;
      let frame, pageIndex = -1, revealed = -1, stopped = false;
      const stop = () => {
        stopped = true; cancelAnimationFrame(frame);
        audio.onplaying = audio.onpause = audio.onwaiting = audio.onstalled = audio.onended = audio.onerror = audio.ontimeupdate = null;
        audio.pause(); audio.removeAttribute('src'); audio.load();
        if (game._stopRecordedVoice === stop) game._stopRecordedVoice = null;
      };
      game._stopRecordedVoice = stop;
      function update() {
        if (stopped || !current()) return;
        if (game.step().sc === 'S11') game.setState({ voiceElapsedMs: audio.currentTime * 1000 });
        const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : entry.duration;
        // Alignment timestamps are seconds relative to this MP3, including leading silence.
        // Keep the duration fallback only for recordings without validated alignment.
        const spokenCount = wordStarts ? wordStarts.filter(start => start <= audio.currentTime).length : null;
        const position = wordStarts ? Math.max(0, spokenCount - 1) : Math.min(total - 0.001, Math.max(0, audio.currentTime / duration * total));
        const audibleCount = wordStarts ? spokenCount : Math.min(total, Math.floor(position) + 1);
        while (spoken < audibleCount) {
          if (game.boundaryScene && game.boundaryScene()) game.keyword(words[spoken]);
          else if (game.guide && game.guide.onWord) game.guide.onWord(words[spoken], game.step());
          spoken += 1;
        }
        let page = 0, offset = 0;
        while (page < pages.length - 1 && position >= offset + counts[page]) offset += counts[page++];
        const count = wordStarts ? Math.max(0, Math.min(counts[page], spokenCount - offset)) : Math.min(counts[page], Math.floor(position - offset) + 1);
        if (game.step().sc === 'S8' && !game.state.reveal) {
          const visibleWords = (pages[page].match(/\S+/g) || []).slice(0, count);
          if (visibleWords.some(word => normalize(word) === 'polygon')) game.keyword('polygon');
        }
        if (page !== pageIndex) {
          pageIndex = page; revealed = count;
          game.prepareNarratorReveal(pages[page]);
          game.setState({ wordReveal: 'recorded', revealedWords: count });
        } else if (revealed !== count) {
          revealed = count; game.setState({ revealedWords: count });
        }
      }
      function tick() { update(); if (!stopped && current() && !audio.paused) frame = requestAnimationFrame(tick); }
      audio.onplaying = () => {
        if (stopped || !current()) return;
        if (game.storyVoiceStart) game.storyVoiceStart();
        game.setState({ voiceError: '' }); cancelAnimationFrame(frame); tick();
      };
      const waiting = () => {
        if (stopped || !current()) return;
        cancelAnimationFrame(frame);
        if (game.guide && game.guide.onInstructionPause) game.guide.onInstructionPause();
      };
      audio.onpause = audio.onwaiting = waiting;
      audio.ontimeupdate = () => { if (!audio.paused) update(); };
      audio.onerror = () => { if (!stopped && current()) { stop(); fail(); } };
      audio.onended = () => {
        if (stopped || !current()) return;
        stop(); game.setState({ wordReveal: 'complete' }, done);
      };
      // Reserve the first phrase before playback; nothing flashes while loading.
      game.prepareNarratorReveal(pages[0]);
      try { const promise = audio.play(); if (promise) promise.catch(() => { if (!stopped && current()) { stop(); fail(); } }); }
      catch (error) { stop(); fail(); }
    }
  };
})();
