/* Optional lesson preview navigation. Remove its script tag to disable it. */
(function () {
  'use strict';
  window.PolygonScreenNavigator = {
    mount(game) {
      const local = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
      if (!local && new URLSearchParams(location.search).get('preview') !== '1') return () => {};
      const host = document.createElement('div');
      host.id = 'polygon-screen-navigator';
      const root = host.attachShadow({ mode: 'open' });
      const button = game.buttonSkin('primary', 16);
      root.innerHTML = `<style>
        :host{position:fixed;top:12px;left:12px;z-index:10000;font:14px system-ui,sans-serif;color:#123a6b}
        *{box-sizing:border-box}button,input{font:inherit}button{cursor:pointer}
        button:focus-visible,input:focus-visible{outline:3px solid #124e57;outline-offset:3px}
        #toggle{border:${button.border};border-radius:${button.borderRadius};padding:10px 16px;color:${button.color};background:${button.background};box-shadow:${button.boxShadow};font-weight:750;min-height:44px}
        #panel{margin-top:10px;width:min(330px,calc(100vw - 24px));padding:14px;background:#f4fbff;border:2px solid #83d6f5;border-radius:18px;box-shadow:0 8px 28px #123a6b33}
        [hidden]{display:none!important}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
        #close{border:0;background:transparent;color:#123a6b;font-size:24px;width:36px;height:36px}
        input{width:100%;padding:10px;border:2px solid #a3d7ed;border-radius:10px;background:white;color:#123a6b;caret-color:#123a6b;user-select:text}
        #list{display:grid;gap:6px;max-height:min(55vh,440px);overflow:auto;margin-top:10px;overscroll-behavior:contain}
        #list button{border:1px solid #c2e3f1;border-radius:10px;background:white;text-align:left;padding:10px;color:#123a6b;min-height:44px}
        #list button:hover{background:#e7f8ef}#list button[aria-current=true]{background:#ffda67;color:#164e53;border-color:#168d92}
        small{display:block;opacity:.8;margin-top:3px}#empty{padding:12px;text-align:center}
      </style>
      <button id="toggle" aria-expanded="false" aria-controls="panel">Screens</button>
      <section id="panel" aria-label="Lesson screen navigator" hidden>
        <header><strong>Jump to a screen</strong><button id="close" aria-label="Close screen navigator">×</button></header>
        <input id="search" type="search" placeholder="Search name or step number" aria-label="Search screens">
        <nav id="list" aria-label="Lesson screens"></nav><div id="empty" hidden>No matching screens</div>
      </section>`;
      const $ = id => root.getElementById(id);
      const toggle = $('toggle'), panel = $('panel'), search = $('search'), list = $('list');
      let disposed = false;
      function close() { panel.hidden = true; toggle.setAttribute('aria-expanded', 'false'); toggle.focus(); }
      function render() {
        if (!game.state.ready) return;
        const query = search.value.trim().toLowerCase();
        list.replaceChildren();
        game.steps().forEach((step, index) => {
          if (query && !`${index + 1} ${step.label} ${step.narr}`.toLowerCase().includes(query)) return;
          const button = document.createElement('button');
          button.textContent = `${index + 1}. ${step.label}`;
          button.setAttribute('aria-current', String(index === game.state.k));
          const description = document.createElement('small');
          description.textContent = step.narr;
          button.append(description);
          button.onclick = () => {
            if (disposed || !game.state.ready) return;
            game.unlockAudio();
            // runStep cancels narration, timers, drawing and active drags.
            // Clear answers that normally persist between adjacent lesson phases.
            game.setState({ k: index, placed: {}, sortAt: {}, dd: [null, null, null, null],
              ddWrong: [false, false, false, false], userPts: null, dragged: false,
              drawn: step.sc === 'S1' && !['point', 'draw'].includes(step.ph), numsB: 0 }, () => {
              if (!disposed) { game.runStep(index, false); sync(); }
            });
            close();
          };
          list.append(button);
        });
        $('empty').hidden = list.childElementCount > 0;
      }
      let last = -1;
      function sync() {
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
      search.oninput = render;
      root.addEventListener('keydown', event => { if (event.key === 'Escape') close(); event.stopPropagation(); });
      document.body.append(host);
      sync();
      const timer = setInterval(sync, 300);
      return () => { disposed = true; clearInterval(timer); host.remove(); };
    }
  };
})();
