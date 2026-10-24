/* Profile Atlas. MIT. Framework-free custom element; public data only. */
const E=(tag,cls='',label)=>{const n=document.createElement(tag);n.className=cls;if(label!==undefined)n.textContent=String(label);return n};
const ACTIVITY_LABELS={star:'Star',fork:'Fork',project:'New repo',commit:'Push'};
function activityIcon(type){
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','25');svg.setAttribute('height','25');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.65');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('stroke-linecap','round');svg.setAttribute('aria-hidden','true');
 const make=(tag,attributes)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);svg.append(node)};
 if(type==='star')make('path',{d:'m12 2.9 2.8 5.7 6.3.9-4.55 4.44 1.08 6.27L12 17.25l-5.63 2.96 1.08-6.27L2.9 9.5l6.3-.9L12 2.9Z'});
 if(type==='fork'){make('circle',{cx:6,cy:4,r:2});make('circle',{cx:18,cy:4,r:2});make('circle',{cx:12,cy:20,r:2});make('path',{d:'M6 6v4a6 6 0 0 0 6 6m6-10v4a6 6 0 0 1-6 6v2'})}
 if(type==='project'){make('path',{d:'M5 3.5h10l4 4V20H5a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Zm10 0v4h4'});make('path',{d:'M8 13h8m-4-4v8'})}
 if(type==='commit'){make('path',{d:'M12 17V3m-5 5 5-5 5 5M5 15v5h14v-5'})}
 return svg;
}
const url=s=>{try{const u=new URL(s);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return''}};
const when=s=>{const d=new Date(s);return Number.isNaN(+d)?'Undated':d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})};
const cacheRead=k=>{try{const o=JSON.parse(localStorage.getItem(k));return o&&Date.now()-o.t<21600000?o.data:null}catch{return null}};
const cacheWrite=(k,data)=>{try{localStorage.setItem(k,JSON.stringify({t:Date.now(),data}))}catch{}};
async function pages(path,headers,signal,max){
 const out=[];let capped=false;
 for(let page=1;page<=max;page++){
  const sep=path.includes('?')?'&':'?';
  const r=await fetch('https://api.github.com'+path+sep+'per_page=100&page='+page,{headers,signal});
  if(!r.ok)throw Error(r.status===403||r.status===429?'GitHub API rate limit reached':'GitHub API HTTP '+r.status);
  const a=await r.json();if(!Array.isArray(a))throw Error('Invalid GitHub response');
  out.push(...a);if(a.length<100)return {items:out,capped:false};capped=true;
 }
 return{items:out,capped};
}
const repoToItem=r=>({id:'repo:'+r.full_name,type:r.fork?'fork':'project',title:r.name,summary:r.description||'GitHub repository',body:'',repo:r.full_name,url:url(r.html_url),demoUrl:url(r.homepage),image:'',preview:'link',date:r.created_at,language:r.language||'',featured:false});
const eventToCommit=e=>({id:'push:'+e.id,type:'commit',title:'Code push',summary:'A public push event; this event does not necessarily represent one commit.',repo:e.repo?.name||'',url:url(e.repo?.name?'https://github.com/'+e.repo.name:''),date:e.created_at,activityCount:1,source:'github-public-events'});
const manifestItem=(r,type,i)=>({id:r.id||type+':'+i,type,title:r.title||'Untitled',summary:r.summary||'',body:r.body||'',repo:r.repo||'',url:url(r.url),demoUrl:url(r.demoUrl),image:url(r.image),preview:['iframe','video','image','link'].includes(r.preview)?r.preview:'link',date:r.date||'',language:r.language||'',featured:!!r.featured});
function merge(repos,stars,manifest){
 const exclusions=(manifest.excludeRepos||[]).map(x=>String(x).toLowerCase());
 const permitted=r=>!exclusions.some(x=>(r.full_name||'').toLowerCase().includes(x)||(r.name||'').toLowerCase().includes(x));
 const owned=repos.filter(r=>permitted(r)&&(manifest.projectVisibility!=='curated'||r.fork)).map(repoToItem), byRepo=new Map(owned.map(x=>[x.repo.toLowerCase(),x]));
 const extras=[];
 (manifest.projects||[]).forEach((r,i)=>{const item=manifestItem(r,'project',i);item.curatedOrder=i;const match=item.repo&&byRepo.get(item.repo.toLowerCase());if(match)Object.assign(match,item,{id:match.id,type:match.type});else extras.push(item)});
 const starItems=stars.filter(x=>permitted(x.repo||x)).map(x=>{const r=x.repo||x;return {...repoToItem(r),id:'star:'+r.full_name,type:'star',date:x.starred_at||''}});
 const stories=(manifest.stories||[]).map((x,i)=>manifestItem(x,'story',i));
 const inspiration=(manifest.inspirations||[]).map((x,i)=>manifestItem(x,'inspiration',i));
 return [...owned,...extras,...starItems,...stories,...inspiration];
}
function unfeaturedMonthlyCounts(repos,manifest){
 if(manifest.projectVisibility!=='curated')return[];
 const featured=new Set((manifest.projects||[]).map(x=>String(x.repo||'').toLowerCase()).filter(Boolean));
 const counts=new Map();
 for(const r of repos){
  if(r.fork||featured.has(String(r.full_name||'').toLowerCase()))continue;
  const d=new Date(r.created_at);if(Number.isNaN(+d))continue;
  const year=d.getUTCFullYear(),month=d.getUTCMonth()+1,key=year+'-'+String(month).padStart(2,'0');
  counts.set(key,(counts.get(key)||0)+1);
 }
 return [...counts.entries()].map(([month,count])=>({id:'unfeatured-month:'+month,type:'project',title:'Unfeatured repository creations',summary:count+' public repositories were created in '+new Date(month+'-01T00:00:00Z').toLocaleDateString(undefined,{month:'long',year:'numeric'})+'. Titles and links are intentionally withheld.',date:month+'-01T00:00:00Z',activityCount:count,aggregate:true}));
}
function monthlyPushCounts(pushes){
 const groups=new Map();for(const event of pushes){const date=new Date(event.date);if(Number.isNaN(+date))continue;const period=date.toISOString().slice(0,7);groups.set(period,(groups.get(period)||0)+1)}
 return [...groups].map(([period,count])=>({id:'public-push-month:'+period,type:'commit',title:'Public code pushes',summary:count+' recent public push event'+(count===1?'':'s')+' in '+period+'. Repository names and commit contents are omitted here.',date:period+'-01T00:00:00Z',activityCount:count,aggregate:true,source:'github-public-events'}));
}
function snapshotToItems(manifest,missingTypes){
 const types=['star','fork','project'],labels={star:'Starred discoveries',fork:'Forks created',project:'Repositories created'},date=manifest.activitySnapshotRecordedAt||'an earlier date';
 return (manifest.activitySnapshot||[]).flatMap(row=>types.flatMap((type,index)=>{
  const count=Number(row[index+1]);if(!missingTypes.has(type)||!Number.isFinite(count)||count<=0||!/^[0-9]{4}-[0-9]{2}$/.test(row[0]))return[];
  return[{id:'public-snapshot:'+row[0]+':'+type,type,title:labels[type],summary:count+' '+type+' activities recorded in '+row[0]+' (public monthly snapshot taken '+date+'). Individual names are omitted in the fallback.',date:row[0]+'-01T00:00:00Z',activityCount:count,aggregate:true,source:'monthly-snapshot'}]
 }));
}
const sorted=(items,kind)=>{const a=kind==='all'?[...items]:items.filter(x=>x.type===kind);return kind==='story'||kind==='inspiration'?a:a.sort((x,y)=>kind==='project'?(Number(y.featured)-Number(x.featured)||(x.curatedOrder??Infinity)-(y.curatedOrder??Infinity)||+new Date(y.date||0)-+new Date(x.date||0)):+new Date(y.date||0)-+new Date(x.date||0))};
/** Independent, framework-free GitHub activity railway. Set .events or use username. */
class GithubActivityTimeline extends HTMLElement{
 static get observedAttributes(){return ['username','max-pages']}
 constructor(){super();this.attachShadow({mode:'open'});this._events=[];this._loadId=0;this._ready=false;const css=E('link'),graphcss=E('link');css.rel='stylesheet';css.href=new URL('./profile-atlas.css',import.meta.url).href;graphcss.rel='stylesheet';graphcss.href=new URL('./github-activity-timeline.css',import.meta.url).href;this.surface=E('section','timeline-section graph-section');this.shadowRoot.append(css,graphcss,this.surface)}
 set events(value){this._events=Array.isArray(value)?value:[];this._ready=true;this._loadId++;if(this.isConnected)this.render()}
 get events(){return this._events}
 connectedCallback(){if(this._ready)this.render();else this.load()}
 disconnectedCallback(){this._loadId++;this.controller?.abort()}
 attributeChangedCallback(){if(this.isConnected&&!this._ready)this.load()}
 async load(){
  const username=(this.getAttribute('username')||'').trim();if(!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username)){this.surface.replaceChildren(E('p','notice','Set a GitHub username or provide an events array.'));return}
  const id=++this._loadId;this.controller?.abort();this.controller=new AbortController();this.surface.replaceChildren(E('p','notice','Loading public activity…'));
  try{
   const max=Math.max(1,Math.min(30,Number(this.getAttribute('max-pages')||10)||10));
   const key='profile-atlas:v2:'+username+':'+max;let data=cacheRead(key)||cacheRead('profile-atlas:v1:'+username+':'+max);
   if(!data){
    const path='/users/'+encodeURIComponent(username),results=await Promise.allSettled([pages(path+'/repos?type=owner&sort=created',{},this.controller.signal,max),pages(path+'/starred',{'Accept':'application/vnd.github.star+json'},this.controller.signal,max),pages(path+'/events/public',{},this.controller.signal,3)]);
    if(results.every(x=>x.status==='rejected'))throw results[0].reason;
    data={repos:results[0].status==='fulfilled'?results[0].value.items:[],stars:results[1].status==='fulfilled'?results[1].value.items:[],pushes:results[2].status==='fulfilled'?results[2].value.items.filter(x=>x.type==='PushEvent'):[]};if(results.some(x=>x.status==='fulfilled'))cacheWrite(key,data)
   }
   if(!('pushes' in data)){try{const p=await pages('/users/'+encodeURIComponent(username)+'/events/public',{},this.controller.signal,3);data.pushes=p.items.filter(x=>x.type==='PushEvent');cacheWrite(key,data)}catch{data.pushes=[]}}
   if(id!==this._loadId)return;
   const owned=data.repos.map(repoToItem),starred=data.stars.map(x=>({...repoToItem(x.repo||x),id:'star:'+((x.repo||x).full_name),type:'star',date:x.starred_at||''})),pushes=(data.pushes||[]).map(eventToCommit);this._events=[...owned,...starred,...pushes];this._ready=true;this.render();
  }catch(e){if(id===this._loadId&&e.name!=='AbortError')this.surface.replaceChildren(E('p','notice',e.message||'Unable to load GitHub activity.'))}
 }
 open(items,label){const event=new CustomEvent('activity-open',{detail:{items,label},bubbles:true,composed:true,cancelable:true});this.dispatchEvent(event);if(!event.defaultPrevented)this.showDetails(items,label)}
 showDetails(items,label){
  this.surface.querySelector('.graph-drawer')?.remove();const drawer=E('div','graph-drawer');drawer.setAttribute('role','region');drawer.setAttribute('aria-label',label);const head=E('div','graph-drawer-head'),close=E('button','','×');close.setAttribute('aria-label','Close activity details');close.onclick=()=>drawer.remove();head.append(E('strong','',label),close);drawer.append(head);
  for(const item of items){const row=E('div','graph-drawer-item');const link=item.url?E('a','',item.title):E('strong','',item.title);if(item.url){link.href=item.url;link.target='_blank';link.rel='noopener noreferrer'}row.append(link,E('small','',item.summary||item.type));drawer.append(row)}this.surface.append(drawer)
 }
 render(){
  this.surface.replaceChildren();const events=this._events.filter(x=>['project','star','fork','commit'].includes(x.type)&&x.date&&!Number.isNaN(+new Date(x.date)));
  const header=E('div','timeline-heading graph-heading'),intro=E('div');intro.append(E('h2','','GitHub activity'));
  const legend=E('div','graph-legend');for(const [type,label] of Object.entries(ACTIVITY_LABELS)){const x=E('span','legend '+type);x.append(activityIcon(type),E('span','',label));legend.append(x)}const more=E('button','graph-more','More ↗');more.onclick=()=>this.open(events.slice().sort((a,b)=>+new Date(b.date)-+new Date(a.date)),'All recorded activity');const aside=E('div','graph-heading-actions');aside.append(legend,more);header.append(intro,aside);this.surface.append(header);
  if(!events.length){this.surface.append(E('p','notice','No dated public GitHub events yet.'));return}
  const dates=events.map(x=>+new Date(x.date)),first=new Date(Math.min(...dates)),last=new Date(Math.max(...dates)),firstMonth=first.getUTCFullYear()*12+first.getUTCMonth(),lastMonth=last.getUTCFullYear()*12+last.getUTCMonth(),months=lastMonth-firstMonth+1,step=150,width=months*step+110;
  const viewport=E('div','graph-viewport');viewport.tabIndex=0;viewport.setAttribute('role','region');viewport.setAttribute('aria-label','Horizontal GitHub activity graph. Drag sideways or use arrow buttons.');const rail=E('div','graph-rail');rail.style.width=width+'px';
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 '+width+' 395');svg.setAttribute('width',width);svg.setAttribute('height','395');svg.classList.add('graph-lines');const path=(d,cls)=>{const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',d);p.setAttribute('class',cls);svg.append(p)};
  path(`M 24 183 H ${width-34} M ${width-43} 176 L ${width-33} 183 L ${width-43} 190`,'graph-main-line');
  const startDot=document.createElementNS('http://www.w3.org/2000/svg','circle');startDot.setAttribute('cx','24');startDot.setAttribute('cy','183');startDot.setAttribute('r','6');startDot.setAttribute('class','graph-origin');svg.append(startDot);
  const grouped=new Map();for(const item of events){const d=new Date(item.date),month=d.getUTCFullYear()*12+d.getUTCMonth()-firstMonth,key=month+':'+item.type;if(!grouped.has(key))grouped.set(key,{type:item.type,month,items:[]});grouped.get(key).items.push(item)}
  const columns=new Set();for(const {month} of grouped.values())columns.add(month);
  for(const month of columns){const x=70+month*step;path(`M ${x} 179 L ${x} 187`,'graph-tick')}
  for(const group of grouped.values()){
   const x=70+group.month*step,total=group.items.reduce((s,i)=>s+(i.activityCount||1),0),monthDate=new Date(Date.UTC(Math.floor((firstMonth+group.month)/12),(firstMonth+group.month)%12,1)),period=monthDate.toLocaleDateString(undefined,{year:'numeric',month:'long'}),t=group.type;
   const px=(t==='star'||t==='project')?x-34:x+34,py=t==='star'?75:t==='fork'?125:t==='project'?245:304;
   if(t==='star')path(`M ${x} 183 C ${x} 129 ${px} 131 ${px} ${py+22}`,'graph-branch star');
   if(t==='fork')path(`M ${x} 183 C ${x} 155 ${px} 150 ${px} ${py+22}`,'graph-branch fork');
   if(t==='project')path(`M ${x} 183 C ${x} 207 ${px} 211 ${px} ${py-22}`,'graph-branch project');
   if(t==='commit')path(`M ${x} 183 C ${x} 245 ${px} 247 ${px} ${py-22}`,'graph-branch commit');
   const node=E('button','graph-event '+t);node.type='button';node.style.left=px+'px';node.style.top=py+'px';node.append(activityIcon(t));node.setAttribute('aria-label',ACTIVITY_LABELS[t]+', '+period+', '+total+' activities');node.title=ACTIVITY_LABELS[t]+' · '+period;node.onclick=()=>this.open(group.items,ACTIVITY_LABELS[t]+' · '+period);rail.append(node)
  }
  const axis=E('div','graph-axis');for(let m=0;m<months;m++){const v=firstMonth+m,year=Math.floor(v/12),month=v%12;if(m===0||month===0||month===3||month===6||month===9){const tick=E('span','graph-axis-tick',month===0?String(year):['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month]);tick.style.left=(70+m*step)+'px';axis.append(tick)}}rail.append(svg,axis);viewport.append(rail);this.surface.append(viewport);
  const bottom=E('div','timeline-bottom graph-bottom'),controls=E('div','timeline-controls'),back=E('button','timeline-arrow','←'),next=E('button','timeline-arrow','→');back.setAttribute('aria-label','Earlier');next.setAttribute('aria-label','Later');back.onclick=()=>viewport.scrollBy({left:-step*4,behavior:'smooth'});next.onclick=()=>viewport.scrollBy({left:step*4,behavior:'smooth'});controls.append(back,next);bottom.append(controls);this.surface.append(bottom);
  const analysis=E('section','monthly-analysis'),analysisHead=E('div','monthly-analysis-head');analysisHead.append(E('h3','','Monthly analysis'));
  const monthsList=[...new Set(events.map(x=>new Date(x.date).toISOString().slice(0,7)))].sort().reverse(),selector=E('select','month-select');selector.setAttribute('aria-label','Month');
  for(const month of monthsList){const option=E('option','',new Date(month+'-01T00:00:00Z').toLocaleDateString(undefined,{month:'short',year:'numeric'}));option.value=month;selector.append(option)}analysisHead.append(selector);
  const metrics=E('div','monthly-metrics'),note=E('p','monthly-note','Push: recent public events only · not a complete commit history.');
  const update=()=>{const counts={star:0,fork:0,project:0,commit:0};for(const item of events)if(new Date(item.date).toISOString().startsWith(selector.value))counts[item.type]+=item.activityCount||1;metrics.replaceChildren();for(const type of ['star','fork','project','commit']){const group=E('div','monthly-metric '+type),label=E('span','monthly-metric-label');label.append(activityIcon(type),E('span','',ACTIVITY_LABELS[type]));group.append(label,E('strong','',String(counts[type])));metrics.append(group)}};
  selector.onchange=update;analysis.append(analysisHead,metrics,note);this.surface.append(analysis);update();
  let drag=null;viewport.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;drag={x:e.clientX,scroll:viewport.scrollLeft};viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging')});viewport.addEventListener('pointermove',e=>{if(drag)viewport.scrollLeft=drag.scroll+drag.x-e.clientX});const end=()=>{drag=null;viewport.classList.remove('dragging')};viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);viewport.addEventListener('wheel',e=>{if(e.shiftKey){e.preventDefault();viewport.scrollLeft+=e.deltaY}},{passive:false});
  requestAnimationFrame(()=>{if(viewport.isConnected)viewport.scrollLeft=viewport.scrollWidth-viewport.clientWidth});
 }
}
if(!customElements.get('github-activity-timeline'))customElements.define('github-activity-timeline',GithubActivityTimeline);
class ProfileAtlas extends HTMLElement{
 static get observedAttributes(){return['username','manifest-url','max-pages']}
 constructor(){super();this.attachShadow({mode:'open'});this.items=[];this.hiddenMonthly=[];this.kind='project';this.pos={};this.pending=true;this.message='';this.loadId=0;this.lastWidth=0;this.root=E('div','atlas');const link=E('link'),newStyles=E('link');link.rel=newStyles.rel='stylesheet';link.href=new URL('./profile-atlas.css',import.meta.url).href;newStyles.href=new URL('./mellow-overrides.css',import.meta.url).href;this.shadowRoot.append(link,newStyles,this.root);this.keydown=this.keydown.bind(this)}
 connectedCallback(){if(['project','star','fork','story','inspiration'].includes(this.getAttribute('row')))this.kind=this.getAttribute('row');this.root.addEventListener('keydown',this.keydown);this.resize=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width||0;if(Math.abs(width-this.lastWidth)>3){this.lastWidth=width;if(!this.pending)this.gallery()}});this.resize.observe(this);this.load()}
 disconnectedCallback(){this.loadId++;this.controller?.abort();this.resize?.disconnect();this.root.removeEventListener('keydown',this.keydown)}
 attributeChangedCallback(){if(this.isConnected)this.load()}
 get username(){return(this.getAttribute('username')||'').trim()}
 get limit(){const n=Number(this.getAttribute('max-pages')||10);return Math.max(1,Math.min(30,Number.isFinite(n)?Math.floor(n):10))}
 get collection(){return sorted(this.items,this.kind)}
 keydown(e){if(e.target.closest('input,select,[role=dialog],.timeline-board'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();this.shift(e.key==='ArrowRight'?1:-1)}}
 async load(){
  const current=++this.loadId;this.controller?.abort();this.controller=new AbortController();this.pending=true;this.message='';this.render();
  if(!/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(this.username)){this.pending=false;this.message='Choose a valid GitHub username.';this.render();return}
  const key='profile-atlas:v2:'+this.username+':'+this.limit;
  try{
   let data=cacheRead(key)||cacheRead('profile-atlas:v1:'+this.username+':'+this.limit);
   if(!data){
    const path='/users/'+encodeURIComponent(this.username);
    const responses=await Promise.allSettled([pages(path+'/repos?type=owner&sort=created',{},this.controller.signal,this.limit),pages(path+'/starred',{'Accept':'application/vnd.github.star+json'},this.controller.signal,this.limit),pages(path+'/events/public',{},this.controller.signal,3)]);
    const r=responses[0].status==='fulfilled'?responses[0].value:{items:[],capped:false};
    const s=responses[1].status==='fulfilled'?responses[1].value:{items:[],capped:false},p=responses[2].status==='fulfilled'?responses[2].value:{items:[],capped:false};
    data={repos:r.items,stars:s.items,pushes:p.items.filter(e=>e.type==='PushEvent'),warning:(r.capped||s.capped?'Reached '+(this.limit*100)+' entries per feed. Increase max-pages. ':'')+(responses.some(x=>x.status==='rejected')?'One or more live GitHub feeds are unavailable; a dated public snapshot may be shown.':'')};if(responses.some(x=>x.status==='fulfilled'))cacheWrite(key,data);
   }
   if(!('pushes' in data)){try{const p=await pages('/users/'+encodeURIComponent(this.username)+'/events/public',{},this.controller.signal,3);data.pushes=p.items.filter(e=>e.type==='PushEvent');cacheWrite(key,data)}catch{data.pushes=[]}}
   let manifest={};const manifestPath=this.getAttribute('manifest-url');
   if(manifestPath){const u=new URL(manifestPath,document.baseURI);if(!['http:','https:'].includes(u.protocol))throw Error('Manifest must use HTTPS or HTTP');const r=await fetch(u.href,{signal:this.controller.signal});if(!r.ok)throw Error('Manifest HTTP '+r.status);manifest=await r.json()}
   if(current!==this.loadId)return;
   this.items=merge(data.repos,data.stars,manifest);
   const knownDates=new Map(data.repos.map(r=>[String(r.full_name||'').toLowerCase(),r.created_at]));
   for(const item of this.items)if(item.type==='project'&&item.repo&&!item.date&&knownDates.has(item.repo.toLowerCase()))item.date=knownDates.get(item.repo.toLowerCase());
   const missing=new Set();if(!data.repos.length){missing.add('project');missing.add('fork')}if(!data.stars.length)missing.add('star');
   this.hiddenMonthly=[...unfeaturedMonthlyCounts(data.repos,manifest),...snapshotToItems(manifest,missing),...(manifest.projectVisibility==='curated'?monthlyPushCounts((data.pushes||[]).map(eventToCommit)):(data.pushes||[]).map(eventToCommit))];
   this.message=data.warning||'';this.pending=false;this.render();this.dispatchEvent(new CustomEvent('atlas-ready',{detail:{count:this.items.length},bubbles:true}));
  }catch(e){if(current!==this.loadId||e.name==='AbortError')return;this.pending=false;this.message=e.message||'Unable to load activity.';this.render()}
 }
 render(){
  this.root.replaceChildren();
  const compact=this.hasAttribute('compact');
  const bar=E('div','toolbar'),tabs=E('nav','tabs');tabs.setAttribute('aria-label','Choose a collection');
  if(!compact)for(const [key,label] of [['project','Made'],['star','Saved'],['fork','Remixed']]){
   const b=E('button','tab'+(this.kind===key?' on':''));b.type='button';b.append(E('span','',label));b.setAttribute('aria-pressed',String(this.kind===key));b.onclick=()=>{this.kind=key;this.pos[key]=0;this.gallery();tabs.querySelectorAll('button').forEach(x=>{x.classList.remove('on');x.setAttribute('aria-pressed','false')});b.classList.add('on');b.setAttribute('aria-pressed','true')};tabs.append(b)
  }
  const browse=E('button','browse','Browse all ↗');browse.type='button';browse.onclick=()=>this.openIndex(this.collection,this.kind==='project'?'All projects':this.kind==='star'?'Starred discoveries':this.kind==='fork'?'Forked repositories':'All entries');bar.append(tabs,browse);this.main=E('main','main');
  if(this.pending)this.main.append(E('p','notice','Collecting public GitHub activity…'));
  else if(!this.items.length)this.main.append(E('p','notice',this.message||'No public items were found.'));
  else this.gallery();
  const footer=E('footer','footer');const a=E('a','','Source: public GitHub activity');a.href='https://github.com/'+encodeURIComponent(this.username);a.target='_blank';a.rel='noopener noreferrer';footer.append(a,E('span','',' · Stars use starred-at dates; forks use creation dates.'));
  if(compact){this.root.append(this.main)}else{this.root.append(bar,this.main);if(!this.pending&&this.items.length)this.root.append(this.timeline());if(this.message)this.root.append(E('p','note',this.message));this.root.append(footer)}
 }
 shift(d){const n=this.collection.length;if(!n)return;this.pos[this.kind]=((this.pos[this.kind]||0)+d%n+n)%n;this.gallery()}
 gallery(){
  if(!this.main)return;this.main.replaceChildren();const items=this.collection;
  if(!items.length){this.main.append(E('p','notice','Nothing here yet.'));return}
  if(this.kind==='story')this.tossGallery(items);else this.splayGallery(items);
 }
 galleryNavigation(n,selected,container){
  const nav=E('div','mellow-nav'),prev=E('button','mellow-arrow','←'),next=E('button','mellow-arrow','→');
  prev.type=next.type='button';prev.setAttribute('aria-label','Previous');next.setAttribute('aria-label','Next');
  prev.onclick=()=>this.shift(-1);next.onclick=()=>this.shift(1);
  nav.append(prev,E('span','mellow-count',String(selected+1).padStart(2,'0')+' / '+String(n).padStart(2,'0')),next);
  container.append(nav);
  if(this.hasAttribute('compact')){const all=E('button','mellow-index compact-index','View all ↗');all.onclick=()=>this.openIndex(this.collection,this.kind==='story'?'Stories':'Inspiration');container.append(all)}
 }
 splayGallery(items){
  const n=items.length,start=((this.pos[this.kind]||0)%n+n)%n,width=this.getBoundingClientRect().width||900,mobile=width<600;
  const visible=Math.min(n,mobile?4:width<860?5:7),plateWidth=mobile?Math.max(154,Math.min(200,width*.51)):Math.max(206,Math.min(254,width*.255));
  const spacing=mobile?Math.max(27,Math.min(42,(width-plateWidth-38)/Math.max(1,visible-1))):Math.max(54,Math.min(97,(width-plateWidth-140)/Math.max(1,visible-1)));
  const cards=Array.from({length:visible},(_,index)=>({item:items[(start+index)%n],index}));
  const container=E('div','mellow-gallery splay-gallery'),stage=E('div','splay-stage'),rack=E('div','splay-rack');
  stage.setAttribute('aria-label','Splay Cards gallery. Hover a card to open the stack; select to preview.');
  rack.style.setProperty('--plate-width',plateWidth+'px');rack.style.setProperty('--plate-height',(mobile?268:330)+'px');rack.style.width=(plateWidth+(visible-1)*spacing)+'px';
  const controls=[],caption=E('div','splay-caption');
  const activate=index=>{for(const {card,i} of controls){card.classList.toggle('is-active',i===index);card.classList.toggle('is-behind',index!==null&&i>index);card.style.zIndex=String(index===i?visible+2:i+1)}
   caption.replaceChildren();if(index===null){caption.append(E('span','caption-idle',this.kind==='project'?'Things I’ve built':this.kind==='inspiration'?'Collected inspiration':'Curious discoveries'));return}
   const item=cards[index].item;caption.append(E('strong','',item.title),E('span','',item.summary));};
  for(const {item,index} of cards){
   const card=E('button','splay-plate'),face=E('div','splay-face');card.type='button';card.dataset.index=String(index);card.style.left=index*spacing+'px';card.style.setProperty('--splay-rank',String(index));card.setAttribute('aria-label',item.title+', open preview');card.title=item.title;
   const preview=E('div','splay-preview');preview.style.setProperty('--tone',String((index*41+start*19+34)%360));
   if(item.image){const image=E('img');image.src=item.image;image.alt='';image.loading='lazy';image.decoding='async';image.onerror=()=>{image.remove();preview.append(E('span','splay-monogram',item.title.slice(0,2).toUpperCase()))};preview.append(image)}
   else{preview.append(E('span','splay-monogram',item.title.slice(0,2).toUpperCase()));}
   const copy=E('div','splay-copy');copy.append(E('h3','',item.title),E('p','',item.summary));if(item.demoUrl)copy.append(E('small','splay-live','LIVE ↗'));face.append(preview,copy);card.append(face);
   card.onfocus=()=>activate(index);rack.append(card);controls.push({card,i:index});
  }
  let drag=null;
  rack.addEventListener('pointermove',e=>{if(drag)return;const bounds=rack.getBoundingClientRect(),index=Math.max(0,Math.min(visible-1,Math.floor((e.clientX-bounds.left)/spacing)));activate(index)});
  rack.addEventListener('pointerleave',()=>{if(!drag)activate(null)});
  stage.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={start:e.clientX,index:Number(e.target.closest('.splay-plate')?.dataset.index)}});
  stage.addEventListener('pointerup',e=>{if(!drag)return;const movement=e.clientX-drag.start;drag=null;if(Math.abs(movement)>65&&n>1){this.suppressClickUntil=Date.now()+380;this.shift(movement<0?1:-1)}});
  stage.addEventListener('pointercancel',()=>{drag=null});
  stage.addEventListener('click',e=>{if(Date.now()<(this.suppressClickUntil||0))return;const bounds=rack.getBoundingClientRect();let index=Number(e.target.closest('.splay-plate')?.dataset.index);if(e.detail!==0&&e.clientX>=bounds.left){index=Math.max(0,Math.min(visible-1,Math.floor((e.clientX-bounds.left)/spacing)))}if(Number.isInteger(index)&&index>=0&&index<cards.length){const item=cards[index].item;this.detail(item,!!item.demoUrl)}});
  activate(null);stage.append(rack);container.append(stage,caption);this.galleryNavigation(n,start,container);this.main.append(container);
 }
 tossGallery(items){
  const n=items.length,start=((this.pos[this.kind]||0)%n+n)%n,width=this.getBoundingClientRect().width||900;
  const container=E('div','mellow-gallery toss-gallery'),stage=E('div','toss-stage');stage.setAttribute('role','group');stage.setAttribute('aria-roledescription','card deck');stage.setAttribute('aria-label','Toss Deck. Swipe or drag the front card to advance.');
  const deck=E('div','toss-stack');deck.style.width=Math.min(380,Math.max(230,width*.75))+'px';const count=Math.min(n,3);
  for(let depth=count-1;depth>=0;depth--){
   const index=(start+depth)%n,item=items[index],card=E('button','toss-card depth-'+depth);card.type='button';card.style.setProperty('--depth',String(depth));card.setAttribute('aria-label',item.title+', open story');card.style.zIndex=String(count-depth);
   const top=E('span','toss-topline',String(index+1).padStart(2,'0')+' / '+String(n).padStart(2,'0')),quote=E('span','toss-quote','“'),title=E('h3','',item.title),summary=E('p','',item.summary);card.append(top,quote,title,summary);
   if(item.image){card.classList.add('with-image');const picture=E('img','toss-picture');picture.src=item.image;picture.alt='';picture.loading='lazy';card.prepend(picture)}
   if(depth===0){card.onclick=()=>{if(Date.now()>(this.suppressClickUntil||0))this.detail(item)}}
   else{card.tabIndex=-1;card.setAttribute('aria-hidden','true');card.disabled=true}
   deck.append(card);
  }
  let gesture=null,animating=false;const front=deck.querySelector('.depth-0');
  const toss=direction=>{if(animating||n<2)return;animating=true;this.suppressClickUntil=Date.now()+400;front.style.setProperty('--fling',String(direction));front.classList.add('is-flying');setTimeout(()=>{this.pos[this.kind]=(start+(direction<0?-1:1)+n)%n;this.gallery()},275)};
  deck.addEventListener('pointerdown',e=>{if(e.button!==0||animating||n<2)return;gesture={x:e.clientX}});
  deck.addEventListener('pointermove',e=>{if(!gesture||animating)return;const delta=Math.max(-125,Math.min(125,e.clientX-gesture.x));front.style.setProperty('--drag-x',delta+'px');front.style.setProperty('--drag-rotation',(delta*.045)+'deg')});
  deck.addEventListener('pointerup',e=>{if(!gesture)return;const delta=e.clientX-gesture.x;gesture=null;if(Math.abs(delta)>55)toss(delta<0?-1:1);else{front.style.removeProperty('--drag-x');front.style.removeProperty('--drag-rotation')}});
  deck.addEventListener('pointercancel',()=>{gesture=null;front.style.removeProperty('--drag-x');front.style.removeProperty('--drag-rotation')});
  stage.append(deck);container.append(stage);this.galleryNavigation(n,start,container);this.main.append(container);
 }
 openIndex(source=this.collection,title='Browse everything'){
  const overlay=E('div','overlay'),panel=E('section','index-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',title);const before=this.shadowRoot.activeElement;
  const head=E('div','index-head'),heading=E('div');heading.append(E('small','eyebrow','THE COMPLETE INDEX'),E('h2','',title));const close=E('button','close','×'),exit=()=>{overlay.remove();before?.focus()};close.setAttribute('aria-label','Close index');close.onclick=exit;overlay.onclick=e=>{if(e.target===overlay)exit()};overlay.onkeydown=e=>{if(e.key==='Escape')exit()};head.append(heading,close);
  const search=E('input','search');search.type='search';search.placeholder='Find by name, idea, language…';search.setAttribute('aria-label','Filter entries');const label=E('small','index-count'),list=E('div','index-list'),more=E('button','more','Show more ↓');let limit=30;
  const draw=()=>{const q=search.value.trim().toLowerCase(),matches=source.filter(x=>(x.title+' '+x.summary+' '+x.language+' '+x.type).toLowerCase().includes(q));list.replaceChildren();matches.slice(0,limit).forEach((x,i)=>{const row=E('button','index-row');row.append(E('small','index-number',String(i+1).padStart(3,'0')),E('strong','',x.title),E('span','',x.summary||'Open details'),E('small','',x.language||x.type));row.onclick=()=>{exit();this.detail(x)};list.append(row)});if(!matches.length)list.append(E('p','notice','Nothing matched. Try another search.'));more.hidden=limit>=matches.length;label.textContent=matches.length+' entries'};
  search.oninput=()=>{limit=30;draw()};more.onclick=()=>{limit+=40;draw()};panel.append(head,search,label,list,more);overlay.append(panel);this.root.append(overlay);draw();search.focus()
 }
 timeline(){
  const component=E('github-activity-timeline');component.events=[...this.items,...this.hiddenMonthly];
  component.addEventListener('activity-open',event=>{event.preventDefault();const {items,label}=event.detail;if(items.length===1)this.detail(items[0]);else this.openIndex(items,label)});
  return component
 }
 detail(item,demoFirst=false){
  const overlay=E('div','overlay'),panel=E('section','detail');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',item.title);
  const before=this.shadowRoot.activeElement,close=E('button','close','×'),exit=()=>{overlay.remove();before?.focus()};close.setAttribute('aria-label','Close detail');close.onclick=exit;overlay.onclick=e=>{if(e.target===overlay)exit()};overlay.onkeydown=e=>{if(e.key==='Escape')exit()};
  const media=E('div','detail-media');
  if((demoFirst||!item.image)&&item.demoUrl&&item.preview==='iframe'){const f=E('iframe');f.src=item.demoUrl;f.title='Preview '+item.title;f.sandbox='allow-scripts allow-forms allow-popups';f.referrerPolicy='no-referrer';f.loading='lazy';media.append(f,E('small','','If this website blocks embedding, open the live demo in a new tab.'))}
  else if((demoFirst||!item.image)&&item.demoUrl&&item.preview==='video'){const v=E('video');v.src=item.demoUrl;v.controls=true;v.playsInline=true;media.append(v)}
  else if(item.image){const img=E('img');img.src=item.image;img.alt=item.title;media.append(img)}
  const copy=E('div','detail-copy');copy.append(E('small','kicker',item.type.toUpperCase()),E('h2','',item.title),E('p','',item.body||item.summary));if(item.date)copy.append(E('small','muted',item.aggregate?'Month: '+new Date(item.date).toLocaleDateString(undefined,{month:'long',year:'numeric'}):'Added '+when(item.date)));const links=E('div','actions');
  for(const [dest,label] of [[item.demoUrl,'Live demo ↗'],[item.url,'Open project ↗']])if(dest){const a=E('a','action',label);a.href=dest;a.target='_blank';a.rel='noopener noreferrer';links.append(a)}
  copy.append(links);panel.append(close,media,copy);overlay.append(panel);this.root.append(overlay);close.focus()
 }
}
if(!customElements.get('profile-atlas'))customElements.define('profile-atlas',ProfileAtlas);
export {ProfileAtlas};
