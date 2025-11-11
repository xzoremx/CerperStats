(function(){
const el=document.getElementById('spinner');
if(!el) return;
let fast=false;
setInterval(()=>{ fast=!fast; el.style.animationDuration = fast?'1.2s':'2s'; },2000);
})();