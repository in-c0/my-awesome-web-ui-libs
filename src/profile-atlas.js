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
const manifestItem=(r,type,i)=>({id:r.id||type+':'+i,type,title:r.title||'Untitled',summary:r.summary||'',body:r.body||'',repo:r.repo||'',url:url(r.url),demoUrl:url(r.demoUrl),image:url(r.image),preview:['iframe','video','image','link'].includes(r.preview)?r.preview:'link',date:r.date||'',language:r.language||'',featured:!!r.featured});
function merge(repos,stars,manifest){
 const exclusions=(manifest.excludeRepos||[]).map(x=>String(x).toLowerCase());
 const permitted=r=>!exclusions.some(x=>(r.full_name||'').toLowerCase().includes(x)||(r.name||'').toLowerCase().includes(x));
 const owned=repos.filter(r=>permitted(r)&&(manifest.projectVisibility!=='curated'||r.fork)).map(repoToItem), byRepo=new Map(owned.map(x=>[x.repo.toLowerCase(),x]));
 const extras=[];
 (manifest.projects||[]).forEach((r,i)=>{const item=manifestItem(r,'project',i),match=item.repo&&byRepo.get(item.repo.toLowerCase());if(match)Object.assign(match,item,{id:match.id,type:match.type});else extras.push(item)});
 const starItems=stars.filter(x=>permitted(x.repo||x)).map(x=>{const r=x.repo||x;return {...repoToItem(r),id:'star:'+r.full_name,type:'star',date:x.starred_at||''}});
 const stories=(manifest.stories||[]).map((x,i)=>manifestItem(x,'story',i));
 const inspiration=(manifest.inspirations||[]).map((x,i)=>manifestItem(x,'inspiration',i));
 return [...owned,...extras,...starItems,...stories,...inspiration];
}
const sorted=(items,kind)=>{const a=kind==='all'?[...items]:items.filter(x=>x.type===kind);return kind==='story'||kind==='inspiration'?a:a.sort((x,y)=>kind==='project'?(Number(y.featured)-Number(x.featured)||+new Date(y.date||0)-+new Date(x.date||0)):+new Date(y.date||0)-+new Date(x.date||0))};
class ProfileAtlas extends HTMLElement{
 static get observedAttributes(){return['username','manifest-url','max-pages']}
 constructor(){super();this.attachShadow({mode:'open'});this.items=[];this.kind='project';this.pos={};this.pending=true;this.message='';this.loadId=0;this.lastWidth=0;this.root=E('div','atlas');const link=E('link');link.rel='stylesheet';link.href=new URL('./profile-atlas.css',import.meta.url).href;this.shadowRoot.append(link,this.root);this.keydown=this.keydown.bind(this)}
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
  const key='profile-atlas:v1:'+this.username+':'+this.limit;
  try{
   let data=cacheRead(key);
   if(!data){
    const path='/users/'+encodeURIComponent(this.username);
    const responses=await Promise.allSettled([pages(path+'/repos?type=owner&sort=created',{},this.controller.signal,this.limit),pages(path+'/starred',{'Accept':'application/vnd.github.star+json'},this.controller.signal,this.limit)]);
    if(responses.every(x=>x.status==='rejected'))throw responses[0].reason;
    const r=responses[0].status==='fulfilled'?responses[0].value:{items:[],capped:false};
    const s=responses[1].status==='fulfilled'?responses[1].value:{items:[],capped:false};
    data={repos:r.items,stars:s.items,warning:(r.capped||s.capped?'Reached '+(this.limit*100)+' entries per feed. Increase max-pages. ':'')+(responses.some(x=>x.status==='rejected')?'One GitHub feed is unavailable.':'')};cacheWrite(key,data);
   }
   let manifest={};const manifestPath=this.getAttribute('manifest-url');
   if(manifestPath){const u=new URL(manifestPath,document.baseURI);if(!['http:','https:'].includes(u.protocol))throw Error('Manifest must use HTTPS or HTTP');const r=await fetch(u.href,{signal:this.controller.signal});if(!r.ok)throw Error('Manifest HTTP '+r.status);manifest=await r.json()}
   if(current!==this.loadId)return;
   this.items=merge(data.repos,data.stars,manifest);this.message=data.warning||'';this.pending=false;this.render();this.dispatchEvent(new CustomEvent('atlas-ready',{detail:{count:this.items.length},bubbles:true}));
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
  const wrap=E('section','timeline-section'),head=E('div','timeline-heading'),intro=E('div');intro.append(E('small','eyebrow','A TRAIL THROUGH TIME'),E('h2','','The things I made & the things I found.'),E('p','','Three traces of curiosity. Travel sideways; select a moment to see what happened.'));
  const explore=E('button','browse','Explore activity ↗');explore.onclick=()=>this.openIndex(this.items.filter(x=>['project','star','fork'].includes(x.type)).sort((a,b)=>+new Date(b.date||0)-+new Date(a.date||0)),'The activity archive');head.append(intro,explore);wrap.append(head);
  const events=this.items.filter(x=>['project','star','fork'].includes(x.type)&&x.date&&!Number.isNaN(+new Date(x.date)));
  if(!events.length){wrap.append(E('p','notice','No dated public events yet.'));return wrap}
  const dates=events.map(x=>new Date(x.date)),first=new Date(Math.min(...dates)),last=new Date(Math.max(...dates)),start=first.getUTCFullYear()*12+first.getUTCMonth(),end=last.getUTCFullYear()*12+last.getUTCMonth(),months=end-start+1,unit=92,total=months*unit+100;
  const board=E('div','timeline-board'),labels=E('div','lane-labels');for(const [type,label,subtitle] of [['project','MADE','Repositories'],['star','SAVED','Stars'],['fork','REMIXED','Forks']]){const row=E('div','lane-label '+type);row.append(E('strong','',label),E('small','',subtitle));labels.append(row)}
  const scroller=E('div','time-window');scroller.tabIndex=0;scroller.setAttribute('aria-label','Horizontal timeline of repository creations, stars and forks. Scroll sideways.');const track=E('div','time-track');track.style.width=total+'px';
  for(const [i,type] of ['project','star','fork'].entries()){const lane=E('div','time-lane '+type);lane.style.top=(53+i*83)+'px';track.append(lane)}
  const axis=E('div','time-axis');for(let m=0;m<months;m++){const year=Math.floor((start+m)/12),month=(start+m)%12;if(m===0||month===0||month===3||month===6||month===9){const tick=E('span','time-tick',month===0?String(year):['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][month]);tick.style.left=(45+m*unit)+'px';axis.append(tick)}}track.append(axis);
  const grouped=new Map();for(const event of events){const d=new Date(event.date),period=d.getUTCFullYear()*12+d.getUTCMonth()-start,key=event.type+':'+period;if(!grouped.has(key))grouped.set(key,{type:event.type,period,items:[]});grouped.get(key).items.push(event)}
  const rowIndex={project:0,star:1,fork:2};for(const group of grouped.values()){const button=E('button','event-dot '+group.type);button.type='button';button.style.left=(45+group.period*unit)+'px';button.style.top=(53+rowIndex[group.type]*83)+'px';button.textContent=group.items.length>1?String(group.items.length):'•';button.setAttribute('aria-label',group.items.length+' '+group.type+' events in '+new Date(Date.UTC(Math.floor((start+group.period)/12),(start+group.period)%12,1)).toLocaleDateString(undefined,{month:'long',year:'numeric'}));button.title=group.items.slice(0,4).map(x=>x.title).join(' · ');button.onclick=()=>group.items.length===1?this.detail(group.items[0]):this.openIndex(group.items,group.items.length+' '+group.type+' discoveries');track.append(button)}
  scroller.append(track);board.append(labels,scroller);wrap.append(board);
  const below=E('div','timeline-bottom'),meta=E('span','',events.length+' public moments · '+first.getUTCFullYear()+'—'+last.getUTCFullYear()),controls=E('div','timeline-controls'),back=E('button','timeline-arrow','←'),forward=E('button','timeline-arrow','→');back.setAttribute('aria-label','Scroll timeline backward');forward.setAttribute('aria-label','Scroll timeline forward');back.onclick=()=>scroller.scrollBy({left:-unit*5,behavior:'smooth'});forward.onclick=()=>scroller.scrollBy({left:unit*5,behavior:'smooth'});controls.append(E('span','','DRAG OR SCROLL TO EXPLORE'),back,forward);below.append(meta,controls);wrap.append(below);
  scroller.addEventListener('wheel',e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY))return;if(e.shiftKey){e.preventDefault();scroller.scrollLeft+=e.deltaY}},{passive:false});
  let drag=null;scroller.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;drag={x:e.clientX,scroll:scroller.scrollLeft};scroller.setPointerCapture(e.pointerId);scroller.classList.add('dragging')});scroller.addEventListener('pointermove',e=>{if(drag)scroller.scrollLeft=drag.scroll+drag.x-e.clientX});const endDrag=()=>{drag=null;scroller.classList.remove('dragging')};scroller.addEventListener('pointerup',endDrag);scroller.addEventListener('pointercancel',endDrag);
  requestAnimationFrame(()=>{if(scroller.isConnected)scroller.scrollLeft=scroller.scrollWidth-scroller.clientWidth});return wrap
 }
 detail(item,demoFirst=false){
  const overlay=E('div','overlay'),panel=E('section','detail');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label',item.title);
  const before=this.shadowRoot.activeElement,close=E('button','close','×'),exit=()=>{overlay.remove();before?.focus()};close.setAttribute('aria-label','Close detail');close.onclick=exit;overlay.onclick=e=>{if(e.target===overlay)exit()};overlay.onkeydown=e=>{if(e.key==='Escape')exit()};
  const media=E('div','detail-media');
  if((demoFirst||!item.image)&&item.demoUrl&&item.preview==='iframe'){const f=E('iframe');f.src=item.demoUrl;f.title='Preview '+item.title;f.sandbox='allow-scripts allow-forms allow-popups';f.referrerPolicy='no-referrer';f.loading='lazy';media.append(f,E('small','','If this website blocks embedding, open the live demo in a new tab.'))}
  else if((demoFirst||!item.image)&&item.demoUrl&&item.preview==='video'){const v=E('video');v.src=item.demoUrl;v.controls=true;v.playsInline=true;media.append(v)}
  else if(item.image){const img=E('img');img.src=item.image;img.alt=item.title;media.append(img)}
  const copy=E('div','detail-copy');copy.append(E('small','kicker',item.type.toUpperCase()),E('h2','',item.title),E('p','',item.body||item.summary));if(item.date)copy.append(E('small','muted','Added '+when(item.date)));const links=E('div','actions');
  for(const [dest,label] of [[item.demoUrl,'Live demo ↗'],[item.url,'Open project ↗']])if(dest){const a=E('a','action',label);a.href=dest;a.target='_blank';a.rel='noopener noreferrer';links.append(a)}
  copy.append(links);panel.append(close,media,copy);overlay.append(panel);this.root.append(overlay);close.focus()
 }
}
if(!customElements.get('profile-atlas'))customElements.define('profile-atlas',ProfileAtlas);
export {ProfileAtlas};
