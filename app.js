const api='https://grundschule-hoefingen.de/wp-json/wp/v2/posts?per_page=10&orderby=date&order=desc&_embed=1';
const list=document.querySelector('#newslist'),status=document.querySelector('#status');
function plain(s){const d=document.createElement('div');d.innerHTML=s||'';return(d.textContent||'').replace(/\s+/g,' ').trim()}
function date(s){return s?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(s)):''}
function eventDate(text){const m=text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);if(!m)return null;return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),23,59,59)}
async function loadNews(){status.hidden=false;status.textContent='Neuigkeiten werden geladen …';try{const r=await fetch(api,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const posts=await r.json();if(!Array.isArray(posts)||!posts.length)throw Error('Keine Beiträge');list.replaceChildren();posts.sort((a,b)=>new Date(b.date)-new Date(a.date));for(const p of posts){const title=plain(p.title?.rendered),excerpt=plain(p.excerpt?.rendered),event=eventDate(title+' '+excerpt),past=Boolean(event&&event<new Date()),card=document.createElement('article'),meta=document.createElement('div'),h=document.createElement('h3'),x=document.createElement('p'),link=document.createElement('a');if(past)card.classList.add('past');meta.className='meta';meta.textContent='SCHULNACHRICHTEN · '+date(p.date);if(past){const tag=document.createElement('span');tag.className='news-state';tag.textContent='VERGANGEN';meta.append(tag)}h.textContent=title;x.textContent=excerpt;link.href=p.link;link.target='_blank';link.rel='noopener';link.textContent='Beitrag lesen ↗';card.append(meta,h,x,link);list.append(card)}status.hidden=true;document.querySelector('#updated').textContent='Nachrichten werden bei jedem Öffnen und über ↻ aktualisiert.'}catch(e){status.textContent='Nachrichten konnten gerade nicht automatisch geladen werden. Bitte die Schulhomepage öffnen.';list.replaceChildren()}}
document.querySelector('#refresh').addEventListener('click',()=>{loadNews();loadSchoolCalendar(true)});loadNews();
const months=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const monthMap=new Map(months.map((m,i)=>[m.toLowerCase(),i]));
const calendarState={month:new Date(new Date().getFullYear(),new Date().getMonth(),1),selected:new Date(),events:[],loaded:false,loading:false};
function dayKey(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function makeDate(day,month,year){const d=new Date(year,month,day);return d.getFullYear()===year&&d.getMonth()===month&&d.getDate()===day?d:null}
function parseSchoolEvents(html){
 const doc=new DOMParser().parseFromString(html,'text/html'),root=doc.querySelector('.entry-content,.page-content,main,article')||doc.body;
 const lines=(root.innerText||root.textContent||'').split(/\n+/).map(s=>s.replace(/\s+/g,' ').trim()).filter(Boolean),found=[];
 let activeMonth=null,activeYear=new Date().getFullYear(),previousMonth=0;
 const weekday='(?:(?:Mo|Di|Mi|Do|Fr|Sa|So)\\.?\\s*)?';
 const dateToken='(\\d{1,2})\\.\\s*(?:(\\d{1,2})\\.)?';
 const rangePattern=new RegExp('^'+weekday+dateToken+'(?:\\s*[–—-]\\s*'+dateToken+')?\\s*(?:\\|\\s*)?(.*)$','i');
 for(const line of lines){
  const heading=line.match(/^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)(?:\s+(20\d{2}))?$/i);
  if(heading){activeMonth=monthMap.get(heading[1].toLowerCase());if(heading[2])activeYear=Number(heading[2]);else if(activeMonth!==null&&activeMonth<previousMonth-6)activeYear++;previousMonth=activeMonth??previousMonth;continue}
  if(activeMonth===null)continue;
  const m=line.match(rangePattern);if(!m||!m[5]?.trim())continue;
  const startDay=Number(m[1]),startMonth=m[2]!==undefined?Number(m[2])-1:activeMonth;
  const endDay=m[3]!==undefined?Number(m[3]):null,endMonth=m[4]!==undefined?Number(m[4])-1:startMonth;
  const title=m[5].trim().replace(/^\|\s*/,'');if(!title)continue;
  const startYear=startMonth<previousMonth-6?activeYear+1:activeYear,endYear=endMonth<startMonth?startYear+1:startYear;
  const start=makeDate(startDay,startMonth,startYear),end=endDay===null?start:makeDate(endDay,endMonth,endYear);
  if(start&&end&&end>=start)found.push({start,end,title,source:'Schulhomepage'});
 }
 if(!found.length){for(const row of doc.querySelectorAll('tr')){const cells=[...row.querySelectorAll('th,td')].map(c=>plain(c.textContent));if(cells.length<2)continue;const m=cells[0].match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/);if(!m)continue;let year=m[3]?Number(m[3]):new Date().getFullYear();if(year<100)year+=2000;const start=makeDate(Number(m[1]),Number(m[2])-1,year);if(start)found.push({start,end:start,title:cells.slice(1).join(' · '),source:'Schulhomepage'})}}
 const unique=new Map();for(const e of found)unique.set(dayKey(e.start)+'|'+dayKey(e.end)+'|'+e.title,e);
 return [...unique.values()].sort((a,b)=>a.start-b.start);
}
function renderCalendar(){
 const grid=document.querySelector('#calendar-days');if(!grid)return;
 const y=calendarState.month.getFullYear(),m=calendarState.month.getMonth(),first=new Date(y,m,1),offset=(first.getDay()+6)%7,start=new Date(y,m,1-offset),today=dayKey(new Date()),selected=dayKey(calendarState.selected);
 document.querySelector('#month-label').textContent=months[m]+' '+y;document.querySelector('#agenda-label').textContent='Termine im '+months[m];grid.replaceChildren();
 for(let n=0;n<42;n++){const d=new Date(start);d.setDate(start.getDate()+n);const b=document.createElement('button');b.type='button';b.className='calendar-day';b.textContent=d.getDate();if(d.getMonth()!==m)b.classList.add('outside');if(dayKey(d)===today)b.classList.add('today');if(dayKey(d)===selected)b.classList.add('selected');if(calendarState.events.some(e=>d>=e.start&&d<=e.end))b.classList.add('has-event');b.setAttribute('aria-label',d.toLocaleDateString('de-DE'));b.addEventListener('click',()=>{calendarState.selected=d;calendarState.month=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar()});grid.append(b)}
 const agenda=document.querySelector('#agenda-list');agenda.replaceChildren();const items=calendarState.events.filter(e=>e.start<=new Date(y,m+1,0)&&e.end>=new Date(y,m,1)).sort((a,b)=>a.start-b.start);
 document.querySelector('#calendar-count').textContent=items.length+' Einträge';
 const upcoming=calendarState.events.filter(e=>e.end>=new Date(new Date().setHours(0,0,0,0))).sort((a,b)=>a.start-b.start)[0],spotlight=document.querySelector('#next-event');
 if(spotlight)spotlight.textContent=upcoming?upcoming.start.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})+(upcoming.end>upcoming.start?' – '+upcoming.end.toLocaleDateString('de-DE',{day:'2-digit',month:'long'}):'')+' · '+upcoming.title:'Alle aktuellen Termine findest du im Schulkalender.';
 if(!items.length){const p=document.createElement('p');p.className='calendar-empty';p.textContent=calendarState.loaded?'Für diesen Monat sind keine Termine hinterlegt.':'Termine werden geladen …';agenda.append(p)}
 for(const e of items){const row=document.createElement('div'),dateBox=document.createElement('div'),body=document.createElement('div'),num=document.createElement('b'),mon=document.createElement('small'),title=document.createElement('strong'),desc=document.createElement('p');row.className='agenda-item';dateBox.className='agenda-date';num.textContent=e.start.getDate()+(dayKey(e.end)!==dayKey(e.start)?'–'+e.end.getDate():'');mon.textContent=months[e.start.getMonth()].slice(0,3);dateBox.append(num,mon);title.textContent=e.title;desc.textContent=e.start.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})+(dayKey(e.end)!==dayKey(e.start)?' – '+e.end.toLocaleDateString('de-DE',{day:'2-digit',month:'long'}):'');body.append(title,desc);row.append(dateBox,body);agenda.append(row)}
}
async function loadSchoolCalendar(force=false){
 const target=document.querySelector('#agenda-list');if(!target||calendarState.loading)return;if(calendarState.loaded&&!force)return;calendarState.loading=true;target.innerHTML='<p class="calendar-loading">Termine werden von der Schulhomepage geladen …</p>';
 try{const r=await fetch('https://grundschule-hoefingen.de/wp-json/wp/v2/pages?slug=termine&_fields=content,title,link',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(!Array.isArray(data)||!data[0]?.content?.rendered)throw Error('Terminseite nicht gefunden');const events=parseSchoolEvents(data[0].content.rendered);if(!events.length)throw Error('Keine Termine erkannt');calendarState.events=events;calendarState.loaded=true;renderCalendar()}catch(e){calendarState.loaded=false;renderCalendar();target.innerHTML='<p class="calendar-empty">Die Termine konnten nicht automatisch eingelesen werden. Bitte nutze die <a href="https://grundschule-hoefingen.de/termine/" target="_blank" rel="noopener">offizielle Terminübersicht ↗</a>.</p>'}finally{calendarState.loading=false}
}
document.querySelector('#month-prev')?.addEventListener('click',()=>{calendarState.month=new Date(calendarState.month.getFullYear(),calendarState.month.getMonth()-1,1);calendarState.selected=new Date(calendarState.month);renderCalendar()});
document.querySelector('#month-next')?.addEventListener('click',()=>{calendarState.month=new Date(calendarState.month.getFullYear(),calendarState.month.getMonth()+1,1);calendarState.selected=new Date(calendarState.month);renderCalendar()});
renderCalendar();
function openCalendar(){const section=document.querySelector('#calendar');if(!section)return;section.hidden=false;document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#calendar'));if(!calendarState.loaded)loadSchoolCalendar();requestAnimationFrame(()=>section.scrollIntoView({behavior:'smooth',block:'start'}))}
function closeCalendar(){document.querySelector('#calendar').hidden=true}
document.querySelectorAll('a[href="#calendar"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();openCalendar()}));
document.querySelector('nav a[href="#"]').addEventListener('click',e=>{e.preventDefault();closeCalendar();document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'));window.scrollTo({top:0,behavior:'smooth'})});
document.querySelector('nav a[href="#news"]').addEventListener('click',e=>{e.preventDefault();closeCalendar();document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#news'));document.querySelector('#news').scrollIntoView({behavior:'smooth',block:'start'})});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=16',{updateViaCache:'none'}).catch(()=>{}));
