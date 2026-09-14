/* ============================================================================
   ICE-AGE BLIZZARD INTRO — sequencing, particles and wind audio.

   Self-contained: it builds its own overlay on top of the lesson, runs one
   fixed timeline, and takes itself back out. The lesson is untouched except
   for one gate — index.html waits on IceIntro.gate before it runs screen 1, so
   no lesson animation, narration or input happens underneath the cinematic.

   Almost all of the motion is in styles/ice-intro.css. This file only:
     - measures the storm's particles and hands each one its own randomised
       travel vector, size, speed, delay and lifetime;
     - starts the timeline and the Web Audio wind, and rides them together;
     - tears everything down at the end — timers, listeners, audio, DOM.

   The wind direction is decided in one place (--wind-tilt in the stylesheet)
   and every particle here derives its vector from it, so nothing can drift out
   of agreement with the mist and streak angles.

   Skip it with ?intro=0, or with ?preview=1 while authoring screens.
   ========================================================================= */
(function () {
  'use strict';

  var DEFAULT_DURATION = 5800;   // ms; the stylesheet's --intro-duration wins
  var VOLUME_TRIM = 0.75;        // headroom over the spec curve; keep it gentle

  /* The storm's shape.

     travel is how far a flake crosses, in vw, and tilt how far below the
     horizontal it does it — the two together are the whole wind. Travel is
     applied as vw on BOTH axes so the angle on screen is exactly tilt at any
     aspect ratio; the spawn box below is what converts back into vh.

     alpha is deliberately high: the artwork is an almost-white ice field, so
     faint white snow simply is not there. Depth is carried by size, speed and
     softness instead of by transparency.

     arrive/cease are fractions of the whole intro: the window over which this
     layer's flakes start turning up, and the window over which they stop. They
     are the storm's build-up and its settling — spreading them per flake is
     what replaces fading whole layers in and out, and it is both cheaper and
     more like weather. */
  var FIELDS = [
    {
      cls: 'snow snow-mid', count: 150,
      size: [5, 11], alpha: [0.85, 1], dur: [1, 1.7],
      travel: [34, 50], tilt: [16, 22], spin: [60, 200], sway: [0.6, 1.8],
      arrive: [0.181, 0.448], cease: [0.793, 0.948]        /* 1.05-2.6s, 4.6-5.5s */
    },
    {
      cls: 'snow snow-front', count: 46,
      size: [14, 28], alpha: [0.95, 1], dur: [0.4, 0.75],
      travel: [40, 62], tilt: [18, 25], spin: [0, 0],
      streaks: 0.35, streakLen: [30, 64], streakThick: [4, 8],
      arrive: [0.362, 0.569], cease: [0.750, 0.879]        /* 2.10-3.3s, 4.35-5.1s */
    },
    {
      cls: 'snow snow-burst', count: 48,
      size: [0, 0], alpha: [0.6, 0.95], dur: [0.18, 0.3],
      travel: [42, 62], tilt: [12, 18], spin: [0, 0],
      streaks: 1, streakLen: [40, 100], streakThick: [1.8, 3.4],
      arrive: [0.543, 0.638], cease: [0.741, 0.853]        /* 3.15-3.7s, 4.3-4.95s */
    },
    {
      cls: 'ground-drift', count: 36,
      size: [0, 0], alpha: [0.35, 0.68], dur: [0.55, 1],
      travel: [38, 58], tilt: [1, 4], spin: [0, 0],
      streaks: 1, streakLen: [14, 44], streakThick: [1.5, 3.5],
      arrive: [0.328, 0.517], cease: [0.776, 0.931],       /* 1.90-3.0s, 4.5-5.4s */
      /* Loose snow lifted off the ice itself, so it lives on the ground. */
      band: [44, 88]
    }
  ];

  /* The distant layer is drawn as tiled dot fields rather than as elements:
     150 tiny identical flakes cost more frame time than the whole rest of the
     storm and carry no individuality worth paying for. Each sheet travels a
     whole number of tiles, so the pattern lands exactly on itself and the loop
     cannot be seen; four coprime tiles at four speeds stop the grid reading as
     a grid. The last one is nearer and faster, and buys a lot of apparent
     density for a single element. */
  var DUST = [
    { tile: [118, 96],  dot: 1.15, alpha: 0.50, tiles: 6, speed: 240 },
    { tile: [83, 71],   dot: 0.90, alpha: 0.38, tiles: 8, speed: 185 },
    { tile: [151, 127], dot: 1.50, alpha: 0.60, tiles: 5, speed: 305 },
    { tile: [207, 173], dot: 2.40, alpha: 0.58, tiles: 6, speed: 430 }
  ];
  var DUST_TILT = 15.5;   /* degrees below horizontal, inside the wind's band */

  /* The wind's loudness through the storm, as fractions of the whole intro so
     that retiming --intro-duration retimes the sound with it. Straight from
     the brief: silent, breathing, building, blizzard, easing, gone. */
  var GAIN_CURVE = [
    [0.000, 0.00], [0.069, 0.00], [0.172, 0.15], [0.345, 0.30],
    [0.603, 0.55], [0.759, 0.35], [0.931, 0.00]
  ];
  /* Wind gets brighter as it gets stronger, not just louder — that is what
     stops it sounding like a volume knob on a hiss. */
  var TONE_CURVE = [
    [0.000, 260], [0.069, 300], [0.345, 620],
    [0.603, 1150], [0.759, 780], [0.931, 380]
  ];
  var GUST_AT = 0.491;           // 2.85s of 5.8s — under the visual gust

  /* ---------------------------------------------------------------------- */

  var resolveGate;
  var gate = new Promise(function (res) { resolveGate = res; });

  var state = {
    root: null, timers: [], audio: null,
    unlockListeners: null, finished: false, started: false
  };

  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
  function pick(list) { return list[(Math.random() * list.length) | 0]; }
  function later(fn, ms) { state.timers.push(setTimeout(fn, ms)); }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function skipRequested() {
    try {
      var q = new URLSearchParams(window.location.search);
      return q.get('intro') === '0' || q.get('preview') === '1';
    } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------ DOM */

  function buildParticles(spec, host, calm) {
    var frag = document.createDocumentFragment();
    var lives = ['flakeFly', 'flakeFly', 'flakeFlyB'];
    var n = Math.max(4, Math.round(spec.count * spec.density));

    for (var i = 0; i < n; i++) {
      var el = document.createElement('i');
      var isStreak = spec.streaks && Math.random() < spec.streaks;
      var tilt = rand(spec.tilt[0], spec.tilt[1]);
      var travel = rand(spec.travel[0], spec.travel[1]);
      var dur = rand(spec.dur[0], spec.dur[1]) * (calm ? 2.4 : 1);
      var w, h;

      if (isStreak) {
        w = rand(spec.streakLen[0], spec.streakLen[1]);
        h = rand(spec.streakThick[0], spec.streakThick[1]);
      } else {
        w = h = rand(spec.size[0], spec.size[1]);
      }

      /* Elongated snow lies along its own path, so a streak always points the
         way it is actually travelling. */
      var rot = isStreak ? -tilt : 0;
      var spin = rand(spec.spin[0], spec.spin[1]) * (Math.random() < 0.5 ? -1 : 1);

      var life = spec.sway && Math.random() < 0.7 ? 'flakeFlyC' : pick(lives);

      /* Spawn across exactly the band this flake will sweep — off to the right
         by its own travel, and up by its own fall. Spawning over a fixed
         oversized box instead wastes most of the storm off-screen: this is the
         difference between 160 flakes and 30 visible ones. */
      var dropVh = travel * Math.tan(tilt * Math.PI / 180) * spec.aspect;
      var top = spec.band ? spec.band[0] : -6;
      var bottom = spec.band ? spec.band[1] : 96;

      var arrive = rand(spec.arrive[0], spec.arrive[1]) * spec.durationSec;
      var cease = rand(spec.cease[0], spec.cease[1]) * spec.durationSec;

      var css =
        '--x:' + rand(-8, 100 + travel).toFixed(2) + '%;' +
        '--y:' + rand(top - dropVh, bottom).toFixed(2) + '%;' +
        '--w:' + w.toFixed(2) + 'px;' +
        '--h:' + h.toFixed(2) + 'px;' +
        '--o:' + rand(spec.alpha[0], spec.alpha[1]).toFixed(3) + ';' +
        '--tx:' + (-travel).toFixed(2) + 'vw;' +
        '--ty:' + (travel * Math.tan(tilt * Math.PI / 180)).toFixed(2) + 'vw;' +
        '--dur:' + dur.toFixed(2) + 's;' +
        /* This flake's own arrival and departure. Spread across the layer's
           windows, the field thickens and thins the way falling snow does
           rather than fading in and out as a sheet. */
        '--delay:' + arrive.toFixed(2) + 's;' +
        '--loops:' + Math.max(1, Math.round((cease - arrive) / dur)) + ';' +
        '--r0:' + rot.toFixed(1) + 'deg;' +
        '--rm:' + (rot + spin * 0.5).toFixed(1) + 'deg;' +
        '--r1:' + (rot + spin).toFixed(1) + 'deg;' +
        '--fly:' + life + ';';

      if (spec.sway) css += '--sway:' + rand(spec.sway[0], spec.sway[1]).toFixed(2) + 'vw;';

      el.style.cssText = css;
      if (isStreak) el.className = 'streak';
      frag.appendChild(el);
    }
    host.appendChild(frag);
  }

  /* A dust sheet drifts by an exact number of tiles, which makes the tiled dot
     field seamless, and picks the tile count on each axis so the direction it
     drifts is as close to the wind as the lattice allows. */
  function buildDust(host, calm) {
    var tan = Math.tan(DUST_TILT * Math.PI / 180);
    DUST.forEach(function (sheet) {
      var el = document.createElement('span');
      el.className = 'dust';
      var across = sheet.tiles * sheet.tile[0];
      var down = Math.max(1, Math.round(across * tan / sheet.tile[1])) * sheet.tile[1];
      var speed = sheet.speed * (calm ? 0.35 : 1);
      el.style.cssText =
        '--tile:' + sheet.tile[0] + 'px ' + sheet.tile[1] + 'px;' +
        '--dot:' + sheet.dot + 'px;' +
        '--o:' + (calm ? sheet.alpha * 0.6 : sheet.alpha) + ';' +
        '--tx:' + (-across) + 'px;' +
        '--ty:' + down + 'px;' +
        '--dur:' + (Math.hypot(across, down) / speed).toFixed(2) + 's;';
      host.appendChild(el);
    });
  }

  /* The shell goes in first and empty, so --intro-duration can be read off the
     live element before a single flake is given a start time. */
  function shell() {
    var root = document.createElement('div');
    root.id = 'ice-intro';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML =
      '<div class="intro-cam">' +
        '<div class="intro-bg"></div>' +
        '<div class="ambient-haze"></div>' +
        '<div class="snow snow-back"></div>' +
        '<div class="ground-drift"></div>' +
        '<div class="snow snow-mid"></div>' +
        '<div class="wind wind-back"></div>' +
        '<div class="wind wind-front"></div>' +
        '<div class="snow snow-front"></div>' +
        '<div class="snow snow-burst"></div>' +
        '<div class="gust gust-one"></div>' +
        '<div class="gust gust-two"></div>' +
        '<div class="ice-vignette"></div>' +
        '<div class="dusk"></div>' +
        '<div class="whiteout-flash"></div>' +
      '</div>';
    document.body.appendChild(root);
    state.root = root;
    return root;
  }

  function fill(root, durMs) {
    var calm = reducedMotion();
    /* Fewer particles on a small screen, and far fewer when motion is
       unwelcome — the storm still reads, it just stops rushing. */
    var wide = window.innerWidth || document.documentElement.clientWidth || 1280;
    var high = window.innerHeight || document.documentElement.clientHeight || 720;
    var density = Math.max(0.5, Math.min(1.15, wide / 1920)) * (calm ? 0.4 : 1);
    var aspect = wide / high;

    buildDust(root.querySelector('.snow-back'), calm);
    FIELDS.forEach(function (spec) {
      if (calm && spec.cls === 'snow snow-burst') return;   // no peak streaks
      var host = root.querySelector('.' + spec.cls.split(' ').pop());
      if (!host) return;
      buildParticles(Object.assign({
        density: density, aspect: aspect, durationSec: durMs / 1000
      }, spec), host, calm);
    });
  }

  /* The reveal must not play over a background that has not arrived: on a slow
     connection the storm would blow across a black screen and the artwork
     would snap in late. Waits for the image the stylesheet actually names — so
     the path stays in one place — and gives up after `cap` so a missing file
     delays the lesson by a moment rather than for ever. */
  function whenBackgroundReady(root, cap) {
    return new Promise(function (done) {
      var settled = false;
      var finish = function () { if (!settled) { settled = true; done(); } };
      setTimeout(finish, cap);
      var url;
      try {
        var css = getComputedStyle(root.querySelector('.intro-bg')).backgroundImage;
        url = (/url\(["']?(.*?)["']?\)/.exec(css) || [])[1];
      } catch (e) {}
      if (!url) { finish(); return; }
      var img = new Image();
      img.onload = finish;
      img.onerror = finish;
      img.src = url;
      if (img.complete) finish();
    });
  }

  function readDuration(root) {
    try {
      var raw = getComputedStyle(root).getPropertyValue('--intro-duration').trim();
      if (!raw) return DEFAULT_DURATION;
      var ms = raw.slice(-2) === 'ms' ? parseFloat(raw) : parseFloat(raw) * 1000;
      return ms > 400 ? ms : DEFAULT_DURATION;
    } catch (e) { return DEFAULT_DURATION; }
  }

  /* ---------------------------------------------------------------- AUDIO */

  /* Brown noise: white noise leaked through an integrator. It is the reason
     this sounds like moving air and not like rain on a tin roof. */
  function brownNoise(ctx, seconds) {
    var buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    var data = buf.getChannelData(0), last = 0;
    for (var i = 0; i < data.length; i++) {
      var white = Math.random() * 2 - 1;
      last = (last + 0.021 * white) / 1.021;
      data[i] = last * 3.2;
    }
    return buf;
  }

  function valueAt(curve, t) {
    if (t <= curve[0][0]) return curve[0][1];
    for (var i = 1; i < curve.length; i++) {
      if (t <= curve[i][0]) {
        var a = curve[i - 1], b = curve[i];
        var k = (t - a[0]) / (b[0] - a[0] || 1);
        return a[1] + (b[1] - a[1]) * k;
      }
    }
    return curve[curve.length - 1][1];
  }

  /* Schedules the remainder of a curve from wherever the storm has got to, so
     a late audio unlock joins the wind already in progress instead of
     restarting it. */
  function schedule(param, curve, elapsed, durSec, now, scale) {
    var mul = scale === undefined ? 1 : scale;
    param.cancelScheduledValues(now);
    param.setValueAtTime(valueAt(curve, elapsed) * mul, now);
    curve.forEach(function (point) {
      if (point[0] <= elapsed) return;
      param.linearRampToValueAtTime(point[1] * mul, now + (point[0] - elapsed) * durSec);
    });
  }

  function startAudio(durMs) {
    if (state.audio || state.finished) return;
    /* The lesson's own mute setting is the learner's decision; honour it. */
    try { if (window.__poly && window.__poly.state && window.__poly.state.muted) return; } catch (e) {}

    var Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;

    var ctx;
    try { ctx = new Ctx(); } catch (e) { return; }

    var audio = { ctx: ctx, nodes: [] };
    state.audio = audio;

    var begin = function () {
      if (state.finished || audio.running) return;
      if (ctx.state !== 'running') return;
      audio.running = true;

      var durSec = durMs / 1000;
      /* Where the storm actually is right now, not where it was when the
         context was created — a gesture may have unlocked it seconds later. */
      var elapsed = Math.max(0, Date.now() - state.startedAt) / durMs;
      if (elapsed >= GAIN_CURVE[GAIN_CURVE.length - 1][0]) return;   // nothing left to play

      var now = ctx.currentTime;
      var buf = brownNoise(ctx, 4);

      var master = ctx.createGain();
      master.gain.value = 0;
      /* The same safety net the lesson puts on its own effects. */
      var limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -14; limiter.knee.value = 14;
      limiter.ratio.value = 9; limiter.attack.value = 0.004; limiter.release.value = 0.2;
      master.connect(limiter); limiter.connect(ctx.destination);
      audio.master = master;

      /* Body: the weight of the air. */
      var body = ctx.createBufferSource();
      body.buffer = buf; body.loop = true;
      var bodyFilter = ctx.createBiquadFilter();
      bodyFilter.type = 'lowpass'; bodyFilter.Q.value = 0.9;
      var bodyGain = ctx.createGain(); bodyGain.gain.value = 1;
      body.connect(bodyFilter); bodyFilter.connect(bodyGain); bodyGain.connect(master);

      /* Howl: the note the wind finds as it rises, drifting so it never
         settles into a tone you could name. */
      var howl = ctx.createBufferSource();
      howl.buffer = buf; howl.loop = true; howl.playbackRate.value = 1.32;
      var howlFilter = ctx.createBiquadFilter();
      howlFilter.type = 'bandpass'; howlFilter.Q.value = 4.2;
      howlFilter.frequency.value = 620;
      var howlGain = ctx.createGain(); howlGain.gain.value = 0.45;
      howl.connect(howlFilter); howlFilter.connect(howlGain); howlGain.connect(master);

      var lfo = ctx.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = 0.14;
      var lfoDepth = ctx.createGain(); lfoDepth.gain.value = 340;
      lfo.connect(lfoDepth); lfoDepth.connect(howlFilter.frequency);

      schedule(master.gain, GAIN_CURVE, elapsed, durSec, now, VOLUME_TRIM);
      schedule(bodyFilter.frequency, TONE_CURVE, elapsed, durSec, now);
      schedule(howlFilter.frequency, TONE_CURVE, elapsed, durSec, now, 0.62);

      body.start(now, Math.random() * 2);
      howl.start(now, Math.random() * 2);
      lfo.start(now);
      audio.nodes.push(body, howl, lfo);

      /* One WHOOSH, under the wind, landing with the gust on screen. */
      if (elapsed < GUST_AT) {
        var at = now + (GUST_AT - elapsed) * durSec;
        var gust = ctx.createBufferSource();
        gust.buffer = buf; gust.loop = true; gust.playbackRate.value = 0.86;
        var gustFilter = ctx.createBiquadFilter();
        gustFilter.type = 'bandpass'; gustFilter.Q.value = 1.1;
        var gustGain = ctx.createGain();
        gust.connect(gustFilter); gustFilter.connect(gustGain); gustGain.connect(master);

        gustFilter.frequency.setValueAtTime(240, at);
        gustFilter.frequency.exponentialRampToValueAtTime(1700, at + 0.42);
        gustFilter.frequency.exponentialRampToValueAtTime(380, at + 0.95);

        gustGain.gain.setValueAtTime(0.0001, at);
        gustGain.gain.linearRampToValueAtTime(0.34, at + 0.3);
        gustGain.gain.linearRampToValueAtTime(0.0001, at + 0.95);

        gust.start(at, Math.random() * 2);
        gust.stop(at + 1.05);
        audio.nodes.push(gust);
      }
    };

    if (ctx.state === 'running') { begin(); return; }

    /* No extra "enable sound" screen: try to resume, and if the browser wants
       a gesture first, the learner's next touch anywhere picks the wind up
       wherever the storm has already got to. */
    try { ctx.resume().then(begin).catch(function () {}); } catch (e) {}

    var onGesture = function () {
      if (state.finished || audio.running) return;
      try { ctx.resume().then(begin).catch(function () {}); } catch (e) {}
    };
    state.unlockListeners = onGesture;
    ['pointerdown', 'pointerup', 'touchend', 'keydown'].forEach(function (type) {
      window.addEventListener(type, onGesture, true);
    });
  }

  function stopAudio() {
    var audio = state.audio;
    state.audio = null;
    if (state.unlockListeners) {
      var fn = state.unlockListeners;
      ['pointerdown', 'pointerup', 'touchend', 'keydown'].forEach(function (type) {
        window.removeEventListener(type, fn, true);
      });
      state.unlockListeners = null;
    }
    if (!audio) return;
    var ctx = audio.ctx;
    try {
      if (audio.master) {
        var now = ctx.currentTime;
        audio.master.gain.cancelScheduledValues(now);
        audio.master.gain.setValueAtTime(audio.master.gain.value, now);
        audio.master.gain.linearRampToValueAtTime(0.0001, now + 0.25);
      }
      audio.nodes.forEach(function (node) {
        try { node.stop(ctx.currentTime + 0.3); } catch (e) {}
      });
    } catch (e) {}
    setTimeout(function () { try { ctx.close(); } catch (e) {} }, 420);
  }

  /* ------------------------------------------------------------- TEARDOWN */

  function finish() {
    if (state.finished) return;
    state.finished = true;
    state.timers.forEach(clearTimeout);
    state.timers = [];
    stopAudio();
    if (state.root && state.root.parentNode) state.root.parentNode.removeChild(state.root);
    state.root = null;
    resolveGate();
  }

  /* ----------------------------------------------------------------- PLAY */

  function play() {
    if (state.started) return gate;
    state.started = true;

    if (skipRequested() || !document.body) { finish(); return gate; }

    var root = shell();
    var durMs = readDuration(root);
    fill(root, durMs);
    state.startedAt = Date.now();

    /* The dark screen holds until the artwork is there, then one frame between
       "in the document" and "running" so the browser has the overlay painted
       before the timeline's first keyframe. The clock starts here and nowhere
       earlier: the lesson's own boot can hold the main thread for a few hundred
       milliseconds, and timers started before that would eat the end of the
       storm. */
    whenBackgroundReady(root, 2500).then(function () {
      requestAnimationFrame(function () {
        if (state.finished) return;
        root.classList.add('is-running');
        state.startedAt = Date.now();
        startAudio(durMs);

        /* The lesson is released the moment the crossfade completes, and the
           overlay leaves a frame later — nothing of the storm is still
           animating once gameplay has the screen. */
        later(function () {
          if (!state.finished) resolveGate();
        }, durMs);
        later(finish, durMs + 90);
      });
    });

    return gate;
  }

  window.IceIntro = {
    gate: gate,
    play: play,
    /* Ends the cinematic immediately and hands the lesson over. */
    skip: finish
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', play, { once: true });
  } else {
    play();
  }
})();
