(()=>{
const B=location.origin+'/dosepranza/';
function fix(){for(const a of document.links){const h=a.getAttribute('href')||'';if(h.includes('russo'))a.href=B+'alimentari-russo.html?v=pages-auth-fix-5';if(h.includes('pagnottella'))a.href=B+'pagnottella-preview/?preview=admin&store=pagnottella&v=pages-auth-fix-5';if(h.includes('reset'))a.href=B+'reset/?v=pages-auth-fix-5';}}
function load(){try{if(location.hostname!=='marcotranquilli.github.io')return;const s=document.createElement('script');s.src='./sw-killer.js?v=pages-auth-fix-5';s.type='module';document