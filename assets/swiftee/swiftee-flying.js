/* The flight cycle, registered beside the generated atlas rather than inside
   it: swiftee-sheets.js is written by build-swiftee.cjs and says so at the
   top, so anything added by hand belongs here or it is lost the next time the
   atlas is rebuilt.

   Eight frames on the same 256px square grid as every other clip, cut from the
   supplied sheet left to right, top row first. Wings beat through the row, so
   the cycle loops seamlessly from frame 8 back to frame 1 -- no ping-pong,
   which would beat the wings backwards on the return leg.

   exitsCell is false: the bird stays inside its cell and the scene moves the
   cell, which is what lets her fly a path without the sprite drifting out of
   frame. */
(function () {
  'use strict';
  if (!window.SWIFTEE || !window.SWIFTEE.clips) return;
  window.SWIFTEE.clips.flying = {
    image: 'assets/swiftee/swiftee_flying@1x.webp',
    frames: 8,
    cols: 4,
    rows: 2,
    pingpong: false,
    exitsCell: false
  };
})();
