async function viewPlay(id){
  app(LOAD);
  try{
    const q=await api('/quizzes/'+id),s=await api(`/quizzes/${id}/start`,{method:'POST',body:JSON.stringify({name:mem.get('name',''),mode:mem.get('mode','classic')})});
    R={id,q,sid:s.sid,total:s.total,pts:0,ok:0,streak:0,best:0,log:[],mode:s.mode||'classic',lives:s.lives||0,hints:s.hints||0};loadQ();
    pt=setInterval(async()=>{try{if((await api(`/play/${R.sid}/ping`)).scare)scream()}catch{}},3000);
  }catch(e){fail(e)}
}
async function loadQ(){
  try{const c=await api(`/play/${R.sid}/question`,{method:'POST'});R.cur=c;if(c.lives!=null)R.lives=c.lives;if(c.hints!=null)R.hints=c.hints;R.lim=R.q.timeLimit*1000;R.t0=Date.now()-(R.lim-c.leftMs);showQ()}catch(e){fail(e)}
}
const hearts=n=>'♥'.repeat(Math.max(0,n))+'♡'.repeat(Math.max(0,3-n));
function showQ(){
  const {q,total,cur,lim}=R,prac=R.mode=='practice';
  const questionNo=cur.n+1,progress=Math.min(100,questionNo/total*100);
  const image=cur.image?`<div class="quiz-visual is-ready"><img class="qimg" src="${esc(cur.image)}" alt="Иллюстрация к вопросу" loading="eager"></div>`:'<div class="quiz-visual" id="qv" hidden></div>';
  app(`<section class="quiz-stage">
    <div class="quiz-stage-head">
      <div class="quiz-titleline"><span class="quiz-eyebrow">Сейчас играем</span><strong>${esc(q.title)}</strong></div>
      <div class="hud">
        <span class="pill pill-count"><span class="pill-dot"></span>Вопрос ${questionNo} / ${total}</span>
        ${prac?'<span class="pill pill-neutral" title="Без таймера">Без таймера</span>':`<span class="pill pill-time" id="tm" aria-label="Осталось секунд">${q.timeLimit}</span>`}
        ${R.mode=='survival'?`<span class="pill lives" id="lv" aria-label="Жизни: ${R.lives}">${hearts(R.lives)}</span>`:''}
        <span class="pill pill-score">${R.streak>1?'Серия '+R.streak+' · ':''}${R.pts} очков</span>
      </div>
    </div>
    <div class="quiz-progress" role="progressbar" aria-label="Прогресс квиза" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><i style="width:${progress}%"></i></div>
    ${prac?'':'<div class="timer"><i id="tb"></i></div>'}
    <div class="quiz-question-card">
      <div class="quiz-question-meta"><span>ВОПРОС ${String(questionNo).padStart(2,'0')}</span><span>Выберите один вариант</span></div>
      ${image}
      <div class="qtext">${esc(cur.text)}</div>
    </div>
    <div class="answers-heading"><h3>Ваш ответ</h3><span>Клавиши 1–4 · выберите вариант</span></div>
    <div class="tiles">${cur.options.map((t,k)=>`<button class="tile" type="button" aria-label="Вариант ${k+1}: ${esc(t||'изображение')}" data-act="answer" data-args="${A(k)}"><span aria-hidden="true">${SHAPE[k]}</span>${cur.optImages[k]?`<img class="oimg" src="${esc(cur.optImages[k])}" alt="" loading="lazy">`:''}<span class="tile-label">${esc(t)}</span><span class="tile-arrow" aria-hidden="true">↗</span></button>`).join('')}</div>
    <div class="quiz-tools"><button class="btn alt sm" id="hn" data-act="useHint" ${R.hints<1||cur.options.length<3||(cur.hidden||[]).length?'disabled':''}><span class="hint-icon" aria-hidden="true">½</span> 50/50 · осталось ${R.hints}</button><span class="mut quiz-hint-note">Подсказка убирает два неверных ответа, но уменьшает очки за вопрос вдвое.</span></div>
    <div id="fb" aria-live="polite"></div>
  </section>`);
  (cur.hidden||[]).forEach(k=>{const t=document.querySelectorAll('.tile')[k];if(t){t.disabled=true;t.classList.add('gone')}});
  if(!cur.image&&window.LQPhotos?.question){
    const slot=$('#qv');
    // Сервер перемешивает порядок вопросов в каждой игре, поэтому ищем
    // исходный индекс по тексту, а не используем текущий номер раунда.
    const sourceQuestions=R.q.questions||R.q.Questions;
    const sourceIndex=Array.isArray(sourceQuestions)?sourceQuestions.findIndex(x=>(x.text??x.Text)===cur.text):-1;
    if(sourceIndex>=0)window.LQPhotos.question(R.id,sourceIndex).then(url=>{
      if(!url||!slot?.isConnected)return;
      slot.innerHTML=`<img class="qimg" src="${esc(url)}" alt="Иллюстрация к вопросу" loading="eager">`;
      slot.hidden=false;slot.classList.add('is-ready');
    }).catch(()=>{});
  }
  if(!prac)timer=setInterval(()=>{const left=Math.max(0,lim-(Date.now()-R.t0));
    const bar=$('#tb'),time=$('#tm');if(bar){bar.style.width=left/lim*100+'%';bar.classList.toggle('low',left/lim<.25)}if(time)time.textContent=Math.ceil(left/1000);if(!left)answer(-1)},100);
}
async function useHint(){
  if(busy)return;
  try{const r=await api(`/play/${R.sid}/hint`,{method:'POST'});R.hints=r.hints;
    r.hide.forEach(k=>{const t=document.querySelectorAll('.tile')[k];if(t){t.disabled=true;t.classList.add('gone')}});
    const b=$('#hn');if(b){b.disabled=true;b.textContent='50/50 · осталось '+r.hints}}catch(e){toast(e.message)}
}
let busy=false;
async function answer(choice){
  if(busy)return;busy=true;clearInterval(timer);
  const T=[...document.querySelectorAll('.tile')];T.forEach(b=>b.disabled=true);
  try{
    const r=await api(`/play/${R.sid}/answer`,{method:'POST',body:JSON.stringify({choice})});
    T.forEach((b,k)=>{if(k==r.correctPos)b.classList.add('right');else{b.classList.add('dim');if(k==choice)b.classList.add('wrong')}});
    R.pts=r.total;R.streak=r.correct?R.streak+1:0;R.best=Math.max(R.best,R.streak);if(r.correct)R.ok++;
    R.log.push({text:R.cur.text,ok:r.correct,mine:R.cur.options[choice],right:R.cur.options[r.correctPos],ex:r.explain||''});sfx(r.correct);
    if(r.lives!=null){R.lives=r.lives;const lv=$('#lv');if(lv){lv.textContent=hearts(R.lives);lv.setAttribute('aria-label','Жизни: '+R.lives)}}
    const hb=$('#hn');if(hb)hb.disabled=true;
    $('#fb').innerHTML=`<div class="fb ${r.correct?'ok':'no'}"><span>${choice<0?'Время вышло':r.correct?'Верно +'+r.points:'Мимо'}${R.mode=='survival'&&r.lives<1?'. Жизни закончились':''}${r.explain?`<small class="ex">${esc(r.explain)}</small>`:''}</span>
      <button class="btn" data-act="${r.done?'finish':'loadQ'}">${r.done?'Результат':'Дальше'}</button></div>`;
    $('#fb button').focus();
  }catch(e){toast(e.message)}finally{busy=false}
}
async function finish(){
  app('<p class="empty">Считаем результат…</p>');
  try{
    const r=await api(`/play/${R.sid}/finish`,{method:'POST'});
    const n=r.answered??r.total,pct=n?r.correct/n:0,cl=R.mode=='classic';
    if(pct>=.6&&r.correct>0)confetti();
    const rk=R.id+(cl?'':':'+R.mode),isNew=BEST.set(rk,r.points)&&r.points>0;
    const di=mem.get('dailyId',{}),dayS=R.mode!='practice'&&di.id==R.id&&di.d==today()?dailyDone():0;
    window.SHARE=`Я набрал ${r.points} очков в квизе «${R.q.title}» (${MODE_NAME[R.mode]}, ${r.correct}/${n}). Сможешь лучше? ${location.origin}/#/quiz/${R.id}`;
    app(`<div class="detail"><div class="panel"><span class="tag">${MODE_NAME[R.mode]}</span><h2 style="margin-top:8px">${esc(R.q.title)}</h2><div class="score" style="margin-top:10px" data-n="${r.points}">0</div>
      <p style="font-size:20px;font-weight:800;margin-top:10px">${pct==1&&n==r.total?'Безупречно!':pct>=.6?'Отличный результат':'Есть что повторить'}${isNew?' · новый рекорд':''}</p>
      ${cl?'':'<p class="note">Этот режим не попадает в таблицу лидеров.</p>'}${dayS?`<p class="note">Квиз дня засчитан. Серия: ${dayS} дн.</p>`:''}
      <div class="stats"><div class="stat"><b>${r.correct}/${n}</b>верных</div><div class="stat"><b>${cl?'#'+r.rank:'—'}</b>в рейтинге</div><div class="stat"><b>${R.best}</b>лучшая серия</div>${R.q.category=='IQ-тест'&&cl?`<div class="stat"><b>~${Math.round(70+pct*60)}</b>условный IQ</div>`:''}</div>
      <div class="row"><button class="btn" data-go="#/play/${R.id}">Ещё раз</button><button class="btn alt" data-act="shareScore">Поделиться</button><button class="btn alt" data-go="#/quiz/${R.id}">К квизу</button><button class="btn alt" data-go="#/">Все квизы</button></div>
      <h3 style="margin-top:16px">Разбор</h3><ul class="rev">${R.log.map(l=>`<li><b class="rk ${l.ok?'g':'r'}">${l.ok?'Верно':'Неверно'}</b>${esc(l.text)}${l.ok?'':`<div class="mut">Вы: ${esc(l.mine||'нет ответа')}. Верно: ${esc(l.right)}</div>`}${l.ex?`<div class="mut">${esc(l.ex)}</div>`:''}</li>`).join('')}</ul></div>
      <div class="panel"><h2>Таблица лидеров</h2><ol class="lb" style="margin-top:10px">${r.top.map(s=>`<li>${esc(s.name)}<b>${s.points}</b></li>`).join('')}</ol></div></div>`);
  countUp();}catch(e){fail(e)}
}
const copyText=t=>navigator.clipboard?.writeText(t).then(()=>toast('Скопировано'),()=>toast('Не удалось скопировать'));

