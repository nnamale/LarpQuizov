const updAuth=()=>{$('#au').textContent=ME?ME.name:'Войти';$('#au').classList.toggle('alt',!ME)};
async function loadMe(){
  try{ME=await api('/me');ME.mine=[...ME.quizzes,...ME.boards].map(x=>x.id)}catch{ME=null}
  updAuth();
}
function pickImg(btn){
  const im=btn.parentElement.querySelector('img');
  if(im.dataset.u){im.hidden=true;delete im.dataset.u;btn.textContent=btn.dataset.t;return} // фото уже есть: кнопка «Убрать»
  btn.dataset.t=btn.dataset.t||btn.textContent;
  const f=document.createElement('input');f.type='file';f.accept='image/*';
  f.onchange=async()=>{
    const file=f.files[0];if(!file)return;
    try{
      const bmp=await createImageBitmap(file),k=Math.min(1,800/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');
      c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(bmp,0,0,c.width,c.height);
      const r=await api('/upload',{method:'POST',body:JSON.stringify({data:c.toDataURL('image/jpeg',.8)})});
      im.src=r.url;im.dataset.u=r.url;im.hidden=false;btn.textContent='Убрать';
    }catch(e){toast(e.message||'Не удалось загрузить фото')}
  };f.click();
}
async function changePass(){
  const o=prompt('Старый пароль');if(!o)return;const n=prompt('Новый пароль (от 8 символов, буквы и цифры)');if(!n)return;
  try{await api('/password',{method:'POST',body:JSON.stringify({oldPassword:o,newPassword:n})});toast('Пароль изменён')}catch(e){toast(e.message)}
}
let AM='login';
function viewAuth(){
  app(`<div class="panel" style="max-width:460px;margin:0 auto"><h2>${AM=='login'?'Вход':'Регистрация'}</h2>
  <label for="an">Имя</label><input type="text" id="an" autocomplete="username">
  <label for="ap">Пароль</label><input type="password" id="ap" autocomplete="${AM=='login'?'current-password':'new-password'}" data-enter="doAuth">
  <div class="row"><button class="btn" data-act="doAuth">${AM=='login'?'Войти':'Создать аккаунт'}</button>
  <button class="btn alt" data-act="toggleAM">${AM=='login'?'Нет аккаунта?':'Уже есть аккаунт'}</button></div>
  <p class="err" id="er" role="alert"></p><p class="mut">Вход нужен только чтобы создавать квизы и игры. Играть можно без аккаунта. Пароль от 8 символов, буквы и цифры.</p></div>`);
}
async function doAuth(){
  try{
    const r=await api(AM=='login'?'/login':'/register',{method:'POST',body:JSON.stringify({name:$('#an').value,password:$('#ap').value})});
    mem.set('name',r.name);await loadMe();toast('Привет, '+r.name);location.hash=AFTER||'#/me';AFTER='';
  }catch(e){$('#er').textContent=e.message}
}
async function logout(){try{await api('/logout',{method:'POST'})}catch{}ME=null;updAuth();location.hash='#/'}
