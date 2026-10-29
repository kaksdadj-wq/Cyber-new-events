/* Extras: persistent player bar (Spotify style), mix filters and genre pills (Mixcloud style),
   merch search + WhatsApp cart (shop style), and site-wide search. No libraries. */
(function(){
var $=function(s,r){return (r||document).querySelector(s)},$$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
function E(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
var QS=new URLSearchParams(location.search).get('q')||'';

/* ---------- embeds: YouTube, Mixcloud, Spotify, SoundCloud ---------- */
function embedFor(u){var m;if(!u)return null;
 if(m=u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/))([\w-]{6,})/))return{k:'yt',src:'https://www.youtube-nocookie.com/embed/'+m[1]+'?autoplay=1&rel=0',h:219,w:390};
 if(m=u.match(/mixcloud\.com\/([^\/?#]+\/[^\/?#]+)/))return{k:'mc',src:'https://www.mixcloud.com/widget/iframe/?hide_cover=1&autoplay=1&feed='+encodeURIComponent('/'+m[1]+'/'),h:120,w:720};
 if(m=u.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show)\/(\w+)/))return{k:'sp',src:'https://open.spotify.com/embed/'+m[1]+'/'+m[2],h:(m[1]==='track'||m[1]==='episode')?152:352,w:720};
 if(/^https?:\/\/(www\.)?soundcloud\.com\//.test(u))return{k:'sc',src:'https://w.soundcloud.com/player/?auto_play=true&url='+encodeURIComponent(u),h:166,w:720};
 return null}

/* ---------- player bar ---------- */
var bar;
function getBar(){if(bar)return bar;bar=document.createElement('div');bar.className='pbar';bar.hidden=true;bar.setAttribute('role','region');bar.setAttribute('aria-label','Player');
 bar.innerHTML='<div class="phd"><b></b><button type="button" class="pclose" aria-label="Close player">&times;</button></div><div class="pbody"></div>';
 document.body.appendChild(bar);
 $('.pclose',bar).addEventListener('click',function(){bar.hidden=true;$('.pbody',bar).innerHTML='';document.body.classList.remove('has-player')});return bar}
window.cyPlay=function(e,title){var b=getBar(),body=$('.pbody',b),el;$('b',b).textContent=title||'Now playing';body.innerHTML='';
 el=document.createElement('iframe');el.src=e.src;el.height=e.h;el.style.width='100%';el.style.maxWidth=e.w+'px';el.allow='autoplay; encrypted-media';el.title=title||'Player';el.setAttribute('allowfullscreen','');
 body.appendChild(el);b.hidden=false;document.body.classList.add('has-player')};

/* ---------- mix cards: genre pills, play, share ---------- */
var TAGS=[['Afrobeat',/afro/i],['Amapiano',/amapiano/i],['Dancehall',/dancehall|ragga/i],['Hip-Hop',/hip.?hop|trap|\brap\b/i],['R&B',/r&b|rnb/i],['Reggae',/reggae/i],['Gospel',/gospel|worship/i],['Old School',/old.?school|throwback|oldies/i],['Live set',/\blive\b/i],['Scratch',/scratch/i],['Chill',/chill|lounge/i],['Ugandan',/chameleone|bobi wine|fik fameica|alien skin|king saha|ugandan|kampala/i]];
function deco(card){if(card.dataset.d)return;card.dataset.d='1';
 var h=$('h3',card),title=h?h.textContent:'',a=$('a[target]',card),href=a?a.href:'',emb=embedFor(href),small=$('.small',card),
  hay=title+' '+(small?small.textContent:''),tags=TAGS.filter(function(t){return t[1].test(hay)}).map(function(t){return t[0]});
 card.dataset.tags=tags.join('|');card.dataset.q=hay.toLowerCase();card.dataset.href=href;
 if(tags.length&&h){var p=document.createElement('p');p.className='pills';p.innerHTML=tags.slice(0,3).map(function(t){return'<span>'+E(t)+'</span>'}).join('')+(tags.length>3?'<span>+'+(tags.length-3)+'</span>':'');(small||h).after(p)}
 var act=document.createElement('div');act.className='mixact';
 if(emb){a.setAttribute('data-embed','1');var pb=document.createElement('button');pb.type='button';pb.className='btn';pb.setAttribute('data-play','1');pb.textContent='▶ Play';act.appendChild(pb)}
 var l=$('.btn.alt',card);if(l){l.textContent=emb?'Open':l.textContent;act.appendChild(l)}
 if(href){var sb=document.createElement('button');sb.type='button';sb.className='btn alt';sb.setAttribute('data-share','1');sb.textContent='Share';act.appendChild(sb)}
 card.appendChild(act)}
document.addEventListener('click',function(e){var t=e.target,card=t.closest&&t.closest('.card.mix');if(!card)return;
 var pl=t.closest('[data-play]'),em=t.closest('a[data-embed]'),sh=t.closest('[data-share]');
 if(pl||em){var x=embedFor(card.dataset.href);if(x){e.preventDefault();window.cyPlay(x,($('h3',card)||{}).textContent)}}
 if(sh){var u=card.dataset.href,ti=($('h3',card)||{}).textContent;
  if(navigator.share){navigator.share({title:ti,url:u}).catch(function(){})}
  else if(navigator.clipboard){navigator.clipboard.writeText(u).then(function(){sh.textContent='Link copied';setTimeout(function(){sh.textContent='Share'},1800)}).catch(function(){})}}});

/* ---------- mixtapes page filters ---------- */
var mq=$('#mq'),activeTag='';
function mixCards(){return $$('.card.mix',$('[data-live="mixtapes"]')||document)}
function filterMix(){var q=(mq?mq.value:'').trim().toLowerCase(),n=0;
 mixCards().forEach(function(c){var ok=(!activeTag||(c.dataset.tags||'').split('|').indexOf(activeTag)>-1)&&(!q||(c.dataset.q||'').indexOf(q)>-1);c.hidden=!ok;if(ok)n++});
 var none=$('#mnone');if(none)none.hidden=n>0}
function buildTags(){var box=$('#mtags');if(!box)return;var count={};mixCards().forEach(function(c){(c.dataset.tags||'').split('|').filter(Boolean).forEach(function(t){count[t]=(count[t]||0)+1})});
 var names=Object.keys(count).sort(function(a,b){return count[b]-count[a]});
 box.innerHTML='<button type="button" class="chip'+(activeTag?'':' on')+'" data-tag="">All</button>'+names.map(function(t){return'<button type="button" class="chip'+(activeTag===t?' on':'')+'" data-tag="'+E(t)+'">'+E(t)+' <small>'+count[t]+'</small></button>'}).join('')}
if(mq){mq.value=QS;mq.addEventListener('input',filterMix);
 var tb=$('#mtags');if(tb)tb.addEventListener('click',function(e){var b=e.target.closest('[data-tag]');if(!b)return;activeTag=b.dataset.tag;buildTags();filterMix()})}

/* ---------- merch: search + cart ---------- */
var sq=$('#sq');function filterShop(){var q=sq.value.trim().toLowerCase();$$('[data-live="shirts"] .card').forEach(function(c){c.hidden=!!q&&c.textContent.toLowerCase().indexOf(q)<0})}
if(sq){sq.value=QS;sq.addEventListener('input',filterShop)}
var CK='cy-cart',cart=[],cartBtn,cartPanel;
try{cart=JSON.parse(localStorage.getItem(CK)||'[]').filter(function(x){return x&&x.item&&x.qty>0})}catch(e){cart=[]}
function num(p){var m=String(p||'').replace(/,/g,'').match(/\d+/);return m?+m[0]:0}
function ugx(n){return 'UGX '+n.toLocaleString('en-US')}
function saveCart(){try{localStorage.setItem(CK,JSON.stringify(cart))}catch(e){}paintCart()}
function count(){return cart.reduce(function(a,x){return a+x.qty},0)}
function paintCart(){if(!cartBtn)return;var n=count();cartBtn.hidden=!n;cartBtn.textContent='Cart ('+n+')';if(!cartPanel||cartPanel.hidden)return;
 var total=0,known=true;cart.forEach(function(x){var p=num(x.price);if(p)total+=p*x.qty;else known=false});
 $('.cl',cartPanel).innerHTML=cart.length?cart.map(function(x,i){return'<li><div><b>'+E(x.item)+'</b><br><small>Size '+E(x.size)+' &middot; '+E(x.price)+'</small></div><div class="qty"><button type="button" data-q="-1" data-i="'+i+'" aria-label="Fewer">&minus;</button><span>'+x.qty+'</span><button type="button" data-q="1" data-i="'+i+'" aria-label="More">+</button></div></li>'}).join(''):'<li>Your cart is empty.</li>';
 $('.ct',cartPanel).textContent=cart.length?'Total: '+ugx(total)+(known?'':' + items priced on request'):'';
 $('.cs',cartPanel).disabled=!cart.length}
function openCart(){if(!cartPanel){cartPanel=document.createElement('div');cartPanel.className='modal';cartPanel.hidden=true;cartPanel.setAttribute('role','dialog');cartPanel.setAttribute('aria-modal','true');cartPanel.setAttribute('aria-label','Your cart');
 cartPanel.innerHTML='<div class="mbox"><div class="mh"><h2>Your order</h2><button type="button" class="mx" aria-label="Close">&times;</button></div><ul class="cl"></ul><p class="ct"></p><label class="small">Your name<input class="cn" autocomplete="name" placeholder="Name for the order"></label><div class="row"><button type="button" class="btn wa cs">Send order on WhatsApp</button><button type="button" class="btn alt cc">Clear cart</button></div><p class="small">We confirm your order and arrange payment and delivery with you on WhatsApp.</p></div>';
 document.body.appendChild(cartPanel);
 cartPanel.addEventListener('click',function(e){var t=e.target;if(t===cartPanel||t.closest('.mx')){cartPanel.hidden=true;return}
  var q=t.closest('[data-q]');if(q){var it=cart[+q.dataset.i];if(it){it.qty+=+q.dataset.q;if(it.qty<1)cart.splice(+q.dataset.i,1);saveCart()}return}
  if(t.closest('.cc')){cart=[];saveCart();return}
  if(t.closest('.cs')&&cart.length){var total=0;var lines=cart.map(function(x){var p=num(x.price);if(p)total+=p*x.qty;return'- '+x.qty+' x '+x.item+' ('+x.size+') - '+x.price});
   var nm=$('.cn',cartPanel).value.trim();
   window.open(waUrl('Hi Cyber Entertainment, I would like to order:\n'+lines.join('\n')+(total?'\nTotal: '+ugx(total):'')+(nm?'\nName: '+nm:'')),'_blank')}})}
 cartPanel.hidden=false;paintCart()}
function decoShop(card){if(card.dataset.c)return;var ob=$('button[data-item]',card);if(!ob)return;card.dataset.c='1';
 var b=document.createElement('button');b.type='button';b.className='btn alt';b.textContent='Add to cart';b.style.marginTop='.5rem';b.setAttribute('data-add','1');ob.after(b)}
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-add]');if(!b)return;var card=b.closest('.card'),ob=$('button[data-item]',card),sel=$('select',card),size=sel?sel.value:'-';
 var ex=cart.filter(function(x){return x.item===ob.dataset.item&&x.size===size})[0];if(ex)ex.qty++;else cart.push({item:ob.dataset.item,price:ob.dataset.price,size:size,qty:1});
 saveCart();b.textContent='Added ✓';setTimeout(function(){b.textContent='Add to cart'},1200)});
if($('[data-live="shirts"]')){cartBtn=document.createElement('button');cartBtn.type='button';cartBtn.className='cartbtn';cartBtn.addEventListener('click',openCart);document.body.appendChild(cartBtn);paintCart()}

/* ---------- watch for cards rendered by live.js ---------- */
function scan(){var fresh=false;$$('.card.mix').forEach(function(c){if(!c.dataset.d){deco(c);fresh=true}});
 $$('[data-live="shirts"] .card').forEach(decoShop);
 if(fresh){buildTags();filterMix()}if(sq)filterShop()}
scan();
if('MutationObserver' in window){var t;var mo=new MutationObserver(function(){clearTimeout(t);t=setTimeout(scan,30)});$$('[data-live]').forEach(function(n){mo.observe(n,{childList:true})})}

/* ---------- one video at a time ---------- */
document.addEventListener('play',function(e){$$('video').forEach(function(v){if(v!==e.target)v.pause()});if(bar&&!bar.hidden){bar.hidden=true;$('.pbody',bar).innerHTML='';document.body.classList.remove('has-player')}},true);

/* ---------- site search ---------- */
var PAGES=[['Events','events.html','upcoming events tickets shows'],['DJs and MCs','djs.html','book a dj profiles'],['Mixtapes','mixtapes.html','mixes listen music'],['DJ Academy','academy.html','training learn modules'],['Recording studio','studio.html','record podcast voice-over'],['Gear hire','hire.html','equipment speakers controllers mixers'],['Store','store.html','merch t-shirts order'],['Contact and bookings','contact.html','book quote whatsapp phone'],['Services','services.html','weddings clubs corporate'],['Packages','packages.html','prices bundles'],['Gallery','gallery.html','photos'],['How it works','how-it-works.html','steps process deposit'],['FAQ','faq.html','questions answers'],['Why choose us','about.html','about']];
var sm,idx=null;
function load(cb){if(idx)return cb();fetch('/api/content',{cache:'no-store'}).then(function(r){return r.json()}).then(function(c){idx=[];
  (c.events||[]).forEach(function(x){idx.push(['Event',x.title+(x.venue?' - '+x.venue:''),'events.html',x.title+' '+(x.venue||'')+' '+(x.lineup||'')])});
  (c.djs||[]).forEach(function(x){idx.push(['DJ',x.name,'djs.html',x.name+' '+(x.realName||'')+' '+(x.genres||'')])});
  (c.mixtapes||[]).forEach(function(x){idx.push(['Mixtape',x.title,'mixtapes.html?q='+encodeURIComponent(x.title.slice(0,40)),x.title])});
  (c.shirts||[]).forEach(function(x){idx.push(['Merch',x.name,'store.html?q='+encodeURIComponent(x.name),x.name+' '+(x.description||'')])});
  (c.gear||[]).forEach(function(x){idx.push(['Gear',x.name,'hire.html',x.name+' '+(x.description||'')])});
  (c.faq||[]).forEach(function(x){idx.push(['FAQ',x.q,'faq.html',x.q+' '+x.a])});cb()}).catch(function(){idx=[];cb()})}
function results(q){var r=$('.sres',sm);q=q.trim().toLowerCase();if(!q){r.innerHTML='<p class="small">Try: dancehall, wedding, T-shirt, studio, tickets</p>';return}
 var all=PAGES.map(function(p){return['Page',p[0],p[1],p[0]+' '+p[2]]}).concat(idx||[]),words=q.split(/\s+/),hit=all.filter(function(x){var h=x[3].toLowerCase();return words.every(function(w){return h.indexOf(w)>-1})}).slice(0,12);
 r.innerHTML=hit.length?hit.map(function(x){return'<a href="'+E(x[2])+'"><small>'+E(x[0])+'</small><span>'+E(x[1])+'</span></a>'}).join(''):'<p class="small">Nothing found. Message us on WhatsApp and we will help.</p>'}
function openSearch(){if(!sm){sm=document.createElement('div');sm.className='modal';sm.hidden=true;sm.setAttribute('role','dialog');sm.setAttribute('aria-modal','true');sm.setAttribute('aria-label','Search');
  sm.innerHTML='<div class="mbox"><div class="mh"><input type="search" class="si" placeholder="Search events, DJs, mixes, merch, gear" aria-label="Search the site"><button type="button" class="mx" aria-label="Close">&times;</button></div><div class="sres"></div></div>';
  document.body.appendChild(sm);
  sm.addEventListener('click',function(e){if(e.target===sm||e.target.closest('.mx'))sm.hidden=true});
  $('.si',sm).addEventListener('input',function(){results(this.value)})}
 sm.hidden=false;var i=$('.si',sm);i.focus();load(function(){results(i.value)})}
document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('.sbtn'))openSearch()});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){[sm,cartPanel].forEach(function(m){if(m)m.hidden=true})}});
})();
