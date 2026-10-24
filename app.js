// ---- tiny IndexedDB store ----
const DB=new Promise((res,rej)=>{const r=indexedDB.open('sourdough',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('recipes',{keyPath:'id'});const b=d.createObjectStore('bakes',{keyPath:'id'});b.createIndex('recipeId','recipeId')};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const tx=async(s,m='readonly')=>(await DB).transaction(s,m).objectStore(s);
const P=r=>new Promise((a,b)=>{r.onsuccess=()=>a(r.result);r.onerror=()=>b(r.error)});
const all=async s=>P((await tx(s)).getAll()),get=async(s,id)=>P((await tx(s)).get(id)),put=async(s,v)=>P((await tx(s,'readwrite')).put(v)),del=async(s,id)=>P((await tx(s,'readwrite')).delete(id));
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const $=s=>document.querySelector(s),app=$('#app'),esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmtDate=d=>d?new Date(d+'T12:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'';
const today=()=>new Date().toISOString().slice(0,10);
// ---- photos: compress on device ----
function compress(file,max=1280,q=.75){return new Promise(res=>{const img=new Image();img.onload=()=>{const s=Math.min(1,max/Math.max(img.width,img.height));const c=document.createElement('canvas');c.width=img.width*s;c.height=img.height*s;c.getContext('2d').drawImage(img,0,0,c.width,c.height);URL.revokeObjectURL(img.src);res(c.toDataURL('image/jpeg',q))};img.src=URL.createObjectURL(file)})}
function photoPicker(onAdd){const w=document.createElement('div');w.className='grid2';w.innerHTML=`<label class="btn alt" style="margin:0;text-align:center">📷 Camera<input type="file" accept="image/*" capture="environment" hidden></label><label class="btn alt" style="margin:0;text-align:center">🖼️ Photos<input type="file" accept="image/*" multiple hidden></label>`;w.querySelectorAll('input').forEach(i=>i.onchange=async()=>{for(const f of i.files)onAdd(await compress(f));i.value=''});return w}
const showImg=src=>{$('#viewerImg').src=src;$('#viewer').classList.remove('hidden')};$('#viewer').onclick=()=>$('#viewer').classList.add('hidden');
// ---- wake lock ----
let lock=null;async function setWake(on){try{if(on){lock=await navigator.wakeLock.request('screen')}else{await lock?.release();lock=null}}catch(e){alert('Keep-awake is not supported on this device/browser.');return false}return true}
document.addEventListener('visibilitychange',()=>{if(lock&&document.visibilityState==='visible')setWake(true)});
// ---- routing ----
const go=h=>{location.hash=h};window.onhashchange=render;
$('#back').onclick=()=>history.length>1?history.back():go('');
function header(t,back){$('#title').textContent=t;$('#back').classList.toggle('hidden',!back)}
async function render(){if(lock&&!location.hash.startsWith('#r/')){setWake(false)}const [v,id,x]=location.hash.slice(1).split('/');window.scrollTo(0,0);
 if(v==='r')return viewRecipe(id);if(v==='e')return editRecipe(id);if(v==='b')return editBake(id,x);return list()}
// ---- list ----
async function lastBakes(){const m={};for(const b of await all('bakes'))if(!m[b.recipeId]||b.date>m[b.recipeId])m[b.recipeId]=b.date;return m}
async function list(){header('🍞 Sourdough Notebook');const rs=await all('recipes'),lb=await lastBakes();
 app.innerHTML=`<input id="q" type="search" placeholder="🔍 Search recipes…" value="${esc(sessionStorage.q||'')}"><button class="btn wide" id="add">＋ New recipe</button><div id="cards"></div>`;
 const draw=()=>{const q=($('#q').value||'').toLowerCase();sessionStorage.q=q;const f=rs.filter(r=>(r.name+' '+(r.notes||'')+' '+(r.ingredients||[]).map(i=>i.item).join(' ')).toLowerCase().includes(q)).sort((a,b)=>(b.fav-a.fav)||((lb[b.id]||'').localeCompare(lb[a.id]||''))||a.name.localeCompare(b.name));
  $('#cards').innerHTML=f.length?f.map(r=>`<div class="card" data-id="${r.id}">${r.photo?`<img class="thumb" src="${r.photo}" alt="">`:'<div class="thumb">🥖</div>'}<div><h2>${esc(r.name||'Untitled')}</h2><div class="muted">${lb[r.id]?'Last baked '+fmtDate(lb[r.id]):'Not baked yet'}</div></div><button class="star" data-fav="${r.id}" aria-label="Favorite">${r.fav?'★':'☆'}</button></div>`).join(''):`<div class="empty muted">${rs.length?'No matches.':'No recipes yet.<br>Tap “New recipe” to add your first loaf!'}</div>`;
  $('#cards').querySelectorAll('.card').forEach(c=>c.onclick=e=>{const fv=e.target.dataset.fav;if(fv){const r=rs.find(r=>r.id===fv);r.fav=r.fav?0:1;put('recipes',r);draw()}else go('r/'+c.dataset.id)})};
 $('#q').oninput=draw;$('#add').onclick=async()=>{const r={id:uid(),name:'',photo:'',ingredients:[{amount:'',unit:'g',item:''}],steps:[''],totalTime:'',notes:'',fav:0,created:Date.now()};await put('recipes',r);go('e/'+r.id)};draw()}
// ---- view recipe ----
async function viewRecipe(id){const r=await get('recipes',id);if(!r)return go('');header(r.name||'Recipe',1);
 const bakes=(await all('bakes')).filter(b=>b.recipeId===id).sort((a,b)=>b.date.localeCompare(a.date)||b.created-a.created);
 app.innerHTML=`${r.photo?`<img class="hero" src="${r.photo}" data-full>`:''}
 <label class="toggle"><input type="checkbox" id="wake" ${lock?'checked':''}> ☀️ Keep screen awake</label>
 <div class="grid2"><button class="btn" id="log">＋ Log a bake</button><button class="btn alt" id="edit">✏️ Edit recipe</button></div>
 ${r.totalTime?`<p><b>Total time:</b> ${esc(r.totalTime)}</p>`:''}
 <h2>Ingredients</h2><ul>${(r.ingredients||[]).filter(i=>i.item||i.amount).map(i=>`<li><b>${esc(i.amount)} ${esc(i.unit)}</b> ${esc(i.item)}</li>`).join('')||'<li class="muted">None yet</li>'}</ul>
 <h2>Steps</h2><ol>${(r.steps||[]).filter(Boolean).map(s=>`<li>${esc(s)}</li>`).join('')||'<li class="muted">None yet</li>'}</ol>
 ${r.notes?`<h2>Notes</h2><p style="white-space:pre-wrap">${esc(r.notes)}</p>`:''}
 <h2>Bake log (${bakes.length})</h2>${bakes.map(b=>`<div class="bake" data-b="${b.id}"><b>${fmtDate(b.date)}</b> <span style="color:var(--accent)">${'★'.repeat(b.rating||0)}${'☆'.repeat(5-(b.rating||0))}</span>
 ${b.tweaks?`<div><b>Tweaks:</b> ${esc(b.tweaks)}</div>`:''}<div class="muted">${[['Feed',b.feed],['Bulk',b.bulk],['Shape',b.shape],['Proof',b.proof],['Bake',[b.bakeTemp,b.bakeTime].filter(Boolean).join(' / ')]].filter(x=>x[1]).map(x=>x[0]+': '+esc(x[1])).join(' · ')}</div>
 ${b.comments?`<div style="white-space:pre-wrap">${esc(b.comments)}</div>`:''}<div class="photos">${(b.photos||[]).map(p=>`<img src="${p}" data-full>`).join('')}</div><button class="btn alt" style="margin-top:8px;min-height:40px;padding:8px 14px" data-eb="${b.id}">Edit</button></div>`).join('')||'<p class="muted">No bakes logged yet.</p>'}
 <button class="btn alt wide" id="delr" style="background:#f4d4c4">🗑️ Delete recipe</button>`;
 app.querySelectorAll('[data-full]').forEach(i=>i.onclick=()=>showImg(i.src));
 app.querySelectorAll('[data-eb]').forEach(b=>b.onclick=()=>go('b/'+id+'/'+b.dataset.eb));
 $('#wake').onchange=async e=>{if(!await setWake(e.target.checked))e.target.checked=false};
 $('#log').onclick=()=>go('b/'+id+'/new');$('#edit').onclick=()=>go('e/'+id);
 $('#delr').onclick=async()=>{if(!confirm('Delete this recipe and all its bakes?'))return;for(const b of bakes)await del('bakes',b.id);await del('recipes',id);go('')}}
// ---- autosave helper ----
function autosaver(store,obj){let t;const s=$('#saved');return()=>{clearTimeout(t);s&&(s.textContent='Saving…');t=setTimeout(async()=>{await put(store,obj);s&&(s.textContent='✓ Saved')},400)}}
// ---- edit recipe ----
async function editRecipe(id){const r=await get('recipes',id);if(!r)return go('');header('Edit recipe',1);
 app.innerHTML=`<div class="saved" id="saved">Changes save automatically</div><label>Recipe name</label><input id="name" value="${esc(r.name)}" placeholder="e.g. Country loaf">
 <label>Photo</label><div id="ph"></div><label>Ingredients</label><div id="ings"></div><button class="btn alt" id="addIng">＋ Ingredient</button>
 <label>Steps</label><div id="steps"></div><button class="btn alt" id="addStep">＋ Step</button>
 <label>Total time</label><input id="tt" value="${esc(r.totalTime)}" placeholder="e.g. 24 hours">
 <label>Notes</label><textarea id="notes">${esc(r.notes)}</textarea><button class="btn wide" id="done">Done</button>`;
 const save=autosaver('recipes',r);
 const drawPh=()=>{$('#ph').innerHTML=r.photo?`<img class="hero" src="${r.photo}"><button class="btn alt wide" id="rmph">Remove photo</button>`:'';if(r.photo)$('#rmph').onclick=()=>{r.photo='';save();drawPh()};$('#ph').append(photoPicker(p=>{r.photo=p;save();drawPh()}))};drawPh();
 const units=['g','kg','ml','L','tsp','tbsp','cup','oz','lb','pinch','%'];
 const drawIng=()=>{$('#ings').innerHTML=r.ingredients.map((i,n)=>`<div class="row"><input inputmode="decimal" data-n="${n}" data-k="amount" value="${esc(i.amount)}" placeholder="500"><select data-n="${n}" data-k="unit">${units.map(u=>`<option ${u===i.unit?'selected':''}>${u}</option>`).join('')}</select><input data-n="${n}" data-k="item" value="${esc(i.item)}" placeholder="bread flour"><button data-rm="${n}" aria-label="Remove">✕</button></div>`).join('');
  $('#ings').querySelectorAll('[data-k]').forEach(e=>e.oninput=()=>{r.ingredients[e.dataset.n][e.dataset.k]=e.value;save()});$('#ings').querySelectorAll('[data-rm]').forEach(b=>b.onclick=()=>{r.ingredients.splice(b.dataset.rm,1);save();drawIng()})};
 const drawSteps=()=>{$('#steps').innerHTML=r.steps.map((s,n)=>`<div style="display:flex;gap:6px;margin:6px 0;align-items:flex-start"><b style="padding-top:12px;min-width:24px">${n+1}.</b><textarea style="min-height:60px" data-s="${n}">${esc(s)}</textarea><button class="del" data-rs="${n}">✕</button></div>`).join('');
  $('#steps').querySelectorAll('[data-s]').forEach(e=>e.oninput=()=>{r.steps[e.dataset.s]=e.value;save()});$('#steps').querySelectorAll('[data-rs]').forEach(b=>b.onclick=()=>{r.steps.splice(b.dataset.rs,1);save();drawSteps()})};
 drawIng();drawSteps();$('#addIng').onclick=()=>{r.ingredients.push({amount:'',unit:'g',item:''});drawIng();save()};$('#addStep').onclick=()=>{r.steps.push('');drawSteps();save()};
 $('#name').oninput=e=>{r.name=e.target.value;save()};$('#tt').oninput=e=>{r.totalTime=e.target.value;save()};$('#notes').oninput=e=>{r.notes=e.target.value;save()};
 $('#done').onclick=async()=>{await put('recipes',r);location.replace('#r/'+id)}}
// ---- edit bake ----
async function editBake(rid,bid){const r=await get('recipes',rid);if(!r)return go('');let b=bid!=='new'&&await get('bakes',bid);
 if(!b){b={id:uid(),recipeId:rid,date:today(),photos:[],tweaks:'',feed:'',bulk:'',shape:'',proof:'',bakeTemp:'',bakeTime:'',rating:0,comments:'',created:Date.now()};await put('bakes',b);history.replaceState(null,'','#b/'+rid+'/'+b.id)}
 header('Bake: '+(r.name||'Recipe'),1);const f=(k,l,p)=>`<div><label>${l}</label><input data-k="${k}" value="${esc(b[k])}" placeholder="${p}"></div>`;
 app.innerHTML=`<div class="saved" id="saved">Changes save automatically</div><label>Date</label><input type="date" data-k="date" value="${b.date}">
 <label>Photos</label><div class="photos" id="bp"></div><div id="pp" style="margin-top:8px"></div>
 <label>Tweaks this time</label><textarea data-k="tweaks" placeholder="e.g. 80% hydration, added rye">${esc(b.tweaks)}</textarea>
 <div class="grid2">${f('feed','Feed','8:00am')}${f('bulk','Bulk','5 hrs')}${f('shape','Shape','2:00pm')}${f('proof','Proof','overnight fridge')}${f('bakeTemp','Bake temp','475°F')}${f('bakeTime','Bake time','20+25 min')}</div>
 <label>Rating</label><div class="rate" id="rate"></div><label>Comments & feedback</label><textarea data-k="comments" placeholder="Crumb, crust, taste, what the family said…">${esc(b.comments)}</textarea>
 <button class="btn wide" id="done">Done</button><button class="btn alt wide" id="delb" style="background:#f4d4c4">🗑️ Delete this bake</button>`;
 const save=autosaver('bakes',b);app.querySelectorAll('[data-k]').forEach(e=>e.oninput=()=>{b[e.dataset.k]=e.value;save()});
 const drawRate=()=>{$('#rate').innerHTML=[1,2,3,4,5].map(n=>`<button class="${n<=b.rating?'on':''}" data-r="${n}">★</button>`).join('');$('#rate').querySelectorAll('button').forEach(x=>x.onclick=()=>{b.rating=+x.dataset.r===b.rating?0:+x.dataset.r;save();drawRate()})};drawRate();
 const drawP=()=>{$('#bp').innerHTML=b.photos.map((p,n)=>`<div style="position:relative"><img src="${p}" data-n="${n}"><button class="del" style="position:absolute;top:0;right:0;background:#fffc;border-radius:50%" data-x="${n}">✕</button></div>`).join('');$('#bp').querySelectorAll('img').forEach(i=>i.onclick=()=>showImg(i.src));$('#bp').querySelectorAll('[data-x]').forEach(x=>x.onclick=()=>{b.photos.splice(x.dataset.x,1);save();drawP()})};drawP();
 $('#pp').append(photoPicker(p=>{b.photos.push(p);save();drawP()}));
 $('#done').onclick=async()=>{await put('bakes',b);location.replace('#r/'+rid)};$('#delb').onclick=async()=>{if(confirm('Delete this bake?')){await del('bakes',b.id);location.replace('#r/'+rid)}}}
// ---- backup ----
async function doExport(){const data={app:'sourdough-notebook',version:1,exported:new Date().toISOString(),recipes:await all('recipes'),bakes:await all('bakes')};const blob=new Blob([JSON.stringify(data)],{type:'application/json'});const name=`sourdough-backup-${today()}.json`;const file=new File([blob],name,{type:'application/json'});
 if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'Sourdough backup'});localStorage.lastBackup=Date.now();return}catch(e){if(e.name==='AbortError')return}}
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();localStorage.lastBackup=Date.now()}
const menu=$('#backupMenu');$('#menu').onclick=e=>{e.stopPropagation();const l=+localStorage.lastBackup;$('#lastBk').textContent=l?'Last backup: '+new Date(l).toLocaleDateString():'No backup yet';menu.classList.toggle('hidden')};
document.addEventListener('click',e=>{if(!menu.contains(e.target))menu.classList.add('hidden')});
$('#exportBtn').onclick=()=>{menu.classList.add('hidden');doExport()};$('#importBtn').onclick=()=>{menu.classList.add('hidden');$('#importFile').click()};
$('#importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{const d=JSON.parse(await f.text());if(d.app!=='sourdough-notebook')throw 0;if(!confirm(`Import ${d.recipes.length} recipes and ${d.bakes.length} bakes? Matching items will be replaced.`))return;for(const r of d.recipes)await put('recipes',r);for(const b of d.bakes)await put('bakes',b);alert('Imported!');render()}catch{alert('That file is not a Sourdough Notebook backup.')}e.target.value=''};
// monthly backup reminder
(async()=>{const n=(await all('recipes')).length,l=+localStorage.lastBackup||0;if(n&&Date.now()-l>30*864e5&&Date.now()-(+localStorage.nag||0)>7*864e5){localStorage.nag=Date.now();setTimeout(()=>alert('Friendly reminder: tap ⋯ (top right) to save a backup of your notebook.'),1500)}})();
navigator.storage?.persist?.();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
render();
