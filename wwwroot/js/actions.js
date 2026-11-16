/* ===== Обработчики событий без inline-JS (нужно для CSP без 'unsafe-inline') =====
   В разметке нет inline-обработчиков (атрибутов onclick и подобных): вместо них data-атрибуты, а действия описаны здесь.
   data-go="#/путь"           клик = переход по адресу
   data-act="имя"             клик = ACT[имя](элемент, аргументы, событие)
   data-in / data-ch="имя"    событие input / change = INP[имя] / CHG[имя]
   data-args='[...]'          аргументы в JSON (кладутся функцией A() с экранированием)
   data-kc                    Enter на самой карточке = клик по ней
   data-enter="имя"           Enter в поле = ACT[имя] */
const argsOf=el=>{try{return JSON.parse(el.dataset.args||'[]')}catch{return []}};
const ACT={
  toggleTheme:()=>toggleTheme(), toggleSnd:()=>toggleSnd(),
  goAcc:()=>{location.hash=ME?'#/me':'#/auth'},
  goCreate:()=>{location.hash=isGame()?'#/board-create':'#/create'},
  doAuth:()=>doAuth(), toggleAM:()=>{AM=AM=='login'?'reg':'login';viewAuth()},
  copyLink:()=>copyLink(), toAll:()=>toAll(), changePass:()=>changePass(), logout:()=>logout(),
  randomPick:(_,a)=>randomPick(a[0]),
  // админка
  sendScare:(_,a)=>sendScare(a[0]), adminDel:(_,a)=>adminDel(a[0],a[1]), repClose:(_,a)=>repClose(a[0]),
  banUser:(_,a)=>banUser(a[0]), unbanUser:(_,a)=>unbanUser(a[0]), makeAdmin:(_,a)=>makeAdmin(a[0]),
  claimAdmin:()=>claimAdmin(),
  // своя игра: редактор
  addCat:()=>addCat(), saveBoard:()=>saveBoard(), rmCat:(_,a)=>rmCat(a[0]), rmCell:(_,a)=>rmCell(a[0],a[1]), addCell:(_,a)=>addCell(a[0]),
  startGame:(_,a)=>startGame(a[0],a[1]),
  // своя игра: ведущий
  openCell:(_,a)=>openCell(a[0],a[1]), toggleBuzz:()=>toggleBuzz(), showStandings:()=>showStandings(), resetGame:()=>resetGame(),
  runTimer:()=>runTimer(), revealJ:()=>revealJ(), award:(_,a)=>award(a[0],a[1]), closeJ:(_,a)=>closeJ(a[0]),
  buzz:(_,a)=>buzz(a[0]), judge:(_,a)=>judge(a[0]), buzzReset:()=>buzzReset(),
  hideJm:()=>{$('#jm').hidden=true},
  // каталог и квиз
  fav:(_,a,e)=>FAV.tog(a[0],e), carGo:(el,a)=>carGo(el,a[0]),
  setCat:(_,a)=>{F.cat=a[0];SHOWN=24;chips();grid()}, more:()=>{SHOWN+=24;grid()},
  startQuiz:(_,a)=>{mem.set('name',$('#nm').value.trim());location.hash='#/play/'+a[0]},
  reportQuiz:(_,a)=>reportQuiz(a[0]), del:(_,a)=>del(a[0],a[1]),
  // редактор квиза
  importQ:()=>importQ(), addQ:()=>addQ(), addTF:()=>addQ(true), save:()=>save(), rmQ:el=>rmQ(el), pickImg:el=>pickImg(el),
  // игра
  answer:(_,a)=>answer(a[0]), useHint:()=>useHint(), finish:()=>finish(), loadQ:()=>loadQ(), shareScore:()=>copyText(window.SHARE),
  // IQ-тест, рейтинг
  iqStart:()=>iqStart(), iqPick:(el,a)=>iqPick(a[0],el),
  iqShare:(_,a)=>copyText(`Мой условный IQ в LarpQuizov: ~${a[0]} (${a[1]}/${a[2]}). Сможешь лучше? `+location.origin+'/#/iq'),
  ratePeriod:(_,a)=>{RT.period=a[0];drawRating()}, rateCat:el=>{RT.category=el.dataset.c;drawRating()}
};
const INP={
  beTitle:el=>{BE.title=el.value},
  beCat:(el,a)=>{BE.cats[a[0]].name=el.value},
  beCell:(el,a)=>{BE.cats[a[0]].cells[a[1]][a[2]]=a[2]=='p'?+el.value:el.value},
  search:el=>onSearch(el.value)
};
const CHG={
  teamInputs:()=>teamInputs(),
  teamName:(el,a)=>{G.teams[a[0]].name=el.value;saveG()},
  teamScore:(el,a)=>{G.teams[a[0]].score=+el.value||0;saveG()},
  setSort:el=>{F.sort=el.value;grid()},
  setMode:el=>mem.set('mode',el.value)
};
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act],[data-go]');if(!el)return; // берётся самый вложенный элемент, как и при stopPropagation
  if(el.dataset.go){location.hash=el.dataset.go;return}
  const f=ACT[el.dataset.act];if(f)f(el,argsOf(el),e);
});
document.addEventListener('input',e=>{const el=e.target.closest('[data-in]');if(el&&INP[el.dataset.in])INP[el.dataset.in](el,argsOf(el),e)});
document.addEventListener('change',e=>{const el=e.target.closest('[data-ch]');if(el&&CHG[el.dataset.ch])CHG[el.dataset.ch](el,argsOf(el),e)});
document.addEventListener('keydown',e=>{
  if(e.key!='Enter')return;
  const k=e.target.closest('[data-kc]');if(k&&e.target===k){k.click();return}
  const n=e.target.closest('[data-enter]');if(n&&ACT[n.dataset.enter])ACT[n.dataset.enter](n,[],e);
});
