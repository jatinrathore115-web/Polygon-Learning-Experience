/* Polygon lesson content: figure geometry traced from the source PDF + screen script. */
(function () {
  function reg(n, cx, cy, r, rotDeg) {
    var pts = [], rot = (rotDeg || 0) * Math.PI / 180;
    for (var i = 0; i < n; i++) {
      var a = rot - Math.PI / 2 + i * 2 * Math.PI / n;
      pts.push([+(cx + r * Math.cos(a)).toFixed(1), +(cy + r * Math.sin(a)).toFixed(1)]);
    }
    return pts;
  }
  function vbOf(pts, pad) {
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs) - pad, y0 = Math.min.apply(null, ys) - pad;
    return [x0, y0, Math.max.apply(null, xs) + pad - x0, Math.max.apply(null, ys) + pad - y0].join(' ');
  }
  function poly(pts, pad) { return { pts: pts, closed: true, vb: vbOf(pts, pad === undefined ? 14 : pad) }; }

  /* ---- figures traced from the PDF ---- */
  var FIG = {
    /* p2 — pointed leaf/star figure with a narrow stem (closed, straight) */
    leaf: poly([[500, 0], [633, 389], [988, 376], [880, 516], [748, 653], [890, 790], [532, 766],
      [532, 955], [468, 955], [468, 766], [110, 790], [252, 653], [120, 516], [12, 376], [367, 389]], 24),

    /* p6 — rounded pot/vase, curved, OPEN across the top lip */
    pot: {
      curved: true, closed: false, vb: '-10 210 1020 780',
      d: 'M110 232 C120 280 130 315 132 348 C70 400 28 490 28 600 C28 780 210 958 460 958' +
         ' C710 958 952 780 952 600 C952 490 908 400 838 348 C840 315 830 280 838 230',
      extra: 'M110 232 L177 241 M808 243 L838 230',
      // One continuous trace includes both lip segments without crossing the opening.
      traceD: 'M177 241 L110 232 C120 280 130 315 132 348 C70 400 28 490 28 600 C28 780 210 958 460 958 C710 958 952 780 952 600 C952 490 908 400 838 348 C840 315 830 280 838 230 L808 243',
      gap: { x: 492, y: 246, w: 320, h: 120 }
    },

    /* p7 — small straight-edged star figure. Open in the source art; p7 adds the closing lip. */
    starOpen: {
      straightOpen: true, closed: false, vb: '60 140 800 700',
      pts: [[350, 190], [95, 165], [255, 385], [85, 585], [300, 568], [455, 800], [520, 568],
        [835, 590], [695, 390], [830, 160], [570, 185]],
      gap: { x: 460, y: 187, w: 250, h: 110 }
    },
    starClosed: {
      closed: true, vb: '60 140 800 700',
      pts: [[350, 190], [95, 165], [255, 385], [85, 585], [300, 568], [455, 800], [520, 568],
        [835, 590], [695, 390], [830, 160], [570, 185]]
    },

    /* p8 — irregular angular open figure */
    zig: {
      straightOpen: true, closed: false, vb: '55 45 710 920',
      pts: [[310, 255], [75, 470], [245, 940], [735, 625], [270, 598], [600, 258], [430, 65], [100, 205]],
      gap: { x: 205, y: 230, w: 260, h: 110 }
    },

    /* p9 — crescent (closed, curved) */
    crescent: {
      curved: true, closed: true, vb: '266 145 150 152',
      d: 'M406.9 159.7 C337.2 153 277.9 176.7 274.4 212.6 C271 248.6 324.7 283.1 394.4 289.8' +
         ' C351.8 271.7 327.3 244.5 329.9 218 C332.4 191.4 361.6 169.3 406.9 159.7 Z'
    },

    /* p17 / p25 / p37 — the lesson pentagon */
    pentagon: poly([[410.3, 116.4], [556.9, 116.4], [602.2, 237.5], [483.6, 312.4], [365, 237.5]]),
    /* p23 — cross-like polygon used for "Label the parts" */
    cross: poly([[162.1, 47.6], [301.2, 47.6], [301.2, 96.6], [350.3, 96.6], [350.3, 194.6],
      [301.2, 194.6], [301.2, 243.7], [162.1, 243.7], [162.1, 194.6], [113, 194.6], [113, 96.6], [162.1, 96.6]]),
    /* p34 / p35 */
    triangle: poly([[268.4, 141.6], [451.6, 141.6], [360, 300]]),
    quad: poly([[241.6, 131], [409.9, 131], [469.3, 253.8], [301, 253.8]]),

    hexagon: poly(reg(6, 500, 500, 300, 30)),
    heptagon: poly(reg(7, 500, 500, 300, 0)),
    octagon: poly(reg(8, 500, 500, 300, 22.5)),

    /* p19 — "which of these figures are polygons" set */
    p19a: { straightOpen: true, closed: false, vb: '-20 -20 1040 1040',
      pts: [[60, 300], [180, 40], [960, 180], [880, 900], [220, 960]] },
    p19b: { curved: true, closed: true, vb: '-20 -20 1040 1040',
      d: 'M500 40 C760 40 960 240 960 500 C960 760 760 960 500 960 C240 960 40 760 40 500 C40 240 240 40 500 40 Z' },
    p19c: poly(reg(5, 500, 520, 440, 0), 30),
    p19d: { curved: true, closed: true, vb: '-20 -20 1040 1040',
      d: 'M480 90 C660 40 900 150 930 380 C960 610 830 900 570 940 C320 980 60 830 60 590' +
         ' C60 400 200 330 300 300 C390 273 380 118 480 90 Z' },
    p19e: poly([[500, 60], [940, 900], [60, 900]], 30),

    /* p36 — "select all the quadrilaterals" */
    q36a: poly([[300, 60], [960, 340], [370, 440], [40, 800]], 30),
    q36b: { curved: true, closed: true, vb: '-20 -20 1040 1040',
      d: 'M120 250 C300 480 480 460 620 250 C700 130 860 170 960 250 L330 940 Z' },
    q36c: poly([[300, 90], [960, 40], [930, 900], [60, 860]], 30),
    q36d: poly([[500, 40], [820, 430], [500, 960], [180, 430]], 30),

    /* CFU 1 */
    c1a: poly(reg(3, 500, 560, 460, 0), 30),
    c1b: { straightOpen: true, closed: false, vb: '-20 -20 1040 1040',
      pts: [[120, 940], [120, 80], [880, 940], [880, 100]] },
    c1c: poly(reg(5, 500, 520, 440, 0), 30),
    c1d: { curved: true, closed: true, vb: '-20 -20 1040 1040',
      d: 'M240 80 L520 80 C820 80 960 300 960 510 C960 720 820 940 520 940 L240 940 Z' },
    c1e: poly([[120, 90], [880, 90], [120, 930], [880, 930]], 30),

    /* CFU 2 */
    c2a: poly([[190, 800], [330, 150], [800, 210], [880, 800]], 30),
    c2b: { curved: true, closed: true, vb: '-20 -20 1040 1040',
      d: 'M500 70 C740 70 930 260 930 500 C930 740 740 930 500 930 C260 930 70 740 70 500 C70 260 260 70 500 70 Z' },
    c2c: poly([[110, 130], [950, 500], [110, 870], [420, 500]], 30),
    c2d: poly(reg(5, 500, 520, 430, 0), 30),
    c2e: { straightOpen: true, closed: false, vb: '-20 -20 1040 1040',
      pts: [[140, 120], [180, 720], [900, 780]] },

    /* CFU 3 */
    c3a: poly(reg(6, 500, 500, 430, 30), 30),
    c3b: poly([[80, 240], [920, 240], [920, 760], [80, 760]], 30),
    c3c: poly([[120, 110], [800, 110], [480, 500], [800, 890], [120, 890]], 30),
    c3d: { curved: true, closed: true, vb: '-20 -20 1040 1040',
      d: 'M500 60 C744 60 940 256 940 500 C940 744 744 940 500 940 C256 940 60 744 60 500 C60 256 256 60 500 60 Z' },

    /* CFU 4 — pentagons (A B C E) and higher-sided distractors (D F) */
    c4a: poly(reg(5, 500, 520, 420, 0), 30),
    c4b: poly([[300, 60], [880, 300], [520, 470], [860, 900], [140, 780]], 30),
    c4c: poly(reg(5, 500, 520, 450, 0), 30),
    c4d: poly(reg(7, 500, 500, 430, 12), 30),
    c4e: poly([[500, 60], [900, 380], [830, 940], [500, 700], [170, 940]], 30),
    c4f: poly(reg(9, 500, 500, 430, 0), 30),

    /* CFU 5 — hexagons and heptagons */
    c5a: poly(reg(6, 500, 500, 430, 30), 30),
    c5b: poly(reg(7, 500, 500, 430, 0), 30),
    c5c: poly([[200, 250], [700, 180], [950, 460], [780, 780], [280, 830], [90, 520]], 30),
    c5d: poly([[500, 70], [850, 260], [930, 640], [640, 930], [300, 900], [80, 620], [140, 250]], 30)
  };

  var C = {
    ink: '#123a6b', blue: '#2f6fd0', purple: '#7c4dcf', green: '#2f9e5e',
    orange: '#ef7d2b', pink: '#e5468a', teal: '#1a9aa8', gold: '#e9a733'
  };

  window.POLY = { FIG: FIG, C: C, reg: reg, poly: poly };
})();
