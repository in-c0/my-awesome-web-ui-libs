/* Pure date bucketing. A month-only snapshot is never placed on an invented day. */
export const ACTIVITY_TYPES=['star','fork','project','commit'];

const pad=n=>String(n).padStart(2,'0');
const monthKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}`;
const dayKey=d=>`${monthKey(d)}-${pad(d.getDate())}`;
const addDay=(d,n)=>new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);
const addMonth=(d,n)=>new Date(d.getFullYear(),d.getMonth()+n,1);
const format=(d,options)=>new Intl.DateTimeFormat('en',{...options}).format(d);
const monthLabel=d=>format(d,{month:'short',year:'numeric'});
const amount=x=>Number.isFinite(Number(x.activityCount))?Math.max(0,Number(x.activityCount)):1;

export function reconcileMonthlySnapshots(rows,recordedAt,known){
 const live=new Map();
 for(const item of known){
  if(!['star','fork','project'].includes(item.type)||!item.date)continue;
  const date=new Date(item.date);if(Number.isNaN(+date))continue;
  const key=date.toISOString().slice(0,7)+':'+item.type;
  live.set(key,(live.get(key)||0)+amount(item));
 }
 const extras=[],types=['star','fork','project'];
 for(const row of rows||[]){
  const month=row[0];if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))continue;
  for(let i=0;i<types.length;i++){
   const total=Number(row[i+1]),type=types[i];if(!Number.isFinite(total)||total<=0)continue;
   const missing=Math.max(0,total-(live.get(month+':'+type)||0));
   if(missing<=0)continue;
   extras.push({id:`monthly-baseline:${month}:${type}`,type,
    title:`${type==='project'?'Repositories':type==='fork'?'Forks':'Stars'} in ${month}`,
    summary:`${missing} additional recorded ${type} activities from the ${recordedAt||'historical'} month-level snapshot; individual dates and names are unavailable.`,
    date:month+'-01T12:00:00Z',activityCount:missing,aggregate:true,source:'monthly-snapshot'});
  }
 }
 return extras;
}

export function activityWindow(range,items,now=new Date()){
 const today=new Date(now.getFullYear(),now.getMonth(),now.getDate());
 let start,grain;
 if(range==='week'){
  start=addDay(today,-(today.getDay()+6)%7);grain='day';
 }else if(range==='month'){
  start=new Date(today.getFullYear(),today.getMonth(),1);grain='day';
 }else if(range==='year'){
  start=new Date(today.getFullYear(),0,1);grain='month';
 }else if(range==='five'){
  start=new Date(today.getFullYear()-5,today.getMonth()+1,1);grain='month';
 }else{
  let earliest=+today;
  for(const item of items){const d=new Date(item.date);if(!Number.isNaN(+d))earliest=Math.min(earliest,+d)}
  const d=new Date(earliest);start=new Date(d.getFullYear(),d.getMonth(),1);
  const span=(today.getFullYear()-start.getFullYear())*12+today.getMonth()-start.getMonth();
  grain=span>72?'year':'month';
  if(grain==='year')start=new Date(start.getFullYear(),0,1);
 }
 if(!['week','month','year','five','all'].includes(range))return activityWindow('year',items,now);
 const finish=range==='week'?addDay(start,7):range==='month'?addMonth(start,1):range==='year'?new Date(today.getFullYear()+1,0,1):addMonth(new Date(today.getFullYear(),today.getMonth(),1),1);
 const bins=[],byKey=new Map();let cursor=start;
 while(cursor<finish&&bins.length<200){
  const next=grain==='day'?addDay(cursor,1):grain==='month'?addMonth(cursor,1):new Date(cursor.getFullYear()+1,0,1);
  const key=grain==='day'?dayKey(cursor):grain==='month'?monthKey(cursor):String(cursor.getFullYear());
  const label=grain==='day'?format(cursor,{weekday:'short',day:'numeric'}):grain==='month'?monthLabel(cursor):key;
  const bin={key,label,start:cursor,end:next,future:cursor>today,items:[],counts:{star:0,fork:0,project:0,commit:0}};
  bins.push(bin);byKey.set(key,bin);cursor=next;
 }
 const totals={star:0,fork:0,project:0,commit:0};let monthOnlyOmitted=0,dated=0;
 for(const item of items){
  if(!ACTIVITY_TYPES.includes(item.type)||!item.date)continue;
  const d=new Date(item.date);if(Number.isNaN(+d)||d>now)continue;
  const month=typeof item.date==='string'&&/^\d{4}-\d{2}/.test(item.date)?item.date.slice(0,7):monthKey(d);
  if(item.aggregate&&grain==='day'){
   const aggregateMonth=month;
   if((range==='month'&&aggregateMonth===monthKey(today))||(range==='week'&&bins.some(b=>monthKey(b.start)===aggregateMonth)))monthOnlyOmitted+=amount(item);
   continue;
  }
  const key=grain==='day'?dayKey(d):grain==='month'?(item.aggregate?month:monthKey(d)):String(d.getFullYear());
  const bin=byKey.get(key);if(!bin)continue;
  bin.items.push(item);bin.counts[item.type]+=amount(item);totals[item.type]+=amount(item);dated++;
 }
 let label;
 if(range==='week')label=`${format(start,{month:'short',day:'numeric'})} – ${format(addDay(start,6),{month:'short',day:'numeric',year:'numeric'})}`;
 else if(range==='month')label=monthLabel(today);
 else if(range==='year')label=String(today.getFullYear());
 else label=`${monthLabel(start)} – ${monthLabel(today)}`;
 return {range,grain,start,finish,bins,totals,label,monthOnlyOmitted,dated};
}
