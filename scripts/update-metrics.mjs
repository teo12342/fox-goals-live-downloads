import fs from 'node:fs/promises';
const URL='https://www.curseforge.com/members/fox_studios_by_teolm30/projects';
function authorTotals(input) {
  if (typeof input!=='string'||input.length<1000) throw Error('Invalid profile HTML');
  const html=input.replace(/\\+"/g,'"').replace(/&quot;/g,'"').replace(/&#34;/g,'"');
  const counts=[...html.matchAll(/"ownedProjectsCount"\s*:\s*(\d+)/g)];
  const dl=[...html.matchAll(/"downloadCount"\s*:\s*(\d+)/g)];
  let pairs=[];
  for(const c of counts){ for(const d of dl){
    const distance=c.index-d.index;
    if(distance>0&&distance<3000) pairs.push({distance,downloads:Number(d[1]),projects:Number(c[1])});
  }}
  pairs.sort((a,b)=>a.distance-b.distance);
  const good=pairs.find(x=>Number.isSafeInteger(x.downloads)&&x.downloads>0&&Number.isSafeInteger(x.projects)&&x.projects>=20&&x.projects<500);
  if(!good)throw Error('Exact CurseForge author totals absent; do not publish estimated data');
  return good;
}
const requests=[
 {url:URL,headers:{'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36','Accept':'text/html,application/xhtml+xml','Accept-Language':'en-US,en;q=0.9'}},
 {url:'https://r.jina.ai/https://www.curseforge.com/members/fox_studios_by_teolm30/projects',headers:{'Accept':'text/plain','X-Return-Format':'html'}}
];
let metric,errors=[];
for(const entry of requests){try{
  const response=await fetch(entry.url,{headers:entry.headers,signal:AbortSignal.timeout(22000)});
  if(!response.ok)throw Error('HTTP '+response.status);
  const body=await response.text();
  if(body.length>6000000)throw Error('Oversized content');
  metric=authorTotals(body);break;
}catch(e){errors.push(entry.url+': '+String(e?.message||e));}}
if(!metric){console.error('Sources failed:',errors.join(' | '));process.exit(1);}
const path='docs/metrics.json';
let previous=null;try{previous=JSON.parse(await fs.readFile(path,'utf8'));}catch{}
if(previous?.status==='verified'&&metric.downloads<previous.downloadCount){
  console.error('New count fell below last verified value; refusing to publish an unexpected decrease');process.exit(1);
}
const now=new Date().toISOString();
const next={downloadCount:metric.downloads,modsCount:metric.projects,publishedProjects:metric.projects,projectTypes:'all-published',downloadCheckedAt:now,modsCheckedAt:now,downloadDelta:previous?.status==='verified'?metric.downloads-previous.downloadCount:0,modsDelta:previous?.status==='verified'?metric.projects-previous.publishedProjects:0,downloadStatus:'verified',modsStatus:'verified',sourceUrl:URL,source:'official-curseforge-profile',status:'verified'};
await fs.mkdir('docs',{recursive:true});
await fs.writeFile(path,JSON.stringify(next,null,2)+'\n');
console.log('VERIFIED METRICS:',metric.downloads,'downloads',metric.projects,'projects',now);
