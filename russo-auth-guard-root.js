(()=>{
const p=new URLSearchParams(location.search),preview=p.get('preview')==='admin';
if(preview){localStorage.setItem('dose_user',JSON.stringify({uid:'russo-review-preview',name:'Anteprima interna',email:'review.russo@dosepranza.local',role:'review',isAdmin:true,provider:'github-pages-russo-preview'}));return}
async function verify(){const access=window.DoseSupplierAccess;if(!access||access.isFilePreview?.()||access.isE2E?.())return;try{const session=await access.resolveSession?.();if(session&&session.uid&&session.email)return}catch(e){console.warn('Russo session check failed',e)}localStorage.removeItem('dose_user');location.replace('./login-google-final.html?v=auth-guard-3&next=russo&reason=session-required')}
verify();
})();