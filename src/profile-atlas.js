/* Profile Atlas. MIT. Framework-free custom element; public data only. */
const E=(tag,cls='',label)=>{const n=document.createElement(tag);n.className=cls;if(label!==undefined)n.textContent=String(label);return n};
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
  const header=E('div','timeline-heading graph-heading'),intro=E('div');intro.append(E('small','eyebrow','GITHUB ACTIVITY / A LIVING BRANCH'),E('h2','','A trail of things made & found.'),E('p','','One timeline, four kinds of activity. Stars and forks above; new repositories and code activity below.'));
  const legend=E('div','graph-legend');for(const [type,label,symbol] of [['star','Star','✳'],['fork','Fork','⑂'],['project','New repo','◆'],['commit','Code push','↟']]){const x=E('span','legend '+type);x.append(E('b','',symbol),E('span','',label));legend.append(x)}const more=E('button','graph-more','Explore activity ↗');more.onclick=()=>this.open(events.slice().sort((a,b)=>+new Date(b.date)-+new Date(a.date)),'All recorded activity');const aside=E('div','graph-heading-actions');aside.append(legend,more);header.append(intro,aside);this.surface.append(header);
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
   const node=E('button','graph-event '+t),count=E('span','graph-event-count',String(total)),symbol=E('span','graph-event-symbol',t==='star'?'✳':t==='fork'?'⑂':t==='project'?'◆':'↟'),tag=E('span','graph-event-tag',t==='star'?'STAR':t==='fork'?'FORK':t==='project'?'NEW REPO':'PUSH');node.type='button';node.style.left=px+'px';node.style.top=py+'px';node.append(symbol,count,tag);node.setAttribute('aria-label',total+' '+(t==='commit'?'public code push':t)+' activities in '+period);node.title=group.items.some(x=>x.aggregate)?total+' '+t+' activities · names intentionally omitted':group.items.slice(0,4).map(x=>x.title).join(' · ');node.onclick=()=>this.open(group.items,total+' '+(t==='commit'?'code push':t)+' activities · '+period);rail.append(node)
  }
  const axis=E('div','graph-axis');for(let m=0;m<months;m++){const v=firstMonth+m,year=Math.floor(v/12),month=v%12;if(m===0||month===0||month===3||month===6||month===9){const tick=E('span','graph-axis-tick',month===0?String(year):['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month]);tick.style.left=(70+m*step)+'px';axis.append(tick)}}rail.append(svg,axis);viewport.append(rail);this.surface.append(viewport);
  const total=events.reduce((s,i)=>s+(i.activityCount||1),0),bottom=E('div','timeline-bottom graph-bottom'),controls=E('div','timeline-controls'),back=E('button','timeline-arrow','←'),next=E('button','timeline-arrow','→');bottom.append(E('span','',total+' recorded public activities · '+first.getUTCFullYear()+'—'+last.getUTCFullYear()+(events.some(x=>x.aggregate)?' · some names hidden':'')));back.setAttribute('aria-label','Travel to earlier events');next.setAttribute('aria-label','Travel to later events');back.onclick=()=>viewport.scrollBy({left:-step*4,behavior:'smooth'});next.onclick=()=>viewport.scrollBy({left:step*4,behavior:'smooth'});controls.append(E('span','','← DRAG TIME →'),back,next);bottom.append(controls);this.surface.append(E('p','graph-freshness','Code activity comes from recent public GitHub push events (up to 30 days), not an all-time commit history.'),bottom);
  let drag=null;viewport.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;drag={x:e.clientX,scroll:viewport.scrollLeft};viewport.setPointerCapture(e.pointerId);viewport.classList.add('dragging')});viewport.addEventListener('pointermove',e=>{if(drag)viewport.scrollLeft=drag.scroll+drag.x-e.clientX});const end=()=>{drag=null;viewport.classList.remove('dragging')};viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);viewport.addEventListener('wheel',e=>{if(e.shiftKey){e.preventDefault();viewport.scrollLeft+=e.deltaY}},{passive:false});
  requestAnimationFrame(()=>{if(viewport.isConnected)viewport.scrollLeft=viewport.scrollWidth-viewport.clientWidth});
 }
}
if(!customElements.get('github-activity-timeline'))customElements.define('github-activity-timeline',GithubActivityTimeline);
class ProfileAtlas extends HTMLElement{
 static get observedAttributes(){return['username','manifest-url','max-pages']}
 constructor(){super();this.attachShadow({mode:'open'});this.items=[];this.hiddenMonthly=[];this.kind='project';this.pos={};this.pending=true;this.message='';this.loadId=0;this.lastWidth=0;this.root=E('div','atlas');const link=E('link');link.rel='stylesheet';link.href=new URL('./profile-atlas.css',import.meta.url).href;this.shadowRoot.append(link,this.root);this.keydown=this.keydown.bind(this)}
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
  const header=E('header','atlas-header');header.append(E('small','eyebrow','AN OPEN INDEX OF CURIOSITY'),E('h2','','Made things. Found things. Everything in between.'),E('p','',this.username?'A living selection from @'+this.username:'Your work, your curiosity, your story.'));
  const bar=E('div','toolbar'),tabs=E('nav','tabs');tabs.setAttribute('aria-label','Choose a collection');
  if(!compact)for(const [key,label] of [['project','Made'],['star','Saved'],['fork','Remixed']]){
   const n=this.items.filter(x=>x.type===key).length,b=E('button','tab'+(this.kind===key?' on':''));b.type='button';b.append(E('span','',label),E('small','',this.pending?'—':n));b.setAttribute('aria-pressed',String(this.kind===key));b.onclick=()=>{this.kind=key;this.pos[key]=0;this.gallery();tabs.querySelectorAll('button').forEach(x=>{x.classList.remove('on');x.setAttribute('aria-pressed','false')});b.classList.add('on');b.setAttribute('aria-pressed','true')};tabs.append(b)
  }
  const browse=E('button','browse','Browse all ↗');browse.type='button';browse.onclick=()=>this.openIndex(this.collection,this.kind==='project'?'All projects':this.kind==='star'?'Starred discoveries':this.kind==='fork'?'Forked repositories':'All entries');bar.append(tabs,browse);this.main=E('main','main');
  if(this.pending)this.main.append(E('p','notice','Collecting public GitHub activity…'));
  else if(!this.items.length)this.main.append(E('p','notice',this.message||'No public items were found.'));
  else this.gallery();
  const footer=E('footer','footer');const a=E('a','','Source: public GitHub activity');a.href='https://github.com/'+encodeURIComponent(this.username);a.target='_blank';a.rel='noopener noreferrer';footer.append(a,E('span','',' · Stars use starred-at dates; forks use creation dates.'));
  if(compact){this.root.append(this.main)}else{this.root.append(header,bar,this.main);if(!this.pending&&this.items.length)this.root.append(this.timeline());if(this.message)this.root.append(E('p','note',this.message));this.root.append(footer)}
 }
 shift(d){const n=this.collection.length;if(!n)return;this.pos[this.kind]=((this.pos[this.kind]||0)+d%n+n)%n;this.gallery()}
 gallery(){
  if(!this.main)return;this.main.replaceChildren();const items=this.collection,n=items.length;
  if(!n){this.main.append(E('p','notice','No items in this row. Choose another collection.'));return}
  const selected=Math.min(this.pos[this.kind]||0,n-1),stage=E('div','stage');stage.tabIndex=0;stage.setAttribute('role','region');stage.setAttribute('aria-roledescription','carousel');stage.setAttribute('aria-label','Rotating gallery. Drag, swipe, or use arrow keys.');
  const width=this.getBoundingClientRect().width||900,radius=Math.max(190,Math.min(530,width*.49)),seen=new Set(),cards=[];
  const count=this.hasAttribute('compact')?3:5;
  for(let offset=-count;offset<=count;offset++){
   if(n===1&&offset!==0)continue;const i=(selected+offset+n*100)%n;if(seen.has(i))continue;seen.add(i);
   const item=items[i],card=E('button','slide'+(offset===0?' chosen':''));card.type='button';card.tabIndex=offset===0?0:-1;card.setAttribute('aria-label',item.title+', '+(i+1)+' of '+n);
   const media=E('div','slide-media');const hue=(i*47+this.kind.length*27)%360;media.style.setProperty('--card-hue',String(hue));
   if(item.image){const image=E('img');image.src=item.image;image.alt='';image.loading='lazy';image.decoding='async';media.append(image)}
   else{const artwork=E('span','artwork');artwork.append(E('span','artwork-orbit'),E('span','artwork-core',item.type==='star'?'✳':item.type==='fork'?'⑂':item.type==='story'?'“':item.language?item.language.slice(0,2).toUpperCase():'◈'));media.append(artwork,E('small','image-tag',item.language||item.type.toUpperCase()))}
   if(item.demoUrl)media.append(E('small','live-tag','LIVE ↗'));
   const copy=E('div','slide-copy');copy.append(E('small','kicker',item.type==='project'?'BUILT':item.type==='star'?'BOOKMARKED':item.type==='fork'?'FORKED':item.type.toUpperCase()),E('h3','',item.title),E('p','',item.summary));card.append(media,copy);
   card.onclick=()=>{if(Date.now()<(this.suppressClickUntil||0))return;if(offset){this.pos[this.kind]=i;this.gallery()}else this.detail(item,!!item.demoUrl)};
   stage.append(card);cards.push({card,offset});
  }
  const paint=(drag=0)=>{for(const {card,offset} of cards){const d=offset-drag,angle=d*(width<550?35:28)*Math.PI/180;const x=Math.sin(angle)*radius,z=(Math.cos(angle)-1)*radius;card.style.transform=`translate3d(calc(-50% + ${x}px), ${Math.abs(d)*7}px, ${z}px) rotateY(${-angle*180/Math.PI*.85}deg) scale(${Math.max(.7,1-Math.abs(d)*.045)})`;card.style.zIndex=String(60-Math.round(Math.abs(d)*5));card.style.opacity=String(Math.max(0,1-Math.max(0,Math.abs(d)-2)*.31));card.style.pointerEvents=Math.abs(d)>3.6?'none':'auto'}};
  paint();let gesture=null;
  stage.addEventListener('pointerdown',e=>{if(e.button!==0||n<=1)return;gesture={x:e.clientX,t:performance.now(),lastX:e.clientX,lastT:performance.now(),velocity:0};stage.setPointerCapture(e.pointerId);stage.classList.add('dragging')});
  stage.addEventListener('pointermove',e=>{if(!gesture)return;const now=performance.now(),dt=Math.max(1,now-gesture.lastT);gesture.velocity=(e.clientX-gesture.lastX)/dt;gesture.lastX=e.clientX;gesture.lastT=now;paint(Math.max(-3,Math.min(3,(gesture.x-e.clientX)/(width<550?122:205))))});
  const finish=e=>{if(!gesture)return;const movement=gesture.x-e.clientX,steps=Math.round(movement/(width<550?122:205)-gesture.velocity*.11);gesture=null;stage.classList.remove('dragging');if(Math.abs(movement)>12){this.suppressClickUntil=Date.now()+400;if(steps!==0)this.shift(Math.max(-4,Math.min(4,steps)));else paint()}else paint()};
  stage.addEventListener('pointerup',finish);stage.addEventListener('pointercancel',()=>{gesture=null;stage.classList.remove('dragging');paint()});
  const nav=E('div','navigation'),prev=E('button','arrow','←'),next=E('button','arrow','→'),progress=E('div','progress');prev.setAttribute('aria-label','Previous item');next.setAttribute('aria-label','Next item');prev.onclick=()=>this.shift(-1);next.onclick=()=>this.shift(1);
  const track=E('div','progress-track'),fill=E('span','progress-fill');fill.style.width=((selected+1)/n*100)+'%';track.append(fill);progress.append(E('span','count',String(selected+1).padStart(2,'0')+' / '+String(n).padStart(2,'0')),track);nav.append(prev,progress,next);
  const item=items[selected],summary=E('div','selection');summary.append(E('small','selection-label','CURRENTLY VIEWING · '+(item.language||item.type).toUpperCase()),E('strong','',item.title),E('p','',item.summary||'Explore this entry.'));
  const actions=E('div','actions');if(item.demoUrl){const b=E('button','action primary','Try the live demo ↗');b.onclick=()=>this.detail(item,true);actions.append(b)}
  if(item.url){const a=E('a','action','Visit ↗');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';actions.append(a)}
  const d=E('button','action secondary','Read more +');d.onclick=()=>this.detail(item);actions.append(d);summary.append(actions);
  const hint=E('div','gesture-hint','← DRAG TO EXPLORE →');this.main.append(stage,nav,summary,hint);
  if(this.hasAttribute('compact')){const seeAll=E('button','compact-browse','Explore the full collection ↗');seeAll.onclick=()=>this.openIndex(items,this.kind==='story'?'Stories & principles':'Inspiration archive');this.main.append(seeAll)}
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
