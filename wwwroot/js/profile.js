/* ===== профиль, история, глобальный рейтинг, жалобы ===== */
const avaBg=n=>`linear-gradient(135deg,hsl(${hue(n)} 70% 50%),hsl(${(hue(n)+40)%360} 70% 40%))`;
const MODE_RU={classic:'Классика',survival:'Выживание',practice:'Тренировка'};
const dt=s=>new Date(s).toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
async function viewMe(){
  app(LOAD);await loadMe();
  if(!ME){location.hash='#/auth';return}
  let p;try{p=await api('/profile')}catch(e){return fail(e)}
  const L=(a,k)=>a.length?`<ul class="lb">${a.map(x=>`<li><a href="#/${k}/${x.id}" style="color:inherit">${esc(x.title)}</a></li>`).join('')}</ul>`:'<p class="mut">Пока пусто</p>';
  const bars=p.byCategory.length?`<div class="bars">${p.byCategory.map(c=>`<div class="bar-row"><span>${esc(c.category)}</span><div class="tr"><i style="width:${c.accuracy}%"></i></div><b>${c.accuracy}%</b></div>`).join('')}</div>`:'<p class="mut">Сыграйте несколько квизов, и здесь появится статистика по темам.</p>';
  const hist=p.history.length?`<table class="tbl"><thead><tr><th>Квиз</th><th>Режим</th><th>Верно</th><th>Очки</th><th>Дата</th></tr></thead><tbody>${p.history.map(h=>`<tr><td><a href="#/quiz/${h.quizId}" style="color:inherit">${esc(h.title)}</a></td><td>${MODE_RU[h.mode]||h.mode}</td><td>${h.correct}/${h.total}</td><td><b>${h.points}</b></td><td class="mut">${dt(h.at)}</td></tr>`).join('')}</tbody></table>`:'<p class="mut">История пуста. Начните с любого квиза.</p>';
  app(`<div class="panel"><div class="prof"><div class="ava" style="background:${avaBg(p.name)}">${esc(p.name[0].toUpperCase())}</div>
    <div><h2>${esc(p.name)}</h2><p class="mut">С нами с ${dt(p.created)}${p.admin?' · администратор':''}</p></div>
    <div class="row" style="margin:0 0 0 auto"><button class="btn alt sm" data-act="changePass">Сменить пароль</button>${p.admin?'<button class="btn sm" data-go="#/admin">Админ-панель</button>':'<button class="btn alt sm" data-act="claimAdmin">Код администратора</button>'}<button class="btn alt sm" data-act="logout">Выйти</button></div></div>
    <div class="kpis"><div class="kpi"><b data-n="${p.games}">0</b><span>игр сыграно</span></div><div class="kpi"><b data-n="${p.accuracy}" data-s="%">0</b><span>верных ответов</span></div><div class="kpi"><b data-n="${p.correct}">0</b><span>правильных из ${p.questions}</span></div><div class="kpi"><b data-n="${p.best}">0</b><span>лучший результат</span></div><div class="kpi"><b data-n="${p.points}">0</b><span>очков в рейтинге</span></div></div></div>
  <div class="detail" style="margin-top:20px"><div class="panel"><h3>Точность по темам</h3>${bars}</div><div class="panel"><h3>Мои квизы</h3>${L(ME.quizzes,'quiz')}<h3 style="margin-top:16px">Мои игры</h3>${L(ME.boards,'board')}</div></div>
  <div class="panel" style="margin-top:20px"><h3>История игр</h3>${hist}</div>`);
  countUp();
}
function countUp(){document.querySelectorAll('[data-n]').forEach(e=>{const to=+e.dataset.n,s=e.dataset.s||'',t0=performance.now();const f=t=>{const k=Math.min(1,(t-t0)/700);e.textContent=Math.round(to*(1-Math.pow(1-k,3)))+s;if(k<1)requestAnimationFrame(f)};requestAnimationFrame(f)})}
let RT={period:'all',category:''};
async function viewRating(){
  app(`<div class="hero"><h1>Рейтинг игроков</h1><p class="mut">Очки считаются по лучшему результату в каждом квизе (режим «Классика») и суммируются. Нужен аккаунт, чтобы попасть в таблицу.</p></div>
  <div class="tabs" id="rt1"></div><div class="tabs" id="rt2"></div><div class="panel" id="rt3">${LOAD}</div>`);
  drawRating();
}
async function drawRating(){
  const P=[['all','За всё время'],['month','Месяц'],['week','Неделя']];
  $('#rt1').innerHTML=P.map(([k,t])=>`<button class="chip ${RT.period==k?'on':''}" data-act="ratePeriod" data-args="${A(k)}">${t}</button>`).join('');
  $('#rt2').innerHTML=['',...CATS].map(c=>`<button class="chip ${RT.category==c?'on':''}" data-act="rateCat" data-c="${c}">${c||'Все темы'}</button>`).join('');
  try{
    const l=await api(`/leaderboard?period=${RT.period}&category=${encodeURIComponent(RT.category)}`);
    $('#rt3').innerHTML=l.length?`<table class="tbl"><thead><tr><th>#</th><th>Игрок</th><th>Квизов</th><th>Точность</th><th>Очки</th></tr></thead><tbody>${l.map((x,i)=>`<tr><td class="n">${i<3?`<span class="medal m${i+1}">${i+1}</span>`:i+1}</td><td><b>${esc(x.name)}</b></td><td>${x.quizzes}</td><td>${x.accuracy}%</td><td><b>${x.points}</b></td></tr>`).join('')}</tbody></table>`:'<p class="empty">За этот период пока нет результатов. Сыграйте в «Классике» с аккаунтом.</p>';
  }catch(e){$('#rt3').textContent=e.message}
}
async function reportQuiz(id){
  const r=prompt('Что не так с квизом? (ошибка в вопросе, неприемлемый контент…)');if(!r)return;
  try{await api(`/quizzes/${id}/report`,{method:'POST',body:JSON.stringify({reason:r})});toast('Жалоба отправлена, спасибо')}catch(e){toast(e.message)}
}

async function claimAdmin(){
  const c=prompt('Код администратора (его задаёт владелец сервера в переменной LARP_ADMIN_CODE)');if(!c)return;
  try{await api('/admin/claim',{method:'POST',body:JSON.stringify({code:c})});toast('Теперь вы администратор');viewMe()}catch(e){toast(e.message)}
}
