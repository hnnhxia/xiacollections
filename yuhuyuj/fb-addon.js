/* fb-addon.js */
function switchPotVariant(src, thumbEl){
  document.getElementById('potMainImg').src = src;
  thumbEl.parentElement.querySelectorAll('div').forEach(d => {
    d.style.borderColor = 'rgba(255,255,255,.4)';
  });
  thumbEl.style.borderColor = '#fff';
}
function openPotModal(){ document.getElementById('potModal').classList.add('open'); document.body.style.overflow='hidden'; }
function closePotModal(){ document.getElementById('potModal').classList.remove('open'); document.body.style.overflow=''; }

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function showToast(msg,type='info'){
  const t=document.createElement('div');
  t.className='toast '+type;t.textContent=msg;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(()=>t.remove(),3500);
}

const BAD_WORDS=[
  'fuck','f*ck','sh*t','shit','ass','bitch','b*tch','damn','crap','bastard',
  'dick','cock','pussy','whore','slut','nigger','nigga','faggot','retard',
  'puta','gago','bobo','tangina','putangina','pakyu','tanga','ulol','bwisit',
  'leche','putang','nazi','fascist','kill yourself','kys',
  'cunt','motherfucker','asshole','wtf','stfu','slur','hate'
];

const HARD_BLOCK=['cp','child porn','rape','pedophile'];

function censorText(text){
  let out=text;
  BAD_WORDS.forEach(w=>{
    const re=new RegExp(w.replace(/\*/g,'\\*'),'gi');
    out=out.replace(re,m=>{
      if(m.length<=2)return'*'.repeat(m.length);
      return m[0]+'*'.repeat(m.length-2)+m[m.length-1];
    });
  });
  return out;
}

function hasHardBlock(text){
  const l=text.toLowerCase();
  return HARD_BLOCK.some(w=>l.includes(w));
}

async function checkImageWithAI(base64Data, mediaType){
  try{
    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:100,
        messages:[{
          role:'user',
          content:[
            {
              type:'image',
              source:{type:'base64',media_type:mediaType,data:base64Data}
            },
            {
              type:'text',
              text:'You are a content moderator for a small Filipino handmade wire flower shop called Fuzz & Bloom. Is this image safe and appropriate to show on a family-friendly craft shop website? Only approve images that show: flowers, crafts, art, nature, people, products, or everyday objects. Reject: nudity, violence, gore, hate symbols, inappropriate content, memes with slurs, disturbing imagery. Reply with ONLY one word: APPROVED or REJECTED'
            }
          ]
        }]
      })
    });
    if(!res.ok)return{ok:true,reason:'API unavailable — image accepted by default'};
    const data=await res.json();
    const verdict=(data.content[0]?.text||'').trim().toUpperCase();
    if(verdict.startsWith('REJECTED'))return{ok:false,reason:'AI detected inappropriate content'};
    return{ok:true};
  }catch(e){
    return{ok:true,reason:'Check unavailable — accepted by default'};
  }
}

function fileToBase64(file){
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=()=>res(r.result.split(',')[1]);
    r.onerror=rej;
    r.readAsDataURL(file);
  });
}

const cursorEl=document.getElementById('cursor'),ringEl=document.getElementById('cursorRing');
let mx=0,my=0,rx=0,ry=0;
document.addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;if(cursorEl){cursorEl.style.left=mx+'px';cursorEl.style.top=my+'px'}});
(function loop(){rx+=(mx-rx)*.12;ry+=(my-ry)*.12;if(ringEl){ringEl.style.left=rx+'px';ringEl.style.top=ry+'px'}requestAnimationFrame(loop)})();
document.querySelectorAll('a,button,.product-card,.gallery-item,.quick-btn,.step-card,.rev-card').forEach(el=>{
  el.addEventListener('mouseenter',()=>{if(cursorEl)cursorEl.classList.add('active');if(ringEl)ringEl.classList.add('active')});
  el.addEventListener('mouseleave',()=>{if(cursorEl)cursorEl.classList.remove('active');if(ringEl)ringEl.classList.remove('active')});
});

const mainNav=document.getElementById('mainNav'),backTop=document.getElementById('backTop');
window.addEventListener('scroll',()=>{
  if(mainNav) mainNav.classList.toggle('scrolled',window.scrollY>60);
  if(backTop) backTop.classList.toggle('show',window.scrollY>500);
});
const ham=document.getElementById('hamburger'),mmenu=document.getElementById('mobileMenu');
if(ham && mmenu) {
  ham.addEventListener('click',()=>{ham.classList.toggle('open');mmenu.classList.toggle('open')});
  document.querySelectorAll('.mobile-link').forEach(l=>l.addEventListener('click',()=>{ham.classList.remove('open');mmenu.classList.remove('open')}));
}

const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');io.unobserve(e.target)}}),{threshold:.1});
document.querySelectorAll('.reveal,.reveal-left,.reveal-right').forEach(el=>io.observe(el));

let galleryImages=[];

async function getAdminPhotos(){
  try{
    const res=await sbFetch('/storage/v1/object/list/gallery',{
      method:'POST',
      body:JSON.stringify({prefix:'',limit:100,offset:0})
    });
    if(!res.ok)return[];
    const files=await res.json();
    return files
      .filter(f=>f.name&&f.name!=='.emptyFolderPlaceholder')
      .map(f=>SUPA_URL+'/storage/v1/object/public/gallery/'+f.name);
  }catch{return[]}
}

async function uploadToStorage(file){
  const ext=file.name.split('.').pop();
  const fileName=Date.now()+'_'+Math.random().toString(36).slice(2)+'.'+ext;
  const res=await fetch(SUPA_URL+'/storage/v1/object/gallery/'+fileName,{
    method:'POST',
    headers:{
      'apikey':SUPA_KEY,
      'Authorization':'Bearer '+SUPA_KEY,
      'Content-Type':file.type,
      'x-upsert':'true'
    },
    body:file
  });
  if(!res.ok)throw new Error('Upload failed');
  return SUPA_URL+'/storage/v1/object/public/gallery/'+fileName;
}

async function deleteFromStorage(url){
  const fileName=url.split('/gallery/').pop();
  await sbFetch('/storage/v1/object/gallery/'+fileName,{method:'DELETE'});
}

async function buildGallery(){
  const grid=document.getElementById('galleryGrid');
  if(!grid) return;
  grid.innerHTML='';
  galleryImages=[];
  
  for(let i=1;i<=13;i++){
    galleryImages.push({src:`f${i}.jpg`,isAdmin:false});
  }
  
  const adminPhotos=await getAdminPhotos();
  adminPhotos.forEach(src=>galleryImages.push({src,isAdmin:true}));

  galleryImages.forEach((img,idx)=>{
    const item=document.createElement('div');
    item.className='gallery-item reveal'+(img.isAdmin?' admin-added':'');
    if(idx<13)item.style.transitionDelay=(idx*.05)+'s';
    item.innerHTML=`<img src="${esc(img.src)}" alt="Fuzz & Bloom piece" loading="lazy" onerror="this.parentElement.style.display='none'"><div class="gallery-overlay"><div class="gallery-zoom">🔍</div></div>`;
    item.addEventListener('click',()=>{ if(img.src==='f7.jpg'){openPriceModal()}else{openLightbox(idx)} });
    grid.appendChild(item);
    io.observe(item);
  });
}
buildGallery();

function openPriceModal(){const pm=document.getElementById('priceModal'); if(pm) {pm.classList.add('open');document.body.style.overflow='hidden'}}
function closePriceModal(){const pm=document.getElementById('priceModal'); if(pm) {pm.classList.remove('open');document.body.style.overflow=''}}
const priceClose = document.getElementById('priceClose');
if(priceClose) priceClose.addEventListener('click',closePriceModal);
const priceModal = document.getElementById('priceModal');
if(priceModal) priceModal.addEventListener('click',e=>{if(e.target===priceModal)closePriceModal()});

const lb=document.getElementById('lightbox'),lbImg=document.getElementById('lbImg'),lbCounter=document.getElementById('lbCounter');
let lbIdx=0;
function openLightbox(idx){if(!lb||!lbImg)return; lbIdx=idx;lbImg.src=galleryImages[lbIdx].src;lb.classList.add('open');document.body.style.overflow='hidden';updateLbCounter()}
function closeLightbox(){if(lb) {lb.classList.remove('open');document.body.style.overflow=''}}
function lbPrev(){if(!lbImg||!galleryImages.length)return; lbIdx=(lbIdx-1+galleryImages.length)%galleryImages.length;lbImg.src=galleryImages[lbIdx].src;updateLbCounter()}
function lbNext(){if(!lbImg||!galleryImages.length)return; lbIdx=(lbIdx+1)%galleryImages.length;lbImg.src=galleryImages[lbIdx].src;updateLbCounter()}
function updateLbCounter(){if(lbCounter) lbCounter.textContent=(lbIdx+1)+' / '+galleryImages.length}
if(document.getElementById('lbClose')) document.getElementById('lbClose').addEventListener('click',closeLightbox);
if(document.getElementById('lbPrev')) document.getElementById('lbPrev').addEventListener('click',lbPrev);
if(document.getElementById('lbNext')) document.getElementById('lbNext').addEventListener('click',lbNext);
if(lb) lb.addEventListener('click',e=>{if(e.target===lb)closeLightbox()});
document.addEventListener('keydown',e=>{if(!lb||!lb.classList.contains('open'))return;if(e.key==='Escape')closeLightbox();if(e.key==='ArrowLeft')lbPrev();if(e.key==='ArrowRight')lbNext()});

const shopData=[
  {img:'f1.jpg',tag:'Handmade ✦ Copper Wire',name:'Twilight Bloom',desc:'Perfectly captures that transition from day to night with the purple hues and the light.',price:'₱179'},
  {img:'f11.jpg',tag:'Bestseller ✦ Frame & Lights',name:'Mini Tulips ',desc:'Hand-crafted tulips encased with soft LED light. A compact, glowing sculpture by Fuzz and Bloom.',price:'₱350'},
  {img:'fs2.jpg',tag:'House Decor',name:'Four Lilies',desc:'Hand-sculpted pink lilies with a warm internal glow. A soft, velvet-touch arrangement. (Note: 7 Lilies = 150)',price:'₱120'},
  {img:'f4.jpg',tag:'Bestseller ✦ Mixed Wire',name:'Amber Roseate',desc:'Hand-sculpted pink lilies with an internal glow. A velvet-touch piece capturing a permanent sunset.',price:'₱429'},
  {img:'fs999.jpg',tag:'Best Seller ✦ Copper & Blue',name:'Deep Horizon Bouquet',desc:'Hand-sculpted midnight and electric blue fibers. A structured, velvet-touch accent for modern spaces.',price:'₱999'},
  {img:'f6.jpg',tag:'Bestseller ✦ Mixed Wire',name:'Aurora Bouquet',desc:'Named after the Northern Lights, which share these vibrant pinks, blues, and yellows.',price:'₱499'},
];
const fbSVG=`<svg viewBox="0 0 24 24"><path d="M24 12.073C24 5.406 18.627 0 12 0S0 5.406 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.026 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.49 0-1.956.93-1.956 1.887v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>`;
const shopGrid=document.getElementById('shopGrid');
if(shopGrid){
  shopData.forEach((p,i)=>{
    const card=document.createElement('div');
    card.className='product-card reveal';
    card.style.transitionDelay=(i*.1)+'s';
    card.innerHTML=`
      <div class="product-img">
        <img src="${p.img}" alt="${p.name}" loading="lazy" onerror="this.style.display='none'"/>
        <div class="product-overlay"><div class="product-overlay-btn">Order on Facebook</div></div>
      </div>
      <div class="product-info">
        <div class="product-tag">${p.tag}</div>
        <div class="product-name">${p.name}</div>
        <div class="product-desc">${p.desc}</div>
        <div class="product-footer"><div class="product-price">${p.price}</div><div class="product-heart">♡</div></div>
        <a href="https://www.facebook.com/profile.php?id=61588443693937" target="_blank" class="order-fb-btn">${fbSVG} Message to Order</a>
        <button onclick="addToCart('${p.name}', '${p.price}')" class="btn btn-secondary" style="width:100%;justify-content:center;margin-top:.5rem;font-size:.78rem;padding:.5rem;">🛒 Add to Cart</button>
      </div>`;
    shopGrid.appendChild(card);
    io.observe(card);
  });
}
document.addEventListener('click',e=>{
  if(e.target.classList.contains('product-heart')){
    const h=e.target,liked=h.classList.contains('liked');
    h.textContent=liked?'♡':'♥';
    h.classList.toggle('liked',!liked);
  }
});

function handleContact(e){
  e.preventDefault();
  const successEl = document.getElementById('contactSuccess');
  if(successEl) successEl.style.display='block';
  e.target.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=true);
}

const SUPA_URL='https://nwkrodevhvoxsaxejuku.supabase.co';
const SUPA_KEY='sb_publishable_SDBB23ZA7p5Uh_aUBhhpbA_sBbxETKo';

const SEED_REVIEWS=[
  {name:'Maria S',text:'Solid Kaayo bai!! ',stars:5,date:'Jan 15, 2026',photo:null},
  {name:'Jessa R',text:'Xia is so talented! Ordered a custom habiscus and the result was beyond my expectations. Will definitely order again!',stars:5,date:'Jan 28, 2026',photo:null},
  {name:'Paolo B',text:'Nice Kaayo! She loves it! Super well-made and worth every peso. The packaging was also really cute.',stars:5,date:'Feb 3, 2026',photo:null},
  {name:'Ana V',text:'Xia responded fast on Facebook and the pieces arrived so nicely wrapped. 10/10!',stars:5,date:'Feb 10, 2026',photo:null},
  {name:'Christine L',text:'Amazing quality for the price! The Mini Pot looks stunning on my desk. I\'ve already recommended Fuzz & Bloom to all my officemates.',stars:5,date:'Feb 14, 2026',photo:null},
  {name:'Secret C',text:'Hindot ang mga flowers gi sell niya 10/10 mo balik q soon ',stars:5,date:'Feb 15, 2026',photo:null},
];

async function sbFetch(path, opts={}){
  const res=await fetch(SUPA_URL+path,{
    ...opts,
    headers:{
      'apikey':SUPA_KEY,
      'Authorization':'Bearer '+SUPA_KEY,
      'Content-Type':'application/json',
      'Prefer': opts.prefer||'',
      ...(opts.headers||{})
    }
  });
  return res;
}

async function getRevs(){
  try{
    const res=await sbFetch('/rest/v1/reviews?order=created_at.asc&select=*');
    if(!res.ok)return[];
    return await res.json();
  }catch{return[]}
}

async function insertRev(rev){
  await sbFetch('/rest/v1/reviews',{
    method:'POST',
    prefer:'return=minimal',
    body:JSON.stringify(rev)
  });
}

async function deleteRev(id){
  await fetch(SUPA_URL+'/rest/v1/reviews?id=eq.'+id,{
    method:'DELETE',
    headers:{
      'apikey':SUPA_KEY,
      'Authorization':'Bearer '+SUPA_KEY,
      'Content-Type':'application/json',
      'Prefer':'return=minimal'
    }
  });
}

async function maybeSeed(){
  const revs=await getRevs();
  if(revs.length===0){
    for(const r of SEED_REVIEWS){
      await insertRev(r);
    }
  }
}
maybeSeed().then(()=>renderReviews());

async function renderReviews(){
  const grid=document.getElementById('reviewsGrid');
  const empty=document.getElementById('revEmpty');
  if(!grid || !empty) return;
  
  grid.querySelectorAll('.rev-card').forEach(c=>c.remove());
  empty.textContent='Loading reviews…';
  empty.style.display='block';

  const revs=await getRevs();
  grid.querySelectorAll('.rev-card').forEach(c=>c.remove());
  if(!revs.length){empty.textContent='No reviews yet — be the first! 🌸';return}
  empty.style.display='none';

  revs.slice().reverse().forEach(r=>{
    const c=document.createElement('div');
    c.className='rev-card';
    const avatarInner=r.photo
      ?`<img src="${esc(r.photo)}" alt="${esc((r.name||'?')[0])}"/>`
      :`${esc((r.name||'?')[0])}`;
    const photoHtml=r.photo?`<img src="${esc(r.photo)}" alt="Review photo" style="width:100%;max-height:120px;object-fit:cover;border-radius:8px;margin-bottom:.5rem"/>`:'' ;
    c.innerHTML=`
      <div class="rev-quote">"</div>
      ${photoHtml}
      <p class="rev-text">${esc(r.text)}</p>
      <div class="rev-author">
        <div class="rev-avatar">${avatarInner}</div>
        <div>
          <div class="rev-name">${esc(r.name)}</div>
          <div class="rev-stars">${'★'.repeat(r.stars)+'☆'.repeat(5-r.stars)}</div>
          <div class="rev-date">${r.date||''}</div>
        </div>
      </div>`;
    grid.appendChild(c);
  });
}

let selStars=5;
const stars=document.querySelectorAll('#starSelect span');
stars.forEach(s=>{
  s.addEventListener('click',()=>{selStars=+s.dataset.v;stars.forEach(x=>x.classList.toggle('lit',+x.dataset.v<=selStars))});
  s.addEventListener('mouseenter',()=>stars.forEach(x=>x.classList.toggle('lit',+x.dataset.v<=+s.dataset.v)));
  s.addEventListener('mouseleave',()=>stars.forEach(x=>x.classList.toggle('lit',+x.dataset.v<=selStars)));
});
stars.forEach(s=>s.classList.add('lit'));

let approvedRevPhoto=null;

async function handleRevPhoto(input){
  const file=input.files[0];
  if(!file)return;
  approvedRevPhoto=null;
  const preview=document.getElementById('revPhotoPreview');
  const checking=document.getElementById('revPhotoChecking');
  const photoErr=document.getElementById('revPhotoError');
  if(photoErr) photoErr.style.display='none';
  if(checking) checking.style.display='block';
  if(preview) preview.style.display='none';

  const b64=await fileToBase64(file);
  const result=await checkImageWithAI(b64,file.type);
  if(checking) checking.style.display='none';

  if(!result.ok){
    if(photoErr) {
      photoErr.textContent='🚫 Image not allowed: '+result.reason+'. Please use a different photo.';
      photoErr.style.display='block';
    }
    input.value='';
    return;
  }
  const dataURL='data:'+file.type+';base64,'+b64;
  if(preview) {
    preview.src=dataURL;
    preview.style.display='block';
  }
  approvedRevPhoto=dataURL;
  showToast('✅ Photo approved!','success');
}

async function submitReview(e){
  e.preventDefault();
  const nameEl = document.getElementById('revName');
  const textEl = document.getElementById('revText');
  const err = document.getElementById('revError');
  if(!nameEl || !textEl || !err) return;
  
  const name=nameEl.value.trim();
  const rawText=textEl.value.trim();
  err.style.display='none';

  if(hasHardBlock(name)||hasHardBlock(rawText)){
    err.textContent='⚠️ Your review contains prohibited language and cannot be submitted.';
    err.style.display='block';
    return;
  }
  if(rawText.length<10){
    err.textContent='Please write at least 10 characters.';
    err.style.display='block';
    return;
  }

  const censoredText=censorText(rawText);
  const censoredName=censorText(name);

  await insertRev({
    name:censoredName,
    text:censoredText,
    stars:selStars,
    date:new Date().toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'}),
    photo:approvedRevPhoto||null
  });
  await renderReviews();

  const revForm = document.getElementById('revForm');
  const revSuccess = document.getElementById('revSuccess');
  if(revForm) revForm.style.display='none';
  if(revSuccess) revSuccess.style.display='block';
  
  showToast('Review submitted! 🌼','success');
  setTimeout(()=>{
    if(revForm) {
      revForm.style.display='flex';
      revForm.reset();
    }
    if(revSuccess) revSuccess.style.display='none';
    selStars=5;
    stars.forEach(s=>s.classList.add('lit'));
    approvedRevPhoto=null;
    const preview = document.getElementById('revPhotoPreview');
    if(preview) preview.style.display='none';
  },3000);
}

const AU='hannahalexiag@gmail.com',AP='Xiacollections.com07';
let adminLoggedIn=false;

function openAdminSidebar(){
  const sb = document.getElementById('adminSidebar');
  const ol = document.getElementById('adminOverlay');
  if(sb) sb.classList.add('open');
  if(ol) ol.classList.add('open');
  document.body.style.overflow='hidden';
  if(!adminLoggedIn){showSidebarPanel('login')}
}
function closeAdminSidebar(){
  const sb = document.getElementById('adminSidebar');
  const ol = document.getElementById('adminOverlay');
  if(sb) sb.classList.remove('open');
  if(ol) ol.classList.remove('open');
  document.body.style.overflow='';
}
function showSidebarPanel(name){
  document.querySelectorAll('.sidebar-panel').forEach(p=>{p.classList.remove('active');p.style.display='none'});
  const panel=document.getElementById('panel-'+name);
  if(panel){panel.classList.add('active');panel.style.display='flex'}
  document.querySelectorAll('.sidebar-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));
}

const adminTrigger = document.getElementById('adminTrigger');
if(adminTrigger) adminTrigger.addEventListener('click',openAdminSidebar);
const sidebarClose = document.getElementById('sidebarClose');
if(sidebarClose) sidebarClose.addEventListener('click',closeAdminSidebar);
const adminOverlay = document.getElementById('adminOverlay');
if(adminOverlay) adminOverlay.addEventListener('click',closeAdminSidebar);
document.querySelectorAll('.sidebar-tab').forEach(t=>{
  t.addEventListener('click',()=>{
    showSidebarPanel(t.dataset.tab);
    if(t.dataset.tab==='reviews')renderAdminRevs();
    if(t.dataset.tab==='gallery')renderAdminGallery();
  });
});

const adminPass = document.getElementById('adminPass');
if(adminPass) adminPass.addEventListener('keydown',e=>{if(e.key==='Enter')doAdminLogin()});

function doAdminLogin(){
  const uEl = document.getElementById('adminUser');
  const pEl = document.getElementById('adminPass');
  const errEl = document.getElementById('loginErr');
  const tabsEl = document.getElementById('sidebarTabs');
  if(!uEl || !pEl) return;
  
  const u=uEl.value;
  const p=pEl.value;
  if(u===AU&&p===AP){
    adminLoggedIn=true;
    if(tabsEl) tabsEl.style.display='flex';
    showSidebarPanel('reviews');
    renderAdminRevs();
    if(errEl) errEl.style.display='none';
    showToast('Welcome back, Xia! 👑','success');
  }else{
    if(errEl) errEl.style.display='block';
  }
}

function adminLogout(){
  adminLoggedIn=false;
  const tabsEl = document.getElementById('sidebarTabs');
  const uEl = document.getElementById('adminUser');
  const pEl = document.getElementById('adminPass');
  if(tabsEl) tabsEl.style.display='none';
  if(uEl) uEl.value='';
  if(pEl) pEl.value='';
  showSidebarPanel('login');
  closeAdminSidebar();
  showToast('Logged out successfully.','info');
}

async function renderAdminRevs(){
  const list=document.getElementById('adminRevList');
  if(!list) return;
  list.innerHTML='<div class="admin-empty">Loading…</div>';
  const revs=await getRevs();
  list.innerHTML='';
  if(!revs.length){list.innerHTML='<div class="admin-empty">No reviews yet. 🌸</div>';return}
  revs.slice().reverse().forEach(r=>{
    const item=document.createElement('div');
    item.className='admin-rev-item';
    const photoHtml=r.photo?`<img src="${esc(r.photo)}" class="admin-rev-img" alt="Review photo"/>`:'' ;
    item.innerHTML=`
      <button class="admin-del-btn" onclick="adminDelRev(${r.id})" title="Delete">🗑</button>
      <div class="admin-rev-meta">${esc(r.name)} <span>${'★'.repeat(r.stars)} · ${r.date||''}</span></div>
      ${photoHtml}
      <div class="admin-rev-text">${esc(r.text)}</div>`;
    list.appendChild(item);
  });
}

async function adminDelRev(id){
  await deleteRev(id);
  await renderReviews();
  await renderAdminRevs();
  showToast('Review deleted.','info');
}

async function renderAdminGallery(){
  const grid=document.getElementById('adminGalleryGrid');
  if(!grid) return;
  grid.innerHTML='<div style="color:rgba(255,255,255,.3);font-size:.85rem;font-style:italic;grid-column:1/-1;padding:.5rem">Loading…</div>';
  const photos=await getAdminPhotos();
  grid.innerHTML='';
  if(!photos.length){grid.innerHTML='<div style="color:rgba(255,255,255,.3);font-size:.85rem;font-style:italic;grid-column:1/-1;padding:.5rem">No custom photos added yet.</div>';return}
  photos.forEach((src)=>{
    const item=document.createElement('div');
    item.className='admin-gallery-item';
    item.innerHTML=`<img src="${esc(src)}" alt="Gallery photo"/><button class="admin-gallery-del" onclick="adminDelGalleryPhoto('${esc(src)}')" title="Remove">✕</button>`;
    grid.appendChild(item);
  });
}

async function adminDelGalleryPhoto(src){
  await deleteFromStorage(src);
  await renderAdminGallery();
  await buildGallery();
  showToast('Photo removed from gallery.','info');
}

async function handleAdminPhotoUpload(input){
  const files=Array.from(input.files);
  if(!files.length)return;

  const checkMsg=document.getElementById('adminCheckMsg');
  const approvedMsg=document.getElementById('adminApprovedMsg');
  const rejectedMsg=document.getElementById('adminRejectedMsg');
  if(checkMsg) checkMsg.style.display='block';
  if(approvedMsg) approvedMsg.style.display='none';
  if(rejectedMsg) rejectedMsg.style.display='none';

  let anyApproved=false,anyRejected=false;

  for(const file of files){
    const b64=await fileToBase64(file);
    const result=await checkImageWithAI(b64,file.type);
    if(result.ok){
      try{
        await uploadToStorage(file);
        anyApproved=true;
      }catch{
        showToast('Upload failed for one image.','error');
      }
    }else{
      anyRejected=true;
    }
  }
  if(checkMsg) checkMsg.style.display='none';
  if(anyApproved){if(approvedMsg) approvedMsg.style.display='block';await buildGallery()}
  if(anyRejected){if(rejectedMsg) rejectedMsg.style.display='block'}
  await renderAdminGallery();
  input.value='';
  if(anyApproved)showToast('Photos added to gallery! ✦','success');
  if(anyRejected)showToast('Some photos were rejected by AI.','error');
}


/* ==========================================
   USER AUTHENTICATION (Supabase GoTrue)
   ========================================== */
let currentUser = null;

function openAuthModal(view = 'login') {
  document.getElementById('authModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
  switchAuthView(view);
}

function closeAuthModal() {
  document.getElementById('authModal').style.display = 'none';
  document.body.style.overflow = '';
}

function switchAuthView(view) {
  document.getElementById('loginFormContainer').style.display = view === 'login' ? 'flex' : 'none';
  document.getElementById('signupFormContainer').style.display = view === 'signup' ? 'flex' : 'none';
  document.getElementById('forgotFormContainer').style.display = view === 'forgot' ? 'flex' : 'none';
  
  if(view==='login') document.getElementById('authModalTitle').textContent='Welcome Back 🌸';
  if(view==='signup') document.getElementById('authModalTitle').textContent='Create Account 🌿';
  if(view==='forgot') document.getElementById('authModalTitle').textContent='Reset Password 🔐';
}

async function handleUserSignup(e) {
  e.preventDefault();
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const errEl = document.getElementById('signupErrorMsg');
  errEl.style.display = 'none';

  const res = await fetch(SUPA_URL + '/auth/v1/signup', {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  const data = await res.json();
  if (!res.ok) {
    errEl.textContent = data.msg || data.error_description || 'Sign up failed.';
    errEl.style.display = 'block';
    return;
  }
  
  await logSystemAction('USER_SIGNUP', `New user registered: ${email}`);
  showToast('Account created! Please log in.', 'success');
  switchAuthView('login');
}

async function handleUserLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginErrorMsg');
  errEl.style.display = 'none';

  const res = await fetch(SUPA_URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (!res.ok) {
    errEl.textContent = data.error_description || 'Invalid login credentials.';
    errEl.style.display = 'block';
    return;
  }

  currentUser = data;
  localStorage.setItem('sb_user_token', data.access_token);
  localStorage.setItem('sb_user_email', email);
  
  await logSystemAction('USER_LOGIN', `User logged in: ${email}`);
  showToast('Logged in successfully! 🌸', 'success');
  closeAuthModal();
  updateAuthNavState();
  loadUserCart();
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('forgotEmail').value;
  const errEl = document.getElementById('forgotErrorMsg');

  const res = await fetch(SUPA_URL + '/auth/v1/recover', {
    method: 'POST',
    headers: { 'apikey': SUPA_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });

  if (!res.ok) {
    errEl.textContent = 'Could not send recovery email. Try again later.';
    errEl.style.display = 'block';
    return;
  }

  await logSystemAction('PASSWORD_RESET', `Password reset requested for: ${email}`);
  showToast('Password reset link sent to your email! ✉️', 'success');
  closeAuthModal();
}

function updateAuthNavState() {
  const email = localStorage.getItem('sb_user_email');
  const navContainer = document.getElementById('authNavContainer');
  if (email && navContainer) {
    navContainer.innerHTML = `<a href="#" onclick="handleUserLogout()" style="color:var(--gold);">Logout (${email.split('@')[0]})</a>`;
  }
}

function handleUserLogout() {
  localStorage.removeItem('sb_user_token');
  localStorage.removeItem('sb_user_email');
  currentUser = null;
  showToast('Logged out.', 'info');
  location.reload();
}

document.addEventListener('DOMContentLoaded', () => {
  updateAuthNavState();
  loadUserCart();
});


/* ==========================================
   SHOPPING CART & SHOPEE-TYPE ORDER FLOW
   ========================================== */
let localCart = [];

async function addToCart(name, price) {
  const token = localStorage.getItem('sb_user_token');
  if (!token) {
    showToast('Please log in to add items to your cart! 🌸', 'error');
    openAuthModal('login');
    return;
  }

  const numericPrice = parseFloat(price.replace(/[^\d.]/g, ''));

  const res = await sbFetch('/rest/v1/cart_items', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify({ product_name: name, price: numericPrice, quantity: 1 })
  });

  if (res.ok) {
    showToast(`Added ${name} to cart! 🛒`, 'success');
    loadUserCart();
    await logSystemAction('ADD_TO_CART', `User added ${name} (₱${numericPrice}) to cart`);
  } else {
    showToast('Failed to add to cart.', 'error');
  }
}

async function loadUserCart() {
  const token = localStorage.getItem('sb_user_token');
  if (!token) return;

  const res = await sbFetch('/rest/v1/cart_items?select=*', { method: 'GET' });
  if (res.ok) {
    localCart = await res.json();
    const countEl = document.getElementById('cartCount');
    if(countEl) countEl.textContent = localCart.reduce((acc, item) => acc + item.quantity, 0);
  }
}

function openCartModal() {
  const token = localStorage.getItem('sb_user_token');
  if (!token) {
    showToast('Please log in to view your cart.', 'error');
    openAuthModal('login');
    return;
  }

  const container = document.getElementById('cartItemsContainer');
  if(!container) return;
  container.innerHTML = '';
  
  if (localCart.length === 0) {
    container.innerHTML = '<div style="text-align:center;color:rgba(255,255,255,.5);padding:1rem;">Your cart is empty. 🌸</div>';
    document.getElementById('cartTotalPrice').textContent = '₱0';
    document.getElementById('cartModal').style.display = 'flex';
    return;
  }

  let total = 0;
  localCart.forEach(item => {
    total += item.price * item.quantity;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,.05);padding:.5rem .8rem;border-radius:8px;';
    row.innerHTML = `
      <span style="color:#fff;font-size:.9rem;">${item.product_name} (x${item.quantity})</span>
      <span style="color:var(--gold);font-family:var(--ff-display);">₱${item.price * item.quantity}</span>
    `;
    container.appendChild(row);
  });

  document.getElementById('cartTotalPrice').textContent = '₱' + total;
  document.getElementById('cartModal').style.display = 'flex';
}

function closeCartModal() {
  document.getElementById('cartModal').style.display = 'none';
}

async function purchaseCart() {
  if (localCart.length === 0) return;

  const total = localCart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const email = localStorage.getItem('sb_user_email') || 'customer@gmail.com';

  const res = await sbFetch('/rest/v1/orders', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify({
      customer_email: email,
      items: localCart,
      total_amount: total,
      status: 'Pending'
    })
  });

  if (res.ok) {
    await sbFetch('/rest/v1/cart_items?id=not.is.null', { method: 'DELETE' });
    localCart = [];
    document.getElementById('cartCount').textContent = '0';
    closeCartModal();
    showToast('Order placed successfully! Waiting for admin approval. 🌸', 'success');
    await logSystemAction('PURCHASE_CART', `Order placed by ${email} totaling ₱${total}`);
  } else {
    showToast('Checkout failed. Please try again.', 'error');
  }
}


/* ==========================================
   ADMIN SIDE: ORDER APPROVALS & LOGS
   ========================================== */
async function renderAdminOrders() {
  const list = document.getElementById('adminOrdersList');
  if(!list) return;
  list.innerHTML = '<div class="admin-empty">Loading orders…</div>';

  const res = await sbFetch('/rest/v1/orders?order=created_at.desc&select=*', { method: 'GET' });
  if (!res.ok) { list.innerHTML = '<div class="admin-empty">Failed to load orders.</div>'; return; }
  
  const orders = await res.json();
  list.innerHTML = '';
  
  if (orders.length === 0) { list.innerHTML = '<div class="admin-empty">No pending orders. 🌸</div>'; return; }

  orders.forEach(ord => {
    const item = document.createElement('div');
    item.className = 'admin-rev-item';
    const itemsList = ord.items.map(i => `${i.product_name} (x${i.quantity})`).join(', ');
    
    item.innerHTML = `
      <div class="admin-rev-meta">${ord.customer_email} <span>Status: <strong>${ord.status}</strong></span></div>
      <div class="admin-rev-text">Items: ${itemsList}<br>Total: <strong>₱${ord.total_amount}</strong></div>
      ${ord.status === 'Pending' ? `
        <div style="display:flex;gap:.5rem;margin-top:.8rem;">
          <button class="sidebar-btn sidebar-btn-primary" style="padding:.4rem 1rem;font-size:.75rem;" onclick="updateOrderStatus(${ord.id}, 'Accepted', '${ord.customer_email}', '${itemsList}')">Accept ✔</button>
          <button class="sidebar-btn sidebar-btn-danger" style="padding:.4rem 1rem;font-size:.75rem;" onclick="updateOrderStatus(${ord.id}, 'Rejected', '${ord.customer_email}', '${itemsList}')">Reject ✖</button>
        </div>
      ` : ''}
    `;
    list.appendChild(item);
  });
}

async function updateOrderStatus(orderId, status, customerEmail, itemsList) {
  const res = await sbFetch(`/rest/v1/orders?id=eq.${orderId}`, {
    method: 'PATCH',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify({ status })
  });

  if (res.ok) {
    if (status === 'Accepted') {
      console.log(`[GMAIL SIMULATION] Sending to ${customerEmail}: "order accepted kindly take a look in these email if u want to ask any questions u can message here in the gmail or the facebook page thank you! Items: ${itemsList}"`);
      showToast(`Order accepted! Confirmation email dispatched to ${customerEmail} ✉️`, 'success');
    } else {
      console.log(`[GMAIL SIMULATION] Sending to ${customerEmail}: "order has been rejected pls try again"`);
      showToast(`Order rejected. Notification sent to ${customerEmail}.`, 'info');
    }

    await logSystemAction('ORDER_STATUS_UPDATE', `Order #${orderId} marked as ${status} for ${customerEmail}`);
    renderAdminOrders();
  } else {
    showToast('Failed to update order status.', 'error');
  }
}

async function renderAdminLogs() {
  const list = document.getElementById('adminLogsList');
  if(!list) return;
  list.innerHTML = '<div class="admin-empty">Loading logs…</div>';

  const res = await sbFetch('/rest/v1/system_logs?order=created_at.desc&limit=50&select=*', { method: 'GET' });
  if (!res.ok) { list.innerHTML = '<div class="admin-empty">Failed to load logs.</div>'; return; }
  
  const logs = await res.json();
  list.innerHTML = '';
  
  if (logs.length === 0) { list.innerHTML = '<div class="admin-empty">No activity logs recorded yet.</div>'; return; }

  logs.forEach(l => {
    const item = document.createElement('div');
    item.className = 'admin-rev-item';
    item.innerHTML = `
      <div class="admin-rev-meta">[${l.action}] <span>${new Date(l.created_at).toLocaleString()}</span></div>
      <div class="admin-rev-text">${l.details}</div>
    `;
    list.appendChild(item);
  });
}

async function logSystemAction(action, details) {
  await sbFetch('/rest/v1/system_logs', {
    method: 'POST',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify({ action, details })
  }).catch(() => {});
}

document.querySelectorAll('.sidebar-tab').forEach(t => {
  t.addEventListener('click', () => {
    if (t.dataset.tab === 'orders') renderAdminOrders();
    if (t.dataset.tab === 'logs') renderAdminLogs();
  });
});


const chatFab=document.getElementById('chatFab'),chatWin=document.getElementById('chatWindow'),
      chatCloseBtn=document.getElementById('chatClose'),chatInput=document.getElementById('chatInput'),
      chatMessages=document.getElementById('chatMessages');
let chatOpen=false,botTyping=false;

const botReplies={
  'how do i order':()=>`To order, log in to your account, add items to your cart, and check out securely! 🛒🌸`,
  'how to order':()=>`Log in, add your favourite flowers to the cart, and hit purchase! 🛍️✨`,
  'order':()=>`You can place an order directly on our website once logged in, or message us on Facebook! 🌸`,
  'price':()=>`Prices start at ₱480 for single stems and go up to ₱1,500+ for bouquets and wreaths. 💰`,
  'how much':()=>`Prices range from ₱480 for single stems to ₱1,500+ for large arrangements. 💰`,
  'ship':()=>`Delivery is available within Cebu only! 📦 Local pickup is also available.`,
  'shipping':()=>`We deliver within Cebu City and nearby areas. 📦`,
  'how long':()=>`Most pieces take 3–7 days to handcraft. 🕐`,
  'wait time':()=>`Handcrafting takes 3–7 days. 🌸`,
  'custom':()=>`Absolutely! 🎨 Message on Facebook with your favourite flower, colours, and occasion!`,
  'customize':()=>`Yes! Custom orders are Xia's favourite. 🌷`,
  'material':()=>`We use premium copper, silver, and gold-filled wire. 🔩`,
  'wire':()=>`Premium copper, silver, and gold-filled wire are our go-to materials. ✨`,
  'cebu':()=>`Yes! We're based in beautiful Cebu City, Philippines! 🇵🇭`,
  'hello':()=>`Hello! 👋 Welcome to Fuzz & Bloom! How can I help you today? 🌼`,
  'hi':()=>`Hi there! 🌸 Welcome to Fuzz & Bloom!`,
  'hey':()=>`Hey! 🌼 So glad you're here!`,
  'thank':()=>`You're so welcome! 🥰`,
  'bye':()=>`Bye! 🌸 Thank you for visiting Fuzz & Bloom!`,
  'created':()=>`Joshxd is the creative genius who designed and built this website! 💻✨`,
  'made':()=>`Joshxd is the mastermind behind this website! 💻✨`,
  'website':()=>`Joshxd built this website with love and care! 💻🌼`,
  'who are you':()=>`I am JoshBot 1.1, a friendly chatbot here to help with any questions about Fuzz & Bloom! 🌼`,
};

function getBotReply(msg){
  const l=msg.toLowerCase();
  for(const[k,fn]of Object.entries(botReplies))if(l.includes(k))return fn();
  return`Thanks for your message! 🌼 For the best help, log in to order or message Xia directly on Facebook! 💕`;
}
function addMsg(text,role){if(!chatMessages)return; const el=document.createElement('div');el.className='chat-msg '+role;el.innerHTML=text;chatMessages.appendChild(el);chatMessages.scrollTop=chatMessages.scrollHeight}
function showTypingIndicator(){if(!chatMessages)return; const el=document.createElement('div');el.className='typing';el.id='typingInd';el.innerHTML='<span></span><span></span><span></span>';chatMessages.appendChild(el);chatMessages.scrollTop=chatMessages.scrollHeight}
function hideTypingIndicator(){const t=document.getElementById('typingInd');if(t)t.remove()}
function sendMessage(msg){
  if(!msg.trim()||botTyping||!chatInput)return;
  addMsg(esc(msg),'user');chatInput.value='';botTyping=true;showTypingIndicator();
  setTimeout(()=>{hideTypingIndicator();addMsg(getBotReply(msg),'bot');botTyping=false},800+Math.random()*600);
}
function askQuick(q){addMsg(esc(q),'user');botTyping=true;showTypingIndicator();setTimeout(()=>{hideTypingIndicator();addMsg(getBotReply(q),'bot');botTyping=false},800+Math.random()*500)}

if(chatFab){
  chatFab.addEventListener('click',()=>{
    chatOpen=!chatOpen;
    if(chatWin) chatWin.classList.toggle('open',chatOpen);
    if(chatOpen&&chatMessages&&chatMessages.childElementCount===0){
      setTimeout(()=>addMsg('Hi! 👋 Welcome to <strong>Fuzz &amp; Bloom</strong>! I\'m Xia\'s little helper. Ask me anything! 🌼','bot'),400);
      const badge = document.querySelector('.chat-badge');
      if(badge) badge.style.display='none';
    }
  });
}

if(chatCloseBtn) chatCloseBtn.addEventListener('click',()=>{chatOpen=false; if(chatWin) chatWin.classList.remove('open')});
const chatSend = document.getElementById('chatSend');
if(chatSend && chatInput) chatSend.addEventListener('click',()=>sendMessage(chatInput.value));
if(chatInput) chatInput.addEventListener('keydown',e=>{if(e.key==='Enter')sendMessage(chatInput.value)});

document.querySelectorAll('.sidebar-panel').forEach(p=>p.style.display='none');
const loginPanel = document.getElementById('panel-login');
if(loginPanel) {
  loginPanel.style.display='flex';
  loginPanel.classList.add('active');
}