(()=>{
const V='google-final-3',B=location.origin+'/dosepranza/';
function fix(){
  for(const a of document.links){
    const h=a.getAttribute('href')||'';
    if(h.includes('russo/index.html'))a.href=B+'russo/index.html?v='+V;
    if(h.includes('reset/'))a.href=B+'reset/?v='+V;
  }
}
fix();setTimeout(fix,250);setTimeout(fix,1000);
})();