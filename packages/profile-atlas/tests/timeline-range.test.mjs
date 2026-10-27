import assert from 'node:assert/strict';
import {test} from 'node:test';
import {activityWindow,reconcileMonthlySnapshots} from '../dist/src/timeline-math.js';

const now=new Date(2026,9,25,18,0,0);
const events=[
 {id:'s',type:'star',date:new Date(2026,9,20,10).toISOString()},
 {id:'f',type:'fork',date:new Date(2026,9,25,11).toISOString()},
 {id:'old',type:'project',date:new Date(2025,3,16,12).toISOString()},
 {id:'month',type:'star',date:'2024-09-01T12:00:00Z',activityCount:45,aggregate:true},
];

test('calendar week begins Monday and groups events by day',()=>{
 const w=activityWindow('week',events,now);
 assert.equal(w.grain,'day');assert.equal(w.bins.length,7);
 assert.equal(w.bins[0].start.getDay(),1);
 assert.equal(w.totals.star,1);assert.equal(w.totals.fork,1);
 assert.equal(w.totals.project,0);
});

test('month has daily bars; year has monthly bars',()=>{
 const month=activityWindow('month',events,now),year=activityWindow('year',events,now);
 assert.equal(month.bins.length,31);assert.equal(month.totals.star,1);
 assert.equal(year.bins.length,12);assert.equal(year.totals.fork,1);
 assert.equal(year.totals.project,0);
});

test('five years means 60 monthly bins and all preserves historical month-only data',()=>{
 const five=activityWindow('five',events,now),all=activityWindow('all',events,now);
 assert.equal(five.bins.length,60);assert.equal(five.bins.at(-1).key,'2026-10');
 assert.equal(five.totals.star,46);
 assert.equal(all.totals.star,46);assert.equal(all.grain,'month');
});

test('historical monthly aggregate never becomes a fake day',()=>{
 const d=activityWindow('month',events,new Date(2024,8,28,14));
 assert.equal(d.totals.star,0);assert.equal(d.monthOnlyOmitted,45);
 assert.equal(d.bins.every(b=>b.items.length===0),true);
});

test('snapshot reconciles against known dates without double counting',()=>{
 const known=[{type:'star',date:'2024-09-08T12:00:00Z'},{type:'project',date:'2024-09-12T12:00:00Z'}];
 const added=reconcileMonthlySnapshots([['2024-09',5,0,1]],'2026-10-24',known);
 assert.equal(added.length,1);assert.equal(added[0].type,'star');assert.equal(added[0].activityCount,4);
});
