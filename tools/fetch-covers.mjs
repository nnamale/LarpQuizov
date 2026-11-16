// Скачивает настоящие фото-обложки с Wikimedia Commons в wwwroot/covers/quiz-ID.jpg (нужен Node 18+ и интернет).
// Запуск: node tools/fetch-covers.mjs   (уже скачанные пропускаются; чтобы заменить фото, удалите файл)
// После этого сайт берёт фото с вашего диска и не зависит от интернета. Авторы и лицензии пишутся в covers/CREDITS.txt
import { writeFile, appendFile, access } from 'node:fs/promises';
const Q = {geo001:'world map',game001:'video game arcade',math001:'mathematics blackboard',space01:'galaxy nebula',film001:'cinema film projector',prog002:'computer code screen',mus001:'concert stage lights',flag001:'flags of nations',py0001:'python programming',iq0001:'chess puzzle',food001:'food market',csharp01:'computer keyboard',gen001:'library books',sci001:'laboratory',lit001:'old books',hist01:'ancient ruins',web00001:'web design',body01:'human skeleton anatomy',sport01:'football stadium',myth01:'greek temple',pc0001:'computer motherboard',anim001:'wildlife animals',logic02:'chess board',anime01:'tokyo street',cap001:'city skyline',cartoon1:'toys',math002:'abacus',phys001:'physics experiment',chem001:'chemistry glassware',bio001:'microscope',rus001:'cyrillic alphabet',eng001:'london street',hist02:'ancient history museum',art001:'painting museum',tech001:'server room',js00001:'javascript code',sql0001:'data center',game002:'video game console',inv001:'steam engine',nat001:'mountain lake',flag002:'flags'};
const API = 'https://commons.wikimedia.org/w/api.php';
for (const [id, term] of Object.entries(Q)) {
  const file = new URL(`../wwwroot/covers/quiz-${id}.jpg`, import.meta.url);
  try { await access(file); console.log('есть', id); continue; } catch {}
  try {
    const u = `${API}?action=query&generator=search&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=1200&format=json&gsrsearch=${encodeURIComponent('filetype:bitmap ' + term)}`;
    const d = await (await fetch(u, { headers: { 'User-Agent': 'LarpQuizov/8 (school project)' } })).json();
    const ps = Object.values(d.query?.pages || {}).sort((a, b) => a.index - b.index);
    const hit = ps.map(p => ({ t: p.title, i: p.imageinfo?.[0] })).find(x => x.i && x.i.mime === 'image/jpeg' && x.i.width >= 1000 && x.i.width / x.i.height > 1.25 && x.i.width / x.i.height < 2.2 && x.i.thumburl);
    if (!hit) { console.log('нет фото', id); continue; }
    const r = await fetch(hit.i.thumburl, { headers: { 'User-Agent': 'LarpQuizov/8 (school project)' } });
    if (!r.ok) throw new Error(r.status);
    await writeFile(file, Buffer.from(await r.arrayBuffer()));
    const m = hit.i.extmetadata || {};
    await appendFile(new URL('../wwwroot/covers/CREDITS.txt', import.meta.url), `quiz-${id}.jpg | ${hit.t} | ${(m.Artist?.value || '').replace(/<[^>]*>/g, '')} | ${m.LicenseShortName?.value || ''}\n`);
    console.log('ok', id, hit.t);
  } catch (e) { console.log('ошибка', id, e.message); }
}
