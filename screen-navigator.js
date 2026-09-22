/* Lesson screen navigation, available wherever the game is opened. */
(function () {
  'use strict';
  window.PolygonScreenNavigator = {
    mount(game) {
      const host = document.createElement('div');
      host.id = 'polygon-screen-navigator';
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = `<link rel="stylesheet" href="${new URL('styles/buttons.css', document.baseURI).href}"><style>
        :host{position:absolute;inset:0;z-index:10000;font:14px Nunito,sans-serif;color:#123a6b;pointer-events:none}
        #toggle,#step-navigation,#panel{pointer-events:auto}
        *{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer}
        button:focus-visible,input:focus-visible{outline:3px solid #31b9de;outline-offset:3px}
        #toggle{position:absolute;top:12px;left:12px;border:2px solid #fff4cb;border-radius:999px;padding:10px 16px;color:#67400e;background:linear-gradient(180deg,#ffe99d 0%,#ffc252 100%);box-shadow:inset 0 2px 0 #fff8d9,0 3px 0 #b77622,0 5px 10px #123a6b26;font-weight:750;min-height:44px;transition:filter .15s,transform .15s}
        #toggle:hover{filter:brightness(1.04)}#toggle:active{transform:translateY(2px)}
        #step-navigation{position:absolute;top:12px;right:12px;display:flex;gap:10px}
        #step-navigation button{min-width:80px;min-height:44px;padding:8px 12px;font-size:16px}
        #panel{position:absolute;top:76px;left:12px;width:330px;padding:14px;background:#f4fbff;border:2px solid #83d6f5;border-radius:18px;box-shadow:0 8px 28px #123a6b33}
        [hidden]{display:none!important}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
        #close{font-size:16px;min-width:72px;height:44px;padding:0 10px;flex-shrink:0}
        input{width:100%;padding:10px;border:2px solid #a3d7ed;border-radius:10px;background:white;color:#123a6b;caret-color:#123a6b;user-select:text}
        #list{display:grid;gap:6px;max-height:440px;overflow:auto;margin-top:10px;overscroll-behavior:contain}
        #list button{text-align:center;padding:10px;min-height:44px;white-space:normal}
        #list{padding:5px 5px 9px}
        small{display:block;opacity:1;margin-top:4px;font-weight:650;line-height:1.35}#empty{padding:12px;text-align:center}
      </style>
      <button class="ice-button" id="toggle" aria-expanded="false" aria-controls="panel">Screens</button>
      <nav id="step-navigation" aria-label="Screen navigation">
        <button class="ice-button" id="back" type="button" disabled>Back</button>
        <button class="ice-button" id="next" type="button" disabled>Next</button>
      </nav>
      <section id="panel" aria-label="Lesson screen navigator" hidden>
        <header><strong>Jump to a screen</strong><button class="ice-button" id="close" aria-label="Close screen navigator">Close</button></header>
        <input id="search" type="search" placeholder="Search name or step number" aria-label="Search screens">
        <nav id="list" aria-label="Lesson screens"></nav><div id="empty" hidden>No matching screens</div>
      </section>`;
      const $ = id => root.getElementById(id);
      const toggle = $('toggle'), panel = $('panel'), search = $('search'), list = $('list');
      let disposed = false;
      function navigate(index) {
        if (disposed || !game.state.ready || index < 0 || index >= game.steps().length) return;
        const step = game.steps()[index];
        game.unlockAudio();
        // runStep cancels narration, timers, drawing and active drags.
        // Clear answers that normally persist between adjacent lesson phases.
        game.setState({ k: index, placed: {}, sortAt: {}, dd: [null, null, null, null],
          ddWrong: [false, false, false, false], userPts: null, dragged: false,
          drawn: step.sc === 'S1' && !['point', 'draw'].includes(step.ph), numsB: 0 }, () => {
          if (!disposed) { game.runStep(index, false); sync(); }
        });
      }
      function close() { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
      function render() {
        if (!game.state.ready) return;
        const query = search.value.trim().toLowerCase();
        list.replaceChildren();
        game.steps().forEach((step, index) => {
          if (query && !`${index + 1} ${step.label} ${step.narr}`.toLowerCase().includes(query)) return;
          const button = document.createElement('button');
          button.className = 'ice-button';
          button.textContent = `${index + 1}. ${step.label}`;
          button.setAttribute('aria-current', String(index === game.state.k));
          const description = document.createElement('small');
          description.textContent = step.narr;
          button.append(description);
          button.onclick = () => {
            navigate(index);
            close();
          };
          list.append(button);
        });
        $('empty').hidden = list.childElementCount > 0;
      }
      let last = -1;
      function sync() {
        $('back').disabled = !game.state.ready || game.state.k === 0;
        $('next').disabled = !game.state.ready || game.state.k >= game.steps().length - 1;
        if (game.state.k === last) return;
        last = game.state.k;
        toggle.textContent = `Screens · ${last + 1}`;
        if (!panel.hidden) render();
      }
      toggle.onclick = () => {
        if (!panel.hidden) { close(); return; }
        panel.hidden = false; toggle.setAttribute('aria-expanded', 'true'); render(); search.focus();
      };
      $('close').onclick = close;
      $('back').onclick = () => navigate(game.state.k - 1);
      $('next').onclick = () => navigate(game.state.k + 1);
      search.oninput = render;
      root.addEventListener('keydown', event => { if (event.key === 'Escape') close(); event.stopPropagation(); });
      game.navigationRef.current.append(host);
      sync();
      const timer = setInterval(sync, 300);
      return () => { disposed = true; clearInterval(timer); host.remove(); };
    }
  };
})();
