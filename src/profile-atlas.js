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
 const owned=repos.map(repoToItem), byRepo=new Map(owned.map(x=>[x.repo.toLowerCase(),x]));
 const extras=[];
 (manifest.projects||[]).forEach((r,i)=>{const item=manifestItem(r,'project',i),match=item.repo&&byRepo.get(item.repo.toLowerCase());if(match)Object.assign(match,item,{id:match.id,type:match.type});else extras.push(item)});
 const starItems=stars.map(x=>{const r=x.repo||x;return {...repoToItem(r),id:'star:'+r.full_name,type:'star',date:x.starred_at||''}});
 const stories=(manifest.stories||[]).map((x,i)=>manifestItem(x,'story',i));
 const inspiration=(manifest.inspirations||[]).map((x,i)=>manifestItem(x,'inspiration',i));
 return [...owned,...extras,...starItems,...stories,...inspiration];
}
const sorted=(items,kind)=>{const a=kind==='all'?[...items]:items.filter(x=>x.type===kind);return kind==='story'||kind==='inspiration'?a:a.sort((x,y)=>kind==='project'?(Number(y.featured)-Number(x.featured)||+new Date(y.date||0)-+new Date(x.date||0)):+new Date(y.date||0)-+new Date(x.date||0))};
class ProfileAtlas extends HTMLElement{
 static get observedAttributes(){return['username','manifest-url','max-pages']}
 constructor(){super();this.attachShadow({mode:'open'});this.items=[];this.kind='project';this.mode='gallery';this.timelineFilter='all';this.pos={};this.query='';this.more=24;this.timelineMore=40;this.pending=true;this.message='';this.loadId=0;this.root=E('div','atlas');const link=E('link');link.rel='stylesheet';link.href=new URL('./profile-atlas.css',import.meta.url).href;this.shadowRoot.append(link,this.root);this.keydown=this.keydown.bind(this)}
 connectedCallback(){if(['project','star','fork','story','inspiration'].includes(this.getAttribute('row')))this.kind=this.getAttribute('row');this.root.addEventListener('keydown',this.keydown);this.resize=new ResizeObserver(()=>{if(this.mode==='gallery'&&!this.pending)this.gallery()});this.resize.observe(this);this.load()}
 disconnectedCallback(){this.loadId++;this.controller?.abort();this.resize?.disconnect();this.root.removeEventListener('keydown',this.keydown)}
 attributeChangedCallback(){if(this.isConnected)this.load()}
 get username(){return(this.getAttribute('username')||'').trim()}
 get limit(){const n=Number(this.getAttribute('max-pages')||10);return Math.max(1,Math.min(30,Number.isFinite(n)?Math.floor(n):10))}
 get collection(){return sorted(this.items,this.kind)}
 keydown(e){if(this.mode!=='gallery'||e.target.closest('input,select,[role=dialog]'))return;if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();this.shift(e.key==='ArrowRight'?1:-1)}}
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
  const header=E('header','atlas-header');header.append(E('small','eyebrow','PROFILE ATLAS / OPEN SOURCE'),E('h2','','A living record of building & discovering'),E('p','',this.username?'Public activity and curated work by @'+this.username:'Your work, your curiosity, your story.'));
  const bar=E('div','toolbar'),tabs=E('nav','tabs');tabs.setAttribute('aria-label','Collections');
  for(const [key,label] of [['project','Projects'],['star','Starred'],['fork','Forks'],['story','Stories'],['inspiration','Inspiration']]){
   const n=this.items.filter(x=>x.type===key).length,b=E('button','tab'+(this.kind===key?' on':''),label+(this.pending?'':' '+n));b.type='button';b.setAttribute('aria-pressed',String(this.kind===key));b.onclick=()=>{this.kind=key;this.mode='gallery';this.query='';this.more=24;this.render()};tabs.append(b)
  }
  const modes=E('div','modes');
  for(const [mode,label] of [['gallery','Gallery'],['index','Index'],['timeline','Timeline']]){const b=E('button','mode'+(this.mode===mode?' on':''),label);b.type='button';b.setAttribute('aria-pressed',String(this.mode===mode));b.onclick=()=>{this.mode=mode;this.render()};modes.append(b)}
  bar.append(tabs,modes);this.main=E('main','main');
  if(this.pending)this.main.append(E('p','notice','Collecting public GitHub activity…'));
  else if(!this.items.length)this.main.append(E('p','notice',this.message||'No public items were found.'));
  else if(this.mode==='gallery')this.gallery();else if(this.mode==='index')this.index();else this.timeline();
  const footer=E('footer','footer');const a=E('a','','Source: public GitHub activity');a.href='https://github.com/'+encodeURIComponent(this.username);a.target='_blank';a.rel='noopener noreferrer';footer.append(a,E('span','',' · Stars use starred-at dates; forks use creation dates.'));
  if(this.hasAttribute('compact')){this.root.append(this.main)}else{this.root.append(header,bar,this.main);if(this.message)this.root.append(E('p','note',this.message));this.root.append(footer)}
 }
 shift(d){const n=this.collection.length;if(!n)return;this.pos[this.kind]=((this.pos[this.kind]||0)+d+n)%n;this.gallery()}
 gallery(){
  if(!this.main)return;this.main.replaceChildren();const items=this.collection,n=items.length;
  if(!n){this.main.append(E('p','notice','No items in this row. Choose another collection.'));return}
  const selected=Math.min(this.pos[this.kind]||0,n-1),stage=E('div','stage');stage.tabIndex=0;stage.setAttribute('role','region');stage.setAttribute('aria-label','Carousel: use left and right arrows');
  const width=this.getBoundingClientRect().width||900,step=Math.max(116,Math.min(218,width*.29)),seen=new Set();
  for(const offset of [0,-1,1,-2,2,-3,3]){
   if(n===1&&offset!==0)continue;const i=(selected+offset+n*10)%n;if(seen.has(i))continue;seen.add(i);
   const item=items[i],card=E('button','slide'+(offset===0?' chosen':''));card.type='button';card.tabIndex=offset===0?0:-1;card.setAttribute('aria-label',item.title+', '+(i+1)+' of '+n);
   card.style.transform='translate(-50%,0) translate3d('+(offset*step)+'px,0,'+(-Math.abs(offset)*110)+'px) rotateY('+(-offset*13)+'deg)';
   card.style.zIndex=String(10-Math.abs(offset));card.style.opacity=String(Math.max(.3,1-Math.abs(offset)*.2));
   const media=E('div','slide-media');
   if(item.image){const image=E('img');image.src=item.image;image.alt='';image.loading='lazy';media.append(image)}
   else media.append(E('span','glyph',item.type==='star'?'✳':item.type==='fork'?'⑂':item.type==='story'?'❝':'◈'),E('small','image-tag',item.language||item.type.toUpperCase()));
   const copy=E('div','slide-copy');copy.append(E('small','kicker',item.type.toUpperCase()),E('h3','',item.title),E('p','',item.summary));card.append(media,copy);
   card.onclick=()=>{if(offset){this.pos[this.kind]=i;this.gallery()}else this.detail(item)};
   stage.append(card);
  }
  let x=null;stage.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')x=e.clientX});stage.addEventListener('pointerup',e=>{if(x===null)return;const d=e.clientX-x;x=null;if(Math.abs(d)>45)this.shift(d<0?1:-1)});
  const nav=E('div','navigation'),prev=E('button','arrow','←'),next=E('button','arrow','→');prev.setAttribute('aria-label','Previous');next.setAttribute('aria-label','Next');prev.onclick=()=>this.shift(-1);next.onclick=()=>this.shift(1);nav.append(prev,E('span','count',(selected+1)+' / '+n),next);
  const item=items[selected],summary=E('div','selection');summary.append(E('strong','',item.title),E('p','',item.summary));
  const actions=E('div','actions');if(item.demoUrl){const b=E('button','action primary','Try demo ↗');b.onclick=()=>this.detail(item,true);actions.append(b)}
  if(item.url){const a=E('a','action','Open project ↗');a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';actions.append(a)}
  const d=E('button','action','Details');d.onclick=()=>this.detail(item);actions.append(d);summary.append(actions);this.main.append(stage,nav,summary)
 }
 index(){
  this.main.replaceChildren();const wrap=E('section','index'),top=E('div','index-top'),search=E('input','search');search.type='search';search.placeholder='Search projects by name or purpose…';search.value=this.query;search.setAttribute('aria-label','Search');const label=E('span','muted'),list=E('div','index-list'),more=E('button','more','Show more ↓');
  const draw=()=>{const q=this.query.trim().toLowerCase(),items=this.collection.filter(x=>(x.title+' '+x.summary+' '+x.language).toLowerCase().includes(q));list.replaceChildren();items.slice(0,this.more).forEach(x=>{const row=E('button','index-row');row.append(E('strong','',x.title),E('span','',x.summary||'Open details'),E('small','',x.language||x.type));row.onclick=()=>this.detail(x);list.append(row)});if(!items.length)list.append(E('p','notice','No matches.'));more.hidden=this.more>=items.length;label.textContent=items.length+' entries'};
  search.oninput=()=>{this.query=search.value;this.more=24;draw()};more.onclick=()=>{this.more+=24;draw()};top.append(search,label);wrap.append(top,list,more);this.main.append(wrap);draw()
 }
 timeline(){
  this.main.replaceChildren();const wrap=E('section','timeline'),top=E('div','timeline-top');top.append(E('h3','','A timeline of making & discovery'));const select=E('select','select');select.setAttribute('aria-label','Filter timeline');
  for(const [value,label] of [['all','All activity'],['project','Projects'],['star','Stars'],['fork','Forks'],['story','Stories']]){const o=E('option','',label);o.value=value;select.append(o)}select.value=this.timelineFilter;
  const list=E('ol','timeline-list'),more=E('button','more','Earlier activity ↓');
  const draw=()=>{const items=sorted(this.items,this.timelineFilter).filter(x=>x.date&&!Number.isNaN(+new Date(x.date)));list.replaceChildren();items.slice(0,this.timelineMore).forEach(x=>{const li=E('li','timeline-item'),mark=E('span','marker '+x.type),body=E('div','timeline-copy'),b=E('button','timeline-link',x.title);b.onclick=()=>this.detail(x);body.append(E('time','',when(x.date)),b,E('p','',x.summary),E('small','kicker',x.type));li.append(mark,body);list.append(li)});if(!items.length)list.append(E('li','notice','No dated items.'));more.hidden=this.timelineMore>=items.length};
  select.onchange=()=>{this.timelineFilter=select.value;this.timelineMore=40;draw()};more.onclick=()=>{this.timelineMore+=40;draw()};top.append(select);wrap.append(top,list,more);this.main.append(wrap);draw()
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
