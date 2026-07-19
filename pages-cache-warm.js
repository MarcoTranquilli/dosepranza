(()=>{
const B=location.origin+'/dosepranza/';
function fix(){for(const a of document.links){const h=a.getAttribute('href')||'';if(h.includes('russo'))a.href=B+'alimentari-russo.html?v=russo-root-2';if(h.includes('pagnottella'))a.href=B+'pagnottella-preview/?preview=admin&store=pagnottella&v=russo-root-2';if(h.includes('reset'))a.href=B+'reset/?v=russo-root-2';}}
fix();setTimeout(fix,250);setTimeout(fix,1000);
})();