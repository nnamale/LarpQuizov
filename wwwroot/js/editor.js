const needLogin=()=>{if(ME)return false;AFTER=location.hash;location.hash='#/auth';return true};
let EID=null; // id редактируемого квиза; null = создаём новый
function viewCreate(){
  if(needLogin())return;
  EID=null;renderEditor('Новый квиз','Опубликовать');QN=0;addQ();
}
async function viewEdit(id){
  if(needLogin())return;
  app(LOAD);
  let q;try{q=await api(`/quizzes/${id}/edit`)}catch(e){return fail(e)}
  EID=id;renderEditor('Редактирование квиза','Сохранить изменения');QN=0;
  $('#t').value=q.title;$('#d').value=q.description;
  const c=$('#c');if(![...c.options].some(o=>o.value==q.category))c.add(new Option(q.category,q.category));c.value=q.category;
  const tl=$('#tl');if(![...tl.options].some(o=>+o.value==q.timeLimit))tl.add(new Option(q.timeLimit+' секунд',q.timeLimit));tl.value=q.timeLimit;
  q.questions.forEach(x=>{addQ();fillQ($('#qs').lastElementChild,x)});
}
function fillQ(b,x){
  b.querySelector('.qt').value=x.text||'';
  const o=b.querySelectorAll('.qo');(x.options||[]).forEach((v,i)=>{if(o[i])o[i].value=v});
  const r=b.querySelectorAll('input[type=radio]');if(r[x.correct])r[x.correct].checked=true;
  b.querySelector('.qe').value=x.explain||'';
  const setImg=(img,url)=>{if(!url)return;const btn=img.parentElement.querySelector('button');btn.dataset.t=btn.textContent;img.src=url;img.dataset.u=url;img.hidden=false;btn.textContent='Убрать'};
  setImg(b.querySelector('.qi'),x.image);
  b.querySelectorAll('.opt').forEach((d,i)=>setImg(d.querySelector('.oi'),(x.optImages||[])[i]));
}
function renderEditor(heading,btnText){
  app(`<div class="panel"><h2>${heading}</h2>
  <label for="t">Название</label><input type="text" id="t" placeholder="Например: ООП в C# для новичков">
  <label for="d">Описание</label><input type="text" id="d" placeholder="О чём этот квиз">
  <div class="two"><div><label for="c">Категория</label><select id="c" style="width:100%">${CATS.map(c=>`<option>${c}</option>`).join('')}</select></div>
  <div><label for="tl">Время на вопрос</label><select id="tl" style="width:100%">${[10,15,20,30,60].map(s=>`<option value="${s}" ${s==20?'selected':''}>${s} секунд</option>`).join('')}</select></div></div>
  <details class="imp"><summary>Импорт вопросов из текста</summary><p class="mut" style="margin-top:8px">Одна строка = один вопрос: вопрос | вариант 1 | вариант 2 | вариант 3 | вариант 4 | номер верного. Пояснение можно добавить в конце после ||</p>
  <textarea id="it" rows="6" aria-label="Текст для импорта" placeholder="Столица Японии? | Осака | Токио | Киото | 2 || Токио с 1868 года"></textarea><button type="button" class="btn alt sm" data-act="importQ">Добавить из текста</button></details>
  <div id="qs"></div>
  <div class="row"><button class="btn alt" data-act="addQ">Добавить вопрос</button><button class="btn alt" data-act="addTF">Вопрос «Верно / Неверно»</button><button class="btn" id="sv" data-act="save">${btnText}</button></div>
  <p class="err" id="er" role="alert"></p><p class="mut">Заполните минимум 2 варианта. Отметьте точкой правильный.</p></div>`);
}
function importQ(){
  const lines=$('#it').value.split('\n').map(x=>x.trim()).filter(Boolean);let n=0,bad=0;
  for(const ln of lines){
    const [main,...ex]=ln.split('||'),p=main.split('|').map(x=>x.trim()),c=+p[p.length-1],k=p.length-2;
    if(k<2||k>4||!p[0]||!(c>=1&&c<=k)||p.slice(1,-1).some(x=>!x)){bad++;continue}
    addQ();const b=$('#qs').lastElementChild;b.querySelector('.qt').value=p[0];
    const o=b.querySelectorAll('.qo');p.slice(1,-1).forEach((v,i)=>o[i].value=v);
    b.querySelectorAll('input[type=radio]')[c-1].checked=true;b.querySelector('.qe').value=ex.join('||').trim();n++;
  }
  const f=$('#qs').firstElementChild;
  if(n&&f&&$('#qs').children.length>1&&!f.querySelector('.qt').value.trim()&&![...f.querySelectorAll('.qo')].some(x=>x.value.trim())){f.remove();num()}
  if(n)$('#it').value='';
  toast(n?`Добавлено вопросов: ${n}${bad?`, строк с ошибкой: ${bad}`:''}`:'Не удалось разобрать строки. Проверьте формат');
}
let QN=0;
function addQ(tf){
  const n=++QN,d=document.createElement('div');d.className='qb';
  d.innerHTML=`<div class="qh"><h3>Вопрос</h3><button class="btn alt sm" data-act="rmQ">Удалить</button></div>
  <input type="text" class="qt" placeholder="Текст вопроса" aria-label="Текст вопроса" style="margin-top:10px">
  <div class="im" style="margin-top:8px"><button type="button" class="btn alt sm" data-act="pickImg">Фото к вопросу</button><img class="qi" hidden alt=""></div>
  ${[0,1,2,3].map(i=>`<div class="opt"><input type="radio" name="r${n}" value="${i}" ${i?'':'checked'} aria-label="Верный: вариант ${i+1}"><span class="sh" style="background:${TILE[i]}">${SHAPE[i]}</span>
  <input type="text" class="qo" placeholder="Вариант ${i+1}${i>1?' (необязательно)':''}" aria-label="Вариант ${i+1}"><span class="im"><button type="button" class="btn alt sm" data-act="pickImg" title="Фото к варианту">Фото</button><img class="oi" hidden alt=""></span></div>`).join('')}
  <input type="text" class="qe" placeholder="Пояснение к ответу (необязательно)" aria-label="Пояснение к ответу" style="margin-top:10px">`;
  $('#qs').appendChild(d);num();
  if(tf===true){const o=d.querySelectorAll('.qo');o[0].value='Верно';o[1].value='Неверно'}
}
function rmQ(b){if($('#qs').children.length<2)return toast('Нужен хотя бы один вопрос');b.closest('.qb').remove();num()}
function num(){[...$('#qs').children].forEach((b,i)=>b.querySelector('h3').textContent='Вопрос '+(i+1))}
async function save(){
  const er=$('#er');er.textContent='';const title=$('#t').value.trim();
  if(title.length<1){er.textContent='Введите название.';return}
  const questions=[];
  for(const [i,b] of [...$('#qs').children].entries()){
    const text=b.querySelector('.qt').value.trim(),all=[...b.querySelectorAll('.qo')].map(o=>o.value.trim());
    const cor=+b.querySelector('input[type=radio]:checked').value;
    const image=b.querySelector('.qi').dataset.u||'',oimg=[...b.querySelectorAll('.opt')].map(d=>d.querySelector('.oi').dataset.u||''),has=k=>all[k]||oimg[k];
    if(!text&&!image){er.textContent=`Вопрос ${i+1}: введите текст или добавьте фото.`;return}
    if(!has(0)||!has(1)){er.textContent=`Вопрос ${i+1}: заполните хотя бы первые два варианта.`;return}
    if(!has(cor)){er.textContent=`Вопрос ${i+1}: отмеченный правильный вариант пуст.`;return}
    const opts=[],oi=[],map={};all.forEach((o,k)=>{if(has(k)){map[k]=opts.length;opts.push(o);oi.push(oimg[k])}});
    questions.push({text,image,options:opts,optImages:oi,correct:map[cor],explain:b.querySelector('.qe')?.value.trim()||''});
  }
  $('#sv').disabled=true;
  try{
    const body=JSON.stringify({title,description:$('#d').value,category:$('#c').value,timeLimit:+$('#tl').value,questions});
    if(EID){await api('/quizzes/'+EID,{method:'PUT',body});toast('Изменения сохранены');location.hash='#/quiz/'+EID;return}
    const r=await api('/quizzes',{method:'POST',body});
    const o=mem.get('owned',{});o[r.id]=r.ownerKey;mem.set('owned',o);
    toast('Квиз опубликован');location.hash='#/quiz/'+r.id;
  }catch(e){er.textContent=e.message;$('#sv').disabled=false}
}
let R;
