// Usage: node scripts/set-domain.js https://www.yourdomain.com
// Makes og:image / og:url absolute (social networks need full links to show the share picture).
const fs=require('fs'),path=require('path');
const d=(process.argv[2]||'').replace(/\/$/,'');if(!/^https?:\/\//.test(d)){console.log('Give your domain, e.g. node scripts/set-domain.js https://www.example.com');process.exit(1)}
const dir=path.join(__dirname,'..','public');
for(const f of fs.readdirSync(dir).filter(x=>x.endsWith('.html'))){
  let s=fs.readFileSync(path.join(dir,f),'utf8');
  s=s.replace(/<meta property="og:image" content="[^"]*">/,'<meta property="og:image" content="'+d+'/assets/og-card.jpg">');
  s=s.replace(/<meta property="og:url" content="[^"]*">/,'');
  s=s.replace('</head>','<meta property="og:url" content="'+d+'/'+(f==='index.html'?'':f)+'"></head>');
  fs.writeFileSync(path.join(dir,f),s);console.log('updated',f)}
