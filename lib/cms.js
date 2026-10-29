'use strict';
// Page content overrides ("Pages" tab in the admin). The tagged HTML in public/ holds the defaults;
// anything the admin changes is stored as an override and applied by public/cms.js in the visitor's browser.
const fs=require('fs'),path=require('path');
let manifest=null;
const load=()=>{if(manifest)return manifest;try{manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','cms-manifest.json'),'utf8'))}catch{manifest={global:{items:[]},pages:[]}}return manifest};
const defaults=()=>{try{return JSON.parse(fs.readFileSync(path.join(__dirname,'..','data','cms-defaults.json'),'utf8'))}catch{return{faq:[],gallery:[]}}};
const clean=(v,n)=>String(v??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').slice(0,n);
const url=(v,media)=>{v=clean(v,500).trim();if(!v)return'';if(/^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(v))return v;if(/^[\w][\w\-.\/?=&#%]*$/.test(v))return v;return''};
const img=v=>{v=clean(v,500).trim();return /^https?:\/\//i.test(v)||/^\/?[\w][\w\/.\-]*$/.test(v)?v:''};
function keys(){const m=load(),t=new Set(),i=new Set(),h=new Set(),s=new Set(),v=new Set(),p=new Set();
  const add=it=>{if(it.kind==='text'){t.add(it.key);if(it.link)h.add(it.key)}else if(it.kind==='img')i.add(it.key);else if(it.kind==='video')v.add(it.key)};
  m.global.items.forEach(add);m.pages.forEach(pg=>{p.add(pg.path);pg.items.forEach(add);pg.sections.forEach(x=>s.add(x.key))});return{t,i,h,s,v,p}}
// Accepts what the admin sends and keeps only known keys, trimmed and validated.
function sanitize(b){
  const K=keys(),o={text:{},links:{},imgs:{},videos:{},hidden:[],seo:{}};b=b&&typeof b==='object'?b:{};
  for(const[k,v]of Object.entries(b.text||{}))if(K.t.has(k))o.text[k]=clean(v,3000);
  for(const[k,v]of Object.entries(b.links||{}))if(K.h.has(k)){const u=url(v);if(u)o.links[k]=u}
  for(const[k,v]of Object.entries(b.imgs||{}))if(K.i.has(k)){const u=img(v);if(u)o.imgs[k]=u}
  for(const[k,v]of Object.entries(b.videos||{}))if(K.v.has(k)&&v&&typeof v==='object'){const src=img(v.src),poster=img(v.poster);if(src||poster)o.videos[k]={src,poster}}
  o.hidden=(Array.isArray(b.hidden)?b.hidden:[]).filter(k=>K.s.has(k));
  for(const[k,v]of Object.entries(b.seo||{}))if(K.p.has(k)&&v&&typeof v==='object'){const t=clean(v.title,120).trim(),d=clean(v.description,300).trim();if(t||d)o.seo[k]={title:t,description:d}}
  return o}
const empty=()=>({text:{},links:{},imgs:{},videos:{},hidden:[],seo:{}});
module.exports={load,defaults,sanitize,empty,clean,url,img};
