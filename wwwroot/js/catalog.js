/* =====================  КВИЗЫ  ===================== */
let LIST=[],NB=0,SHOWN=24,F={q:'',cat:'Все',sort:'new'};
const FEAT=['anime01','game001','space01','flag001','iq0001','mus001'];
const VF='<svg class="vf" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="#3b82f6"/><path d="M4.6 8.2l2.4 2.3 4.4-4.6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const st=(i,t)=>`<div class="st"><span class="ic">${ICO[i]}</span>${t}</div>`;
const mins=x=>Math.max(1,Math.ceil(x.count*x.timeLimit/60));
function card(x,rank){
  const fv=FAV.has(x.id),b=BEST.get(x.id);
  return `<article class="qc" tabindex="0" data-go="#/quiz/${x.id}" data-kc>
    ${rank?`<span class="rank r${Math.min(rank,4)}">${rank}</span>`:''}
    <button class="fav ${fv?'on':''}" aria-label="${fv?'Убрать из избранного':'В избранное'}" aria-pressed="${fv}" data-act="fav" data-args="${A(x.id)}">${fv?'★':'☆'}</button>
    <div class="cover" data-qid="${x.id}" data-cat="${esc(x.category)}" style="background-image:${cov(x.category,x.id)}"><span class="cat">${esc(x.category)}</span></div>
    <div class="in"><h3>${esc(x.title)}</h3>${st('q',`${x.count} ${plural(x.count)}`)}${st('t',`до ${mins(x)} мин`)}${st('u',`${x.plays} ${plural(x.plays,['прохождение','прохождения','прохождений'])}`)}${b?`<span class="rec">Ваш рекорд: ${b}</span>`:''}</div></article>`;
}
const secHead=(ico,title,badge,all)=>`<div class="sech">${ico?`<span class="ic2">${ico}</span>`:''}<h2>${title}</h2>${badge}${all?`<button class="all" data-act="toAll">Смотреть все ›</button>`:''}</div>`;
const toAll=()=>document.getElementById('all')?.scrollIntoView({behavior:'smooth'});
function carGo(b,d){const r=b.parentElement.querySelector('.rail');r.scrollBy({left:d*r.clientWidth*.8,behavior:'smooth'})}
const rail=(l,ranked)=>`<div class="car"><button class="arr l" aria-label="Назад" data-act="carGo" data-args="${A(-1)}">←</button><div class="rail">${l.map((x,i)=>card(x,ranked?i+1:0)).join('')}</div><button class="arr r" aria-label="Вперёд" data-act="carGo" data-args="${A(1)}">→</button></div>`;
async function viewCatalog(){
  const tick=[...CATS,'Своя игра','Квиз дня','50/50','Выживание'].map(c=>`<span>${c}</span><i>★</i>`).join('');
  app(`<section class="hero2"><div><span class="stk">alpha · бесплатно · без регистрации</span>
    <h1>Квизы на скорость. <mark>Своя игра</mark> для компании.</h1>
    <p class="lead">Отвечайте на время, берите подсказку 50/50, копите серии и забирайте место в таблице лидеров. Свои квизы собираются за пару минут.</p>
    <div class="cta"><button class="btn lg" data-act="toAll">Смотреть квизы</button><button class="btn alt lg" data-act="randomPick" data-args="${A('quizzes')}">Случайный</button><button class="btn alt lg" data-go="#/boards">Своя игра</button><button class="btn alt lg" data-go="#/iq">IQ-тест</button></div>
    <input class="search" id="s" placeholder="Найти квиз по названию или теме" aria-label="Поиск" value="${esc(F.q)}" data-in="search">
    <div class="facts" id="facts"></div></div>
    <aside id="daily" aria-label="Квиз дня"></aside></section>
    <div class="ticker" aria-hidden="true"><div>${tick}${tick}</div></div>
    <div id="curated"></div>
    <section class="sec" id="all"><div class="sech"><h2>Все квизы</h2></div><div class="row" id="chips" style="margin-top:0"></div><div class="grid" id="grid">${'<div class="skel"></div>'.repeat(6)}</div></section>`);
  try{const r=await Promise.all([api('/quizzes'),api('/boards').catch(()=>[])]);LIST=r[0];NB=r[1].length}catch(e){return fail(e)}
  const pl=LIST.reduce((a,x)=>a+x.plays,0),dq=dailyQuiz();
  if(dq)mem.set('dailyId',{d:today(),id:dq.id});
  $('#daily').innerHTML=dailyHtml();
  $('#facts').innerHTML=`<span class="fact"><b>${LIST.length}</b> ${plural(LIST.length,['квиз','квиза','квизов'])}</span><span class="fact"><b>${NB}</b> ${plural(NB,['игра','игры','игр'])} «Своя игра»</span>${pl?`<span class="fact"><b>${pl}</b> ${plural(pl,['прохождение','прохождения','прохождений'])}</span>`:''}`;
  curated();chips();grid();
}
function onSearch(v){
  const was=!!F.q.trim();F.q=v;SHOWN=24;curated();grid();
  if(v.trim()&&!was)toAll();
}
function curated(){
  const e=$('#curated');if(!e)return;
  if(F.q.trim()||!LIST.length){e.innerHTML='';return}
  let ft=FEAT.map(id=>LIST.find(x=>x.id==id)).filter(Boolean).slice(0,3);
  for(const x of LIST){if(ft.length>=3)break;if(!ft.includes(x))ft.push(x)}
  const fvs=FAV.get().map(id=>LIST.find(x=>x.id==id)).filter(Boolean),top=[...LIST].sort((a,b)=>b.plays-a.plays||b.count-a.count).slice(0,8),nw=LIST.slice(0,8);
  e.innerHTML=`${fvs.length?`<section class="sec">${secHead('','Моё избранное',`<span class="badge">${fvs.length}</span>`,0)}${rail(fvs,false)}</section>`:''}<section class="sec">${secHead('','Избранные квизы','<span class="badge">Выбор редакции</span>',0)}<div class="feat">${ft.map(x=>card(x,0)).join('')}</div></section>
    <section class="sec">${secHead('','Топ квизов','<span class="badge">Самые популярные</span>',1)}${rail(top,true)}</section>
    <section class="sec">${secHead('','Новые квизы','<span class="badge">Свежие публикации</span>',1).replace('<h2>','<span class="new">NEW</span><h2>')}${rail(nw,false)}</section>`;
}
function chips(){$('#chips').innerHTML=['Все',...CATS].map(c=>`<button class="chip ${F.cat==c?'on':''}" data-act="setCat" data-args="${A(c)}">${c}</button>`).join('')+
  `<select aria-label="Сортировка" data-ch="setSort" style="margin-left:auto"><option value="new" ${F.sort=='new'?'selected':''}>Сначала новые</option><option value="pop" ${F.sort=='pop'?'selected':''}>Популярные</option></select>`}
function grid(){
  const q=F.q.trim().toLowerCase();
  let l=LIST.filter(x=>(F.cat=='Все'||x.category==F.cat)&&(x.title+' '+x.description).toLowerCase().includes(q));
  if(F.sort=='pop')l.sort((a,b)=>b.plays-a.plays);
  const more=l.length>SHOWN;l=l.slice(0,SHOWN);
  $('#grid').innerHTML=l.length?l.map(x=>card(x,0)).join('')
  :'<p class="empty" style="grid-column:1/-1">Ничего не найдено. Измените запрос или создайте такой квиз сами.</p>';
  if(more)$('#grid').insertAdjacentHTML('beforeend','<button class="btn alt" style="grid-column:1/-1;justify-self:center" data-act="more">Показать ещё</button>');
}
async function viewQuiz(id){
  app(LOAD);
  let q;try{q=await api('/quizzes/'+id)}catch(e){return fail(e)}
  const owned=mem.get('owned',{})[id]||ME?.mine?.includes(id)||ME?.admin, n=q.questions.length;
  app(`<div class="detail"><div class="panel"><div class="dcover" data-qid="${q.id}" data-cat="${esc(q.category)}" style="background-image:${cov(q.category,q.id)}"></div>
    <span class="tag">${esc(q.category)}</span><h1 style="margin:8px 0">${esc(q.title)}</h1>
    <p class="mut">${esc(q.description)}</p>
    <p style="margin:10px 0 0"><b>${n} ${plural(n)}</b> · ${q.timeLimit} сек. на вопрос · ${q.plays} прохождений</p>
    ${BEST.get(id)?`<p style="margin-top:8px"><span class="rec">Ваш рекорд: ${BEST.get(id)}</span></p>`:''}
    <fieldset class="modes"><legend>Режим игры</legend>${MODES.map(([k,t,d])=>`<label class="mode"><input type="radio" name="md" value="${k}" ${mem.get('mode','classic')==k?'checked':''} data-ch="setMode"><span><b>${t}</b><small>${d}</small></span></label>`).join('')}</fieldset>
    <label for="nm">Ваше имя для таблицы лидеров</label><input type="text" id="nm" value="${esc(mem.get('name',''))}" placeholder="Например: Артём">
    <div class="row"><button class="btn" data-act="startQuiz" data-args="${A(id)}">Начать</button>
    <button class="btn alt" data-act="copyLink">Скопировать ссылку</button>
    <button class="btn alt" id="fv" aria-pressed="${FAV.has(id)}" data-act="fav" data-args="${A(id)}">${FAV.has(id)?'★ В избранном':'☆ В избранное'}</button>
    ${ME&&(ME.mine?.includes(id)||ME.admin)?`<button class="btn alt sm" data-go="#/edit/${id}">Изменить</button>`:''}${ME?`<button class="btn alt sm" data-act="reportQuiz" data-args="${A(id)}">Пожаловаться</button>`:''}
    ${owned?`<button class="btn danger sm" data-act="del" data-args="${A('quizzes',id)}">Удалить квиз</button>`:''}</div></div>
    <div class="panel"><h2>Лучшие результаты</h2>${q.top.length?`<ol class="lb" style="margin-top:10px">${q.top.map(s=>`<li>${esc(s.name)}<span class="mut">${s.correct}/${n}</span><b>${s.points}</b></li>`).join('')}</ol>`:'<p class="mut" style="margin-top:10px">Пока никого. Станьте первым.</p>'}</div></div>`);
}
async function del(kind,id){
  if(!confirm('Удалить безвозвратно? Это действие нельзя отменить.'))return;
  try{await api(`/${kind}/${id}`,{method:'DELETE',headers:{'X-Owner-Key':mem.get('owned',{})[id]}});toast('Удалено');location.hash=kind=='boards'?'#/boards':'#/'}catch(e){toast(e.message)}
}
let AFTER='';
