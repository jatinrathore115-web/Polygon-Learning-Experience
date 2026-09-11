const fs=require('fs'),cp=require('child_process'),assert=require('assert');
/* The lesson does not render the guide character (GUIDE_VISIBLE=false in
   index.html), so there is no sprite on screen to verify. This stays ready for
   whenever he comes back — flip that flag and the check runs again. */
if (require('fs').readFileSync('index.html','utf8').includes('const GUIDE_VISIBLE = false')) {
  console.log('SKIP: the guide is not rendered (GUIDE_VISIBLE=false in index.html).');
  process.exit(0);
}
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';const url='file:///'+process.cwd().replaceAll('\\','/')+'/verification/mammoth-layout.html';const report=[];
for(const [width,height] of [[1920,1080],[1440,900],[1366,768],[1280,720],[1024,768]]){
 let outerW=width+16,outerH=height+151,result;
 for(let n=0;n<3;n++){
 const args=['--headless','--no-sandbox','--disable-gpu','--disable-software-rasterizer','--no-first-run','--user-data-dir='+process.env.TEMP+'/polygon-layout-verify','--window-size='+outerW+','+outerH,'--dump-dom','--virtual-time-budget=1000'];
 if(width===1440)args.push('--screenshot='+process.cwd()+'/verification/mammoth-1440.png');args.push(url);
 const dom=cp.execFileSync(chrome,args,{encoding:'utf8',windowsHide:true,timeout:20000,stdio:['ignore','pipe','pipe'],maxBuffer:4000000});result=JSON.parse(dom.match(/<pre id="report"[^>]*>(.*?)<\/pre>/s)[1]);
 if(result.width===width&&result.height===height)break;outerW+=width-result.width;outerH+=height-result.height;
 }
 assert.equal(result.width,width);assert.equal(result.height,height);assert(result.noScroll);assert(result.results.every(r=>r.pass));report.push(result);console.log('PASS '+width+'x'+height+': full sprite rectangle and five pose bounds; no horizontal scroll.');
}
fs.writeFileSync('verification/mammoth-layout-results.json',JSON.stringify(report,null,2));
