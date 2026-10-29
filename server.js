'use strict';
// Cyber Entertainment — website + admin API. No npm dependencies (Node 18+).
// Storage: Supabase (Postgres + Storage) when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set, otherwise local files (data/) for development.
// Works both as `node server.js` and as a Vercel Function (the handler is exported; see api/).
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const sb=require('./lib/supabase'),localStore=require('./lib/store-local'),cms=require('./lib/cms');
const PORT=+process.env.PORT||3000,PUB=path.join(__dirname,'public'),DIR=path.join(__dirname,'data');
const SUPA=sb.enabled(),MEDIA=path.join(DIR,'media'),BACKUPS=path.join(DIR,'backups');
const MAX_AUDIO_MB=+process.env.MAX_UPLOAD_MB||(SUPA?50:300),MAX_IMG_MB=8;
const IMG=['.jpg','.jpeg','.png','.webp','.gif'],AUD=['.mp3','.m4a','.aac','.wav','.ogg'],VID=['.mp4','.webm'];
const AUDRE=/\.(mp3|m4a|aac|wav|ogg)(\?.*)?$/i;
const MIME={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.xml':'application/xml','.webp':'image/webp','.mp3':'audio/mpeg','.m4a':'audio/mp4','.aac':'audio/aac','.wav':'audio/wav','.ogg':'audio/ogg','.mp4':'video/mp4','.webm':'video/webm','.woff2':'font/woff2','.woff':'font/woff','.webmanifest':'application/manifest+json'};
if(!SUPA)try{fs.mkdirSync(MEDIA,{recursive:true})}catch{}

const store=SUPA?sb.store():localStore(DIR);
const uuid=()=>crypto.randomUUID();
const G=n=>({id:uuid(),name:n,description:'Available for hire — message us for availability and rates.',price:'',available:true});
const DEF={settings:{tagline:'Great Vybz Nothingless',phone:'+256703046409',whatsapp:'256703046409',email:'academy@cyberentertainment.com',address:'Seguku Katale, Wankulukuku Road, Kampala',hours:'Mon – Fri 8 AM – 8 PM · Sat 8 AM – 2 PM',instagram:'',youtube:'',tiktok:'',facebook:'',soundcloud:''}};
const URL_KEYS=['instagram','youtube','tiktok','facebook','soundcloud'];

// ---------- helpers ----------
const bad=(st,msg)=>{const e=new Error(msg);e.status=st;e.userMessage=msg;return e};
const s=(v,n)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);
const web=v=>/^https?:\/\//i.test(v)?v:'';
const idOk=v=>/^[\w-]{1,60}$/.test(String(v||''));
// Editable lists (Academy modules, packages, events we cover): kv key -> field limits
const LISTS={modules:{title:120,desc:700},packages:{name:80,tagline:160,features:900},evtypes:{title:100,tagline:160,text:600,points:700}};
const sl=(v,n)=>String(v??'').replace(/[\u0000-\u0008\u000b-\u001f]/g,' ').replace(/\r\n?/g,'\n').trim().slice(0,n);
const hash=(pw,salt=crypto.randomBytes(16).toString('hex'))=>salt+':'+crypto.scryptSync(pw,salt,64).toString('hex');
const check=(pw,h)=>{try{const[sl,k]=String(h).split(':');return crypto.timingSafeEqual(Buffer.from(k,'hex'),crypto.scryptSync(pw,sl,64))}catch{return false}};
const EVST=['upcoming','soldout','postponed','cancelled'],BKST=['new','contacted','confirmed','done','cancelled'];
const dateOk=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v+'T00:00:00Z'));
const today=()=>new Date(Date.now()+108e5).toISOString().slice(0,10); // Kampala (UTC+3)
const evSort=(a,b)=>(a.date?0:1)-(b.date?0:1)||a.date.localeCompare(b.date);
const send=(r,c,o,h={})=>{r.writeHead(c,{'Content-Type':'application/json','Cache-Control':'no-store',...h});r.end(JSON.stringify(o))};
const body=(q,max=2e6)=>new Promise((ok,no)=>{let d='',n=0,over=false;q.on('data',c=>{if(over)return;n+=c.length;if(n>max){over=true;d='';no(bad(413,'That is too much data to save at once.'));return}d+=c});q.on('end',()=>{if(over)return;try{ok(JSON.parse(d||'{}'))}catch{no(bad(400,'The data sent was not valid.'))}});q.on('error',()=>no(bad(400,'The request was interrupted.')))});

// rate limiting (per server instance)
const hits=new Map();
const limited=(k,max,ms)=>{const n=Date.now(),a=(hits.get(k)||[]).filter(t=>n-t<ms);a.push(n);hits.set(k,a);return a.length>max};
const over=(k,max,ms)=>(hits.get(k)||[]).filter(t=>Date.now()-t<ms).length>=max,note=k=>{const a=(hits.get(k)||[]).filter(t=>Date.now()-t<9e5);a.push(Date.now());hits.set(k,a)};
setInterval(()=>{const n=Date.now();for(const[k,a]of hits){const f=a.filter(t=>n-t<9e5);f.length?hits.set(k,f):hits.delete(k)}},6e5).unref();

// sessions: signed cookie, valid across serverless instances
let adminHash='',hashAt=0;
const refreshHash=async()=>{if(Date.now()-hashAt<1e4)return;hashAt=Date.now();try{adminHash=(await store.kvGet('admin'))||adminHash}catch{}};
const secret=()=>process.env.SESSION_SECRET||adminHash||'cyber';
const sign=v=>crypto.createHmac('sha256',secret()).update(v).digest('base64url');
const mkToken=()=>{const e=String(Date.now()+288e5);return e+'.'+sign(e)};
const tokOk=t=>{if(!t)return false;const[e,g]=String(t).split('.');if(!e||!g||!(+e>Date.now()))return false;const a=Buffer.from(g),b=Buffer.from(sign(e));return a.length===b.length&&crypto.timingSafeEqual(a,b)};
const sid=q=>((q.headers.cookie||'').match(/cy_sid=([\w.-]+)/)||[])[1];
const authed=q=>tokOk(sid(q));

// ---------- media ----------
const mediaUrl=f=>SUPA?sb.storage.publicUrl(f):'/media/'+f;
const publicize=v=>{ // turn "/media/x" into the direct Supabase URL for the public site
  if(!SUPA)return v;if(typeof v==='string')return /^\/media\/[\w.\-]+$/.test(v)?sb.storage.publicUrl(v.slice(7)):v;
  if(Array.isArray(v))return v.map(publicize);if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v))o[k]=publicize(v[k]);return o}return v};
const mediaExists=f=>SUPA||fs.existsSync(path.join(MEDIA,f));
const okImg=v=>web(v)||(/^\/media\/[\w.\-]+$/.test(v)&&mediaExists(v.slice(7)));
const mediaRefs=data=>{const set=new Set();JSON.stringify(data).replace(/\/media\/([\w.\-]+)/g,(m,f)=>set.add(f));return set};

// ---------- setup / seeding ----------
let ready;
function bootstrap(){
  return ready||(ready=(async()=>{
    await store.init();
    if(SUPA)try{await sb.storage.ensureBuckets()}catch(e){console.error('Storage buckets:',e.message)}
    await seed();
    adminHash=await store.kvGet('admin')||'';hashAt=Date.now();
    if(!adminHash||process.env.RESET_ADMIN_PASSWORD==='1'){
      const pw=process.env.ADMIN_PASSWORD||crypto.randomBytes(9).toString('base64url');
      adminHash=hash(pw);await store.kvSet('admin',adminHash);
      console.log('\n=== ADMIN PASSWORD SET ===\nAdmin URL: /admin\nPassword : '+(process.env.ADMIN_PASSWORD?'(the ADMIN_PASSWORD value)':pw)+'\nChange it in Admin > Account.\n'+(process.env.RESET_ADMIN_PASSWORD==='1'?'Remove RESET_ADMIN_PASSWORD now so it is not reset on every restart.\n':''));
    }
    const st=await store.kvGet('settings');if(!st)await store.kvSet('settings',DEF.settings);
  })().catch(e=>{ready=null;throw e}));
}
async function seed(){
  // First run on an empty Supabase project: import the bundled starter content (data/db.json) once.
  // Local mode just uses data/db.json directly.
  const d=cms.defaults();
  if(!SUPA){
    if(await store.kvGet('faq')===null&&d.faq.length)await store.kvSet('faq',d.faq);
    if(await store.kvGet('gallery')===null&&d.gallery.length)await store.kvSet('gallery',d.gallery);
    for(const k of Object.keys(LISTS))if(await store.kvGet(k)===null&&(d[k]||[]).length)await store.kvSet(k,d[k]);
    if((await store.list('gear')).length===0&&!(await store.kvGet('seeded'))){
      await store.upsert('gear',G('Controllers & Decks'));for(const n of['Mixers','PA Speakers','Microphones','Stage Lighting','Effects & Extras'])await store.upsert('gear',G(n));
      await store.kvSet('seeded',new Date().toISOString())}
    return}
  if(!await store.kvGet('seeded')){
    let legacy={};try{legacy=JSON.parse(fs.readFileSync(path.join(DIR,'db.json'),'utf8'))}catch{}
    const existing=(await store.count('djs'))+(await store.count('events'));
    if(!existing){
      const items={},kv={};for(const c of sb.COLS)items[c]=Array.isArray(legacy[c])?legacy[c]:[];
      if(!items.gear.length)items.gear=['Controllers & Decks','Mixers','PA Speakers','Microphones','Stage Lighting','Effects & Extras'].map(G);
      kv.settings={...DEF.settings,...(legacy.settings||{})};
      if(d.faq.length)kv.faq=d.faq;if(d.gallery.length)kv.gallery=d.gallery;for(const k of Object.keys(LISTS))if((d[k]||[]).length)kv[k]=d[k];
      await store.importAll({items,kv});
      if(legacy.admin)await store.kvSet('admin',legacy.admin);
    }
    await store.kvSet('seeded',new Date().toISOString());
  }
  await seedMedia().catch(e=>console.error('Could not copy bundled images to Supabase Storage:',e.message));
}
async function seedMedia(force){
  if(!SUPA||(!force&&await store.kvGet('media_seeded')))return 0;
  let n=0;try{for(const f of fs.readdirSync(MEDIA)){if(!/^[\w.\-]+$/.test(f))continue;await sb.storage.putMedia(f,fs.readFileSync(path.join(MEDIA,f)),MIME[path.extname(f).toLowerCase()]);n++}}catch(e){if(e.code!=='ENOENT')throw e}
  await store.kvSet('media_seeded',new Date().toISOString());return n}

// ---------- public content ----------
let pubCache=null,pubAt=0;
const bust=()=>{pubCache=null};
const pubMix=x=>({id:x.id,djId:x.djId,title:x.title,stream:x.file?mediaUrl(x.file):(AUDRE.test(x.url)?x.url:''),link:x.file||AUDRE.test(x.url)?'':x.url});
const pubEv=x=>({id:x.id,title:x.title,date:x.date,time:x.time,venue:x.venue,description:x.description,lineup:x.lineup,price:x.price,ticketUrl:x.ticketUrl,image:x.image,status:x.status});
const pubNews=x=>({id:x.id,title:x.title,date:x.date,summary:x.summary,link:x.link,image:x.image});
async function publicContent(){
  if(pubCache&&Date.now()-pubAt<(SUPA?8e3:0))return pubCache;
  const[settings,gear,djs,shirts,mixtapes,events,news,content,faq,gallery]=await Promise.all([store.kvGet('settings'),store.list('gear'),store.list('djs'),store.list('shirts'),store.list('mixtapes'),store.list('events'),store.list('news'),store.kvGet('content'),store.kvGet('faq'),store.kvGet('gallery')]);
  const liveDj=new Set(djs.filter(d=>d.available).map(d=>d.id));
  const out={settings:{...DEF.settings,...(settings||{})},gear:gear.filter(x=>x.available),djs:djs.filter(d=>d.available),
    shirts:shirts.filter(x=>x.available&&liveDj.has(x.djId)),mixtapes:mixtapes.filter(x=>x.available&&liveDj.has(x.djId)).map(pubMix),
    events:events.filter(x=>x.available&&(!x.date||x.date>=today())).sort(evSort).map(pubEv),
    news:news.filter(x=>x.available).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12).map(pubNews),
    cms:content||cms.empty(),faq:Array.isArray(faq)?faq.filter(x=>x.available).map(x=>({q:x.q,a:x.a})):null,gallery:Array.isArray(gallery)?gallery.filter(x=>x.available).map(x=>({image:x.image,alt:x.alt,title:x.title,caption:x.caption})):null};
  out.lists={};for(const k of Object.keys(LISTS)){const v=await store.kvGet(k);out.lists[k]=Array.isArray(v)?v.filter(x=>x.available).map(x=>{const o={};for(const f of Object.keys(LISTS[k]))o[f]=x[f]||'';if(k==='packages')o.recommended=!!x.recommended;return o}):null}
  pubCache=publicize(out);pubAt=Date.now();return pubCache}

// ---------- backups ----------
const stamp=()=>new Date().toISOString().replace(/[:T]/g,'-').slice(0,19);
async function snapshot(){const x=await store.exportAll();return{app:'cyber-entertainment',version:1,created:new Date().toISOString(),storage:store.kind,items:x.items,kv:x.kv}}
const bName=n=>/^[\w.\-]+\.json$/.test(n);
const bStore={
  async put(n,t){if(SUPA)return sb.storage.putBackup(n,t);fs.mkdirSync(BACKUPS,{recursive:true});fs.writeFileSync(path.join(BACKUPS,n),t)},
  async list(){if(SUPA)return sb.storage.listBackups();try{return fs.readdirSync(BACKUPS).filter(f=>f.endsWith('.json')).map(f=>{const st=fs.statSync(path.join(BACKUPS,f));return{name:f,size:st.size,created:st.mtime.toISOString()}}).sort((a,b)=>b.name.localeCompare(a.name))}catch{return[]}},
  async get(n){if(SUPA)return sb.storage.getBackup(n);try{return fs.readFileSync(path.join(BACKUPS,n),'utf8')}catch{throw bad(404,'Backup not found')}},
  async del(n){if(SUPA)return sb.storage.removeBackup(n);try{fs.unlinkSync(path.join(BACKUPS,n))}catch{}}
};
async function makeBackup(reason){const snap=await snapshot(),name=stamp()+'-'+reason+'.json';await bStore.put(name,JSON.stringify(snap));
  const c=snap.items;return{name,counts:Object.fromEntries(Object.keys(c).map(k=>[k,c[k].length]))}}
async function autoBackup(){ // at most one automatic snapshot per day, after the first admin change; keeps the last 30
  try{const t=today();if(await store.kvGet('last_backup')===t)return;await store.kvSet('last_backup',t);await makeBackup('auto');
    const all=(await bStore.list()).filter(b=>/-auto\.json$/.test(b.name)).sort((a,b)=>b.name.localeCompare(a.name));for(const b of all.slice(30))await bStore.del(b.name)}
  catch(e){console.error('Automatic backup failed:',e.message)}}
async function restoreSnapshot(snap){
  if(!snap||snap.app!=='cyber-entertainment'||!snap.items||typeof snap.items!=='object')throw bad(400,'This file is not a Cyber Entertainment backup.');
  await makeBackup('before-restore');
  const items={};for(const c of sb.COLS)if(Array.isArray(snap.items[c]))items[c]=snap.items[c].filter(x=>x&&idOk(x.id));
  const kv={};for(const k of['settings','content','faq','gallery',...Object.keys(LISTS)])if(snap.kv&&snap.kv[k]!==undefined)kv[k]=snap.kv[k];
  await store.importAll({items,kv});bust()}

// ---------- validators for each collection ----------
const V={
  gear:(g)=>({id:idOk(g.id)?g.id:uuid(),name:s(g.name,80)||'Untitled',description:s(g.description,300),price:s(g.price,40),available:!!g.available}),
  djs:(d)=>({id:idOk(d.id)?d.id:uuid(),name:s(d.name,60)||'Untitled DJ',realName:s(d.realName,60),title:s(d.title,60),bio:s(d.bio,600),genres:s(d.genres,100),instagram:web(s(d.instagram,300)),photo:okImg(s(d.photo,300))?s(d.photo,300):'',available:!!d.available}),
  events:(x)=>{const d=s(x.date,10);return{id:idOk(x.id)?x.id:uuid(),title:s(x.title,100)||'Untitled event',date:dateOk(d)?d:'',time:s(x.time,30),venue:s(x.venue,120),description:s(x.description,600),lineup:s(x.lineup,200),price:s(x.price,60),ticketUrl:web(s(x.ticketUrl,300)),image:okImg(s(x.image,300))?s(x.image,300):'',status:EVST.includes(x.status)?x.status:'upcoming',available:!!x.available}},
  news:(x)=>{const d=s(x.date,10);return{id:idOk(x.id)?x.id:uuid(),title:s(x.title,120)||'Untitled post',date:dateOk(d)?d:today(),summary:s(x.summary,500),link:web(s(x.link,300)),image:okImg(s(x.image,300))?s(x.image,300):'',available:!!x.available}}
};

// ---------- API ----------
async function api(q,r,u){
  await bootstrap();await refreshHash();
  const ip=q.headers['x-forwarded-for']?.split(',')[0].trim()||q.socket.remoteAddress,m=q.method,p=u.pathname;

  // ---- public ----
  if(m==='GET'&&p==='/api/content'){const c=await publicContent();return send(r,200,c,{'Cache-Control':SUPA?'public, max-age=0, s-maxage=10, stale-while-revalidate=30':'no-store'})}
  const dm=p.match(/^\/api\/mixtapes\/([\w-]+)\/download$/);
  if(m==='GET'&&dm){const x=await store.get('mixtapes',dm[1]);if(!x||!x.available)return send(r,404,{error:'Not found'});
    x.downloads=(x.downloads||0)+1;store.upsert('mixtapes',x).catch(()=>{});
    const dest=x.file?(SUPA?sb.storage.publicUrl(x.file)+'?download='+encodeURIComponent(x.file.replace(/^[0-9a-f-]{36}-/,'')):'/media/'+x.file+'?dl=1'):x.url;
    r.writeHead(302,{Location:dest});return r.end()}
  if(m==='POST'&&p==='/api/bookings'){
    if(limited('b'+ip,5,6e5))return send(r,429,{error:'Too many requests, try later.'});
    const b=await body(q);if(b.web)return send(r,200,{ok:true}); // honeypot
    const x={id:uuid(),created:new Date().toISOString(),name:s(b.n,80),phone:s(b.p,30),service:s(b.s,40),dj:s(b.dj,80),date:s(b.d,10),venue:s(b.v,120),message:s(b.m,1000),status:'new',note:''};
    if(!x.name||!x.phone)return send(r,400,{error:'Name and phone are required.'});
    await store.upsert('bookings',x,{front:true});return send(r,201,{ok:true})}
  if(m==='POST'&&p==='/api/subscribe'){
    if(limited('n'+ip,5,6e5))return send(r,429,{error:'Too many requests, try again later.'});
    const b=await body(q);if(b.web)return send(r,200,{ok:true});
    const em=s(b.email,120).toLowerCase();
    if(!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(em))return send(r,400,{error:'Please enter a valid email address.'});
    const id='e'+crypto.createHash('sha1').update(em).digest('hex').slice(0,24);
    if(!await store.get('subscribers',id))await store.upsert('subscribers',{id,created:new Date().toISOString(),email:em},{front:true});
    return send(r,201,{ok:true})}
  if(m==='POST'&&p==='/api/login'){
    if(over('l'+ip,8,9e5))return send(r,429,{error:'Too many wrong passwords. Wait 15 minutes.'});
    const b=await body(q);if(!check(String(b.password||''),adminHash)){note('l'+ip);return send(r,401,{error:'Wrong password.'})}
    const sec=(process.env.COOKIE_SECURE==='1'||q.headers['x-forwarded-proto']==='https')?'; Secure':'';
    return send(r,200,{ok:true},{'Set-Cookie':`cy_sid=${mkToken()}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${sec}`})}

  // ---- admin ----
  if(!p.startsWith('/api/admin/')&&p!=='/api/logout')return send(r,404,{error:'Not found'});
  if(!authed(q))return send(r,401,{error:'Login required'});
  if(m!=='GET'&&q.headers['x-requested-with']!=='admin')return send(r,403,{error:'Bad request'});
  if(p==='/api/logout')return send(r,200,{ok:true},{'Set-Cookie':'cy_sid=; Max-Age=0; Path=/'});

  if(m==='GET'&&p==='/api/admin/health'){const h=await store.health();
    return send(r,200,{ok:h.ok,storage:store.kind,message:h.ok?'':h.message,maxImageMB:MAX_IMG_MB,maxAudioMB:MAX_AUDIO_MB,direct:SUPA,lastBackup:await store.kvGet('last_backup').catch(()=>null)})}
  if(m==='GET'&&p==='/api/admin/data'){
    const[settings,gear,djs,shirts,mixtapes,events,news,bookings,subscribers,content,faq,gallery]=await Promise.all([store.kvGet('settings'),store.list('gear'),store.list('djs'),store.list('shirts'),store.list('mixtapes'),store.list('events'),store.list('news'),store.list('bookings'),store.list('subscribers'),store.kvGet('content'),store.kvGet('faq'),store.kvGet('gallery')]);
    const lists={};for(const k of Object.keys(LISTS)){const v=await store.kvGet(k);lists[k]=Array.isArray(v)?v:(cms.defaults()[k]||[])}
    return send(r,200,{...lists,settings:{...DEF.settings,...(settings||{})},gear,djs,shirts,mixtapes,events,news,bookings,subscribers,content:content||cms.empty(),faq:faq||[],gallery:gallery||[]})}
  if(m==='GET'&&p==='/api/admin/cms-manifest')return send(r,200,cms.load(),{'Cache-Control':'private, max-age=300'});

  const csv=v=>'"'+String(v??'').replace(/"/g,'""').replace(/^([=+\-@])/,"'$1")+'"';
  if(m==='GET'&&p==='/api/admin/bookings.csv'){const k=['created','name','phone','service','dj','date','venue','message','status','note'],L=await store.list('bookings');
    r.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename=bookings.csv'});return r.end('﻿'+[k.join(',')].concat(L.map(b=>k.map(x=>csv(b[x])).join(','))).join('\n'))}
  if(m==='GET'&&p==='/api/admin/subscribers.csv'){const L=await store.list('subscribers');
    r.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename=subscribers.csv'});return r.end(['created,email'].concat(L.map(x=>csv(x.created)+','+csv(x.email))).join('\n'))}

  // bookings: add manually, edit, delete
  if(m==='POST'&&p==='/api/admin/bookings'){const b=await body(q);const x={id:uuid(),created:new Date().toISOString(),name:s(b.name,80),phone:s(b.phone,30),service:s(b.service,40),dj:s(b.dj,80),date:s(b.date,10),venue:s(b.venue,120),message:s(b.message,1000),status:BKST.includes(b.status)?b.status:'new',note:s(b.note,500)};
    if(!x.name)return send(r,400,{error:'Name is required.'});await store.upsert('bookings',x,{front:true});await autoBackup();return send(r,201,x)}
  const bm=p.match(/^\/api\/admin\/bookings\/([\w-]+)$/);
  if(bm){const x=await store.get('bookings',bm[1]);if(!x)return send(r,404,{error:'Not found'});
    if(m==='DELETE'){await store.remove('bookings',x.id);return send(r,200,{ok:true})}
    if(m==='PATCH'){const b=await body(q);if(BKST.includes(b.status))x.status=b.status;
      for(const[k,n]of[['note',500],['name',80],['phone',30],['service',40],['dj',80],['venue',120],['message',1000]])if(k in b)x[k]=s(b[k],n);
      if('date'in b)x.date=s(b.date,10);await store.upsert('bookings',x);return send(r,200,x)}}
  if(m==='POST'&&p==='/api/admin/subscribers'){const b=await body(q),em=s(b.email,120).toLowerCase();
    if(!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']{2,}$/.test(em))return send(r,400,{error:'Enter a valid email address.'});
    const id='e'+crypto.createHash('sha1').update(em).digest('hex').slice(0,24),x={id,created:new Date().toISOString(),email:em};await store.upsert('subscribers',x,{front:true});return send(r,201,x)}
  const sm=p.match(/^\/api\/admin\/subscribers\/([\w-]+)$/);
  if(sm&&m==='DELETE'){if(!await store.remove('subscribers',sm[1]))return send(r,404,{error:'Not found'});return send(r,200,{ok:true})}

  if(m==='PUT'&&p==='/api/admin/settings'){const b=await body(q),cur=(await store.kvGet('settings'))||{},o={...DEF.settings,...cur};
    for(const k of Object.keys(DEF.settings))if(k in b)o[k]=s(b[k],200);
    o.whatsapp=o.whatsapp.replace(/\D/g,'');URL_KEYS.forEach(k=>o[k]=web(o[k]));
    await store.kvSet('settings',o);bust();await autoBackup();return send(r,200,o)}

  const mm=p.match(/^\/api\/admin\/(gear|djs|events|news|shirts|mixtapes)$/);
  if(m==='PUT'&&mm){const col=mm[1],b=await body(q);if(!Array.isArray(b[col]))return send(r,400,{error:'Bad data'});
    const lim={gear:100,djs:80,events:500,news:500,shirts:500,mixtapes:1000}[col];let list;
    if(col==='shirts'){const ids=new Set((await store.list('djs')).map(d=>d.id));
      list=b.shirts.slice(0,lim).filter(x=>ids.has(x.djId)).map(x=>({id:idOk(x.id)?x.id:uuid(),djId:x.djId,name:s(x.name,80)||'Untitled tee',description:s(x.description,300),price:Math.max(0,Math.round(+x.price)||0),sizes:s(x.sizes,60)||'S,M,L,XL',image:okImg(s(x.image,300))?s(x.image,300):'',available:!!x.available}))}
    else if(col==='mixtapes'){const old=new Map((await store.list('mixtapes')).map(x=>[x.id,x])),ids=new Set((await store.list('djs')).map(d=>d.id));
      list=b.mixtapes.slice(0,lim).filter(x=>ids.has(x.djId)).map(x=>{const o=old.get(x.id),fn=s(x.file,200),u2=s(x.url,300);
        return{id:o?o.id:(idOk(x.id)?x.id:uuid()),djId:x.djId,title:s(x.title,100)||'Untitled mixtape',file:/^[\w.\-]+$/.test(fn)&&mediaExists(fn)?fn:'',url:web(u2),available:!!x.available,downloads:o?o.downloads||0:0,created:o?o.created:new Date().toISOString()}})}
    else list=b[col].slice(0,lim).map(V[col]);
    await store.replace(col,list);
    if(col==='djs'){ // removing a DJ also removes their mixtapes and T-shirts
      const ids=new Set(list.map(d=>d.id));
      for(const c of['shirts','mixtapes']){const cur=await store.list(c),keep=cur.filter(x=>ids.has(x.djId));if(keep.length!==cur.length)await store.replace(c,keep)}}
    bust();await autoBackup();return send(r,200,list)}

  if(m==='PUT'&&p==='/api/admin/cms'){const b=await body(q),o=cms.sanitize(b);await store.kvSet('content',o);bust();await autoBackup();return send(r,200,o)}
  for(const[kv,fields]of[['faq',{q:300,a:2000}],['gallery',{title:100,caption:200,alt:200}]]){
    if(m==='PUT'&&p==='/api/admin/'+kv){const b=await body(q);if(!Array.isArray(b[kv]))return send(r,400,{error:'Bad data'});
      const list=b[kv].slice(0,200).map(x=>{const o={id:idOk(x.id)?x.id:uuid(),available:!!x.available};for(const f of Object.keys(fields))o[f]=s(x[f],fields[f]);
        if(kv==='gallery'){o.image=cms.img(x.image);if(!o.image||(o.image.startsWith('/media/')&&!okImg(o.image)))o.image='';}
        else if(!o.q)o.q='Untitled question';return o}).filter(x=>kv!=='gallery'||x.image);
      await store.kvSet(kv,list);bust();await autoBackup();return send(r,200,list)}}

  for(const k of Object.keys(LISTS)){
    if(m==='PUT'&&p==='/api/admin/'+k){const b=await body(q);if(!Array.isArray(b[k]))return send(r,400,{error:'Bad data'});
      const first=Object.keys(LISTS[k])[0];
      const list=b[k].slice(0,100).map(x=>{const o={id:idOk(x.id)?x.id:uuid(),available:!!x.available};for(const f of Object.keys(LISTS[k]))o[f]=sl(x[f],LISTS[k][f]);if(k==='packages')o.recommended=!!x.recommended;return o}).filter(o=>o[first]);
      await store.kvSet(k,list);bust();await autoBackup();return send(r,200,list)}}
  // ---- uploads ----
  if(m==='POST'&&p==='/api/admin/upload-url'){ // Supabase: browser uploads straight to Storage
    if(!SUPA)return send(r,400,{error:'Direct upload is only used with Supabase.'});
    const b=await body(q),name=s(b.name,100).replace(/[^\w.\-]+/g,'_').replace(/^\.+/,''),ext=path.extname(name).toLowerCase(),size=+b.size||0;
    const lim=IMG.includes(ext)?MAX_IMG_MB:(AUD.includes(ext)||VID.includes(ext))?MAX_AUDIO_MB:0;
    if(!lim)return send(r,400,{error:'Use an mp3, m4a, aac, wav, ogg (audio), mp4/webm (video) or jpg, png, webp, gif (image) file.'});
    if(size>lim*1048576)return send(r,413,{error:'File too large (max '+lim+' MB).'});
    const file=uuid()+'-'+name;const uploadUrl=await sb.storage.signUpload(file);
    return send(r,200,{uploadUrl,file,url:'/media/'+file,contentType:MIME[ext]||'application/octet-stream',apikey:process.env.SUPABASE_ANON_KEY||''})}
  if(m==='POST'&&p==='/api/admin/upload'){ // local development: stream to data/media
    if(SUPA)return send(r,400,{error:'Use direct upload.'});
    const name=s(u.searchParams.get('name'),100).replace(/[^\w.\-]+/g,'_').replace(/^\.+/,''),len=+q.headers['content-length']||0;
    const ext=path.extname(name).toLowerCase(),lim=(IMG.includes(ext)?MAX_IMG_MB:MAX_AUDIO_MB)*1048576;
    if(!IMG.includes(ext)&&!AUD.includes(ext)&&!VID.includes(ext))return send(r,400,{error:'Use an mp3, m4a, aac, wav, ogg (audio), mp4/webm (video) or jpg, png, webp, gif (image) file.'});
    if(len>lim)return send(r,413,{error:'File too large (max '+(lim>>20)+' MB).'});
    const file=uuid()+'-'+name,fp=path.join(MEDIA,file),ws=fs.createWriteStream(fp);let n=0,dead=false;
    q.on('data',c=>{n+=c.length;if(n>lim&&!dead){dead=true;ws.destroy();fs.unlink(fp,()=>{});send(r,413,{error:'File too large (max '+(lim>>20)+' MB).'});q.destroy()}});
    ws.on('finish',()=>{if(!dead)send(r,201,{file,url:'/media/'+file,size:n})});ws.on('error',()=>{if(!dead){dead=true;send(r,500,{error:'Upload failed'})}});q.pipe(ws);return}

  // ---- media library ----
  const usedSet=async()=>{const[a,b2,c,d2,e,f,g,h2]=await Promise.all(['djs','shirts','mixtapes','events','news'].map(c=>store.list(c)).concat([store.kvGet('content'),store.kvGet('faq'),store.kvGet('gallery')]));
    const set=mediaRefs([a,b2,c,d2,e,f,g,h2]);c.forEach(x=>x.file&&set.add(x.file));return set};
  if(m==='GET'&&p==='/api/admin/media'){
    let files;if(SUPA)files=await sb.storage.listMedia();else files=(fs.existsSync(MEDIA)?fs.readdirSync(MEDIA):[]).map(f=>{const st=fs.statSync(path.join(MEDIA,f));return{name:f,size:st.size,created:st.mtime.toISOString()}});
    const used=await usedSet();return send(r,200,{files:files.map(f=>({...f,url:'/media/'+f.name,publicUrl:mediaUrl(f.name),used:used.has(f.name)}))})}
  if(m==='POST'&&p==='/api/admin/media/delete-unused'){const used=await usedSet();let files;
    if(SUPA)files=(await sb.storage.listMedia()).map(f=>f.name);else files=fs.existsSync(MEDIA)?fs.readdirSync(MEDIA):[];
    const gone=files.filter(f=>!used.has(f));if(SUPA){if(gone.length)await sb.storage.removeMedia(gone)}else gone.forEach(f=>{try{fs.unlinkSync(path.join(MEDIA,f))}catch{}});return send(r,200,{deleted:gone.length})}
  const dmed=p.match(/^\/api\/admin\/media\/([\w.\-]+)$/);
  if(dmed&&m==='DELETE'){if((await usedSet()).has(dmed[1]))return send(r,409,{error:'This file is still used on the site. Remove it from the page first.'});
    if(SUPA)await sb.storage.removeMedia([dmed[1]]);else try{fs.unlinkSync(path.join(MEDIA,dmed[1]))}catch{}return send(r,200,{ok:true})}
  if(m==='POST'&&p==='/api/admin/media/import-bundled'){if(!SUPA)return send(r,400,{error:'Only needed with Supabase.'});return send(r,200,{copied:await seedMedia(true)})}

  // ---- backups ----
  if(m==='GET'&&p==='/api/admin/backups')return send(r,200,{backups:await bStore.list()});
  if(m==='POST'&&p==='/api/admin/backups'){const x=await makeBackup('manual');await store.kvSet('last_backup',today());return send(r,201,x)}
  if(m==='GET'&&p==='/api/admin/export'){const t=JSON.stringify(await snapshot(),null,1);r.writeHead(200,{'Content-Type':'application/json','Content-Disposition':'attachment; filename="cyber-backup-'+stamp()+'.json"'});return r.end(t)}
  if(m==='POST'&&p==='/api/admin/import'){const b=await body(q,25e6);await restoreSnapshot(b);return send(r,200,{ok:true})}
  const bk=p.match(/^\/api\/admin\/backups\/([\w.\-]+\.json)(\/restore)?$/);
  if(bk&&bName(bk[1])){
    if(m==='GET'&&!bk[2]){const t=await bStore.get(bk[1]);r.writeHead(200,{'Content-Type':'application/json','Content-Disposition':'attachment; filename="'+bk[1]+'"'});return r.end(t)}
    if(m==='POST'&&bk[2]){let snap;try{snap=JSON.parse(await bStore.get(bk[1]))}catch(e){if(e.status)throw e;throw bad(400,'That backup file is damaged.')}await restoreSnapshot(snap);return send(r,200,{ok:true})}
    if(m==='DELETE'&&!bk[2]){await bStore.del(bk[1]);return send(r,200,{ok:true})}}

  if(m==='POST'&&p==='/api/admin/password'){const b=await body(q);
    if(!check(String(b.current||''),adminHash))return send(r,400,{error:'Current password is wrong.'});
    if(String(b.next||'').length<10)return send(r,400,{error:'Use at least 10 characters.'});
    adminHash=hash(String(b.next));hashAt=Date.now();await store.kvSet('admin',adminHash);return send(r,200,{ok:true},{'Set-Cookie':'cy_sid=; Max-Age=0; Path=/'})}
  send(r,404,{error:'Not found'})}

// ---------- static files, media, seo ----------
function localMedia(q,r,u){let f='';try{f=decodeURIComponent(u.pathname.slice(7))}catch{}
  if(!/^[\w.\-]+$/.test(f)){r.writeHead(404);return r.end('Not found')}
  if(SUPA){r.writeHead(302,{Location:sb.storage.publicUrl(f)+(u.searchParams.get('dl')?'?download='+encodeURIComponent(f.replace(/^[0-9a-f-]{36}-/,'')):''),'Cache-Control':'public, max-age=3600'});return r.end()}
  const fp=path.join(MEDIA,f);fs.stat(fp,(e,st)=>{if(e||!st.isFile()){r.writeHead(404);return r.end('Not found')}
    const h={'Content-Type':MIME[path.extname(f).toLowerCase()]||'application/octet-stream','Accept-Ranges':'bytes','Cache-Control':'public, max-age=86400'};
    if(u.searchParams.get('dl'))h['Content-Disposition']='attachment; filename="'+f.replace(/^[0-9a-f-]{36}-/,'')+'"';
    let a=0,b=st.size-1,c=200;const mm=/bytes=(\d*)-(\d*)/.exec(q.headers.range||'');
    if(mm&&(mm[1]||mm[2])){if(mm[1]==='')a=Math.max(0,st.size-+mm[2]);else{a=+mm[1];if(mm[2])b=Math.min(+mm[2],b)}
      if(a>b||a>=st.size){r.writeHead(416,{'Content-Range':'bytes */'+st.size});return r.end()}c=206;h['Content-Range']='bytes '+a+'-'+b+'/'+st.size}
    h['Content-Length']=b-a+1;r.writeHead(c,h);if(q.method==='HEAD')return r.end();fs.createReadStream(fp,{start:a,end:b}).pipe(r)})}
const SITE_PAGES=['/','/events.html','/djs.html','/mixtapes.html','/services.html','/packages.html','/academy.html','/studio.html','/hire.html','/store.html','/gallery.html','/news.html','/how-it-works.html','/about.html','/faq.html','/contact.html','/legal.html'];
function origin(q){const h=q.headers['x-forwarded-host']||q.headers.host||'localhost',pr=q.headers['x-forwarded-proto']||(/^localhost|^127\./.test(h)?'http':'https');return pr+'://'+h}
const SEC={'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'strict-origin-when-cross-origin'};
const handler=async(q,r)=>{
  try{const u=new URL(q.url,'http://x');Object.entries(SEC).forEach(([k,v])=>r.setHeader(k,v));
    if(u.pathname.startsWith('/media/'))return localMedia(q,r,u);
    if(u.pathname.startsWith('/api/'))return await api(q,r,u);
    if(u.pathname==='/robots.txt'){r.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'public, max-age=3600'});return r.end('User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: '+origin(q)+'/sitemap.xml\n')}
    if(u.pathname==='/sitemap.xml'){const o=origin(q);r.writeHead(200,{'Content-Type':'application/xml; charset=utf-8','Cache-Control':'public, max-age=3600'});return r.end('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+SITE_PAGES.map(x=>'<url><loc>'+o+x+'</loc></url>').join('\n')+'\n</urlset>\n')}
    let p=decodeURIComponent(u.pathname);if(p==='/admin')p+='/';if(p.endsWith('/'))p+='index.html';
    const f=path.join(PUB,p);if(!f.startsWith(PUB+path.sep)||/(^|[\\/])\./.test(p)){r.writeHead(403);return r.end('Forbidden')}
    fs.readFile(f,(e,d)=>{if(e){r.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});return fs.readFile(path.join(PUB,'404.html'),(e2,d2)=>r.end(e2?'<h1>404</h1><a href="/">Back home</a>':d2))}
      r.writeHead(200,{'Content-Type':MIME[path.extname(f)]||'application/octet-stream','Cache-Control':p.startsWith('/admin')?'no-store':'public, max-age=300'});r.end(d)});
  }catch(e){console.error('Request error:',e&&e.message||e);if(!r.headersSent)send(r,e&&e.status||500,{error:(e&&e.userMessage)||'Server error'})}
};
module.exports=handler;
module.exports.handler=handler;
if(require.main===module){
  bootstrap().catch(e=>console.error('Startup problem (will retry on the next request):',e.message));
  const srv=http.createServer(handler).listen(PORT,()=>console.log('Cyber Entertainment running on http://localhost:'+PORT+' ('+store.kind+' storage)'));
  srv.requestTimeout=18e5;
}
