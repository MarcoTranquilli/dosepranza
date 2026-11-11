(function(root){
  'use strict';
  const normalizeEmail=value=>String(value||'').trim().toLowerCase();
  const embedded=agent=>/WhatsApp|Telegram|Line|MicroMessenger|musical_ly|FBAN|FBAV|Instagram|Slack|Teams|;\s*wv\)|\bwv\b|GSA\//i.test(agent||'');
  function guidance(agent){
    const app=/WhatsApp/i.test(agent||'')?'WhatsApp':'un browser interno a un’app';
    return `Stai aprendo la pagina dentro ${app}. Google può bloccare l'accesso nei browser interni: tocca i 3 puntini (o l'icona Condividi) e seleziona "Apri in Chrome" o "Apri in Safari".`;
  }
  function errorMessage(error){
    switch(error?.code){
      case 'auth/redirect-session-missing':return 'Google non ha restituito una sessione valida. Apri il link in Safari o Chrome e consenti i dati del sito. Nessun altro redirect automatico sarà avviato; usa Disconnetti e usa un altro account per riprovare.';
      case 'auth/redirect-storage-unavailable':return 'Lo storage della sessione è bloccato: impossibile recuperare in sicurezza il redirect. Consenti cookie e dati del sito oppure usa un altro browser.';
      case 'auth/popup-closed-by-user':case 'auth/cancelled-popup-request':return 'Accesso annullato. Premi Accedi con Google per riprovare.';
      case 'auth/popup-blocked':return 'Il browser ha bloccato il popup Google. Consenti i popup per questo sito e riprova, oppure apri questa pagina direttamente in Safari o Chrome, fuori da WhatsApp.';
      case 'auth/operation-not-supported-in-this-environment':case 'auth/web-storage-unsupported':case 'auth/disallowed-useragent':return 'Questo browser non consente l’accesso Google o lo storage necessario. Apri il link in Safari o Chrome e consenti cookie e dati del sito.';
      case 'auth/unauthorized-domain':return 'Dominio non autorizzato per Google Login. Apri il link ufficiale della dashboard o contatta l’amministratore.';
      case 'auth/network-request-failed':return 'Connessione non disponibile. Controlla la rete e riprova.';
      default:return 'Accesso Google non completato. Riprova da Safari o Chrome; se il problema continua contatta l’amministratore.';
    }
  }
  function createFlow({auth,sdk,status=()=>{},onIssue=()=>{},storage=root.sessionStorage,agent=root.navigator?.userAgent||'',path=root.location?.pathname||'supplier'}) {
    const key='dose_supplier_redirect:'+path;
    let busy=false,recovering=null;
    function pending(){try{const at=Number(storage?.getItem(key));return Number.isFinite(at)&&at>0&&Date.now()-at<600000;}catch{return false;}}
    function reset(){try{storage?.removeItem(key);}catch{}}
    function failure(code){const error=new Error(code);error.code=code;return error;}
    async function bounded(promise,code){
      if(typeof root.setTimeout!=='function')return promise;
      let timer;
      try{return await Promise.race([promise,new Promise((_,reject)=>{timer=root.setTimeout(()=>reject(failure(code)),15000);})]);}
      finally{root.clearTimeout(timer);}
    }
    async function recover(){
      if(recovering)return recovering;
      recovering=(async()=>{
        const wasPending=pending();
        try{
          const result=await bounded(sdk.getRedirectResult(auth),'auth/redirect-session-missing');
          const user=result?.user||(!auth.currentUser?.isAnonymous?auth.currentUser:null);
          if(user){reset();return {user};}
          if(wasPending)throw failure('auth/redirect-session-missing');
          return {user:null};
        }catch(error){status(errorMessage(error));onIssue();return {user:null,issue:true};}
      })();
      return recovering;
    }
    async function login(){
      if(busy)return null;
      if(embedded(agent)){status(guidance(agent));return null;}
      busy=true;
      try{
        const provider=new sdk.GoogleAuthProvider();provider.setCustomParameters?.({prompt:'select_account'});
        status('Apertura della selezione account Google...');
        try{const result=await sdk.signInWithPopup(auth,provider);reset();return result;}
        catch(error){
          if(!['auth/popup-blocked','auth/cancelled-popup-request'].includes(error?.code))throw error;
          if(pending())throw failure('auth/redirect-session-missing');
          try{if(!storage)throw Error();storage.setItem(key,String(Date.now()));if(!storage.getItem(key))throw Error();}
          catch{throw failure('auth/redirect-storage-unavailable');}
          status('Popup non disponibile. Apertura di Google nella stessa scheda...');
          await bounded(sdk.signInWithRedirect(auth,provider),'auth/redirect-session-missing');
          return null;
        }
      }catch(error){status(errorMessage(error));onIssue();return null;}
      finally{busy=false;}
    }
    return {recover,login,reset};
  }
  root.DoseSupplierLogin={normalizeEmail,embedded,guidance,errorMessage,createFlow};
  if(typeof document==='undefined')return;
  const agent=root.navigator?.userAgent||'',banner=document.getElementById('supplier-browser-warning');
  if(banner){banner.hidden=!embedded(agent);banner.textContent=guidance(agent);}
  // Runs before Firebase module loading, so the login surface is never a blank page.
  const view=document.getElementById('login-view'),status=document.getElementById('access-status');
  if(view)view.style.display='block';
  if(status)status.textContent='Preparazione accesso Google...';
  root.addEventListener('error',event=>{
    if(event.target?.tagName==='SCRIPT' && event.target.type==='module' && status)status.textContent='Impossibile caricare Google Login. Controlla la connessione e ricarica la pagina in Safari o Chrome.';
  },true);
})(typeof window==='undefined'?globalThis:window);
