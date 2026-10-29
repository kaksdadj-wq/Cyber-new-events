'use strict';
// Supabase backend: Postgres (via the PostgREST API) for content + Storage for images, audio and backups.
// Uses only fetch (Node 18+), so there are no npm dependencies. Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server side only).
const COLS=['gear','djs','shirts','mixtapes','events','news','bookings','subscribers'];
const MEDIA_BUCKET=process.env.SUPABASE_MEDIA_BUCKET||'media',BACKUP_BUCKET=process.env.SUPABASE_BACKUP_BUCKET||'backups';
const URL_=(process.env.SUPABASE_URL||'').replace(/\/+$/,''),KEY=process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_SERVICE_KEY||'';
const enabled=()=>!!(URL_&&KEY);
const H=()=>({apikey:KEY,Authorization:'Bearer '+KEY});
const SETUP='Supabase is connected but the database tables are missing. In Supabase open SQL Editor, paste the file supabase/schema.sql from this project and press Run.';
function explain(status,txt){
  let msg=txt;try{const j=JSON.parse(txt);msg=j.message||j.error||j.msg||txt}catch{}
  if(status===404||/PGRST205|PGRST204|does not exist|Could not find the table/i.test(txt))return SETUP;
  if(status===401||status===403||/Invalid API key|JWT/i.test(txt))return 'Supabase rejected the key. Use the service_role key (Project Settings → API) as SUPABASE_SERVICE_ROLE_KEY, not the anon key.';
  return 'Supabase error '+status+': '+String(msg).slice(0,300);
}
async function rest(method,pathq,body,extra={}){
  const r=await fetch(URL_+'/rest/v1/'+pathq,{method,headers:{...H(),'Content-Type':'application/json',...extra},body:body===undefined?undefined:JSON.stringify(body)});
  const t=await r.text();
  if(!r.ok){const e=new Error(explain(r.status,t));e.userMessage=e.message;e.status=502;throw e}
  return t?JSON.parse(t):null;
}
const q=v=>'"'+String(v).replace(/"/g,'\\"')+'"';
const chunks=(a,n)=>{const o=[];for(let i=0;i<a.length;i+=n)o.push(a.slice(i,i+n));return o};
const sortOf=(c,item,i)=>(c==='bookings'||c==='subscribers')?-(Date.parse(item.created)||Date.now()):i;

function store(){
  const rows=(c,items)=>items.map((x,i)=>({collection:c,id:String(x.id),sort:sortOf(c,x,i),data:x}));
  const upsertRows=async rs=>{for(const ch of chunks(rs,200))await rest('POST','cy_items?on_conflict=collection,id',ch,{Prefer:'resolution=merge-duplicates,return=minimal'})};
  const listIds=async c=>{const o=[];for(let off=0;;off+=1000){const p=await rest('GET','cy_items?select=id&collection=eq.'+c+'&limit=1000&offset='+off);o.push(...p.map(x=>x.id));if(p.length<1000)break}return o};
  return{
    kind:'supabase',
    async init(){await rest('GET','cy_kv?select=key&limit=1')},
    async list(c){const o=[];for(let off=0;;off+=1000){const p=await rest('GET','cy_items?select=data&collection=eq.'+c+'&order=sort.asc,id.asc&limit=1000&offset='+off);o.push(...p.map(x=>x.data));if(p.length<1000)break}return o},
    async get(c,id){const p=await rest('GET','cy_items?select=data&collection=eq.'+c+'&id=eq.'+encodeURIComponent(id)+'&limit=1');return p[0]?p[0].data:null},
    async count(c){const r=await fetch(URL_+'/rest/v1/cy_items?select=id&collection=eq.'+c+'&limit=1',{headers:{...H(),Prefer:'count=exact'}});const cr=r.headers.get('content-range')||'';const n=+cr.split('/')[1];return isNaN(n)?0:n},
    async replace(c,arr){
      await upsertRows(rows(c,arr));
      const keep=new Set(arr.map(x=>String(x.id))),old=await listIds(c),gone=old.filter(i=>!keep.has(i));
      for(const ch of chunks(gone,40))await rest('DELETE','cy_items?collection=eq.'+c+'&id=in.('+ch.map(q).join(',')+')',undefined,{Prefer:'return=minimal'});
    },
    async upsert(c,item,opt={}){await upsertRows([{collection:c,id:String(item.id),sort:sortOf(c,item,opt.front?-Date.now():Date.now()),data:item}])},
    async remove(c,id){const p=await rest('DELETE','cy_items?collection=eq.'+c+'&id=eq.'+encodeURIComponent(id),undefined,{Prefer:'return=representation'});return !!(p&&p.length)},
    async kvGet(k){const p=await rest('GET','cy_kv?select=value&key=eq.'+encodeURIComponent(k)+'&limit=1');return p[0]?p[0].value:null},
    async kvSet(k,v){await rest('POST','cy_kv?on_conflict=key',[{key:k,value:v,updated_at:new Date().toISOString()}],{Prefer:'resolution=merge-duplicates,return=minimal'})},
    async exportAll(){const items={};for(const c of COLS)items[c]=await this.list(c);const kv={};const p=await rest('GET','cy_kv?select=key,value&limit=1000');for(const r of p)if(r.key!=='admin')kv[r.key]=r.value;return{items,kv}},
    async importAll(snap){for(const c of COLS)if(snap.items&&Array.isArray(snap.items[c]))await this.replace(c,snap.items[c]);for(const k of Object.keys(snap.kv||{}))if(k!=='admin')await this.kvSet(k,snap.kv[k])},
    async health(){try{await rest('GET','cy_kv?select=key&limit=1');return{ok:true}}catch(e){return{ok:false,message:e.message}}}
  };
}

// ---- Storage ----
async function sreq(method,p,body,headers={}){
  const r=await fetch(URL_+'/storage/v1/'+p,{method,headers:{...H(),...headers},body});
  const t=await r.text();let j=null;try{j=t?JSON.parse(t):null}catch{}
  if(!r.ok){const e=new Error(explain(r.status===400&&/not found|Bucket/i.test(t)?404:r.status,t).replace(SETUP,'The Supabase Storage bucket is missing. Run supabase/schema.sql (it creates the buckets) or create public bucket "'+MEDIA_BUCKET+'" and private bucket "'+BACKUP_BUCKET+'".'));e.status=502;e.userMessage=e.message;e.raw=t;throw e}
  return j;
}
const enc=p=>p.split('/').map(encodeURIComponent).join('/');
const storage={
  publicUrl:f=>URL_+'/storage/v1/object/public/'+MEDIA_BUCKET+'/'+enc(f),
  async ensureBuckets(){
    for(const [id,pub] of [[MEDIA_BUCKET,true],[BACKUP_BUCKET,false]]){
      try{await sreq('POST','bucket',JSON.stringify({id,name:id,public:pub}),{'Content-Type':'application/json'})}catch(e){if(!/already exists|Duplicate|exists/i.test(e.raw||e.message))throw e}
    }
  },
  // direct browser upload: the browser PUTs the file to the returned url, so Vercel's 4.5 MB body limit does not apply
  async signUpload(file){const j=await sreq('POST','object/upload/sign/'+MEDIA_BUCKET+'/'+enc(file),'{}',{'Content-Type':'application/json','x-upsert':'true'});
    const u=j.url||'';return u.startsWith('http')?u:URL_+'/storage/v1'+(u.startsWith('/')?u:'/'+u)},
  async putMedia(file,buf,type){await sreq('POST','object/'+MEDIA_BUCKET+'/'+enc(file),buf,{'Content-Type':type||'application/octet-stream','x-upsert':'true','cache-control':'max-age=31536000'})},
  async listMedia(){const o=[];for(let off=0;;off+=1000){const p=await sreq('POST','object/list/'+MEDIA_BUCKET,JSON.stringify({prefix:'',limit:1000,offset:off,sortBy:{column:'created_at',order:'desc'}}),{'Content-Type':'application/json'});
    o.push(...p.filter(x=>x.id!==null||x.metadata).map(x=>({name:x.name,size:(x.metadata&&x.metadata.size)||0,type:(x.metadata&&x.metadata.mimetype)||'',created:x.created_at})));if(p.length<1000)break}return o},
  async removeMedia(names){for(const ch of chunks(names,100))await sreq('DELETE','object/'+MEDIA_BUCKET,JSON.stringify({prefixes:ch}),{'Content-Type':'application/json'})},
  async putBackup(name,text){await sreq('POST','object/'+BACKUP_BUCKET+'/'+enc(name),text,{'Content-Type':'application/json','x-upsert':'true'})},
  async listBackups(){const p=await sreq('POST','object/list/'+BACKUP_BUCKET,JSON.stringify({prefix:'',limit:1000,offset:0,sortBy:{column:'name',order:'desc'}}),{'Content-Type':'application/json'});
    return p.filter(x=>x.name&&x.name.endsWith('.json')).map(x=>({name:x.name,size:(x.metadata&&x.metadata.size)||0,created:x.created_at}))},
  async getBackup(name){const r=await fetch(URL_+'/storage/v1/object/'+BACKUP_BUCKET+'/'+enc(name),{headers:H()});if(!r.ok)throw Object.assign(new Error('Backup not found'),{status:404,userMessage:'Backup not found'});return r.text()},
  async removeBackup(name){await sreq('DELETE','object/'+BACKUP_BUCKET,JSON.stringify({prefixes:[name]}),{'Content-Type':'application/json'})}
};
module.exports={enabled,store,storage,COLS,MEDIA_BUCKET,BACKUP_BUCKET,URL:()=>URL_};
