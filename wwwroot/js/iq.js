/* ===== IQ-тест: 20 вопросов (числа, слова, логика), ~15 минут. Развлекательный, не клинический ===== */
const IQQ=[
['Продолжите ряд: 2, 4, 8, 16, ?',['24','30','32','36'],2],
['Продолжите ряд: 3, 6, 11, 18, 27, ?',['36','38','40','45'],1],
['Продолжите ряд: 1, 1, 2, 3, 5, 8, ?',['11','12','13','15'],2],
['Продолжите ряд: 5, 10, 20, 40, ?',['60','70','80','90'],2],
['Продолжите ряд: 100, 91, 83, 76, ?',['68','69','70','71'],2],
['Продолжите ряд: 2, 3, 5, 7, 11, ?',['12','13','14','15'],1],
['Продолжите ряд: 1, 4, 9, 16, 25, ?',['30','34','36','49'],2],
['Продолжите ряд: 4, 9, 19, 39, ?',['78','79','80','81'],1],
['Книга относится к библиотеке, как картина к …',['художнику','галерее','раме','краске'],1],
['Какое слово лишнее?',['яблоко','груша','морковь','слива'],2],
['Какое слово лишнее?',['Сатурн','Юпитер','Луна','Марс'],2],
['Вода относится к жажде, как еда к …',['повару','голоду','тарелке','вкусу'],1],
['Продолжите: пн, ср, пт, …',['сб','вс','чт','вт'],1],
['Все розы — цветы. Некоторые цветы быстро вянут. Что верно про быстрое увядание роз?',['Розы всегда быстро вянут','Розы никогда быстро не вянут','Из условий этого не следует','Вянут только летом'],2],
['Маша выше Саши, Саша выше Пети. Кто самый низкий?',['Маша','Саша','Петя','Нельзя определить'],2],
['5 станков делают 5 деталей за 5 минут. За сколько минут 100 станков сделают 100 деталей?',['5','20','50','100'],0],
['Площадь кувшинок на озере каждый день удваивается. За 48 дней они покрыли всё озеро. За сколько дней покрыта половина?',['24','46','47','45'],2],
['Какой угол между стрелками часов в 3:15?',['0°','7,5°','15°','22,5°'],1],
['Какое число лишнее: 16, 25, 36, 48, 49?',['16','25','48','49'],2],
['▲ ■ ● ▲ ■ ● ▲ ■ …  Что дальше?',['▲','■','●','◆'],2]];
let IQ=null,iqT=null;
function viewIq(){
  const best=mem.get('iqBest',0);
  app(`<div class="iqw panel"><span class="tag">IQ-тест</span><h1 style="margin:8px 0">Проверьте логику</h1>
  <p class="mut">20 вопросов: числовые ряды, аналогии и логические задачи. На всё даётся 15 минут, вернуться к прошлому вопросу нельзя. Результат считается на вашем устройстве.</p>
  <p class="note">Это развлекательный тест. Он не заменяет профессиональное психометрическое тестирование, а баллы условные.</p>
  ${best?`<p style="margin:10px 0"><span class="rec">Ваш лучший результат: ~${best}</span></p>`:''}
  <div class="row"><button class="btn lg" data-act="iqStart">Начать тест</button></div></div>`);
}
function iqStart(){
  IQ={i:0,ok:0,t0:Date.now(),lim:15*60*1000,log:[]};
  iqT=setInterval(()=>{const left=IQ.lim-(Date.now()-IQ.t0),e=$('#iqt');if(e){const s=Math.max(0,Math.ceil(left/1000));e.textContent=Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}if(left<=0)iqEnd()},500);
  iqShow();
}
function iqShow(){
  const [q,o]=IQQ[IQ.i];IQ.map=shuffle(o.map((_,k)=>k));
  app(`<div class="iqw panel"><div class="hud"><span class="pill">Вопрос ${IQ.i+1} / ${IQQ.length}</span><span class="pill" id="iqt">15:00</span></div>
  <div class="prog"><i style="width:${IQ.i/IQQ.length*100}%"></i></div><p class="iqq">${esc(q)}</p>
  ${IQ.map.map(k=>`<button class="iqo" data-act="iqPick" data-args="${A(k)}">${esc(o[k])}</button>`).join('')}</div>`);
}
function iqPick(k,b){
  const [,,a]=IQQ[IQ.i];if(k==a)IQ.ok++;IQ.log.push(k==a);
  document.querySelectorAll('.iqo').forEach(x=>{x.disabled=true});b.classList.add('sel');
  setTimeout(()=>{IQ.i++;IQ.i>=IQQ.length?iqEnd():iqShow()},220);
}
function iqEnd(){
  clearInterval(iqT);if(!IQ)return;const raw=IQ.ok,n=IQQ.length,score=Math.round(70+raw/n*60),secs=Math.round((Date.now()-IQ.t0)/1000);
  const lvl=score>=120?'Очень высокий результат':score>=108?'Выше среднего':score>=92?'Средний уровень':'Есть куда расти';
  if(score>(mem.get('iqBest',0)))mem.set('iqBest',score);
  if(score>=108)confetti();
  app(`<div class="iqw panel" style="text-align:center"><span class="tag">Результат</span><div class="gauge">~${score}</div><h2>${lvl}</h2>
  <p class="mut" style="margin:8px 0">Верно ${raw} из ${n} · ${Math.floor(secs/60)} мин ${secs%60} с</p>
  <p class="note">Условная шкала: 70–130. Тест короткий, поэтому точность невысокая.</p>
  <div class="row" style="justify-content:center"><button class="btn" data-act="iqStart">Пройти ещё раз</button><button class="btn alt" data-act="iqShare" data-args="${A(score,raw,n)}">Поделиться</button><button class="btn alt" data-go="#/">Все квизы</button></div></div>`);
  IQ=null;
}
