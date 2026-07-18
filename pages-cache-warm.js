(()=>{
const B=location.origin+'/dosepranza/';
function fix(){for(const a of document.links){const h=a.getAttribute('href')||'';if(h.includes('russo'))a.href=B+'russo/index.html?v=google-final-5&swreset=1';if(h.includes('pagnottella'))a.href=B+'pagnottella-preview/?preview=admin&store=pagnottella&v=google-final-5';if(h.includes('reset'))a.href=B+'reset/?v=google-final-5';}}
fix();setTimeout(fix,250);setTimeout(fix,1000);
})();