import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {installDom,settle} from './fake-dom.mjs';

const manifest=JSON.parse(readFileSync(new URL('../data/in-c0.json',import.meta.url),'utf8'));
let n=0;
const fresh=()=>import('../dist/src/profile-atlas.js?case='+(++n));

function recorder({offline=false}={}){
 const calls=[];
 const fetch=async url=>{
  url=String(url);calls.push(url);
  if(url.startsWith('https://api.github.com')){if(offline)throw new TypeError('Failed to fetch');return {ok:true,status:200,json:async()=>[]}}
  return {ok:true,status:200,json:async()=>structuredClone(manifest)};
 };
 return {calls,fetch,github:()=>calls.filter(u=>u.startsWith('https://api.github.com')),manifests:()=>calls.filter(u=>u.endsWith('.json')&&!u.startsWith('https://api.github.com'))};
}
const text=el=>el.shadowRoot.textContent;

test('an events array set before the element is defined is kept, and nothing is fetched',async()=>{
 const net=recorder();const document=installDom({fetch:net.fetch});
 const el=document.createElement('github-activity-timeline');
 el.setAttribute('username','in-c0');
 el.events=[{id:'a',type:'star',title:'Saved repo',date:'2026-10-02T10:00:00Z'},{id:'b',type:'fork',title:'Fork',date:'2026-10-03T10:00:00Z'}];
 document.body.append(el);
 await fresh();await settle();
 assert.equal(el.events.length,2);
 assert.equal(net.github().length,0);
 assert.match(text(el),/Monthly analysis/);
});

test('upgrading <profile-atlas> with three attributes loads once',async()=>{
 const net=recorder();const document=installDom({fetch:net.fetch});
 const el=document.createElement('profile-atlas');
 el.setAttribute('username','in-c0');el.setAttribute('manifest-url','../data/in-c0.json');el.setAttribute('max-pages','2');
 document.body.append(el);
 await fresh();await settle();
 assert.equal(net.manifests().length,1,'one manifest request');
 assert.equal(net.github().length,3,'one request per GitHub feed');
 assert.equal(el.items.filter(x=>x.type==='project').length,7);
});

test('upgrading <github-activity-timeline> with a username loads once',async()=>{
 const net=recorder();const document=installDom({fetch:net.fetch});
 const el=document.createElement('github-activity-timeline');
 el.setAttribute('username','in-c0');el.setAttribute('max-pages','1');
 document.body.append(el);
 await fresh();await settle();
 assert.equal(net.github().length,3);
});

test('a manifest without a username renders the gallery and never calls GitHub',async()=>{
 const net=recorder();const document=installDom({fetch:net.fetch});
 await fresh();
 const el=document.createElement('profile-atlas');
 el.setAttribute('manifest-url','../data/in-c0.json');
 document.body.append(el);await settle();
 assert.equal(net.github().length,0);
 assert.equal(el.pending,false);
 assert.equal(el.items.length,7+5+10);
 assert.ok(el.shadowRoot.querySelector('.splay-plate'),'gallery plates are drawn');
 assert.ok(el.shadowRoot.querySelector('github-activity-timeline'),'the timeline is drawn from the snapshot');
});

test('dates may be Date objects or timestamps',async()=>{
 const document=installDom({fetch:recorder().fetch});
 await fresh();
 const el=document.createElement('github-activity-timeline');
 document.body.append(el);
 el.events=[{id:'d',type:'project',title:'From a Date',date:new Date()},{id:'t',type:'commit',title:'From a number',date:Date.now()}];
 assert.match(text(el),/Monthly analysis/);
 const metrics=el.shadowRoot.querySelectorAll('.monthly-metric').map(x=>x.querySelector('strong').textContent);
 assert.deepEqual(metrics,['0','0','1','1']);
});

test('the range attribute and property pick the period',async()=>{
 const document=installDom({fetch:recorder().fetch});
 await fresh();
 const el=document.createElement('github-activity-timeline');
 el.setAttribute('range','five');
 document.body.append(el);
 el.events=[{id:'x',type:'star',title:'x',date:new Date().toISOString()}];
 assert.equal(el.range,'five');
 assert.equal(el.shadowRoot.querySelector('.activity-range.selected').textContent,'Past 5 years');
 el.range='week';
 assert.equal(el.shadowRoot.querySelector('.activity-range.selected').textContent,'This week');
 el.range='decade';
 assert.equal(el.range,'week','unknown ranges are ignored');
});

test('an unreachable API explains itself instead of printing "Failed to fetch"',async()=>{
 const net=recorder({offline:true});const document=installDom({fetch:net.fetch});
 await fresh();
 const el=document.createElement('github-activity-timeline');
 el.setAttribute('username','someone');
 document.body.append(el);await settle();
 assert.doesNotMatch(text(el),/Failed to fetch/);
 assert.match(text(el),/could not be reached/);
});

test('arrow keys inside the nested timeline do not move the gallery',async()=>{
 const document=installDom({fetch:recorder().fetch});
 await fresh();
 const el=document.createElement('profile-atlas');
 el.setAttribute('manifest-url','../data/in-c0.json');
 document.body.append(el);await settle();
 const timeline=el.shadowRoot.querySelector('github-activity-timeline');
 let prevented=false;
 el.keydown({key:'ArrowRight',target:timeline,preventDefault(){prevented=true}});
 assert.equal(el.pos.project||0,0);assert.equal(prevented,false);
 el.keydown({key:'ArrowRight',target:el.shadowRoot.querySelector('.splay-plate'),preventDefault(){prevented=true}});
 assert.equal(el.pos.project,1);assert.equal(prevented,true);
});

test('theme is passed to the nested timeline',async()=>{
 const document=installDom({fetch:recorder().fetch});
 await fresh();
 const el=document.createElement('profile-atlas');
 el.setAttribute('manifest-url','../data/in-c0.json');el.setAttribute('theme','dark');
 document.body.append(el);await settle();
 const timeline=el.shadowRoot.querySelector('github-activity-timeline');
 assert.equal(timeline.getAttribute('theme'),'dark');
 el.setAttribute('theme','auto');
 assert.equal(timeline.getAttribute('theme'),'auto');
});

test('the activity-open event can replace the built-in details panel',async()=>{
 const document=installDom({fetch:recorder().fetch});
 await fresh();
 const el=document.createElement('github-activity-timeline');
 document.body.append(el);
 el.events=[{id:'s',type:'star',title:'Saved',date:new Date().toISOString()}];
 let detail=null;
 el.addEventListener('activity-open',e=>{detail=e.detail;e.preventDefault()});
 el.shadowRoot.querySelector('.activity-mark').click();
 assert.equal(detail.items.length,1);assert.match(detail.label,/^Star · /);
 assert.equal(el.shadowRoot.querySelector('.graph-drawer'),null);
});

test('collections with no entries get no tab',async()=>{
 const document=installDom({fetch:recorder().fetch});
 await fresh();
 const el=document.createElement('profile-atlas');
 el.setAttribute('manifest-url','../data/in-c0.json');
 document.body.append(el);await settle();
 assert.equal(el.shadowRoot.querySelectorAll('.tab').length,0,'only Made has entries, so no tab row');
});

test('a scrolling plot opens on the latest period',async()=>{
 const document=installDom({fetch:recorder().fetch});
 await fresh();
 const el=document.createElement('github-activity-timeline');
 el.setAttribute('range','all');
 document.body.append(el);
 el.events=[{id:'o',type:'star',title:'Old',date:'2019-01-05T00:00:00Z'},{id:'n',type:'star',title:'New',date:new Date().toISOString()}];
 assert.equal(el.shadowRoot.querySelector('.activity-plot-viewport').scrollLeft,1000);
});
