
const API='/api', CATS=['Программирование','Общие знания','Игры','Кино и музыка','Наука','История','География','IQ-тест','Другое'];
const TILE=['var(--t0)','var(--t1)','var(--t2)','var(--t3)'], SHAPE=['A','B','C','D'];
const $=s=>document.querySelector(s), app=h=>{$('#app').innerHTML=h};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// A(...args): безопасно кладёт аргументы в атрибут data-args (JSON + экранирование HTML), без JavaScript в разметке
const A=(...a)=>esc(JSON.stringify(a));
const mem={get(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
const shuffle=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const SLUG={'Программирование':'code','Общие знания':'general','Игры':'games','Кино и музыка':'cinema','Наука':'science','История':'history','География':'geo','IQ-тест':'iq','Другое':'other'};
// порядок: свой файл covers/quiz-ID.jpg -> фото из интернета -> svg-запасной вариант
const cov=(c,id)=>{const k=SLUG[c]||'other';return `url(/covers/quiz-${id}.jpg),url(/covers/quiz-${id}.svg),url(/covers/${k}.jpg),url(/covers/${k}.svg)`};
const covB=id=>`url(/covers/board-${id}.jpg),url(/covers/board-${id}.svg),url(/covers/board.jpg),url(/covers/board.svg)`;
const EMO={'Программирование':'💻','Общие знания':'🧠','Игры':'🎮','Кино и музыка':'🎬','Наука':'🔬','История':'📚','География':'🌍','IQ-тест':'🧩','Другое':'✨'};
const ICO={q:'<svg viewBox="0 0 12 12" fill="none" stroke="#0f0f0f" stroke-width="1.8" stroke-linecap="round"><path d="M4 4.2a2 2 0 1 1 2.8 1.8c-.6.3-.8.6-.8 1.2"/><circle cx="6" cy="9.6" r=".3"/></svg>',
 g:'<svg viewBox="0 0 12 12" fill="#0f0f0f"><rect x="1.5" y="1.5" width="4" height="4" rx="1"/><rect x="6.5" y="1.5" width="4" height="4" rx="1"/><rect x="1.5" y="6.5" width="4" height="4" rx="1"/><rect x="6.5" y="6.5" width="4" height="4" rx="1"/></svg>',
 t:'<svg viewBox="0 0 12 12" fill="none" stroke="#0f0f0f" stroke-width="1.8" stroke-linecap="round"><circle cx="6" cy="6" r="4.2"/><path d="M6 3.6V6l1.6 1"/></svg>',
 u:'<svg viewBox="0 0 12 12" fill="#0f0f0f"><circle cx="6" cy="4" r="2.2"/><path d="M1.8 10.6c.3-2.2 2-3.4 4.2-3.4s3.9 1.2 4.2 3.4z"/></svg>'};
const hue=s=>[...s].reduce((h,c)=>(h*31+c.charCodeAt(0))%360,7);
const grad=s=>`linear-gradient(135deg,hsl(${hue(s)} 85% 68%),hsl(${(hue(s)+50)%360} 85% 60%))`;
const plural=(n,w=['вопрос','вопроса','вопросов'])=>{const a=n%10,b=n%100;return a==1&&b!=11?w[0]:a>1&&a<5&&(b<10||b>=20)?w[1]:w[2]};
let ME=null; // вход хранится в HttpOnly-cookie, JS токен не видит
const LOAD='<p class="empty">Загрузка…</p>';
let toastT;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2600)}
async function api(p,o={}){
  let r;try{r=await fetch(API+p,{...o,credentials:'same-origin',headers:{'Content-Type':'application/json',...(o.headers||{})}})}catch{throw new Error('Нет связи с сервером. Проверьте интернет и обновите страницу.')}
  let d=null;try{d=await r.json()}catch{}
  if(!r.ok)throw new Error(d?.error||'Ошибка сервера ('+r.status+')');return d;
}
const fail=e=>{app(`<div class="empty"><h2>Что-то пошло не так</h2><p>${esc(e.message)}</p><p><button class="btn" data-go="#/">На главную</button></p></div>`)};
async function randomPick(kind){try{const r=await api('/'+kind+'/random');location.hash=(kind=='boards'?'#/board/':'#/quiz/')+r.id}catch(e){toast(e.message)}}
const copyLink=()=>navigator.clipboard?.writeText(location.href).then(()=>toast('Ссылка скопирована'),()=>toast('Скопируйте адрес из строки браузера'));


/* ---------- избранное, рекорды, квиз дня ---------- */
const ymd=d=>d.toLocaleDateString('sv'),today=()=>ymd(new Date()),yest=()=>ymd(new Date(Date.now()-864e5));
const FAV={get:()=>mem.get('fav',[]),has:id=>FAV.get().includes(id),
  tog(id,e){e?.stopPropagation();const a=FAV.get(),i=a.indexOf(id);i<0?a.push(id):a.splice(i,1);mem.set('fav',a);toast(i<0?'Добавлено в избранное':'Убрано из избранного');
    if(location.hash.split('/')[1]=='quiz'){const b=document.getElementById('fv');if(b){b.classList.toggle('on',FAV.has(id));b.setAttribute('aria-pressed',FAV.has(id));b.textContent=FAV.has(id)?'★ В избранном':'☆ В избранное'}}else if($('#curated')){curated();grid()}}};
const BEST={get:id=>mem.get('best',{})[id]||0,set(id,p){const b=mem.get('best',{});if(p>(b[id]||0)){b[id]=p;mem.set('best',b);return true}return false}};
const dayNum=()=>Math.floor((Date.now()-new Date().getTimezoneOffset()*6e4)/864e5);
const dailyQuiz=()=>LIST.length?[...LIST].sort((a,b)=>a.id<b.id?-1:1)[dayNum()%LIST.length]:null;
const dStreak=()=>{const d=mem.get('daily',{date:'',streak:0});return d.date==today()||d.date==yest()?d.streak:0};
function dailyDone(){const d=mem.get('daily',{date:'',streak:0});if(d.date==today())return d.streak;const n=d.date==yest()?d.streak+1:1;mem.set('daily',{date:today(),streak:n});return n}
const MODES=[['classic','Классика','Время на ответ, очки за скорость, результат идёт в рейтинг'],['survival','Выживание','3 жизни: играете, пока не ошибётесь трижды. Без рейтинга'],['practice','Тренировка','Без таймера и с пояснениями. Без рейтинга']];
const MODE_NAME={classic:'Классика',survival:'Выживание',practice:'Тренировка'};
function toggleSnd(){mem.set('mute',!mem.get('mute',false));updSnd()}
function updSnd(){const b=$('#snd');if(b)b.textContent='Звук: '+(mem.get('mute',false)?'выкл':'вкл')}
function dailyHtml(){
  const q=dailyQuiz();if(!q)return '';const st2=dStreak(),done=mem.get('daily',{}).date==today();
  return `<div class="dq" tabindex="0" data-go="#/quiz/${q.id}" data-kc>
    <div class="cover" data-qid="${q.id}" data-cat="${esc(q.category)}" style="background-image:${cov(q.category,q.id)}"></div>
    <div class="in"><div class="dqh"><span class="stk y">Квиз дня</span><span class="mono" style="font-size:13px;font-weight:700">${done?'пройден сегодня':'ещё не пройден'} · серия ${st2} дн.</span></div>
    <h3>${esc(q.title)}</h3><div class="st">${q.count} ${plural(q.count)} · ${esc(q.category)}</div><span class="btn">Играть сегодня</span></div></div>`;
}

/* ---------- роутер ---------- */
let timer,jt,pt;
const GAME=['boards','board-create','board','host'];
const PAGES={create:()=>viewCreate(),edit:id=>viewEdit(id),quiz:id=>viewQuiz(id),play:id=>viewPlay(id),boards:()=>viewBoards(),'board-create':()=>viewBoardCreate(),board:id=>viewBoard(id),host:id=>viewHost(id),admin:()=>viewAdmin(),auth:()=>viewAuth(),me:()=>viewMe(),rating:()=>viewRating(),iq:()=>viewIq()};
const isGame=()=>GAME.includes(location.hash.split('/')[1]);
function route(){
  clearInterval(timer);clearInterval(jt);clearInterval(pt);jt=null;JM=null;
  const [,p,id]=location.hash.split('/'),g=GAME.includes(p);
  document.querySelectorAll('.nav').forEach(b=>b.classList.remove('on'));
  ({boards:'n2','board-create':'n2',board:'n2',host:'n2',iq:'n3',rating:'n4'}[p]?$('#'+{boards:'n2','board-create':'n2',board:'n2',host:'n2',iq:'n3',rating:'n4'}[p]):$('#n1')).classList.add('on');
  document.body.classList.remove('menu');
  $('#nb').textContent=g?'Создать игру':'Создать квиз';
  $('main').classList.toggle('wide',p=='host');
  (PAGES[p]?()=>PAGES[p](id):viewCatalog)();
  const m=$('main');m.classList.remove('in');void m.offsetWidth;m.classList.add('in');
  scrollTo(0,0);
}
addEventListener('hashchange',route);


/* тема: светлая / тёмная */
function initTheme(){const t=mem.get('theme',matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.dataset.theme=t;updTheme()}
function toggleTheme(){const t=document.documentElement.dataset.theme=='dark'?'light':'dark';document.documentElement.dataset.theme=t;mem.set('theme',t);updTheme()}
function updTheme(){const b=$('#th');if(b)b.textContent=document.documentElement.dataset.theme=='dark'?'☀':'☾'}
