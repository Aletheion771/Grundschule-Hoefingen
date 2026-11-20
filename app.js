const api='https://grundschule-hoefingen.de/wp-json/wp/v2/posts?per_page=10&orderby=date&order=desc&_embed=1';
const list=document.querySelector('#newslist'),status=document.querySelector('#status');
function plain(s){const d=document.createElement('div');d.innerHTML=s||'';return(d.textContent||'').replace(/\s+/g,' ').trim()}
function date(s){return s?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(s)):''}
function eventDate(text){const m=text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);if(!m)return null;const d=new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),23,59,59);return Number.isNaN(d.getTime())?null:d}
async function load(){status.hidden=false;status.textContent='Neuigkeiten werden geladen …';try{const r=await fetch(api,{cache:'no-store'});if(!r.ok)throw Error();const posts=await r.json();if(!Array.isArray(posts)||!posts.length)throw Error();list.replaceChildren();posts.sort((x,y)=>new Date(y.date)-new Date(x.date));for(const p of posts){const title=plain(p.title?.rendered),excerpt=plain(p.excerpt?.rendered),event=eventDate(title+' '+excerpt),past=Boolean(event&&event<new Date());const card=document.createElement('article'),meta=document.createElement('div'),h=document.createElement('h3'),x=document.createElement('p'),l=document.createElement('a');if(past)card.classList.add('past');meta.className='meta';meta.textContent='SCHULNACHRICHTEN · veröffentlicht '+date(p.date);if(past){const tag=document.createElement('span');tag.className='news-state';tag.textContent='VERGANGEN';meta.append(tag)}h.textContent=title;x.textContent=excerpt;l.href=p.link;l.target='_blank';l.rel='noopener';l.textContent=past?'Beitrag ansehen ↗':'Beitrag lesen ↗';card.append(meta,h,x,l);list.append(card)}status.hidden=true;document.querySelector('#updated').textContent='Nachrichten werden bei jedem Öffnen und über ↻ aktualisiert.'}catch(e){status.textContent='Nachrichten konnten gerade nicht automatisch geladen werden. Bitte die Schulhomepage öffnen.';list.replaceChildren()}}
document.querySelector('#refresh').addEventListener('click',()=>{load();loadSchoolCalendar()});load();

const calendarState={month:new Date(new Date().getFullYear(),new Date().getMonth(),1),selected:new Date(),events:[]};
const months=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const weekdays=['Mo','Di','Mi','Do','Fr','Sa','So'];
function dayKey(d){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
function parseSchoolEvents(html){
 const doc=new DOMParser().parseFromString(html,'text/html'),rows=[...doc.querySelectorAll('tr')],found=[];
 for(const row of rows){const cells=[...row.querySelectorAll('th,td')].map(x=>plain(x.textContent));if(cells.length>=2){const dateText=cells[0],description=cells.slice(1).join(' · ').trim();const m=dateText.match(/(?:Mo|Di|Mi|Do|Fr|Sa|So)?\s*(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/i);if(m&&description){let year=m[3]?Number(m[3]):calendarState.month.getFullYear();if(year<100)year+=2000;found.push({date:new Date(year,Number(m[2])-1,Number(m[1])),title:description,source:'Schulhomepage'})}}}
 if(found.length)return found;
 const text=(doc.body.textContent||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);let activeMonth=null;
 for(const line of text){const monthMatch=line.match(/^(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)$/i);if(monthMatch){activeMonth=months.findIndex(x=>x.toLowerCase()===monthMatch[1].toLowerCase());continue}
 const m=line.match(/^(?:(?:Mo|Di|Mi|Do|Fr|Sa|So)\s+)?(\d{1,2})\.(?:(\d{1,2})\.)?\s*(?:\|)?\s*(.*)$/i);
 if(m&&activeMonth!==null&&m[3]){const month=m[2]?Number(m[2])-1:activeMonth;let year=calendarState.month.getFullYear();if(month<calendarState.month.getMonth()-5)year++;found.push({date:new Date(year,month,Number(m[1])),title:m[3],source:'Schulhomepage'})}}
 return found;
}
function renderCalendar(){
 const grid=document.querySelector('#calendar-days');if(!grid)return;
 const y=calendarState.month.getFullYear(),m=calendarState.month.getMonth(),first=new Date(y,m,1),offset=(first.getDay()+6)%7,start=new Date(y,m,1-offset),today=dayKey(new Date()),selected=dayKey(calendarState.selected);
 document.querySelector('#month-label').textContent=months[m]+' '+y;document.querySelector('#agenda-label').textContent='Termine im '+months[m];
 grid.replaceChildren();
 for(let n=0;n<42;n++){const d=new Date(start);d.setDate(start.getDate()+n);const b=document.createElement('button');b.className='calendar-day';b.textContent=d.getDate();if(d.getMonth()!==m)b.classList.add('outside');if(dayKey(d)===today)b.classList.add('today');if(dayKey(d)===selected)b.classList.add('selected');if(calendarState.events.some(e=>dayKey(e.date)===dayKey(d)))b.classList.add('has-event');b.setAttribute('aria-label',d.toLocaleDateString('de-DE'));b.addEventListener('click',()=>{calendarState.selected=d;calendarState.month=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar()});grid.append(b)}
 const list=document.querySelector('#agenda-list');list.replaceChildren();
 const items=calendarState.events.filter(e=>e.date.getFullYear()===y&&e.date.getMonth()===m).sort((a,b)=>a.date-b.date);
 document.querySelector('#calendar-count').textContent=items.length+' Termine';
 if(!items.length){const p=document.createElement('p');p.className='calendar-empty';p.textContent='Für diesen Monat sind keine Termine in der App hinterlegt. Die vollständige Übersicht findest du auf der Schulhomepage.';list.append(p)}
 else for(const e of items){const row=document.createElement('div'),d=document.createElement('div'),body=document.createElement('div'),num=document.createElement('b'),mon=document.createElement('small'),title=document.createElement('strong'),desc=document.createElement('p');row.className='agenda-item';d.className='agenda-date';num.textContent=e.date.getDate();mon.textContent=months[e.date.getMonth()].slice(0,3);d.append(num,mon);title.textContent=e.title;desc.textContent=e.date.toLocaleDateString('de-DE',{weekday:'long'});body.append(title,desc);row.append(d,body);list.append(row)}
}
async function loadSchoolCalendar(){
 const target=document.querySelector('#agenda-list');if(!target)return;
 target.innerHTML='<p class="calendar-loading">Termine werden von der Schulhomepage geladen …</p>';
 try{const r=await fetch('https://grundschule-hoefingen.de/wp-json/wp/v2/pages?slug=termine&_fields=content,title,link',{cache:'no-store'});if(!r.ok)throw Error();const data=await r.json();if(!data.length)throw Error();calendarState.events=parseSchoolEvents(data[0].content.rendered);renderCalendar();if(!calendarState.events.length)throw Error('Keine Termine erkannt')}
 catch(e){calendarState.events=[];renderCalendar();target.innerHTML='<p class="calendar-empty">Die Termine konnten nicht automatisch ausgelesen werden. Bitte nutze die <a href="https://grundschule-hoefingen.de/termine/" target="_blank" rel="noopener">offizielle Terminübersicht ↗</a>.</p>'}
}
document.querySelector('#month-prev')?.addEventListener('click',()=>{calendarState.month.setMonth(calendarState.month.getMonth()-1);calendarState.selected=new Date(calendarState.month);renderCalendar()});
document.querySelector('#month-next')?.addEventListener('click',()=>{calendarState.month.setMonth(calendarState.month.getMonth()+1);calendarState.selected=new Date(calendarState.month);renderCalendar()});
renderCalendar();loadSchoolCalendar();
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=10',{updateViaCache:'none'}).catch(()=>{}));