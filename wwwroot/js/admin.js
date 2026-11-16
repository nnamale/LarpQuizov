/* ===== админ: кто играет + скример ===== */
async function viewAdmin(){
  if(needLogin())return;
  app(`<div class="panel"><h2>Игроки онлайн</h2><p class="mut">Обновляется каждые 3 секунды. Скример увидит игрок, у которого сейчас открыт квиз.</p><div id="pl">${LOAD}</div></div>
  <div class="panel" style="margin-top:20px"><h2>Контент сайта</h2><p class="mut">Админ может удалить любой квиз или игру.</p><div id="ct">${LOAD}</div></div>
  <div class="panel" style="margin-top:20px"><h2>Жалобы</h2><div id="rp">${LOAD}</div></div>
  <div class="panel" style="margin-top:20px"><h2>Пользователи</h2><div id="us">${LOAD}</div></div>
  <div class="panel" style="margin-top:20px"><h2>Журнал действий</h2><div id="lg">${LOAD}</div></div>`);
  adminMod();
  const draw=async()=>{
    let l;try{l=await api('/admin/players')}catch(e){clearInterval(timer);return fail(e)}
    const e=$('#pl');if(!e)return;
    e.innerHTML=`<p>Сейчас играют: <b>${l.length}</b></p><div class="row"><button class="btn danger" data-act="sendScare" data-args="${A('all')}">Скример всем</button></div>
    <ul class="lb">${l.map(x=>`<li><span>${esc(x.name)} <span class="mut">· ${esc(x.quiz)} · ${x.done}/${x.total} · ${x.points} очков</span></span><button class="btn danger sm" style="margin-left:auto" data-act="sendScare" data-args="${A(x.sid)}">Скример</button></li>`).join('')||'<li class="mut">Сейчас никто не играет</li>'}</ul>`;
  };
  draw();timer=setInterval(draw,3000);
  try{
    const [q,b]=await Promise.all([api('/quizzes'),api('/boards')]);
    const L=(a,k)=>a.map(x=>`<li><a href="#/${k=='quizzes'?'quiz':'board'}/${x.id}">${esc(x.title)}</a><button class="btn danger sm" style="margin-left:auto" data-act="adminDel" data-args="${A(k,x.id)}">Удалить</button></li>`).join('');
    $('#ct').innerHTML=`<h3>Квизы (${q.length})</h3><ul class="lb">${L(q,'quizzes')}</ul><h3 style="margin-top:20px">Игры (${b.length})</h3><ul class="lb">${L(b,'boards')}</ul>`;
  }catch(e){$('#ct').textContent=e.message}
}
async function adminDel(k,id){
  if(!confirm('Удалить безвозвратно?'))return;
  try{await api(`/${k}/${id}`,{method:'DELETE'});toast('Удалено');viewAdmin()}catch(e){toast(e.message)}
}
async function sendScare(sid){try{const r=await api('/admin/scream',{method:'POST',body:JSON.stringify({sid})});toast('Отправлено: '+r.sent)}catch(e){toast(e.message)}}
function scream(){
  if(document.getElementById('scr'))return;
  const d=document.createElement('div');d.id='scr';const im=document.createElement('img');im.className='scf';im.alt='';im.onerror=()=>{im.onerror=null;im.src='/scream.svg'};im.src='/scream.jpg';d.appendChild(im);d.onclick=()=>d.remove();document.body.appendChild(d);
  try{AC=AC||new AudioContext();const t=AC.currentTime,n=AC.sampleRate*1.2,b=AC.createBuffer(1,n,AC.sampleRate),a=b.getChannelData(0);for(let i=0;i<n;i++)a[i]=(Math.random()*2-1)*(1-i/n);
    const s=AC.createBufferSource(),g=AC.createGain(),o=AC.createOscillator();s.buffer=b;g.gain.setValueAtTime(.5,t);g.gain.exponentialRampToValueAtTime(.001,t+1.2);o.type='sawtooth';o.frequency.setValueAtTime(900,t);o.frequency.exponentialRampToValueAtTime(120,t+1);
    s.connect(g);o.connect(g);g.connect(AC.destination);s.start();o.start();o.stop(t+1.2)}catch{}
  setTimeout(()=>d.remove(),2500);
}
/* ===== аккаунты ===== */

async function adminMod(){
  try{
    const r=await api('/admin/reports');
    $('#rp').innerHTML=r.length?r.map(x=>`<div class="rep"><span><a href="#/quiz/${x.quizId}">${esc(x.quiz)}</a> · ${esc(x.user)}: ${esc(x.reason)} <span class="mut">(${dt(x.at)})</span></span><button class="btn alt sm" data-act="repClose" data-args="${A(x.id)}">Закрыть</button></div>`).join(''):'<p class="mut">Открытых жалоб нет</p>';
    const u=await api('/admin/users');
    const st=x=>x.banned?`заблокирован ${x.banUntil?'до '+new Date(x.banUntil).toLocaleString('ru-RU'):'навсегда'}${x.banReason?` <span class="mut">(${esc(x.banReason)})</span>`:''}`:'активен';
    $('#us').innerHTML=`<table class="tbl"><thead><tr><th>Имя</th><th>Роль</th><th>Статус</th><th></th></tr></thead><tbody>${u.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.role)}</td><td>${st(x)}</td><td>${x.role=='admin'?'':`${x.banned?`<button class="btn alt sm" data-act="unbanUser" data-args="${A(x.name)}">Разблокировать</button>`:`<button class="btn alt sm" data-act="banUser" data-args="${A(x.name)}">Заблокировать</button>`} <button class="btn alt sm" data-act="makeAdmin" data-args="${A(x.name)}">Сделать админом</button>`}</td></tr>`).join('')}</tbody></table>`;
    const [m,l]=await Promise.all([api('/admin/modlog'),api('/admin/log')]);
    const mt=m.length?`<table class="tbl"><thead><tr><th>Когда</th><th>Админ</th><th>Действие</th><th>Объект</th><th>Детали</th></tr></thead><tbody>${m.map(x=>`<tr><td class="mut">${esc(new Date(x.at).toLocaleString('ru-RU'))}</td><td>${esc(x.admin)}</td><td>${esc(x.action)}</td><td>${esc(x.target)}</td><td>${esc(x.details)}</td></tr>`).join('')}</tbody></table>`:'<p class="mut">Действий модераторов пока нет</p>';
    $('#lg').innerHTML=`${mt}<details style="margin-top:14px"><summary>Технический журнал сервера</summary><pre style="white-space:pre-wrap;font:13px var(--mono);max-height:260px;overflow:auto">${esc(l.lines.join('\n'))||'Пусто'}</pre></details>`;
  }catch(e){}
}
async function repClose(id){try{await api(`/admin/reports/${id}/close`,{method:'POST'});adminMod()}catch(e){toast(e.message)}}
async function userAct(p,b){try{await api(p,{method:'POST',body:JSON.stringify(b)});toast('Готово');adminMod()}catch(e){toast(e.message)}}
async function banUser(name){
  const h=prompt('На сколько часов заблокировать? 0 = навсегда','24');if(h===null)return;
  const hours=Math.floor(+h);if(!Number.isFinite(hours)||hours<0)return toast('Введите число часов (0 = навсегда)');
  const reason=prompt('Причина блокировки (её увидит пользователь)','');if(reason===null)return;
  userAct('/admin/ban',{name,banned:true,hours,reason});
}
const unbanUser=name=>userAct('/admin/ban',{name,banned:false});
const makeAdmin=name=>{if(confirm('Выдать пользователю '+name+' права администратора?'))userAct('/admin/role',{name,role:'admin'})};
