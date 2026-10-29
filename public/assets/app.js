var b=document.querySelector(".burger"),n=document.getElementById("nav");
b.addEventListener("click",function(){var o=n.classList.toggle("open");b.setAttribute("aria-expanded",o)});
function waUrl(t){return "https://wa.me/"+(window.CYWA||"256703046409")+"?text="+encodeURIComponent(t)}
function post(u,o){try{return fetch(u,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(o),keepalive:true})}catch(e){return Promise.reject(e)}}
function orderShirt(b){var s=b.parentNode.querySelector("select").value;window.open(waUrl("Hi Cyber Entertainment, I would like to order: 1 x "+b.dataset.item+" ("+s+") - "+b.dataset.price+"."),"_blank")}
function newsletter(f){var m=f.querySelector(".msg");m.textContent="Sending...";
 post("/api/subscribe",{email:f.querySelector("input").value}).then(function(r){return r.json().then(function(j){m.textContent=r.ok?"Thanks! You are subscribed.":(j.error||"Something went wrong.");if(r.ok)f.reset()})}).catch(function(){m.textContent="Could not subscribe right now. Please message us on WhatsApp."});return false}
var bk=document.getElementById("bk");
if(bk){var q=new URLSearchParams(location.search).get("dj");if(q){var s=document.getElementById("dj");for(var i=0;i<s.options.length;i++)if(s.options[i].text===q)s.selectedIndex=i}
bk.addEventListener("submit",function(e){e.preventDefault();var d=new FormData(bk);
var t="Hi Cyber Entertainment,\nName: "+d.get("n")+"\nPhone: "+d.get("p")+"\nI need: "+d.get("s")+"\nPreferred DJ: "+d.get("d")+"\nEvent date: "+(d.get("dt")||"-")+"\nVenue: "+(d.get("v")||"-")+"\nMessage: "+(d.get("m")||"-");
post("/api/bookings",{n:d.get("n"),p:d.get("p"),s:d.get("s"),dj:d.get("d"),d:d.get("dt"),v:d.get("v"),m:d.get("m")}).catch(function(){});
window.open(waUrl(t),"_blank");var mm=document.getElementById("bkmsg");if(mm)mm.textContent="Thanks! Your request is saved and WhatsApp is opening so you can send it."})}

n.addEventListener("click",function(e){if(e.target.tagName==="A"){n.classList.remove("open");b.setAttribute("aria-expanded","false")}});
(function(){var els=document.querySelectorAll(".card,.stats div,.cta,.evcard,.phead .pimg,.gal figure");
if(!("IntersectionObserver" in window)||matchMedia("(prefers-reduced-motion:reduce)").matches)return;
var io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add("in");io.unobserve(x.target)}})},{rootMargin:"0px 0px -40px 0px"});
els.forEach(function(e){e.classList.add("rv");io.observe(e)});
setTimeout(function(){document.querySelectorAll(".rv:not(.in)").forEach(function(e){e.classList.add("in")})},2500)})();

(function(){var r=document.documentElement,t=document.querySelector(".theme"),mt=document.querySelector('meta[name="theme-color"]');
function cur(){return r.getAttribute("data-theme")==="light"?"light":"dark"}
function sync(){var l=cur()==="light",m=l?"Switch to dark mode":"Switch to light mode";if(t){t.setAttribute("aria-label",m);t.title=m}if(mt)mt.setAttribute("content",l?"#f7f3ec":"#1b1530")}
sync();if(t)t.addEventListener("click",function(){var n=cur()==="light"?"dark":"light";r.setAttribute("data-theme",n);try{localStorage.setItem("cy-theme",n)}catch(e){}sync()});
var h=document.querySelector(".top");if(h&&document.body.classList.contains("home")){function f(){h.classList.toggle("solid",scrollY>40||n.classList.contains("open"))}f();addEventListener("scroll",f,{passive:true});b.addEventListener("click",f)}
window.cyCount=function(date,title){var c=document.getElementById("count");if(!c)return;if(!date){c.hidden=true;return}
var now=new Date(Date.now()+108e5).toISOString().slice(0,10),d=Math.round((Date.parse(date+"T00:00:00Z")-Date.parse(now+"T00:00:00Z"))/864e5);
if(d<0){c.hidden=true;return}c.hidden=false;if(title)c.querySelector('[data-ct="title"]').textContent=title;
c.querySelector('[data-ct="days"]').textContent=d===0?"Today!":d===1?"Tomorrow":d+" days to go"};
var c=document.getElementById("count");if(c)window.cyCount(c.dataset.date,c.dataset.title)})();
