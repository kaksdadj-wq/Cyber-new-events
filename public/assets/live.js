/* Loads live content from /api/content and fills the sections marked data-live. Falls back to the built-in static content if the API is unavailable. */
(function(){
var WA='256703046409';
function E(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function Q(s){return Array.prototype.slice.call(document.querySelectorAll(s))}
function wa(t){return 'https://wa.me/'+WA+'?text='+encodeURIComponent(t)}
function btn(l,h,alt,ext){return '<a class="btn'+(alt?' alt':'')+'" href="'+E(h)+'"'+(ext?' target="_blank" rel="noopener"':'')+'>'+E(l)+'</a>'}
function photo(d,cls){return d&&d.photo?'<img class="'+cls+'" src="'+E(d.photo)+'" alt="'+E(d.name)+'" loading="lazy">':'<div class="avatar">'+E((d&&d.name||'?').slice(0,2).toUpperCase())+'</div>'}
function djCard(d){var t=/\bmc\b|emcee/i.test(d.name);
 return '<article class="card dj">'+photo(d,'ph')+'<h3>'+E(d.name)+'</h3>'+(d.realName?'<p class="nick">'+E(d.realName)+'</p>':'')+'<p class="small">'+E(d.title||'')+(d.genres?' &middot; '+E(d.genres):'')+'</p>'+(d.bio?'<p class="small">'+E(d.bio)+'</p>':'')+btn('Book '+d.name,'contact.html?dj='+encodeURIComponent(d.name).replace(/%20/g,'+'))+(d.instagram?'<p class="small"><a href="'+E(d.instagram)+'">Social profile</a></p>':'')+'</article>'}
function cal(e){var a=new Date(e.date+'T00:00:00'),b=new Date(a.getTime()+864e5),f=function(d){return d.getFullYear()+('0'+(d.getMonth()+1)).slice(-2)+('0'+d.getDate()).slice(-2)};return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(e.title)+'&dates='+f(a)+'/'+f(b)+'&location='+encodeURIComponent(e.venue||'')}
function evCard(e){var ds=e.date?new Date(e.date+'T00:00:00').toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'Date to be confirmed';
 var st={soldout:'Sold out',postponed:'Postponed',cancelled:'Cancelled'}[e.status];
 return '<article class="evcard">'+(e.image?'<img src="'+E(e.image)+'" alt="Flyer for '+E(e.title)+'" loading="lazy">':'')+'<div><h3>'+E(e.title)+(st?' <small class="nick">'+st+'</small>':(e.date&&e.date===new Date(Date.now()+108e5).toISOString().slice(0,10)?' <small class="nick">Today</small>':''))+'</h3><p><b>'+E(ds)+'</b>'+(e.time?'<br>'+E(e.time):'')+(e.venue?'<br>'+E(e.venue):'')+'</p>'+(e.description?'<p>'+E(e.description)+'</p>':'')+(e.lineup?'<p>Line-up: '+E(e.lineup)+'</p>':'')+(e.price?'<p>Tickets: '+E(String(e.price).replace(/\s*[A-Za-z][A-Za-z ]*:\s*$/,'').trim())+'</p>':'')+(e.ticketUrl?btn('Buy tickets',e.ticketUrl,false,true):btn('Ask about tickets',wa("Hi Cyber Entertainment, I'd like tickets for "+e.title+'.')))+(e.date?btn('Add to calendar',cal(e),true,true):'')+'</div></article>'}
function mixCard(m,djs){var d=djs[m.djId],y=(m.link||'').match(/(?:youtu\.be\/|v=)([\w-]{6,})/);
 var th=y?'<img src="https://img.youtube.com/vi/'+y[1]+'/hqdefault.jpg" alt="" loading="lazy">':photo(d,'ph');
 return '<article class="card mix">'+(m.link?'<a href="'+E(m.link)+'" target="_blank" rel="noopener">'+th+'</a>':th)+'<h3>'+E(m.title)+'</h3><p class="small">By '+E(d?d.name:'Cyber Entertainment')+'</p>'+(m.stream?'<audio controls preload="none" src="'+E(m.stream)+'" style="width:100%"></audio>':'')+(m.link?btn('Listen',m.link,true,true):'')+'</article>'}
function shirtCard(s,djs){var d=djs[s.djId],sizes=String(s.sizes||'S,M,L,XL,XXL').split(',').map(function(x){return x.trim()}).filter(Boolean),pr=s.price?'UGX '+Number(s.price).toLocaleString('en-US'):'Ask for price';
 var im=s.image?'<img class="av" src="'+E(s.image)+'" alt="" loading="lazy">':(d&&d.photo?'<img class="av" src="'+E(d.photo)+'" alt="" loading="lazy">':'');
 return '<article class="card">'+im+'<h3>'+E(s.name)+'</h3><p>'+E(s.description||'')+'</p><p><b>'+E(pr)+'</b></p><label class="small">Size <select>'+sizes.map(function(x){return '<option>'+E(x)+'</option>'}).join('')+'</select></label><button class="btn" data-item="'+E(s.name)+'" data-price="'+E(pr)+'" onclick="orderShirt(this)">Order on WhatsApp</button></article>'}
function fill(k,html){Q('[data-live="'+k+'"]').forEach(function(n){n.innerHTML=html})}
function apply(c){
 var s=c.settings||{},djs={};(c.djs||[]).forEach(function(d){djs[d.id]=d});
 if(s.whatsapp)WA=String(s.whatsapp).replace(/\D/g,'')||WA; window.CYWA=WA;
 Q('a[href*="wa.me/"]').forEach(function(a){a.href=a.href.replace(/wa\.me\/\d+/,'wa.me/'+WA)});
 if(s.phone){var p=s.phone.replace(/[^\d+]/g,'');Q('a[href^="tel:"]').forEach(function(a){a.href='tel:'+p;if(a.textContent.replace(/\D/g,'')!==p.replace(/\D/g,''))a.textContent=s.phone})}
 if(s.email)Q('a[href^="mailto:"]').forEach(function(a){a.href='mailto:'+s.email;if(a.textContent.indexOf('@')>-1)a.textContent=s.email});
 ['address','hours'].forEach(function(k){if(s[k])Q('[data-s="'+k+'"]').forEach(function(n){n.textContent=s[k]})});
 ['tiktok','youtube','instagram','facebook'].forEach(function(k){Q('a[data-s="'+k+'"]').forEach(function(a){if(s[k]){a.href=s[k];a.hidden=false}else a.hidden=true})});
 if(c.djs&&c.djs.length){fill('djs',c.djs.map(djCard).join(''));
  fill('djstrip',c.djs.slice(0,5).map(function(d){return '<a class="mini" href="djs.html">'+photo(d,'')+'<span>'+E(d.name)+'</span></a>'}).join(''));
  var sel=document.getElementById('dj');if(sel){sel.innerHTML='<option>Any DJ / no preference</option>'+c.djs.map(function(d){return '<option>'+E(d.name)+'</option>'}).join('');var q=new URLSearchParams(location.search).get('dj');if(q)for(var i=0;i<sel.options.length;i++)if(sel.options[i].text===q)sel.selectedIndex=i}}
 if(c.events){var up=c.events.filter(function(e){return e.date&&e.status!=='cancelled'&&e.status!=='postponed'})[0];
  if(window.cyCount)window.cyCount(up&&up.date,up&&up.title);
  fill('herodate',up?'<span class="d">'+E(new Date(up.date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}))+'</span><span class="v">'+E(up.title)+(up.venue?' &middot; '+E(up.venue):'')+'</span>':'<span class="d">Dates coming soon</span><span class="v">Follow us for updates</span>')}
 if(c.mixtapes&&c.mixtapes.length)fill('featmix',c.mixtapes.slice(0,8).map(function(m){return mixCard(m,djs)}).join(''));
 if(c.shirts&&c.shirts.length)fill('shirtprev',c.shirts.slice(0,6).map(function(x){return shirtCard(x,djs)}).join(''));
 if(c.events)fill('events',c.events.length?c.events.map(evCard).join(''):'<div class="note"><h3>New events are being planned</h3><p>Message us on WhatsApp and we will tell you first when dates and venues are confirmed.</p></div>');
 if(c.mixtapes)fill('mixtapes',c.mixtapes.length?c.mixtapes.map(function(m){return mixCard(m,djs)}).join(''):'<div class="note"><h3>Mixtapes are on the way</h3><p>Check back soon.</p></div>');
 if(c.shirts)fill('shirts',c.shirts.map(function(x){return shirtCard(x,djs)}).join(''));
 if(c.gear)fill('gear',c.gear.map(function(g){return '<article class="card"><h3>'+E(g.name)+'</h3><p>'+E(g.description||'')+'</p>'+(g.price?'<p><b>'+E(g.price)+'</b></p>':'')+'</article>'}).join(''));
 if(c.faq&&c.faq.length)fill('faq',c.faq.map(function(f){return '<details class="ev"><summary>'+E(f.q)+'</summary><p>'+E(f.a)+'</p></details>'}).join(''));
 if(c.gallery&&c.gallery.length)fill('gallery',c.gallery.map(function(g){return '<figure>'+(/\.(mp4|webm)(\?|$)/i.test(g.image)?'<video controls preload="metadata" playsinline src="'+E(g.image)+'" aria-label="'+E(g.alt||g.title||'Video')+'"></video>':'<img src="'+E(g.image)+'" alt="'+E(g.alt||g.title||'')+'" loading="lazy">')+'<figcaption><b>'+E(g.title||'')+'</b> '+E(g.caption||'')+'</figcaption></figure>'}).join(''));
 var L=c.lists||{};
 function lines(t){return String(t||'').split('\n').map(function(x){return x.trim()}).filter(Boolean)}
 function ul(t){var a=lines(t);return a.length?'<ul>'+a.map(function(x){return '<li>'+E(x)+'</li>'}).join('')+'</ul>':''}
 function newsCard(n){var d=n.date?new Date(n.date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'}):'';
  return '<article class="card news">'+(n.image?'<img class="cimg" src="'+E(n.image)+'" alt="" loading="lazy">':'')+(d?'<p class="small">'+E(d)+'</p>':'')+'<h3>'+E(n.title)+'</h3>'+(n.summary?'<p>'+E(n.summary)+'</p>':'')+(n.link?btn('Read more',n.link,true,true):'')+'</article>'}
 if(L.modules&&L.modules.length)fill('modules',L.modules.map(function(m){return '<li><h3>'+E(m.title)+'</h3><p>'+E(m.desc)+'</p></li>'}).join(''));
 if(L.packages&&L.packages.length)fill('packages',L.packages.map(function(p){return '<article class="card pkg'+(p.recommended?' rec':'')+'">'+(p.recommended?'<span class=badge>Recommended</span>':'')+'<h3>'+E(p.name)+'</h3>'+(p.tagline?'<p><i>'+E(p.tagline)+'</i></p>':'')+ul(p.features)+btn('Get a quote','contact.html')+'</article>'}).join(''));
 if(L.evtypes&&L.evtypes.length)fill('evtypes',L.evtypes.map(function(e,i){return '<details class="ev"'+(i?'':' open')+'><summary>'+E(e.title)+'</summary><p>'+(e.tagline?'<b>'+E(e.tagline)+'</b> ':'')+E(e.text)+'</p>'+ul(e.points)+btn('Plan this event','contact.html')+'</details>'}).join(''));
 if(c.news){fill('news',c.news.length?c.news.map(newsCard).join(''):'<div class="note"><h3>No news yet</h3><p>Check back soon, or follow us on TikTok and YouTube.</p></div>');
  fill('newsstrip',c.news.slice(0,3).map(newsCard).join(''));var nb=document.getElementById('newsbox');if(nb)nb.hidden=!c.news.length}
 window.CYdata=c;document.dispatchEvent(new Event('cy:data'));
}
if(!document.querySelector('[data-live],[data-s],a[href*="wa.me/"]'))return;
fetch('/api/content',{cache:'no-store'}).then(function(r){if(!r.ok)throw 0;return r.json()}).then(apply).catch(function(){});
})();
