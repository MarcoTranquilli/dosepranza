(()=>{
const V='google-final-4',B=location.origin+'/dosepranza/';
function fix(){for(const a of document.links){const h=a.getAttribute('href')||'';if(h.includes('russo'))a.href=B+'russo.html?v='+V;if(h.includes('pagnottella'))a.href=B+'pagnottella-preview/?preview=admin&store=pagnottella&v='+V;if(h.includes('reset'))a.href=B+'reset/?v='+V;}}
fix();setTimeout(fix,250);setTimeout(fix,1000);
})();