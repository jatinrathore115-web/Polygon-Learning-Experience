/* Pinned runtime dependencies are served with the game, without a CDN round trip. */
window.__resources = Object.assign({}, window.__resources, {
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'assets/runtime/react-18.3.1.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': 'assets/runtime/react-dom-18.3.1.min.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js': 'assets/runtime/babel-7.29.0.min.js'
});
