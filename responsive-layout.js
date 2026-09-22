/* One resolution-independent design canvas. All lesson coordinates, including
   scenery and navigation, belong to this canvas and share one uniform scale. */
(function () {
  'use strict';
  const width=1980,height=width*9/16;
  const canvas=Object.freeze({width,height});
  function frame(viewportWidth,viewportHeight) {
    const w=Math.max(1,viewportWidth),h=Math.max(1,viewportHeight);
    const scale=Math.min(w/width,h/height);
    return {width:w,height:h,scale,stageHeight:height,
      left:(w-width*scale)/2,top:(h-height*scale)/2};
  }
  window.PolygonResponsive={canvas,frame};
})();
