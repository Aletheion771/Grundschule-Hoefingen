const api='https://grundschule-hoefingen.de/wp-json/wp/v2/posts?per_page=10&orderby=date&order=desc&_embed=1';
const list=document.querySelector('#newslist'),status=document.querySelector('#status');
function plain(s){const d=document.createElement('div');d.innerHTML=s||'';return(d.textContent||'').replace(/\s+/g,' ').trim()}
function date(s){return s?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(s)):''}
function eventDate(text){const m=text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);if(!m)return null;return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),23,59,59)}
async function loadNews(){
 status.hidden=false;status.textContent='Neuigkeiten werden geladen …';
 try{
  const r=await fetch(api,{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);
  const posts=await r.json();if(!Array.isArray(posts)||!posts.length)throw Error('Keine Beiträge');
  list.replaceChildren();posts.sort((a,b)=>new Date(b.date)-new Date(a.date));
  posts.forEach((p,index)=>{
   const title=plain(p.title?.rendered),excerpt=plain(p.excerpt?.rendered),event=eventDate(title),past=Boolean(event&&event<new Date());
   const published=new Date(p.date),ageDays=(Date.now()-published.getTime())/86400000,isNew=ageDays>=0&&ageDays<=14;
   const card=document.createElement('article'),meta=document.createElement('div'),content=document.createElement('div'),h=document.createElement('h3'),x=document.createElement('p'),link=document.createElement('a');
   const media=p._embedded?.['wp:featuredmedia']?.[0],sizes=media?.media_details?.sizes||{},imageUrl=sizes.medium_large?.source_url||sizes.large?.source_url||media?.source_url;
   if(index===0)card.classList.add('featured');if(past)card.classList.add('past');
   meta.className='meta';meta.textContent=date(p.date);
   if(isNew){const tag=document.createElement('span');tag.className='news-state news-new';tag.textContent='NEU';meta.append(tag)}
   if(past){const tag=document.createElement('span');tag.className='news-state';tag.textContent='VERGANGEN';meta.append(tag)}
   if(imageUrl){const image=document.createElement('img');image.className='news-image';image.src=imageUrl;image.alt=plain(media?.alt_text)||title;image.loading=index<2?'eager':'lazy';image.decoding='async';image.addEventListener('error',()=>image.remove(),{once:true});card.append(image)}
   content.className='news-content';h.textContent=title;x.textContent=excerpt;
   link.href=p.link;link.target='_blank';link.rel='noopener';link.textContent='Beitrag lesen ↗';
   content.append(meta,h,x,link);card.append(content);list.append(card);
  });
  status.hidden=true;
 }catch(e){status.textContent=navigator.onLine?'Nachrichten konnten gerade nicht automatisch geladen werden. Bitte die Schulhomepage öffnen.':'Keine Internetverbindung – die Neuigkeiten können gerade nicht geladen werden.';list.replaceChildren()}
}
document.querySelector('#refresh').addEventListener('click',()=>{loadNews();loadSchoolCalendar(true)});loadNews();
const months=['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const monthMap=new Map(months.map((m,i)=>[m.toLowerCase(),i]));
const calendarState={month:new Date(new Date().getFullYear(),new Date().getMonth(),1),selected:new Date(),events:[],loaded:false,loading:false,view:'list'};
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
function officialCareEvents(){
 const specs=[
 ['2026-01-02','2026-01-05','Weihnachtsferien 2025/26','Ferien'],
 ['2026-01-05','2026-01-05','Betreuungstag','Betreuung'],
 ['2026-01-02','2026-01-02','Betreuung geschlossen','Schließtag'],
 ['2026-02-10','2026-02-10','Beweglicher Ferientag (Pferdemarkt)','Ferien'],
 ['2026-02-10','2026-02-10','Betreuungstag','Betreuung'],
 ['2026-02-16','2026-02-20','Faschingsferien','Ferien'],
 ['2026-02-17','2026-02-20','Betreuungstage','Betreuung'],
 ['2026-02-16','2026-02-16','Pädagogischer Tag – Betreuung geschlossen','Schließtag'],
 ['2026-03-30','2026-04-10','Osterferien','Ferien'],
 ['2026-03-30','2026-04-10','Betreuungstage','Betreuung'],
 ['2026-05-26','2026-06-05','Pfingstferien','Ferien'],
 ['2026-05-26','2026-05-29','Betreuungstage','Betreuung'],
 ['2026-06-01','2026-06-05','Betreuung geschlossen','Schließtag'],
 ['2026-07-30','2026-09-11','Sommerferien','Ferien'],
 ['2026-07-30','2026-08-14','Betreuungstage','Betreuung'],
 ['2026-08-17','2026-08-28','Betreuung geschlossen','Schließtag'],
 ['2026-08-31','2026-09-11','Betreuungstage','Betreuung'],
 ['2026-10-26','2026-10-30','Herbstferien','Ferien'],
 ['2026-10-27','2026-10-30','Betreuungstage','Betreuung'],
 ['2026-10-26','2026-10-26','Pädagogischer Tag – Betreuung geschlossen','Schließtag'],
 ['2026-12-23','2026-12-31','Weihnachtsferien','Ferien'],
 ['2026-12-23','2026-12-23','Betreuungstag','Betreuung'],
 ['2026-12-24','2026-12-31','Betreuung geschlossen','Schließtag'],
 // Landesweit festgelegte Schulferien Baden-Württemberg 2026/27 und 2027/28
 ['2026-12-23','2027-01-09','Weihnachtsferien 2026/27','Ferien'],
 ['2027-03-25','2027-03-25','Schulfrei (Gründonnerstag)','Schulfreier Tag'],
 ['2027-03-30','2027-04-03','Osterferien 2027','Ferien'],
 ['2027-05-18','2027-05-29','Pfingstferien 2027','Ferien'],
 ['2027-07-29','2027-09-11','Sommerferien 2027','Ferien'],
 ['2027-11-02','2027-11-06','Herbstferien 2027','Ferien'],
 ['2027-12-23','2028-01-08','Weihnachtsferien 2027/28','Ferien']
 ];
 return specs.map(([a,b,title,category])=>({start:new Date(a+'T00:00:00'),end:new Date(b+'T23:59:59'),title,category,source:category==='Betreuung'||category==='Schließtag'?'Offizieller Betreuungs-Ferienplan 2026':'Kultusministerium Baden-Württemberg'}));
}
function renderCalendar(){
 const grid=document.querySelector('#calendar-days');if(!grid)return;
 const y=calendarState.month.getFullYear(),m=calendarState.month.getMonth(),first=new Date(y,m,1),offset=(first.getDay()+6)%7,start=new Date(y,m,1-offset),today=dayKey(new Date()),selected=dayKey(calendarState.selected);
 document.querySelector('#month-label').textContent=months[m]+' '+y;document.querySelector('#agenda-label').textContent=calendarState.view==='list'?'Die nächsten Termine':'Termine im '+months[m];grid.replaceChildren();
 for(let n=0;n<42;n++){const d=new Date(start);d.setDate(start.getDate()+n);const b=document.createElement('button');b.type='button';b.className='calendar-day';b.textContent=d.getDate();if(d.getMonth()!==m)b.classList.add('outside');if(dayKey(d)===today)b.classList.add('today');if(dayKey(d)===selected)b.classList.add('selected');if(calendarState.events.some(e=>d>=e.start&&d<=e.end))b.classList.add('has-event');b.setAttribute('aria-label',d.toLocaleDateString('de-DE'));b.addEventListener('click',()=>{calendarState.selected=d;calendarState.month=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar()});grid.append(b)}
 const agenda=document.querySelector('#agenda-list');agenda.replaceChildren();const now=new Date();now.setHours(0,0,0,0);const items=(calendarState.view==='list'?calendarState.events.filter(e=>e.end>=now&&e.start<=new Date(now.getFullYear()+1,now.getMonth(),now.getDate())):calendarState.events.filter(e=>e.start<=new Date(y,m+1,0)&&e.end>=new Date(y,m,1))).sort((a,b)=>a.start-b.start);
 document.querySelector('#calendar-count').textContent=items.length+(calendarState.view==='list'?' kommende Einträge':' Einträge im Monat');
 const upcoming=calendarState.events.filter(e=>e.end>=new Date(new Date().setHours(0,0,0,0))).sort((a,b)=>a.start-b.start)[0],spotlight=document.querySelector('#next-event');
 if(spotlight)spotlight.textContent=upcoming?upcoming.start.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})+(upcoming.end>upcoming.start?' – '+upcoming.end.toLocaleDateString('de-DE',{day:'2-digit',month:'long'}):'')+' · '+upcoming.title:'Alle aktuellen Termine findest du im Schulkalender.';
 if(!items.length){const p=document.createElement('p');p.className='calendar-empty';p.textContent=calendarState.loaded?(calendarState.view==='list'?'Aktuell sind keine zukünftigen Termine hinterlegt.':'Für diesen Monat sind keine Termine hinterlegt.'):'Termine werden geladen …';agenda.append(p)}
 for(const e of items){const row=document.createElement('div'),dateBox=document.createElement('div'),body=document.createElement('div'),num=document.createElement('b'),mon=document.createElement('small'),title=document.createElement('strong'),desc=document.createElement('p');row.className='agenda-item';dateBox.className='agenda-date';num.textContent=e.start.getDate()+(dayKey(e.end)!==dayKey(e.start)?'–'+e.end.getDate():'');mon.textContent=months[e.start.getMonth()].slice(0,3);dateBox.append(num,mon);title.textContent=e.title;desc.textContent=e.start.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})+(dayKey(e.end)!==dayKey(e.start)?' – '+e.end.toLocaleDateString('de-DE',{day:'2-digit',month:'long'}):'');if(e.category){const cat=document.createElement('span');cat.className='event-category';cat.textContent=e.category;body.append(title,cat,desc)}else body.append(title,desc);row.append(dateBox,body);agenda.append(row)}
}
async function loadSchoolCalendar(force=false){
 const target=document.querySelector('#agenda-list');if(!target||calendarState.loading)return;if(calendarState.loaded&&!force)return;calendarState.loading=true;target.innerHTML='<p class="calendar-loading">Termine werden von der Schulhomepage geladen …</p>';
 try{const r=await fetch('https://grundschule-hoefingen.de/wp-json/wp/v2/pages?slug=termine&_fields=content,title,link',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.json();if(!Array.isArray(data)||!data[0]?.content?.rendered)throw Error('Terminseite nicht gefunden');const pageEvents=parseSchoolEvents(data[0].content.rendered);const preserved=calendarState.events||[];const merged=[...preserved,...pageEvents,...officialCareEvents()];const unique=new Map();for(const e of merged)unique.set(dayKey(e.start)+'|'+dayKey(e.end)+'|'+e.title,e);calendarState.events=[...unique.values()].sort((a,b)=>a.start-b.start);if(!calendarState.events.length)throw Error('Keine Termine erkannt');calendarState.loaded=true;renderCalendar()}catch(e){calendarState.loaded=false;renderCalendar();target.innerHTML='<p class="calendar-empty">Die Termine konnten nicht automatisch eingelesen werden. Bitte nutze die <a href="https://grundschule-hoefingen.de/termine/" target="_blank" rel="noopener">offizielle Terminübersicht ↗</a>.</p>'}finally{calendarState.loading=false}
}
document.querySelectorAll('.view-choice').forEach(button=>button.addEventListener('click',()=>{calendarState.view=button.dataset.view;document.querySelectorAll('.view-choice').forEach(b=>b.classList.toggle('active',b===button));document.querySelector('#calendar-month-view').hidden=calendarState.view!=='month';renderCalendar()}));
document.querySelector('#month-prev')?.addEventListener('click',()=>{calendarState.month=new Date(calendarState.month.getFullYear(),calendarState.month.getMonth()-1,1);calendarState.selected=new Date(calendarState.month);renderCalendar()});
document.querySelector('#month-next')?.addEventListener('click',()=>{calendarState.month=new Date(calendarState.month.getFullYear(),calendarState.month.getMonth()+1,1);calendarState.selected=new Date(calendarState.month);renderCalendar()});
renderCalendar();
function openCalendar(){const section=document.querySelector('#calendar');if(!section)return;section.hidden=false;document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#calendar'));if(!calendarState.loaded)loadSchoolCalendar();requestAnimationFrame(()=>section.scrollIntoView({behavior:'smooth',block:'start'}))}
function closeCalendar(){document.querySelector('#calendar').hidden=true}
document.querySelectorAll('a[href="#calendar"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();openCalendar()}));
document.querySelector('nav a[href="#"]').addEventListener('click',e=>{e.preventDefault();closeCalendar();document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#'));window.scrollTo({top:0,behavior:'smooth'})});
document.querySelector('nav a[href="#news"]').addEventListener('click',e=>{e.preventDefault();closeCalendar();document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#news'));document.querySelector('#news').scrollIntoView({behavior:'smooth',block:'start'})});
if('serviceWorker'in navigator)addEventListener('load',()=>navigator.serviceWorker.register('./sw.js?v=22',{updateViaCache:'none'}).catch(()=>{}));

const connectionHint=document.querySelector('#connection-hint');
function updateConnectionHint(){if(!connectionHint)return;connectionHint.hidden=navigator.onLine;connectionHint.textContent='Du bist offline. Nachrichten und aktuelle Termine benötigen eine Internetverbindung; bereits geladene App-Inhalte bleiben teilweise verfügbar.'}
window.addEventListener('online',()=>{updateConnectionHint();loadNews();if(calendarState.loaded)loadSchoolCalendar(true)});
window.addEventListener('offline',updateConnectionHint);
updateConnectionHint();


/* Informationsbereiche: immer nur einen Bereich gleichzeitig öffnen */
document.querySelectorAll('.info-section-item').forEach(item=>{
 item.addEventListener('toggle',()=>{
  if(item.open) document.querySelectorAll('.info-section-item').forEach(other=>{if(other!==item)other.open=false});
 });
});
document.querySelectorAll('.quick-link[href^="#"]').forEach(link=>{
 link.addEventListener('click',e=>{
  const target=document.querySelector(link.getAttribute('href'));
  if(!target?.matches('.info-section-item'))return;
  e.preventDefault();
  document.querySelectorAll('.info-section-item').forEach(other=>{other.open=other===target});
  history.replaceState(null,'',link.getAttribute('href'));
  requestAnimationFrame(()=>target.scrollIntoView({behavior:'smooth',block:'start'}));
 });
});


/* Förderverein: Inhalte bei jedem App-Start aus WordPress laden */
async function loadFoerderverein(){
 const root=document.querySelector('#foerderverein .foerderverein-card');
 const status=document.querySelector('#fv-sync-status');
 if(!root)return;
 const cacheKey='gs-hoefingen-foerderverein-v1';
 const setStatus=t=>{if(status)status.textContent=t};
 try{
  const endpoint='https://grundschule-hoefingen.de/wp-json/wp/v2/pages?slug=foerderverein&_fields=content,title,link';
  const response=await fetch(endpoint,{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const pages=await response.json();
  if(!Array.isArray(pages)||!pages[0]?.content?.rendered)throw Error('Fördervereinsseite nicht gefunden');
  const doc=new DOMParser().parseFromString(pages[0].content.rendered,'text/html');
  const content=doc.querySelector('.entry-content,.page-content,main,article')||doc.body;
  const paragraphs=[...content.querySelectorAll('p')].map(p=>p.textContent.replace(/\s+/g,' ').trim()).filter(Boolean);
  const headings=[...content.querySelectorAll('h2,h3,h4')];
  const activities=[];
  headings.forEach((h,i)=>{
   const title=h.textContent.replace(/\s+/g,' ').trim();
   if(!title||/förderverein|aktivitäten|schon mitglied|kontakt/i.test(title))return;
   let sibling=h.nextElementSibling;
   while(sibling&& !/^H[234]$/.test(sibling.tagName)){
    if(sibling.tagName==='P'&&sibling.textContent.trim()){
     activities.push({title,description:sibling.textContent.replace(/\s+/g,' ').trim()});break;
    }
    sibling=sibling.nextElementSibling;
   }
  });
  const logo=content.querySelector('img');
  const email=(content.innerText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[])[0]||'kontakt@foerderverein-hoefingen.de';
  const membershipUrl='https://grundschule-hoefingen.de/foerderverein-mitgliedsantrag/';
  let fee='12 €';
  try{
   const mr=await fetch('https://grundschule-hoefingen.de/wp-json/wp/v2/pages?slug=foerderverein-mitgliedsantrag&_fields=content',{cache:'no-store'});
   if(mr.ok){const mp=await mr.json();const txt=mp?.[0]?.content?.rendered||'';const match=txt.match(/(\d+[,.]?\d*)\s*€\s*(?:jährlich|pro\s*Jahr)|(?:jährlich|pro\s*Jahr)[^\d]{0,20}(\d+[,.]?\d*)\s*€/i);if(match)fee=(match[1]||match[2]).replace('.',',')+' €';}
  }catch(_){}
  const data={paragraphs:paragraphs.slice(0,3),activities,logo:logo?.getAttribute('src')||'',email,fee,updated:new Date().toISOString()};
  if(!data.paragraphs.length)throw Error('Seiteninhalt konnte nicht gelesen werden');
  localStorage.setItem(cacheKey,JSON.stringify(data));
  renderFoerderverein(data);
  setStatus('Aktuelle Inhalte von der Schulhomepage · zuletzt geladen: '+new Date(data.updated).toLocaleString('de-DE'));
 }catch(e){
  try{const cached=JSON.parse(localStorage.getItem(cacheKey)||'null');if(cached){renderFoerderverein(cached);setStatus('Gespeicherter Stand wird angezeigt · Aktualisierung derzeit nicht möglich');return;}}catch(_){}
  setStatus('Homepage-Inhalte konnten nicht aktualisiert werden. Bitte die Schulhomepage öffnen.');
 }
}
function renderFoerderverein(data){
 const root=document.querySelector('#foerderverein .foerderverein-card');if(!root)return;
 const brand=root.querySelector('.fv-brand');
 if(brand&&data.logo){const img=brand.querySelector('img');if(img)img.src=data.logo;}
 const oldIntro=root.querySelector('.fv-dynamic-intro');if(oldIntro)oldIntro.remove();
 const intro=document.createElement('div');intro.className='fv-dynamic-intro';
 (data.paragraphs||[]).forEach(t=>{const p=document.createElement('p');p.textContent=t;intro.append(p)});
 brand?.after(intro);
 const fee=root.querySelector('.fv-fee-panel span b');if(fee&&data.fee)fee.textContent=data.fee;
 const emailLink=root.querySelector('.fv-contact a');if(emailLink&&data.email){emailLink.href='mailto:'+data.email;emailLink.textContent=data.email;}
 const list=root.querySelector('.fv-activities-list');
 if(list&&data.activities?.length){list.replaceChildren();data.activities.forEach(a=>{const item=document.createElement('div'),b=document.createElement('b'),p=document.createElement('p');b.textContent=a.title;p.textContent=a.description;item.append(b,p);list.append(item)});}
}
loadFoerderverein();

/* Unterrichtszeiten, Betreuung und Formulare live aus WordPress laden */
const schoolPageSources=[
 {slug:'unterrichtszeiten',id:'unterrichtszeiten-info',key:'schedule'},
 {slug:'schulkindbetreuung',id:'betreuung-info',key:'care'},
 {slug:'formulare',id:'formulare-info',key:'forms'}
];
function safeSchoolFragment(markup){
 const parsed=new DOMParser().parseFromString(markup,'text/html');
 const source=parsed.querySelector('.entry-content,.page-content,main,article')||parsed.body;
 const allowed=new Set(['H2','H3','H4','P','UL','OL','LI','A','STRONG','B','EM','BR','HR']);
 function cloneSafe(n){
  if(n.nodeType===Node.TEXT_NODE)return document.createTextNode(n.textContent);
  if(n.nodeType!==Node.ELEMENT_NODE)return document.createDocumentFragment();
  if(!allowed.has(n.tagName)){const f=document.createDocumentFragment();n.childNodes.forEach(c=>f.append(cloneSafe(c)));return f;}
  const e=document.createElement(n.tagName.toLowerCase());
  if(n.tagName==='A'){
   const href=n.getAttribute('href')||'';
   let valid=false;try{const u=new URL(href,'https://grundschule-hoefingen.de/');valid=u.hostname==='grundschule-hoefingen.de'&&u.protocol==='https:'}catch(_){}
   if(valid||/^(mailto:|tel:)/i.test(href)){e.href=href;if(valid){e.target='_blank';e.rel='noopener'}}
  }
  n.childNodes.forEach(c=>e.append(cloneSafe(c)));return e;
 }
 const f=document.createDocumentFragment();source.childNodes.forEach(n=>f.append(cloneSafe(n)));return f;
}
async function loadSchoolInfoPages(){
 await Promise.all(schoolPageSources.map(async src=>{
  const card=document.querySelector('#'+src.id+' .info-card'),status=document.querySelector('#'+src.key+'-sync-status');if(!card)return;
  const cacheKey='gs-hoefingen-page-'+src.slug+'-v1',setStatus=t=>{if(status)status.textContent=t};
  try{
   const r=await fetch('https://grundschule-hoefingen.de/wp-json/wp/v2/pages?slug='+src.slug+'&_fields=content,title,link',{cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const pages=await r.json();if(!Array.isArray(pages)||!pages[0]?.content?.rendered)throw Error('Seite nicht gefunden');
   const markup=pages[0].content.rendered,doc=new DOMParser().parseFromString(markup,'text/html'),content=doc.querySelector('.entry-content,.page-content,main,article')||doc.body;
   if(!content.textContent.trim())throw Error('Kein Inhalt');
   localStorage.setItem(cacheKey,JSON.stringify({html:content.innerHTML,updated:new Date().toISOString()}));
   card.replaceChildren(safeSchoolFragment(content.innerHTML));
   setStatus('Aktuelle Inhalte von der Schulhomepage · zuletzt geladen: '+new Date().toLocaleString('de-DE'));
  }catch(e){
   try{const old=JSON.parse(localStorage.getItem(cacheKey)||'null');if(old?.html){card.replaceChildren(safeSchoolFragment(old.html));setStatus('Gespeicherter Stand · Aktualisierung derzeit nicht möglich');return}}catch(_){}
   setStatus('Homepage-Inhalte konnten nicht aktualisiert werden. Bitte die Schulhomepage öffnen.');
  }
 }));
}
loadSchoolInfoPages();

/* Anonyme App-Nutzungsstatistik: nur aggregierte Ereignisse, keine Nutzerkennungen */
(function(){
 const endpoint='https://grundschule-hoefingen.de/wp-json/schulapp/v1/event';
 function countEvent(event){
  try{
   const body=JSON.stringify({event});
   const payload=new Blob([body],{type:'text/plain;charset=UTF-8'});
   if(navigator.sendBeacon){navigator.sendBeacon(endpoint,payload);}
   else{fetch(endpoint,{method:'POST',mode:'no-cors',body:payload,keepalive:true}).catch(()=>{});}
  }catch(_){}
 }
 countEvent('app_open');
 const eventBySection={
  'foerderverein':'foerderverein',
  'unterrichtszeiten-info':'schedule',
  'betreuung-info':'care',
  'formulare-info':'forms'
 };
 document.querySelectorAll('.info-section-item').forEach(section=>{
  section.addEventListener('toggle',()=>{if(section.open&&eventBySection[section.id])countEvent(eventBySection[section.id]);});
 });
 document.querySelectorAll('nav a[href="#news"]').forEach(a=>a.addEventListener('click',()=>countEvent('news')));
 document.querySelectorAll('a[href="#calendar"]').forEach(a=>a.addEventListener('click',()=>countEvent('calendar')));
})();
