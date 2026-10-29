#!/usr/bin/env node
'use strict';
// Marks every editable piece of text, link, image, video and section in public/*.html with data-cms* attributes
// and writes data/cms-manifest.json (what the admin "Pages" tab lists) and data/cms-defaults.json (starter FAQ + gallery).
// Safe to run again: existing keys are kept, only new elements get new keys. Only start tags are touched.
//   node scripts/cms-tag.js
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..'),PUB=path.join(ROOT,'public'),DATA=path.join(ROOT,'data');
const VOID=new Set('area base br col embed hr img input link meta source track wbr'.split(' '));
const INLINE=new Set(['b','strong','em','i','br']);
const RAW=new Set(['script','style','svg','noscript','template']);
const SKIP_TAGS=new Set(['option','select','textarea','input','button-none','title','head']);
const DYN_IDS=new Set(['evgrid','djgrid','mixhub','mixroot','mixpanel','agendalist','newsgrid','merchrow','xnlist','bf','nl','faq','y','app']);
const PAGES=fs.readdirSync(PUB).filter(f=>f.endsWith('.html')&&f!=='404.html').sort((a,b)=>a==='index.html'?-1:b==='index.html'?1:a.localeCompare(b)).map(f=>[f,f==='index.html'?'home':f.replace('.html',''),f==='index.html'?'/':'/'+f]);
const ENT={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:'\u00a0',mdash:'—',ndash:'–',hellip:'…',rsquo:'’',lsquo:'‘',ldquo:'“',rdquo:'”',middot:'·',copy:'©',rarr:'→',larr:'←'};
const dec=s=>s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi,(m,e)=>{if(e[0]==='#'){const n=e[1].toLowerCase()==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);return isNaN(n)?m:String.fromCodePoint(n)}return ENT[e.toLowerCase()]??m});
const attr=(s,n)=>{const m=s.match(new RegExp('(?:^|\\s)'+n+'\\s*=\\s*(?:"([^"]*)"|\'([^\']*)\'|([^\\s"\'>]+))','i'));return m?(m[1]??m[2]??m[3]):null};
const hasAttr=(s,n)=>new RegExp('(?:^|\\s)'+n+'(?:\\s*=|\\s|$)','i').test(s);

function parse(src){
  const root={tag:'#root',children:[],attrs:'',parent:null,s:0,e:0,cs:0,ce:src.length};let cur=root;
  const re=/<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;let m;
  while((m=re.exec(src))){
    if(m[0].startsWith('<!--'))continue;
    const close=!!m[1],tag=m[2].toLowerCase();
    if(close){let n=cur;while(n&&n.tag!==tag)n=n.parent;if(n&&n!==root){n.cs2=m.index;n.ce=m.index+m[0].length;cur=n.parent}continue}
    const self=/\/\s*$/.test(m[3])||VOID.has(tag);
    const el={tag,attrs:m[3].replace(/\/\s*$/,''),parent:cur,children:[],s:m.index,e:m.index+m[0].length,cs:m.index+m[0].length,cs2:null,ce:null,startEnd:m.index+m[0].length-(m[0].endsWith('/>')?2:1),selfClose:self};
    cur.children.push(el);
    if(RAW.has(tag)&&!self){const ci=src.toLowerCase().indexOf('</'+tag,el.e);const j=ci<0?src.length:ci;const end=src.indexOf('>',j)+1;el.cs2=j;el.ce=end;re.lastIndex=end;continue}
    if(!self)cur=el;
  }
  return root;
}
const walk=(n,f)=>{n.children.forEach(c=>{f(c);walk(c,f)})};
const text=(src,n)=>n.cs2==null?'':src.slice(n.cs,n.cs2);
const plainSpan=c=>c.tag==='span'&&!c.attrs.trim();
const isLeaf=(src,n)=>{
  if(n.cs2==null||n.selfClose)return false;let ok=true,bold=false,ital=false;
  walk(n,c=>{if(c.tag==='b'||c.tag==='strong')bold=true;if(c.tag==='em'||c.tag==='i')ital=true;if(!INLINE.has(c.tag)&&!plainSpan(c))ok=false});
  if(!ok||(bold&&ital))return false;
  return /[A-Za-z0-9\u00C0-\uFFFF]/.test(dec(text(src,n).replace(/<[^>]*>/g,'')));
};
const toMarkup=h=>{
  let s=h.replace(/\s*\n\s*/g,' ').replace(/<br\s*\/?>/gi,'\n').replace(/<span>([\s\S]*?)<\/span>/gi,'^^$1^^').replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi,'**$2**').replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi,'*$2*').replace(/<[^>]*>/g,'');
  return dec(s).replace(/[ \t]+\n/g,'\n').trim();
};

const manifest={generated:new Date().toISOString(),global:{items:[]},pages:[]},defaults={faq:[],gallery:[]};
const globalSeen=new Set();
for(const [file,slug,url] of PAGES){
  const fp=path.join(PUB,file);if(!fs.existsSync(fp))continue;
  let src=fs.readFileSync(fp,'utf8');const root=parse(src);
  const ins=[]; // {pos,text}
  const counters={};const used=new Set();
  // reuse existing keys
  walk(root,n=>{for(const a of['data-cms','data-cms-src','data-cms-video','data-cms-sec']){const k=attr(n.attrs,a);if(k)used.add(k)}});
  const next=(p)=>{let i=counters[p]||0;let k;do{k=p+(++i)}while(used.has(k));counters[p]=i;used.add(k);return k};
  const body=(function f(n){if(n.tag==='body')return n;for(const c of n.children){const r=f(c);if(r)return r}return null})(root);
  const head=(function f(n){if(n.tag==='head')return n;for(const c of n.children){const r=f(c);if(r)return r}return null})(root);
  const titleM=src.match(/<title>([\s\S]*?)<\/title>/i);
  const descM=src.match(/<meta[^>]*name="description"[^>]*>/i);
  const page={path:url,slug,file,title:titleM?dec(titleM[1]).trim():'',description:descM?dec(attr(descM[0],'content')||''):'',items:[],sections:[]};
  if(!body){manifest.pages.push(page);continue}
  const out=[];
  const inCtx=(n)=>{const ctx={dyn:false,hdr:false,ftr:false,hire:false};for(let p=n;p;p=p.parent){const id=attr(p.attrs,'id');if(id&&DYN_IDS.has(id))ctx.dyn=true;if(id==='hire')ctx.hire=true;if(p.tag==='header')ctx.hdr=true;if(p.tag==='footer')ctx.ftr=true;
    const cl=attr(p.attrs,'class')||'';if(/\b(gear|photo-gallery|ev-empty|lb|nl|xn)\b/.test(cl)||(ctx.hire&&/\bgrid3\b/.test(cl))||/\binfo\b/.test(cl))ctx.dyn=true;if(hasAttr(p.attrs,'data-live')||hasAttr(p.attrs,'data-s')||hasAttr(p.attrs,'data-ct'))ctx.dyn=true}return ctx};
  const add=(n,attrText,key,item)=>{ins.push({pos:n.startEnd,text:' '+attrText});item.key=key;out.push(item)};
  walk(body,n=>{
    if(RAW.has(n.tag)||SKIP_TAGS.has(n.tag))return;
    const ctx=inCtx(n);if(ctx.dyn)return;
    const prefix=ctx.hdr?'g.h':ctx.ftr?'g.f':slug+'.';
    const grp=ctx.hdr?'Header & menu':ctx.ftr?'Footer':null;
    // sections
    if(n.tag==='section'&&!ctx.hdr&&!ctx.ftr&&!hasAttr(n.attrs,'data-cms-sec')){
      const id=attr(n.attrs,'id'),cl=attr(n.attrs,'class')||'';let label='';const h=[];walk(n,c=>{if(/^h[12]$/.test(c.tag)&&!h.length&&c.cs2!=null)h.push(toMarkup(text(src,c)).replace(/\*\*/g,''))});
      label=(h[0]||attr(n.attrs,'aria-label')||id||cl.split(/\s+/)[0]||'Section').replace(/\s+/g,' ');
      const key=slug+'.sec.'+(id||next('s'));if(!used.has(key)||true){used.add(key);ins.push({pos:n.startEnd,text:' data-cms-sec="'+key+'"'});page.sections.push({key,label:label.slice(0,70)})}
    }else if(hasAttr(n.attrs,'data-cms-sec')){page.sections.push({key:attr(n.attrs,'data-cms-sec'),label:attr(n.attrs,'id')||'Section'})}
    // images
    if(n.tag==='img'&&!hasAttr(n.attrs,'data-cms-src')&&attr(n.attrs,'src')){
      const k=next(prefix+'img');add(n,'data-cms-src="'+k+'"',k,{kind:'img',def:dec(attr(n.attrs,'src')),alt:attr(n.attrs,'alt')||'',group:grp});return}
    if(n.tag==='video'&&!hasAttr(n.attrs,'data-cms-video')){
      const sm=n.children.find(c=>c.tag==='source');const k=next(prefix+'video');add(n,'data-cms-video="'+k+'"',k,{kind:'video',def:sm?dec(attr(sm.attrs,'src')):'',poster:dec(attr(n.attrs,'poster')||''),group:grp});return}
    if(n.tag==='source'||n.tag==='img'||n.tag==='video')return;
    // text / links
    if(!hasAttr(n.attrs,'data-cms')&&isLeaf(src,n)){
      const par=n.parent;if(par&&par!==body&&par.tag!=='#root'&&!SKIP_TAGS.has(par.tag)&&isLeaf(src,par))return; // parent is the leaf
      if(n.tag==='a'){
        const href=attr(n.attrs,'href')||'';
        if(hasAttr(n.attrs,'data-k')||/^(tel:|mailto:|https?:\/\/wa\.me)/.test(href)||hasAttr(n.attrs,'data-sol')||/\bskip\b/.test(attr(n.attrs,'class')||''))return;
        const k=next(prefix+'t');add(n,'data-cms="'+k+'" data-cms-href="'+k+'"',k,{kind:'text',link:true,def:toMarkup(text(src,n)),href:dec(href),group:grp});return}
      if(/\btagline\b|\bloc\b|\binfo\b|\bupd\b|\bskip\b/.test(attr(n.attrs,'class')||''))return;
      const k=next(prefix+'t');add(n,'data-cms="'+k+'"',k,{kind:'text',def:toMarkup(text(src,n)),group:grp});return}
    // anchors that wrap non-inline children are skipped (icons etc.)
  });
  // apply insertions (descending so offsets stay valid)
  ins.sort((a,b)=>b.pos-a.pos);let outSrc=src;
  const seenPos=new Set();for(const i of ins){if(seenPos.has(i.pos+i.text))continue;seenPos.add(i.pos+i.text);outSrc=outSrc.slice(0,i.pos)+i.text+outSrc.slice(i.pos)}
  if(outSrc!==src)fs.writeFileSync(fp,outSrc);
  // manifest items: re-read existing tagged ones too (idempotent runs)
  const root2=parse(outSrc),body2=(function f(n){if(n.tag==='body')return n;for(const c of n.children){const r=f(c);if(r)return r}return null})(root2);
  const items=[];
  walk(body2,n=>{
    const ck=attr(n.attrs,'data-cms'),sk=attr(n.attrs,'data-cms-src'),vk=attr(n.attrs,'data-cms-video');
    const ctx=(()=>{let h=false,f=false;for(let p=n;p;p=p.parent){if(p.tag==='header')h=true;if(p.tag==='footer')f=true}return{h,f}})();
    const grp=ctx.h?'Header & menu':ctx.f?'Footer':null;
    if(ck){const href=attr(n.attrs,'data-cms-href');items.push({key:ck,kind:'text',link:!!href,def:toMarkup(text(outSrc,n)),href:href?dec(attr(n.attrs,'href')||''):undefined,group:grp})}
    if(sk)items.push({key:sk,kind:'img',def:dec(attr(n.attrs,'src')||(n.tag==='img'?'':'assets/img/hero-bg.webp')),alt:attr(n.attrs,'alt')||'',group:grp});
    if(vk){const sm=n.children.find(c=>c.tag==='source');items.push({key:vk,kind:'video',def:sm?dec(attr(sm.attrs,'src')):'',poster:dec(attr(n.attrs,'poster')||''),group:grp})}
  });
  for(const it of items){if(it.group){if(!globalSeen.has(it.key)){globalSeen.add(it.key);manifest.global.items.push(it)}}else page.items.push(it)}
  // sections (idempotent)
  page.sections=[];walk(body2,n=>{const k=attr(n.attrs,'data-cms-sec');if(k){const h=[];walk(n,c=>{if(/^h[12]$/.test(c.tag)&&!h.length&&c.cs2!=null)h.push(toMarkup(text(outSrc,c)).replace(/\*\*/g,''))});page.sections.push({key:k,label:(h[0]||attr(n.attrs,'aria-label')||attr(n.attrs,'id')||(attr(n.attrs,'class')||'').split(/\s+/)[0]||'Section').replace(/\s+/g,' ').slice(0,70)})}});
  manifest.pages.push(page);
  // defaults for FAQ + gallery
  if(slug==='faq'){walk(body2,n=>{if(n.tag==='details'){let q='',a='';n.children.forEach(c=>{if(c.tag==='summary')q=toMarkup(text(outSrc,c));if(c.tag==='p')a=toMarkup(text(outSrc,c))});if(q)defaults.faq.push({id:'faq'+(defaults.faq.length+1),q,a,available:true})}})}
  if(slug==='gallery'){walk(body2,n=>{if(n.tag==='article'&&n.parent&&/photo-gallery/.test(attr(n.parent.attrs,'class')||'')){const img=n.children.find(c=>c.tag==='img'),cap=n.children.find(c=>c.tag==='div');let t='',d='';if(cap)cap.children.forEach(c=>{if(c.tag==='h3')t=toMarkup(text(outSrc,c));if(c.tag==='p')d=toMarkup(text(outSrc,c))});if(img)defaults.gallery.push({id:'g'+(defaults.gallery.length+1),image:dec(attr(img.attrs,'src')||''),alt:attr(img.attrs,'alt')||'',title:t,caption:d,available:true})}})}
}
fs.mkdirSync(DATA,{recursive:true});
fs.writeFileSync(path.join(DATA,'cms-manifest.json'),JSON.stringify(manifest));
fs.writeFileSync(path.join(DATA,'cms-defaults.json'),JSON.stringify(defaults,null,1));
console.log('pages:',manifest.pages.length,'global items:',manifest.global.items.length,'page items:',manifest.pages.reduce((a,p)=>a+p.items.length,0),'sections:',manifest.pages.reduce((a,p)=>a+p.sections.length,0),'faq:',defaults.faq.length,'gallery:',defaults.gallery.length);
