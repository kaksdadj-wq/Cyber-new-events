/* Applies what the admin changed in "Pages & text": text, links, images, videos, hidden sections and page titles/descriptions.
   The last copy is cached in the browser so repeat visits show edits without a flash. Built with DOM calls only (never innerHTML from the network). */
(function(){
var $=function(s,r){return (r||document).querySelector(s)},all=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var st=document.createElement('style');st.textContent='[data-cms-off]{display:none!important}';document.head.appendChild(st);
function safe(u){u=u||'';return /^(https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(u)||/^[\w][\w\-.\/?=&#%]*$/.test(u)}
function inline(s,into){var re=/\^\^([\s\S]+?)\^\^|\*\*([\s\S]+?)\*\*|\*([^*\n]+?)\*/,m;
 while((m=re.exec(s))){if(m.index)into.appendChild(document.createTextNode(s.slice(0,m.index)));
  var e;if(m[1]!=null){e=document.createElement('span');inline(m[1],e)}else if(m[2]!=null){e=document.createElement('strong');inline(m[2],e)}else{e=document.createElement('em');e.textContent=m[3]}
  into.appendChild(e);s=s.slice(m.index+m[0].length)}
 if(s)into.appendChild(document.createTextNode(s))}
function setText(el,txt){if(el.__d===undefined)el.__d=el.innerHTML;var f=document.createDocumentFragment();String(txt).split('\n').forEach(function(ln,i){if(i)f.appendChild(document.createElement('br'));inline(ln,f)});el.replaceChildren(f)}
function apply(c){if(!c)return;
 var T=c.text||{},L=c.links||{},I=c.imgs||{},V=c.videos||{};
 all('[data-cms]').forEach(function(el){var k=el.getAttribute('data-cms');if(k in T)setText(el,T[k]);else if(el.__d!==undefined){el.innerHTML=el.__d;el.__d=undefined}});
 all('[data-cms-href]').forEach(function(el){var k=el.getAttribute('data-cms-href'),v=L[k];if(el.__h===undefined)el.__h=el.getAttribute('href');if(v&&safe(v)){el.setAttribute('href',v);if(/^https?:/i.test(v)){el.target='_blank';el.rel='noopener'}}else el.setAttribute('href',el.__h||'#')});
 all('[data-cms-src]').forEach(function(el){var k=el.getAttribute('data-cms-src'),v=I[k],img=el.tagName==='IMG';
  if(el.__s===undefined)el.__s=img?el.getAttribute('src'):el.style.backgroundImage;
  if(v&&safe(v)){if(img){el.removeAttribute('srcset');el.src=v}else el.style.backgroundImage='url("'+v.replace(/"/g,'%22')+'")'}
  else if(el.__s!==undefined&&el.__s!==null){if(img)el.setAttribute('src',el.__s);else el.style.backgroundImage=el.__s}});
 Object.keys(V).forEach(function(k){var v=V[k];all('[data-cms-video="'+k+'"]').forEach(function(el){
  if(v.poster&&safe(v.poster))el.poster=v.poster;
  if(v.src&&safe(v.src)){var s=$('source',el);if(s&&s.getAttribute('src')!==v.src){s.src=v.src;s.type=/\.webm(\?|$)/i.test(v.src)?'video/webm':'video/mp4';el.load()}}})});
 var hide={};(c.hidden||[]).forEach(function(k){hide[k]=1});
 all('[data-cms-sec]').forEach(function(el){el.toggleAttribute('data-cms-off',!!hide[el.getAttribute('data-cms-sec')])});
 var seo=(c.seo||{})[location.pathname.replace(/index\.html$/,'')]||(c.seo||{})[location.pathname];
 if(seo){if(seo.title){document.title=seo.title;['og:title','twitter:title'].forEach(function(n){var m=$('meta[property="'+n+'"],meta[name="'+n+'"]');if(m)m.setAttribute('content',seo.title)})}
  if(seo.description)['description','og:description','twitter:description'].forEach(function(n){var m=$('meta[name="'+n+'"],meta[property="'+n+'"]');if(m)m.setAttribute('content',seo.description)})}}
try{var raw=localStorage.getItem('cy_cms');if(raw){var c0=JSON.parse(raw);var run=function(){apply(c0)};document.readyState==='loading'?document.addEventListener('DOMContentLoaded',run):run()}}catch(e){}
document.addEventListener('cy:data',function(){var C=window.CYdata;if(!C||!C.cms)return;apply(C.cms);try{localStorage.setItem('cy_cms',JSON.stringify(C.cms))}catch(e){}});
})();
