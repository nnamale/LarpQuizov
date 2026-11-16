/* Настоящие фото для обложек: ищем на Wikimedia Commons (свободные лицензии), результат кэшируется в браузере.
   Приоритет: свой файл covers/quiz-ID.jpg -> фото из Commons -> svg-обложка. */
(()=>{
  const Q={geo001:'world map',game001:'video game arcade',math001:'mathematics blackboard',space01:'galaxy nebula',film001:'cinema film projector',prog002:'computer code screen',mus001:'concert stage lights',flag001:'flags of nations',py0001:'python programming',iq0001:'chess puzzle',food001:'food market',csharp01:'computer keyboard',gen001:'library books',sci001:'laboratory',lit001:'old books',hist01:'ancient ruins',web00001:'web design',body01:'human skeleton anatomy',sport01:'football stadium',myth01:'greek temple',pc0001:'computer motherboard',anim001:'wildlife animals',logic02:'chess board',anime01:'tokyo street',cap001:'city skyline',cartoon1:'toys',
    math002:'abacus',phys001:'physics experiment',chem001:'chemistry glassware',bio001:'microscope',rus001:'cyrillic alphabet',eng001:'london street',hist02:'ancient history museum',art001:'painting museum',tech001:'server room',js00001:'javascript code',sql0001:'data center',game002:'video game console',inv001:'steam engine',nat001:'mountain lake',flag002:'flags',
    code:'computer code',general:'library',games:'video game',cinema:'cinema',science:'laboratory',history:'ancient ruins',geo:'landscape mountains',iq:'chess',other:'architecture'};
  // Визуальные подсказки к готовым вопросам. Пустые и абстрактные вопросы
  // намеренно остаются без фото, чтобы картинка не отвлекала от задания.
  const QP={
    gen001:['Earth from space','Mercury planet surface','Canberra Parliament House','Earth atmosphere clouds','rainbow over landscape','Pacific Ocean aerial','hexagon architecture'],
    geo001:['Nile river aerial view','Ottawa Parliament buildings','Russia world map','Mount Everest Himalayas','Astana Kazakhstan skyline','Lake Baikal aerial view'],
    hist01:['World War I historical trenches','Yuri Gagarin astronaut portrait','Apollo 11 moon landing','Giza pyramids Egypt','World War II historical memorial','Christopher Columbus sailing ship'],
    sci001:['water molecule model H2O','light beam optics experiment','human skeleton x ray','Saturn planet rings','human heart anatomy model','diamond crystal macro'],
    game001:['Legend of Zelda video game landscape','Minecraft block landscape','yellow electric mouse illustration sculpture','Dota 2 esports arena','Nintendo game console','Minecraft game landscape'],
    film001:['cinema film projector','Queen band concert stage','Titanic ocean liner','Lord of the Rings fantasy landscape','aquarium clownfish','classical acoustic guitar'],
    anim001:['cheetah running wildlife','octopus underwater','blue whale ocean','kangaroo in Australia','penguin colony','spider macro photography'],
    space01:['solar system planets model','Jupiter planet closeup','Milky Way galaxy night sky','Mars planet surface','Earth Moon from space','Apollo astronauts on Moon','Sun solar photograph','Sputnik 1 satellite'],
    cap001:['Tokyo skyline Japan','Brasilia architecture aerial','Ankara city skyline','Cairo city skyline','Bern old town Switzerland','Seoul skyline South Korea','Wellington New Zealand harbor','Oslo Norway waterfront'],
    food001:['Italian pizza margherita','Japanese sushi platter','fresh avocado cut in half','Ethiopian coffee ceremony','tiramisu dessert','Greek salad feta cheese','hummus chickpea bowl','saffron crocus flowers'],
    sport01:['football soccer stadium match','ice hockey puck on ice','Olympic rings flag','Rio de Janeiro Maracana stadium','basketball hoop court','football soccer pitch','tennis court grass','2018 FIFA World Cup stadium'],
    mus001:['musical notes sheet music','grand piano keyboard','Ludwig van Beethoven portrait','four musicians playing rock music','Nutcracker ballet stage','orchestra conductor performance','drum kit instrument','jazz trumpet performance'],
    lit001:['Leo Tolstoy War and Peace book','Fyodor Dostoevsky portrait','Alexander Pushkin portrait','old library books fantasy novel','Mikhail Bulgakov portrait','George Orwell 1984 book','Little Prince book illustration','Sherlock Holmes Baker Street museum'],
    myth01:['Zeus ancient Greek statue','Thor Norse mythology statue','Poseidon Greek statue','Athena goddess statue','Anubis ancient Egyptian statue','phoenix mythological bird art','Theseus Minotaur Greek sculpture','Achilles ancient Greek statue'],
    body01:['human heart anatomical model','human lungs anatomy model','human skin anatomy illustration','human teeth dental model','red blood cells microscope','human femur bone anatomy','sunlight vitamin D outdoors','human chromosomes microscope'],
    py0001:['python snake closeup','Python programming code on screen','computer floating point code','programming code editor','Python list programming code','programmer keyboard desk','Python programming language logo','Python code terminal'],
    prog002:['HTML code on screen','CSS web design code','C sharp programming code','git version control terminal','404 error web page display','computer binary boolean code'],
    pc0001:['computer CPU processor closeup','RAM memory module computer','binary data computer memory','web browser on laptop','USB Type C connector','solid state drive SSD','network IP router','graphics card GPU closeup'],
    phys001:['laser optics physics experiment','Isaac Newton portrait','gravity physics pendulum','boiling water kettle science','sound frequency waveform','rainbow spectrum physics','barometer instrument','outer space vacuum stars','Ohms law electric circuit','Earth planet from space'],
    chem001:['sodium element periodic table','water molecule H2O model','oxygen gas laboratory cylinder','hydrogen atom model','salt crystals macro','pH indicator strips','graphite and diamond carbon','liquid mercury metal droplets','Dmitri Mendeleev portrait','iron metal texture'],
    bio001:['mitochondria cell microscope','human chromosomes microscope','human heart anatomy model','photosynthesis green leaf closeup','human skin anatomy','sunlight through forest trees','Gregor Mendel portrait','human skeleton anatomy','red blood cells microscope','dolphin underwater'],
    hist02:['World War I historical trenches','World War II historical memorial','George Washington portrait','Berlin Wall fall 1989','Giza pyramids Egypt','Christopher Columbus sailing ship','French Revolution Bastille painting','Genghis Khan statue','Yuri Gagarin astronaut portrait','Julius Caesar Roman statue'],
    art001:['Mona Lisa painting Louvre','Vincent van Gogh Starry Night painting','Colosseum Rome Italy','Pablo Picasso Guernica painting','Eiffel Tower Paris','Salvador Dali melting clocks painting','Claude Monet impressionist garden painting','Saint Basils Cathedral Moscow','Edvard Munch The Scream painting','Taj Mahal India architecture'],
    tech001:['URL web browser address bar','Bill Gates Paul Allen portrait','HTML web page source code','computer RAM memory module','first iPhone smartphone','Android smartphone device','computer byte binary data','HTTPS padlock browser address bar','cloud data center server racks','Linus Torvalds portrait'],
    js00001:['JavaScript const code editor','JavaScript typeof null code','JavaScript array code editor','strict equality JavaScript code','JavaScript array push method code','JavaScript string concatenation code','JavaScript map array method code','JSON code data display','browser developer console code','JavaScript floating point code'],
    sql0001:['SQL SELECT query computer screen','SQL WHERE query code','SQL ORDER BY query code','SQL count query database','database primary key diagram','SQL JOIN database tables diagram','SQL INSERT query code','database SQL delete statement','SQL database icon','database NULL value diagram'],
    game002:['The Legend of Zelda game scenery','Minecraft block world','Tetris video game screen','Pac-Man arcade game cabinet','Half Life video game','Tomb Raider Lara Croft game','Dota 2 esports tournament','Bowser Super Mario game','Fortnite game scenery','Minecraft creeper character'],
    inv001:['Alexander Graham Bell telephone invention','Alexander Fleming penicillin laboratory','Johannes Gutenberg printing press','Alfred Nobel dynamite inventor','Thomas Edison incandescent light bulb','Rudolf Diesel engine','smallpox vaccination historical painting','Wilhelm Rontgen x ray discovery','Sputnik 1 satellite','Tim Berners Lee World Wide Web'],
    nat001:['giraffe wildlife savanna','cheetah running wildlife','Mount Everest Himalayas','Lake Baikal aerial view','Sahara desert dunes','ostrich wildlife bird','blue whale ocean','spider closeup eight legs','Greenland aerial landscape','Arctic Ocean aerial'],
  };
  const key=(id,cat)=>Q[id]||Q[SLUG[cat]||'other'];
  const mem2={get(k){try{return localStorage.getItem(k)}catch{return null}},set(k,v){try{localStorage.setItem(k,v)}catch{}}};
  const loads=u=>new Promise(r=>{const i=new Image();i.onload=()=>r(true);i.onerror=()=>r(false);i.src=u});
  async function find(term,kind='cover'){
    const k=(kind==='question'?'phq9:':'ph8:')+term,c=mem2.get(k);if(c!==null)return c||null;
    const u='https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=18&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=1000&format=json&origin=*&gsrsearch='+encodeURIComponent('filetype:bitmap '+term);
    try{
      const d=await (await fetch(u,{mode:'cors'})).json();
      const ps=Object.values(d.query?.pages||{}).sort((a,b)=>a.index-b.index);
      const ok=ps.map(p=>p.imageinfo?.[0]).filter(i=>{
        if(!i||i.mime!=='image/jpeg'||!i.thumburl)return false;
        if(kind==='question')return i.width>=650&&i.height>=420&&i.width/i.height>.62&&i.width/i.height<2.3;
        return i.width>=1000&&i.width/i.height>1.25&&i.width/i.height<2.2;
      });
      const url=ok[0]?.thumburl||'';mem2.set(k,url);return url||null;
    }catch{return null}
  }
  const inflight=new Map();
  async function question(id,n){
    const term=QP[id]?.[n];if(!term)return null;
    const key=id+':'+n;if(inflight.has(key))return inflight.get(key);
    const task=find(term,'question').then(async url=>{
      if(url&&/^https:\/\/upload\.wikimedia\.org\//i.test(url)&&await loads(url))return url;
      return null;
    }).finally(()=>inflight.delete(key));
    inflight.set(key,task);return task;
  }
  window.LQPhotos={question};
  let busy=0;const wait=[];
  const pump=()=>{while(busy<3&&wait.length){const f=wait.shift();busy++;f().finally(()=>{busy--;pump()})}};
  async function one(el){
    const id=el.dataset.qid,term=key(id,el.dataset.cat);if(!term)return;
    if(await loads(`/covers/quiz-${id}.jpg`))return; // свой файл уже показан
    const u=await find(term);if(!u||!(await loads(u)))return;
    el.style.backgroundImage=`url("${u}"),${el.style.backgroundImage}`;el.classList.add('ph');
  }
  function scan(){document.querySelectorAll('[data-qid]:not([data-ph])').forEach(el=>{el.dataset.ph='1';wait.push(()=>one(el))});pump()}
  new MutationObserver(scan).observe(document.getElementById('app'),{childList:true,subtree:true});scan();
})();
