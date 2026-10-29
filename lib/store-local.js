'use strict';
// File-based store used for local development (node server.js without Supabase variables).
// Same interface as store-supabase.js. Data lives in data/db.json (collections as arrays, other values as plain keys).
const fs=require('fs'),path=require('path');
const COLS=['gear','djs','shirts','mixtapes','events','news','bookings','subscribers'];
module.exports=function localStore(dir){
  const file=path.join(dir,'db.json');let db;let chain=Promise.resolve();
  const load=()=>{try{db=JSON.parse(fs.readFileSync(file,'utf8'))}catch{db={}}if(!db||typeof db!=='object')db={};COLS.forEach(c=>{if(!Array.isArray(db[c]))db[c]=[]})};
  const flush=()=>{fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(db,null,1));fs.renameSync(file+'.tmp',file)};
  const w=fn=>{const p=chain.catch(()=>{}).then(()=>{const r=fn();flush();return r});chain=p;return p};
  const clone=v=>v===undefined?v:JSON.parse(JSON.stringify(v));
  return{
    kind:'local',
    async init(){load();try{flush()}catch(e){console.error('Could not write data/db.json:',e.message)}},
    async list(c){return clone(db[c]||[])},
    async get(c,id){return clone((db[c]||[]).find(x=>x.id===id)||null)},
    async count(c){return (db[c]||[]).length},
    async replace(c,arr){return w(()=>{db[c]=clone(arr)})},
    async upsert(c,item,opt={}){return w(()=>{const a=db[c]||(db[c]=[]),i=a.findIndex(x=>x.id===item.id);if(i>=0)a[i]=clone(item);else opt.front?a.unshift(clone(item)):a.push(clone(item))})},
    async remove(c,id){return w(()=>{const a=db[c]||[],i=a.findIndex(x=>x.id===id);if(i<0)return false;a.splice(i,1);return true})},
    async kvGet(k){return clone(db[k]===undefined?null:db[k])},
    async kvSet(k,v){return w(()=>{db[k]=clone(v)})},
    async exportAll(){const items={};COLS.forEach(c=>items[c]=clone(db[c]||[]));const kv={};for(const k of Object.keys(db)){if(COLS.includes(k)||k==='admin')continue;kv[k]=clone(db[k])}return{items,kv}},
    async importAll(snap){return w(()=>{for(const c of COLS)if(snap.items&&Array.isArray(snap.items[c]))db[c]=clone(snap.items[c]);for(const k of Object.keys(snap.kv||{}))if(k!=='admin')db[k]=clone(snap.kv[k])})},
    async health(){try{fs.accessSync(dir,fs.constants.W_OK);return{ok:true}}catch{return{ok:false,message:'The data folder is not writable.'}}}
  };
};
module.exports.COLS=COLS;
