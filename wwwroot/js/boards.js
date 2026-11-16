/* =====================  СВОЯ ИГРА (с ведущим, без компьютеров у игроков)  ===================== */
async function viewBoards(){
  app(`<div class="hero"><h1>Своя игра</h1><p class="mut">Игра для компании с ведущим. На экране доска: категории и вопросы за разные очки. Команды отвечают вслух или жмут красную кнопку, ведущий открывает вопрос, показывает ответ и начисляет очки.</p><p><button class="btn" data-act="randomPick" data-args="${A('boards')}">Случайная игра</button></p></div><div class="grid" id="bg">${LOAD}</div>`);
  let l;try{l=await api('/boards')}catch(e){return fail(e)}
  $('#bg').innerHTML=l.length?l.map(b=>`<article class="qc" tabindex="0" data-go="#/board/${b.id}" data-kc>
    <div class="cover" style="background-image:${covB(b.id)}"><span class="cat">Своя игра</span></div>
    <div class="in"><h3>${esc(b.title)}</h3>${st('g',`${b.categories.length} ${plural(b.categories.length,['категория','категории','категорий'])}`)}${st('q',`${b.count} ${plural(b.count)}`)}
    <p class="mut" style="font-size:14px">${b.categories.map(esc).join(', ')}</p></div></article>`).join('')
  :'<p class="empty" style="grid-column:1/-1">Игр пока нет. Создайте первую кнопкой «Создать игру».</p>';
}

/* --- редактор игры --- */
let BE;
const newCat=()=>({name:'',cells:[100,200,300].map(p=>({p,q:'',a:''}))});
function viewBoardCreate(){
  if(needLogin())return;
  BE={title:'',cats:[newCat(),newCat(),newCat()]};
  app(`<div class="panel"><h2>Новая игра</h2><p class="mut">Категории стоят в столбцах, внутри вопросы с разной стоимостью. Вопрос виден всем, ответ ведущий показывает кнопкой.</p>
  <label for="bt">Название игры</label><input type="text" id="bt" data-in="beTitle" placeholder="Например: Аниме-вечер">
  <div id="bc"></div>
  <div class="row"><button class="btn alt" data-act="addCat">Добавить категорию</button><button class="btn" id="bs" data-act="saveBoard">Опубликовать игру</button></div>
  <p class="err" id="er" role="alert"></p><p class="mut">До 12 категорий и до 20 вопросов в каждой. Стоимость в одной категории не должна повторяться.</p></div>`);
  drawBE();
}
function drawBE(){
  $('#bc').innerHTML=BE.cats.map((c,i)=>`<div class="qb"><div class="qh"><h3>Категория ${i+1}</h3><button class="btn alt sm" data-act="rmCat" data-args="${A(i)}">Удалить</button></div>
  <input type="text" placeholder="Название категории" value="${esc(c.name)}" data-in="beCat" data-args="${A(i)}" style="margin:10px 0 4px" aria-label="Название категории">
  ${c.cells.map((x,j)=>`<div class="bcell"><input type="number" min="1" max="10000" value="${x.p}" data-in="beCell" data-args="${A(i,j,'p')}" aria-label="Очки">
    <input type="text" placeholder="Вопрос" value="${esc(x.q)}" data-in="beCell" data-args="${A(i,j,'q')}" aria-label="Вопрос">
    <input type="text" placeholder="Ответ" value="${esc(x.a)}" data-in="beCell" data-args="${A(i,j,'a')}" aria-label="Ответ">
    <button class="btn alt sm" data-act="rmCell" data-args="${A(i,j)}" aria-label="Удалить вопрос">Удалить</button></div>`).join('')}
  <button class="btn alt sm" style="margin-top:10px" data-act="addCell" data-args="${A(i)}">Добавить вопрос</button></div>`).join('');
}
function addCat(){if(BE.cats.length>=12)return toast('Не больше 12 категорий');BE.cats.push(newCat());drawBE()}
function rmCat(i){if(BE.cats.length<2)return toast('Нужна хотя бы одна категория');BE.cats.splice(i,1);drawBE()}
function addCell(i){const c=BE.cats[i];if(c.cells.length>=20)return toast('Не больше 20 вопросов в категории');c.cells.push({p:Math.max(0,...c.cells.map(x=>x.p))+100,q:'',a:''});drawBE()}
function rmCell(i,j){const c=BE.cats[i];if(c.cells.length<2)return toast('Нужен хотя бы один вопрос');c.cells.splice(j,1);drawBE()}
async function saveBoard(){
  const er=$('#er');er.textContent='';
  if(BE.title.trim().length<1){er.textContent='Введите название.';return}
  const categories=[];
  for(const [i,c] of BE.cats.entries()){
    if(!c.name.trim()){er.textContent=`Категория ${i+1}: введите название.`;return}
    const ps=c.cells.map(x=>x.p);
    if(ps.some(p=>!(p>=1&&p<=10000))){er.textContent=`«${c.name}»: очки должны быть от 1 до 10000.`;return}
    if(new Set(ps).size!=ps.length){er.textContent=`«${c.name}»: стоимость вопросов не должна повторяться.`;return}
    if(c.cells.some(x=>!x.q.trim()||!x.a.trim())){er.textContent=`«${c.name}»: заполните вопрос и ответ в каждой строке.`;return}
    categories.push({name:c.name.trim(),cells:c.cells.map(x=>({points:x.p,question:x.q.trim(),answer:x.a.trim()}))});
  }
  $('#bs').disabled=true;
  try{
    const r=await api('/boards',{method:'POST',body:JSON.stringify({title:BE.title.trim(),categories})});
    const o=mem.get('owned',{});o[r.id]=r.ownerKey;mem.set('owned',o);
    toast('Игра опубликована');location.hash='#/board/'+r.id;
  }catch(e){er.textContent=e.message;$('#bs').disabled=false}
}

/* --- лобби: выбор команд --- */
let TN=[];
async function viewBoard(id){
  app(LOAD);
  let b;try{b=await api('/boards/'+id)}catch(e){return fail(e)}
  const n=b.categories.reduce((s,c)=>s+c.cells.length,0),owned=mem.get('owned',{})[id]||ME?.mine?.includes(id)||ME?.admin,saved=mem.get('game:'+id,null);
  TN=mem.get('teams:'+id,['Команда 1','Команда 2','Команда 3']);
  app(`<div class="detail"><div class="panel"><div class="dcover" style="background-image:${covB(b.id)}"></div>
    <h1 style="margin-bottom:6px">${esc(b.title)}</h1><p class="mut">${b.categories.length} ${plural(b.categories.length,['категория','категории','категорий'])} · ${n} ${plural(n)}</p>
    ${saved?`<div class="row"><button class="btn" data-go="#/host/${id}">Продолжить игру</button><span class="mut">Сыграно вопросов: ${Object.keys(saved.used).length}</span></div>`:''}
    <label for="tc">Сколько команд играет</label>
    <select id="tc" data-ch="teamInputs">${[2,3,4,5,6,7,8].map(k=>`<option value="${k}" ${k==TN.length?'selected':''}>${k}</option>`).join('')}</select>
    <div id="tn"></div>
    <div class="row"><button class="btn ${saved?'alt':''}" data-act="startGame" data-args="${A(id,!!saved)}">Начать новую игру</button>
    <button class="btn alt" data-act="copyLink">Скопировать ссылку</button>
    ${owned?`<button class="btn danger sm" data-act="del" data-args="${A('boards',id)}">Удалить игру</button>`:''}</div></div>
    <div class="panel"><h2>Категории</h2><ul class="lb" style="margin-top:10px">${b.categories.map(c=>`<li>${esc(c.name)}<span class="mut" style="margin-left:auto">${c.cells.length} ${plural(c.cells.length)}</span></li>`).join('')}</ul>
    <p class="mut" style="margin-top:14px">Подсказка: откройте игру на ноутбуке с проектором или на большом экране. Игрокам компьютер не нужен. Вести игру может только вошедший в аккаунт.</p></div></div>`);
  teamInputs();
}
function teamInputs(){
  const n=+$('#tc').value,old=[...document.querySelectorAll('.tname')].map(i=>i.value),src=old.length?old:TN;
  $('#tn').innerHTML=Array.from({length:n},(_,i)=>`<input type="text" class="tname" value="${esc(src[i]||'Команда '+(i+1))}" aria-label="Название команды ${i+1}" style="margin-top:8px">`).join('');
}
function startGame(id,has){
  if(has&&!confirm('Начать заново? Сохранённые очки и сыгранные вопросы сбросятся.'))return;
  const names=[...document.querySelectorAll('.tname')].map((i,k)=>i.value.trim()||'Команда '+(k+1));
  mem.set('teams:'+id,names);
  mem.set('game:'+id,{teams:names.map(name=>({name,score:0})),used:{}});
  location.hash='#/host/'+id;
}

/* --- экран ведущего --- */
let B,G,H,JM=null,jl=0,BZ=mem.get('buzz',false);
const saveG=()=>mem.set('game:'+B.id,G);
async function viewHost(id){
  if(needLogin())return;
  app(LOAD);
  try{B=await api('/boards/'+id);H=(await api(`/boards/${id}/host`,{method:'POST'})).hid}catch(e){return fail(e)}
  G=mem.get('game:'+id,null);
  if(!G){location.hash='#/board/'+id;return}
  renderHost();
}
function renderHost(){
  const rows=[...new Set(B.categories.flatMap(c=>c.cells.map(x=>x.points)))].sort((a,b)=>a-b);
  const cells=rows.map(p=>B.categories.map((c,ci)=>{
    if(!c.cells.some(z=>z.points==p))return '<div class="jc empty"></div>';
    const used=G.used[ci+'-'+p];
    return `<button class="jc" ${used?'disabled aria-label="Сыграно"':''} data-act="openCell" data-args="${A(ci,p)}">${used?'':p}</button>`}).join('')).join('');
  app(`<div class="hbar"><h2>${esc(B.title)}</h2><div class="row" style="margin:0">
    <button class="btn alt sm" data-act="toggleBuzz">Красная кнопка: ${BZ?'ВКЛ':'ВЫКЛ'}</button><button class="btn alt sm" data-act="showStandings">Итоги</button><button class="btn alt sm" data-act="resetGame">Заново</button><button class="btn alt sm" data-go="#/board/${B.id}">Выйти</button></div></div>
    <div class="jgrid" style="grid-template-columns:repeat(${B.categories.length},minmax(0,1fr))">${B.categories.map(c=>`<div class="jh">${esc(c.name)}</div>`).join('')}${cells}</div>
    <div class="teams" id="teams"></div><div class="jm" id="jm" hidden></div>`);
  renderTeams();
}
function renderTeams(){
  $('#teams').innerHTML=G.teams.map((t,i)=>`<div class="team"><input type="text" class="tn" value="${esc(t.name)}" data-ch="teamName" data-args="${A(i)}" aria-label="Название команды">
    <input type="number" class="ts" value="${t.score}" data-ch="teamScore" data-args="${A(i)}" aria-label="Очки команды"></div>`).join('');
}
const rehost=async()=>{H=(await api(`/boards/${B.id}/host`,{method:'POST'})).hid};
async function openCell(ci,p){
  try{const r=await api(`/host/${H}/open`,{method:'POST',body:JSON.stringify({ci,p})});
    JM={ci,p,x:{question:r.question,answer:''},rev:false,k:ci+'-'+p,win:null,blk:[]};drawModal()}
  catch(e){if(/истекла/.test(e.message)){try{await rehost();return openCell(ci,p)}catch(e2){e=e2}}toast(e.message)}
}
function drawModal(){
  const {x,ci,p,rev}=JM,m=$('#jm');m.hidden=false;
  m.innerHTML=`<div class="jbox"><div class="jt">${esc(B.categories[ci].name)} за ${p}</div><div class="jq">${esc(x.question)}</div>
    <div class="row" style="justify-content:center;margin:0"><button class="btn alt sm" data-act="runTimer">Таймер 30 с</button><span class="pill" id="tmv" style="min-width:70px;text-align:center">&nbsp;</span><button class="btn alt sm" data-act="toggleBuzz">Красная кнопка: ${BZ?'ВКЛ':'ВЫКЛ'}</button></div>
    ${BZ?buzzHtml():''}
    ${rev?`<div class="ja">${esc(x.answer)}</div>`:`<div><button class="btn" data-act="revealJ">Показать ответ (Пробел)</button></div>`}
    <div class="jaw">${G.teams.map((t,i)=>`<div class="aw"><b>${esc(t.name)}</b><span class="pill sc${i}">${t.score}</span>
      <div class="row" style="margin:0"><button class="btn sm" data-act="award" data-args="${A(i,1)}">+${p}</button><button class="btn danger sm" data-act="award" data-args="${A(i,-1)}">−${p}</button></div></div>`).join('')}</div>
    <div class="row" style="justify-content:center;margin:0"><button class="btn alt" data-act="closeJ" data-args="${A(false)}">Вернуть на доску</button><button class="btn" data-act="closeJ" data-args="${A(true)}">Готово, вопрос сыгран</button></div></div>`;
  if(jt)$('#tmv').textContent=jl;
}
async function revealJ(){
  if(!JM||JM.rev)return;const m=JSON.stringify({ci:JM.ci,p:JM.p}),u=`/host/${H}/`;
  try{
    let r;try{r=await api(u+'reveal',{method:'POST',body:m})}
    catch(e){if(!/истекла/.test(e.message))throw e;await rehost();await api(`/host/${H}/open`,{method:'POST',body:m});r=await api(`/host/${H}/reveal`,{method:'POST',body:m})}
    if(JM){JM.x.answer=r.answer;JM.rev=true;drawModal()}
  }catch(e){toast(e.message)}
}
function buzzHtml(){
  const {win,blk,p}=JM;
  if(win==null)return `<div class="bz"><div class="bzh">Кто первый нажмёт — тот отвечает (клавиши 1–${G.teams.length})</div><div class="bzrow">${G.teams.map((t,i)=>`<button class="bzb" ${blk.includes(i)?'disabled':''} data-act="buzz" data-args="${A(i)}"><b>${i+1}</b><span>${esc(t.name)}</span></button>`).join('')}</div></div>`;
  return `<div class="bz win"><div class="bzname">Отвечает: ${esc(G.teams[win].name)}</div><div class="row" style="justify-content:center;margin:0"><button class="btn sm" data-act="judge" data-args="${A(true)}">Верно +${p}</button><button class="btn danger sm" data-act="judge" data-args="${A(false)}">Неверно −${p}</button><button class="btn alt sm" data-act="buzzReset">Сбросить</button></div></div>`;
}
function toggleBuzz(){BZ=!BZ;mem.set('buzz',BZ);if(JM){JM.win=null;drawModal()}else renderHost()}
function buzzSound(){if(mem.get('mute',false))return;try{AC=AC||new AudioContext();const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain();o.type='sawtooth';o.frequency.setValueAtTime(240,t);o.frequency.exponentialRampToValueAtTime(110,t+.5);g.gain.setValueAtTime(.25,t);g.gain.exponentialRampToValueAtTime(.001,t+.55);o.connect(g).connect(AC.destination);o.start();o.stop(t+.55)}catch{}}
function buzz(i){if(!JM||!BZ||JM.win!=null||JM.blk.includes(i)||!G.teams[i])return;JM.win=i;buzzSound();drawModal()}
function buzzReset(){JM.win=null;drawModal()}
function judge(ok){
  const w=JM.win;if(w==null)return;award(w,ok?1:-1);JM.win=null;
  if(ok){JM.blk=G.teams.map((_,i)=>i);drawModal();revealJ()}else{JM.blk.push(w);drawModal()}
}
function award(i,s){G.teams[i].score+=s*JM.p;saveG();document.querySelector('.sc'+i).textContent=G.teams[i].score;renderTeams()}
function closeJ(done){clearInterval(jt);jt=null;if(done){G.used[JM.k]=true;saveG()}JM=null;renderHost()}
function runTimer(){
  clearInterval(jt);jl=30;$('#tmv').textContent=jl;
  jt=setInterval(()=>{jl--;const e=$('#tmv');if(e)e.textContent=jl>0?jl:'Время!';if(jl<=0){clearInterval(jt);jt=null}},1000);
}
function showStandings(){
  const l=[...G.teams].sort((a,b)=>b.score-a.score),m=$('#jm');m.hidden=false;
  m.innerHTML=`<div class="jbox"><div class="jt">Итоги</div><ol class="lb">${l.map(t=>`<li>${esc(t.name)}<b>${t.score}</b></li>`).join('')}</ol>
    <div><button class="btn" data-act="hideJm">Продолжить игру</button></div></div>`;
}
function resetGame(){
  if(!confirm('Сбросить очки и вернуть все вопросы на доску?'))return;
  G.teams.forEach(t=>t.score=0);G.used={};saveG();renderHost();
}
addEventListener('keydown',e=>{
  if(!JM||e.target.matches('input'))return;
  if(e.key==' '){e.preventDefault();revealJ()}
  else if(BZ&&/^[1-8]$/.test(e.key))buzz(+e.key-1);
  else if(e.key=='Escape')closeJ(JM.rev);
});

