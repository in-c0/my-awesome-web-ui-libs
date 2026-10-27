/* Profile Atlas. MIT. Framework-free custom element; public data only. */
import {ACTIVITY_TYPES,activityWindow,reconcileMonthlySnapshots} from './timeline-math.js';
const E=(tag,cls='',label)=>{const n=document.createElement(tag);n.className=cls;if(label!==undefined)n.textContent=String(label);return n};
const ACTIVITY_LABELS={star:'Star',fork:'Fork',project:'New repo',commit:'Push'};
const RANGES=['week','month','year','five','all'],KINDS=['project','star','fork','story','inspiration'];
const USERNAME=/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const reducedMotion=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
/* A property set on an element before its class was defined shadows the accessor; re-apply it through the setter. */
const upgradeProperty=(el,prop)=>{if(Object.prototype.hasOwnProperty.call(el,prop)){const value=el[prop];delete el[prop];el[prop]=value}};
/* Several attribute callbacks arrive together during an upgrade; collapse them into one load. */
const queueLoad=el=>{if(el._queued)return;el._queued=true;queueMicrotask(()=>{el._queued=false;if(el.isConnected)el.load()})};
const unreachable=e=>e instanceof TypeError?'GitHub\u2019s public API could not be reached. Try again later, or set the events property yourself.':(e.message||'Unable to load GitHub activity.');
const isoDate=value=>{if(typeof value==='string')return value;const d=new Date(value);return Number.isNaN(+d)?'':d.toISOString()};
/* Keep Tab inside an open dialog. */
function trapFocus(e,panel,root){if(e.key!=='Tab')return;const focusable=[...panel.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,video[controls],iframe,[tabindex]:not([tabindex="-1"])')].filter(x=>!x.hidden);if(!focusable.length)return;const first=focusable[0],last=focusable[focusable.length-1],active=root.activeElement;if(e.shiftKey&&(active===first||!panel.contains(active))){e.preventDefault();last.focus()}else if(!e.shiftKey&&(active===last||!panel.contains(active))){e.preventDefault();first.focus()}}
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
const assetUrl=(value,base)=>{try{const u=new URL(value,base);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return''}};
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
const manifestItem=(r,type,i,manifestUrl)=>({id:r.id||type+':'+i,type,title:r.title||'Untitled',summary:r.summary||'',body:r.body||'',repo:r.repo||'',url:url(r.url),demoUrl:url(r.demoUrl),image:r.image?assetUrl(r.image,manifestUrl):'',poster:r.poster?assetUrl(r.poster,manifestUrl):'',mediaType:r.mediaType==='video'?'video':'image',preview:['iframe','video','image','link'].includes(r.preview)?r.preview:'link',date:r.date||'',language:r.language||'',featured:!!r.featured});
function merge(repos,stars,manifest,manifestUrl){
 const exclusions=(manifest.excludeRepos||[]).map(x=>String(x).toLowerCase());
 const permitted=r=>!exclusions.some(x=>(r.full_name||'').toLowerCase().includes(x)||(r.name||'').toLowerCase().includes(x));
 const owned=repos.filter(r=>permitted(r)&&(manifest.projectVisibility!=='curated'||r.fork)).map(repoToItem), byRepo=new Map(owned.map(x=>[x.repo.toLowerCase(),x]));
 const extras=[];
 (manifest.projects||[]).forEach((r,i)=>{const item=manifestItem(r,'project',i,manifestUrl);item.curatedOrder=i;const match=item.repo&&byRepo.get(item.repo.toLowerCase());if(match)Object.assign(match,item,{id:match.id,type:match.type});else extras.push(item)});
 const starItems=stars.filter(x=>permitted(x.repo||x)).map(x=>{const r=x.repo||x;return {...repoToItem(r),id:'star:'+r.full_name,type:'star',date:x.starred_at||''}});
 const stories=(manifest.stories||[]).map((x,i)=>manifestItem(x,'story',i,manifestUrl));
 const inspiration=(manifest.inspirations||[]).map((x,i)=>manifestItem(x,'inspiration',i,manifestUrl));
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
const sorted=(items,kind)=>{const a=kind==='all'?[...items]:items.filter(x=>x.type===kind);return kind==='story'||kind==='inspiration'?a:a.sort((x,y)=>kind==='project'?(Number(y.featured)-Number(x.featured)||(x.curatedOrder??Infinity)-(y.curatedOrder??Infinity)||+new Date(y.date||0)-+new Date(x.date||0)):+new Date(y.date||0)-+new Date(x.date||0))};
/** Independent, framework-free GitHub activity railway. Set .events or use username. */
class GithubActivityTimeline extends HTMLElement{
 static get observedAttributes(){return ['username','max-pages','range']}
 constructor(){super();this.attachShadow({mode:'open'});this._events=[];this._loadId=0;this._ready=false;this._explicit=false;this._range='year';this.activeType=null;const css=E('link'),graphcss=E('link');css.rel='stylesheet';css.href=new URL('./profile-atlas.css',import.meta.url).href;graphcss.rel='stylesheet';graphcss.href=new URL('./github-activity-timeline.css',import.meta.url).href;this.surface=E('section','timeline-section graph-section');this.shadowRoot.append(css,graphcss,this.surface)}
 set events(value){this._events=Array.isArray(value)?value:[];this._explicit=true;this._ready=true;this._loadId++;this.controller?.abort();if(this.isConnected)this.render()}
 get events(){return this._events}
 get range(){return this._range}
 set range(value){if(!RANGES.includes(value)||value===this._range)return;this._range=value;this.activeType=null;this.metricMonth=undefined;if(this._ready&&this.isConnected)this.render()}
 connectedCallback(){upgradeProperty(this,'events');upgradeProperty(this,'range');if(this._ready)this.render();else this.requestLoad()}
 disconnectedCallback(){this._loadId++;this.controller?.abort()}
 attributeChangedCallback(name,old,value){if(old===value)return;if(name==='range'){this.range=value;return}if(!this._explicit&&this.isConnected)this.requestLoad()}
 requestLoad(){queueLoad(this)}
 async load(){
  if(this._explicit)return;
  const username=(this.getAttribute('username')||'').trim();if(!USERNAME.test(username)){this.surface.replaceChildren(E('p','notice','Set a GitHub username or provide an events array.'));return}
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
  }catch(e){if(id===this._loadId&&e.name!=='AbortError')this.surface.replaceChildren(E('p','notice',unreachable(e)))}
 }
 open(items,label){const event=new CustomEvent('activity-open',{detail:{items,label},bubbles:true,composed:true,cancelable:true});this.dispatchEvent(event);if(!event.defaultPrevented)this.showDetails(items,label)}
 showDetails(items,label){
  this.surface.querySelector('.graph-drawer')?.remove();const drawer=E('div','graph-drawer');drawer.setAttribute('role','region');drawer.setAttribute('aria-label',label);const head=E('div','graph-drawer-head'),close=E('button','','×');close.setAttribute('aria-label','Close activity details');close.onclick=()=>drawer.remove();head.append(E('strong','',label),close);drawer.append(head);
  const list=E('div','activity-detail-list'),more=E('button','activity-details-more','Show more');let limit=12;
  const draw=()=>{list.replaceChildren();for(const item of items.slice(0,limit)){const row=E('div','graph-drawer-item');const link=item.url?E('a','',item.title):E('strong','',item.title);if(item.url){link.href=item.url;link.target='_blank';link.rel='noopener noreferrer'}const date=E('small','',item.aggregate?'Month-only record':item.date?when(item.date):'');row.append(link,E('small','',item.summary||item.type),date);list.append(row)}more.hidden=limit>=items.length};more.onclick=()=>{limit+=30;draw()};
  drawer.append(list,more);const analysis=this.surface.querySelector('.activity-monthly-analysis');if(analysis)analysis.before(drawer);else this.surface.append(drawer);draw();drawer.scrollIntoView({block:'nearest',behavior:reducedMotion()?'auto':'smooth'});
 }
 render(){
  this.surface.replaceChildren();
  const events=this._events.filter(x=>x&&ACTIVITY_TYPES.includes(x.type)&&x.date!=null&&x.date!==''&&!Number.isNaN(+new Date(x.date))).map(x=>typeof x.date==='string'?x:{...x,date:isoDate(x.date)});
  const state=activityWindow(this.range,events);
  const heading=E('div','activity-heading'),headingCopy=E('div');
  headingCopy.append(E('h2','','GitHub activity'),E('p','activity-period',state.label));
  const all=E('button','activity-view-all','Browse activity');
  all.type='button';all.onclick=()=>this.open(state.bins.flatMap(bin=>bin.items).sort((a,b)=>+new Date(b.date)-+new Date(a.date)),'Recorded activity · '+state.label);
  all.disabled=!Object.values(state.totals).some(Boolean);
  heading.append(headingCopy,all);this.surface.append(heading);
  const ranges=E('div','activity-range-picker');
  ranges.setAttribute('role','group');ranges.setAttribute('aria-label','Timeline period');
  for(const [key,label] of [['week','This week'],['month','This month'],['year','This year'],['five','Past 5 years'],['all','All']]){
   const button=E('button','activity-range'+(key===this.range?' selected':''),label);
   button.type='button';button.setAttribute('aria-pressed',String(key===this.range));
   button.onclick=()=>{this.range=key};
   ranges.append(button);
  }
  this.surface.append(ranges);
  if(!events.length){this.surface.append(E('p','activity-empty','No dated public activity records are available.'));return}

  const matrix=E('div','activity-matrix'),labels=E('div','activity-labels'),viewport=E('div','activity-plot-viewport'),plot=E('div','activity-plot');
  viewport.tabIndex=0;viewport.setAttribute('role','region');viewport.setAttribute('aria-label','Activity by period, scroll horizontally to explore');
  const columns=state.bins.length;
  plot.style.minWidth=Math.max(390,columns*(columns<=7?62:columns<=12?43:columns<=36?24:14))+'px';
  for(const type of ACTIVITY_TYPES){
   const active=!this.activeType||this.activeType===type;
   const label=E('button','activity-lane-label '+type+(active?'':' dimmed'));
   label.type='button';label.title='Highlight '+ACTIVITY_LABELS[type];
   label.setAttribute('aria-pressed',String(this.activeType===type));
   label.append(activityIcon(type),E('span','',ACTIVITY_LABELS[type]));
   label.onclick=()=>{this.activeType=this.activeType===type?null:type;this.render()};
   labels.append(label);
   const row=E('div','activity-lane '+type+(active?'':' dimmed'));
   row.style.gridTemplateColumns='repeat('+columns+',minmax(0,1fr))';
   const peak=Math.max(1,...state.bins.map(bin=>bin.counts[type]));
   for(const bin of state.bins){
    const count=bin.counts[type],cell=E('div','activity-cell'+(bin.future?' future':''));
    if(count){
     const mark=E('button','activity-mark '+type);
     mark.type='button';mark.style.height=(5+Math.round(25*Math.sqrt(count/peak)))+'px';
     mark.title=ACTIVITY_LABELS[type]+' · '+bin.label+': '+count+' recorded';
     mark.setAttribute('aria-label',mark.title+'. Open records.');
     mark.onclick=()=>{this.metricMonth=bin.key.slice(0,7).length===7?bin.key.slice(0,7):this.metricMonth;this.open(bin.items.filter(item=>item.type===type),ACTIVITY_LABELS[type]+' · '+bin.label)};
     cell.append(mark);
    }
    row.append(cell);
   }
   plot.append(row);
  }
  labels.append(E('span','activity-axis-spacer',''));
  const axis=E('div','activity-bin-axis');axis.style.gridTemplateColumns='repeat('+columns+',minmax(0,1fr))';
  state.bins.forEach((bin,index)=>{
   const d=bin.start,show=state.grain==='year'||(state.grain==='month'?(columns<=12||d.getMonth()===0||index%6===0):columns<=7||index===0||d.getDate()%5===0);
   const tick=E('span','activity-bin-label',show?(state.grain==='day'?String(d.getDate()):state.grain==='year'?String(d.getFullYear()):d.getMonth()===0?String(d.getFullYear()):d.toLocaleDateString('en',{month:'short'})):'');
   tick.title=bin.label;axis.append(tick);
  });
  plot.append(axis);viewport.append(plot);matrix.append(labels,viewport);this.surface.append(matrix);
  const insight=E('div','activity-under-chart');
  insight.append(E('span','',state.grain==='day'?'Daily activity':state.grain==='year'?'Yearly activity':'Monthly activity'));
  if(state.monthOnlyOmitted)insight.append(E('span','activity-precision',state.monthOnlyOmitted+' month-only records are not shown on individual days. Choose This year.'));
  if(!Object.values(state.totals).some(Boolean))insight.append(E('span','activity-precision','No recorded events in this range.'));
  this.surface.append(insight);

  const analysis=E('section','monthly-analysis activity-monthly-analysis'),analysisHead=E('div','monthly-analysis-head');
  analysisHead.append(E('h3','','Monthly analysis'));
  const select=E('select','month-select');select.setAttribute('aria-label','Select month for analysis');
  const months=[...new Set(events.map(item=>item.date.slice(0,7)))].filter(month=>/^\d{4}-\d{2}$/.test(month)).sort().reverse();
  const today=new Date(),currentMonth=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0');
  const defaultMonth=months.find(month=>month===currentMonth)||months[0];
  if(!months.includes(this.metricMonth))this.metricMonth=defaultMonth;
  for(const month of months){const option=E('option','',new Date(month+'-01T12:00:00Z').toLocaleDateString(undefined,{month:'short',year:'numeric'}));option.value=month;option.selected=month===this.metricMonth;select.append(option)}
  analysisHead.append(select);
  const metrics=E('div','monthly-metrics');
  const updateMetrics=()=>{
   metrics.replaceChildren();
   const month=this.metricMonth;
   for(const type of ACTIVITY_TYPES){
    const items=events.filter(item=>item.type===type&&item.date.slice(0,7)===month);
    const count=items.reduce((total,item)=>total+(Number(item.activityCount)||1),0);
    const metric=E('button','monthly-metric '+type);metric.type='button';metric.title='Inspect '+ACTIVITY_LABELS[type]+' · '+month;
    const name=E('span','monthly-metric-label');name.append(activityIcon(type),E('span','',ACTIVITY_LABELS[type]));
    metric.append(name,E('strong','',String(count)));metric.onclick=()=>this.open(items,ACTIVITY_LABELS[type]+' · '+month);
    metrics.append(metric);
   }
  };
  select.onchange=()=>{this.metricMonth=select.value;updateMetrics()};
  const coverage=E('details','activity-coverage'),summary=E('summary','','About the data');
  coverage.append(summary,E('p','','This is a partial record of public GitHub activity, not a complete contribution history. Public push events are recent only. Historical snapshot totals have month-level precision; they are included in monthly/yearly views but never assigned to invented days. Private work and uncollected events are not counted.'));
  analysis.append(analysisHead,metrics,coverage);this.surface.append(analysis);updateMetrics();
 }
}
if(!customElements.get('github-activity-timeline'))customElements.define('github-activity-timeline',GithubActivityTimeline);
class ProfileAtlas extends HTMLElement{
 static get observedAttributes(){return['username','manifest-url','max-pages','row','compact','theme']}
 constructor(){super();this.attachShadow({mode:'open'});this.items=[];this.hiddenMonthly=[];this.kind='project';this.pos={};this.pending=true;this.message='';this.loadId=0;this.lastWidth=0;this.root=E('div','atlas');const link=E('link'),newStyles=E('link');link.rel=newStyles.rel='stylesheet';link.href=new URL('./profile-atlas.css',import.meta.url).href;newStyles.href=new URL('./mellow-overrides.css',import.meta.url).href;this.shadowRoot.append(link,newStyles,this.root);this.keydown=this.keydown.bind(this)}
 connectedCallback(){if(KINDS.includes(this.getAttribute('row')))this.kind=this.getAttribute('row');this.root.addEventListener('keydown',this.keydown);this.resize=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width||0;if(Math.abs(width-this.lastWidth)>3){this.lastWidth=width;if(!this.pending)this.gallery()}});this.resize.observe(this);this.requestLoad()}
 disconnectedCallback(){this.loadId++;this.controller?.abort();this.resize?.disconnect();this.root.removeEventListener('keydown',this.keydown)}
 attributeChangedCallback(name,old,value){if(old===value)return;if(name==='theme'){const t=this.root.querySelector('github-activity-timeline');if(t){if(value===null)t.removeAttribute('theme');else t.setAttribute('theme',value)}return}if(name==='row'||name==='compact'){if(name==='row'&&KINDS.includes(value))this.kind=value;if(this.isConnected&&!this.pending)this.render();return}if(this.isConnected)this.requestLoad()}
 requestLoad(){queueLoad(this)}
 get username(){return(this.getAttribute('username')||'').trim()}
 get limit(){const n=Number(this.getAttribute('max-pages')||10);return Math.max(1,Math.min(30,Number.isFinite(n)?Math.floor(n):10))}
 get collection(){return sorted(this.items,this.kind)}
 keydown(e){if(e.target.closest('input,select,textarea,[role=dialog],github-activity-timeline'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();this.shift(e.key==='ArrowRight'?1:-1)}}
 async load(){
  const current=++this.loadId;this.controller?.abort();this.controller=new AbortController();this.pending=true;this.message='';this.render();
  const manifestOnly=!this.username&&!!this.getAttribute('manifest-url');
  if(!manifestOnly&&!USERNAME.test(this.username)){this.pending=false;this.message='Set a valid GitHub username, or a manifest-url on its own.';this.render();return}
  const key='profile-atlas:v2:'+this.username+':'+this.limit;
  try{
   let data=manifestOnly?{repos:[],stars:[],pushes:[]}:(cacheRead(key)||cacheRead('profile-atlas:v1:'+this.username+':'+this.limit));
   if(!data){
    const path='/users/'+encodeURIComponent(this.username);
    const responses=await Promise.allSettled([pages(path+'/repos?type=owner&sort=created',{},this.controller.signal,this.limit),pages(path+'/starred',{'Accept':'application/vnd.github.star+json'},this.controller.signal,this.limit),pages(path+'/events/public',{},this.controller.signal,3)]);
    const r=responses[0].status==='fulfilled'?responses[0].value:{items:[],capped:false};
    const s=responses[1].status==='fulfilled'?responses[1].value:{items:[],capped:false},p=responses[2].status==='fulfilled'?responses[2].value:{items:[],capped:false};
    data={repos:r.items,stars:s.items,pushes:p.items.filter(e=>e.type==='PushEvent'),warning:(r.capped||s.capped?'Reached '+(this.limit*100)+' entries per feed. Increase max-pages. ':'')+(responses.some(x=>x.status==='rejected')?'One or more live GitHub feeds are unavailable; a dated public snapshot may be shown.':'')};if(responses.some(x=>x.status==='fulfilled'))cacheWrite(key,data);
   }
   if(!('pushes' in data)){try{const p=await pages('/users/'+encodeURIComponent(this.username)+'/events/public',{},this.controller.signal,3);data.pushes=p.items.filter(e=>e.type==='PushEvent');cacheWrite(key,data)}catch{data.pushes=[]}}
   let manifest={};const manifestPath=this.getAttribute('manifest-url');let manifestHref=document.baseURI;
   if(manifestPath){const u=new URL(manifestPath,document.baseURI);if(!['http:','https:'].includes(u.protocol))throw Error('Manifest must use HTTPS or HTTP');manifestHref=u.href;const r=await fetch(u.href,{signal:this.controller.signal});if(!r.ok)throw Error('Manifest HTTP '+r.status);manifest=await r.json()}
   if(current!==this.loadId)return;
   this.items=merge(data.repos,data.stars,manifest,manifestHref);
   const knownDates=new Map(data.repos.map(r=>[String(r.full_name||'').toLowerCase(),r.created_at]));
   for(const item of this.items)if(item.type==='project'&&item.repo&&!item.date&&knownDates.has(item.repo.toLowerCase()))item.date=knownDates.get(item.repo.toLowerCase());
   const hiddenRepos=unfeaturedMonthlyCounts(data.repos,manifest);
   const historical=reconcileMonthlySnapshots(manifest.activitySnapshot,manifest.activitySnapshotRecordedAt,[...this.items,...hiddenRepos]);
   const publicPushes=(data.pushes||[]).map(eventToCommit).map(item=>manifest.projectVisibility==='curated'?{...item,repo:'',url:''}:item);
   this.hiddenMonthly=[...hiddenRepos,...historical,...publicPushes];
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
  const footer=E('footer','footer');if(this.username){const a=E('a','','Source: public GitHub activity');a.href='https://github.com/'+encodeURIComponent(this.username);a.target='_blank';a.rel='noopener noreferrer';footer.append(a,E('span','',' · Stars use starred-at dates; forks use creation dates.'))}else footer.append(E('span','','Source: the manifest only. Add a username to include public GitHub activity.'));
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
  stage.setAttribute('role','group');stage.setAttribute('aria-label','Splay Cards gallery. Hover a card to open the stack; select to preview.');
  rack.style.setProperty('--plate-width',plateWidth+'px');rack.style.setProperty('--plate-height',(mobile?268:330)+'px');rack.style.width=(plateWidth+(visible-1)*spacing)+'px';
  const controls=[],caption=E('div','splay-caption');let activeIndex=undefined;
  const activate=index=>{if(activeIndex===index)return;activeIndex=index;for(const {card,i,video} of controls){card.classList.toggle('is-active',i===index);card.classList.toggle('is-behind',index!==null&&i>index);card.style.zIndex=String(index===i?visible+2:i+1);if(video){if(index===i&&!reducedMotion())video.play().catch(()=>{});else video.pause()}}
   caption.replaceChildren();if(index===null){caption.append(E('span','caption-idle',this.kind==='project'?'Things I’ve built':this.kind==='inspiration'?'Collected inspiration':'Curious discoveries'));return}
   const item=cards[index].item;caption.append(E('strong','',item.title),E('span','',item.summary));};
  for(const {item,index} of cards){
   const card=E('button','splay-plate'),face=E('div','splay-face');card.type='button';card.dataset.index=String(index);card.style.left=index*spacing+'px';card.style.setProperty('--splay-rank',String(index));card.setAttribute('aria-label',item.title+', open preview');card.title=item.title;
   const preview=E('div','splay-preview');preview.style.setProperty('--tone',String((index*41+start*19+34)%360));
   let video=null;
   if(item.mediaType==='video'&&item.image){
    video=E('video');video.src=item.image;video.muted=true;video.loop=true;video.playsInline=true;video.preload='none';video.setAttribute('aria-hidden','true');if(item.poster)video.poster=item.poster;
    video.onerror=()=>{video.hidden=true;if(item.poster){const still=E('img');still.src=item.poster;still.alt='';preview.append(still)}else preview.append(E('span','splay-monogram',item.title.slice(0,2).toUpperCase()))};preview.append(video);
   }
   else if(item.image){const image=E('img');image.src=item.image;image.alt='';image.loading='lazy';image.decoding='async';image.onerror=()=>{image.remove();card.classList.add('has-text-preview');preview.append(this.textPreview(item))};preview.append(image)}
   else{card.classList.add('has-text-preview');preview.append(this.textPreview(item))}
   const copy=E('div','splay-copy');copy.append(E('h3','',item.title),E('p','',item.summary));if(item.demoUrl)copy.append(E('small','splay-live','LIVE ↗'));face.append(preview,copy);card.append(face);
   card.onfocus=()=>activate(index);rack.append(card);controls.push({card,i:index,video});
  }
  let drag=null;
  rack.addEventListener('pointermove',e=>{if(drag)return;const bounds=rack.getBoundingClientRect(),index=Math.max(0,Math.min(visible-1,Math.floor((e.clientX-bounds.left)/spacing)));activate(index)});
  rack.addEventListener('pointerleave',()=>{if(!drag)activate(null)});
  stage.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={start:e.clientX,index:Number(e.target.closest('.splay-plate')?.dataset.index)}});
  stage.addEventListener('pointermove',e=>{if(drag&&!drag.captured&&Math.abs(e.clientX-drag.start)>16){stage.setPointerCapture(e.pointerId);drag.captured=true}});
  stage.addEventListener('pointerup',e=>{if(!drag)return;const movement=e.clientX-drag.start;drag=null;if(Math.abs(movement)>65&&n>1){this.suppressClickUntil=Date.now()+380;this.shift(movement<0?1:-1)}});
  stage.addEventListener('pointercancel',()=>{drag=null});
  stage.addEventListener('click',e=>{if(Date.now()<(this.suppressClickUntil||0))return;const bounds=rack.getBoundingClientRect();let index=Number(e.target.closest('.splay-plate')?.dataset.index);if(e.detail!==0&&e.clientX>=bounds.left){index=Math.max(0,Math.min(visible-1,Math.floor((e.clientX-bounds.left)/spacing)))}if(Number.isInteger(index)&&index>=0&&index<cards.length){const item=cards[index].item;this.detail(item,!!item.demoUrl)}});
  activate(null);stage.append(rack);container.append(stage,caption);this.galleryNavigation(n,start,container);this.main.append(container);
 }
 textPreview(item){
  const cover=E('div','splay-text-preview'),kind=E('small','splay-text-kind',item.type==='project'?'BUILT':item.type==='star'?'DISCOVERED':item.type==='fork'?'FORKED':'COLLECTED');
  const meta=item.language||(item.demoUrl||item.url?(()=>{try{return new URL(item.demoUrl||item.url).hostname.replace(/^www\./,'')}catch{return''}})():'');
  cover.append(kind,E('strong','splay-text-title',item.title),E('span','splay-text-meta',meta||'GitHub'));
  return cover;
 }
 tossGallery(items){
  const n=items.length,start=((this.pos[this.kind]||0)%n+n)%n,width=this.getBoundingClientRect().width||900;
  const container=E('div','mellow-gallery toss-gallery'),stage=E('div','toss-stage');stage.setAttribute('role','group');stage.setAttribute('aria-roledescription','card deck');stage.setAttribute('aria-label','Toss Deck. Swipe or drag the front card to advance.');
  const deck=E('div','toss-stack');deck.style.width=Math.min(380,Math.max(230,width*.75))+'px';const count=Math.min(n,3);
  for(let depth=count-1;depth>=0;depth--){
   const index=(start+depth)%n,item=items[index],card=E('button','toss-card depth-'+depth);card.type='button';card.style.setProperty('--depth',String(depth));card.setAttribute('aria-label',item.title+', open story');card.style.zIndex=String(count-depth);
   const top=E('span','toss-topline',String(index+1).padStart(2,'0')+' / '+String(n).padStart(2,'0')),quote=E('span','toss-quote','“'),title=E('h3','',item.title),summary=E('p','',item.summary);card.append(top,quote,title,summary);
   if(item.image){card.classList.add('with-image');const picture=E('img','toss-picture');picture.src=item.mediaType==='video'?item.poster:item.image;picture.alt='';picture.loading='lazy';if(picture.src)card.prepend(picture)}
   if(depth===0){card.onclick=()=>{if(Date.now()>(this.suppressClickUntil||0))this.detail(item)}}
   else{card.tabIndex=-1;card.setAttribute('aria-hidden','true');card.disabled=true}
   deck.append(card);
  }
  let gesture=null,animating=false;const front=deck.querySelector('.depth-0');
  const toss=direction=>{if(animating||n<2)return;animating=true;this.suppressClickUntil=Date.now()+400;front.style.setProperty('--fling',String(direction));front.classList.add('is-flying');setTimeout(()=>{this.pos[this.kind]=(start+(direction<0?-1:1)+n)%n;this.gallery()},275)};
  deck.addEventListener('pointerdown',e=>{if(e.button!==0||animating||n<2)return;gesture={x:e.clientX}});
  deck.addEventListener('pointermove',e=>{if(!gesture||animating)return;const delta=Math.max(-125,Math.min(125,e.clientX-gesture.x));if(Math.abs(delta)>16&&!gesture.captured){deck.setPointerCapture(e.pointerId);gesture.captured=true}front.style.setProperty('--drag-x',delta+'px');front.style.setProperty('--drag-rotation',(delta*.045)+'deg')});
  deck.addEventListener('pointerup',e=>{if(!gesture)return;const delta=e.clientX-gesture.x;gesture=null;if(Math.abs(delta)>55)toss(delta<0?-1:1);else{front.style.removeProperty('--drag-x');front.style.removeProperty('--drag-rotation')}});
  deck.addEventListener('pointercancel',()=>{gesture=null;front.style.removeProperty('--drag-x');front.style.removeProperty('--drag-rotation')});
  stage.append(deck);container.append(stage);this.galleryNavigation(n,start,container);this.main.append(container);
 }
 openIndex(source=this.collection,title='Browse everything'){
  const overlay=E('div','overlay'),panel=E('section','index-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',title);const before=this.shadowRoot.activeElement;
  const head=E('div','index-head'),heading=E('div');heading.append(E('small','eyebrow','THE COMPLETE INDEX'),E('h2','',title));const close=E('button','close','×'),exit=()=>{overlay.remove();before?.focus()};close.setAttribute('aria-label','Close index');close.onclick=exit;overlay.onclick=e=>{if(e.target===overlay)exit()};overlay.onkeydown=e=>{if(e.key==='Escape')exit();else trapFocus(e,panel,this.shadowRoot)};head.append(heading,close);
  const search=E('input','search');search.type='search';search.placeholder='Find by name, idea, language…';search.setAttribute('aria-label','Filter entries');const label=E('small','index-count'),list=E('div','index-list'),more=E('button','more','Show more ↓');let limit=30;
  const draw=()=>{const q=search.value.trim().toLowerCase(),matches=source.filter(x=>(x.title+' '+x.summary+' '+x.language+' '+x.type).toLowerCase().includes(q));list.replaceChildren();matches.slice(0,limit).forEach((x,i)=>{const row=E('button','index-row');row.append(E('small','index-number',String(i+1).padStart(3,'0')),E('strong','',x.title),E('span','',x.summary||'Open details'),E('small','',x.language||x.type));row.onclick=()=>{exit();this.detail(x)};list.append(row)});if(!matches.length)list.append(E('p','notice','Nothing matched. Try another search.'));more.hidden=limit>=matches.length;label.textContent=matches.length+' entries'};
  search.oninput=()=>{limit=30;draw()};more.onclick=()=>{limit+=40;draw()};panel.append(head,search,label,list,more);overlay.append(panel);this.root.append(overlay);draw();search.focus()
 }
 timeline(){
  const component=E('github-activity-timeline');const theme=this.getAttribute('theme');if(theme)component.setAttribute('theme',theme);component.events=[...this.items,...this.hiddenMonthly];
  return component
 }
 detail(item,demoFirst=false){
  const overlay=E('div','overlay'),panel=E('section','detail');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',item.title);
  const before=this.shadowRoot.activeElement,close=E('button','close','×'),exit=()=>{overlay.remove();before?.focus()};close.setAttribute('aria-label','Close detail');close.onclick=exit;overlay.onclick=e=>{if(e.target===overlay)exit()};overlay.onkeydown=e=>{if(e.key==='Escape')exit();else trapFocus(e,panel,this.shadowRoot)};
  const media=E('div','detail-media');
   if(item.mediaType==='video'&&item.image){const v=E('video');v.src=item.image;if(item.poster)v.poster=item.poster;v.controls=true;v.playsInline=true;v.preload='metadata';v.autoplay=!reducedMotion();v.muted=true;v.loop=true;v.setAttribute('aria-label',item.title+' motion preview');media.append(v)}
   else if(item.image){const img=E('img');img.src=item.image;img.alt=item.title+' project preview';if(item.demoUrl||item.url){const destination=E('a','detail-poster-link');destination.href=item.demoUrl||item.url;destination.target='_blank';destination.rel='noopener noreferrer';destination.setAttribute('aria-label','Open '+item.title+' in a new tab');destination.append(img,E('span','detail-open-site','Visit live ↗'));media.append(destination)}else media.append(img)}
   else if(item.demoUrl&&item.preview==='iframe'){const f=E('iframe');f.src=item.demoUrl;f.title='Preview '+item.title;f.sandbox='allow-scripts allow-forms allow-popups';f.referrerPolicy='no-referrer';f.loading='lazy';media.append(f,E('small','','If this website blocks embedding, open the live demo in a new tab.'))}
  else if((demoFirst||!item.image)&&item.demoUrl&&item.preview==='video'){const v=E('video');v.src=item.demoUrl;v.controls=true;v.playsInline=true;media.append(v)}
  const copy=E('div','detail-copy');copy.append(E('small','kicker',item.type.toUpperCase()),E('h2','',item.title),E('p','',item.body||item.summary));if(item.date)copy.append(E('small','muted',item.aggregate?'Month: '+new Date(item.date).toLocaleDateString(undefined,{month:'long',year:'numeric'}):'Added '+when(item.date)));const links=E('div','actions');
  const actions=item.image?(item.url&&item.url!==(item.demoUrl||item.url)?[[item.url,'Source ↗']]:[]):[[item.demoUrl,'Live demo ↗'],[item.url&&item.url!==item.demoUrl?item.url:'',item.demoUrl?'Source ↗':'Open project ↗']];
  for(const [dest,label] of actions)if(dest){const a=E('a','action',label);a.href=dest;a.target='_blank';a.rel='noopener noreferrer';links.append(a)}
  if(links.childElementCount)copy.append(links);panel.append(close);if(media.childElementCount)panel.append(media);panel.append(copy);overlay.append(panel);this.root.append(overlay);close.focus()
 }
}
if(!customElements.get('profile-atlas'))customElements.define('profile-atlas',ProfileAtlas);
export {ProfileAtlas,GithubActivityTimeline};
