/* анимации сайта: индикатор прокрутки, прячущаяся шапка, появление блоков при прокрутке */
(()=>{
  const hd=document.querySelector('header'),sp=document.createElement('div');sp.id='sp';document.body.prepend(sp);
  let ly=0,tick=false;
  addEventListener('scroll',()=>{if(tick)return;tick=true;requestAnimationFrame(()=>{tick=false;const y=scrollY,h=document.documentElement.scrollHeight-innerHeight;
    sp.style.transform=`scaleX(${h>0?Math.min(1,y/h):0})`;hd.classList.toggle('stuck',y>8);hd.classList.toggle('hide',y>ly+4&&y>160);if(y<ly-4)hd.classList.remove('hide');ly=y})},{passive:true});
  if(!('IntersectionObserver' in window))return;
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;const t=e.target;t.classList.add('vis');io.unobserve(t);setTimeout(()=>{t.style.transitionDelay=''},1300)}),{threshold:.06,rootMargin:'0px 0px -30px 0px'});
  const SEL='.qc,.sec,.panel,.kpi,.stat,.team,.dq,.fb';
  function scan(){document.querySelectorAll(SEL).forEach(e=>{if(e.dataset.rv)return;e.dataset.rv='1';e.classList.add('rv');
    const i=[...e.parentElement.children].indexOf(e);e.style.transitionDelay=Math.min(i,8)*70+'ms';io.observe(e)})}
  new MutationObserver(scan).observe(document.getElementById('app'),{childList:true,subtree:true});scan();
})();
