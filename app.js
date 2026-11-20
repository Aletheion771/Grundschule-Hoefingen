const api='https://grundschule-hoefingen.de/wp-json/wp/v2/posts?per_page=10&orderby=date&order=desc&_embed=1';

/* Gemeinsamer WordPress-Cache: automatische Aktualisierung höchstens alle 30 Minuten */
const SCHOOL_CACHE_TTL=30*60*1000;
async function getSchoolJson(url,key,force=false){
 const cacheKey='gs-school-cache-'+key;
 let cached=null;
 try{cached=JSON.parse(localStorage.getItem(cacheKey)||'null')}catch(_){}
 if(!force&&cached?.data&&Date.now()-cached.savedAt<SCHOOL_CACHE_TTL)return cached.data;
 try{
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok)throw Error('HTTP '+response.status);
  const data=await response.json();
  localStorage.setItem(cacheKey,JSON.stringify({data,savedAt:Date.now()}));
  return data;
 }catch(error){
  if(cached?.data)return cached.data;
  throw error;
 }
}

const list=document.querySelector('#newslist'),status=document.querySelector('#status');
function plain(s){const d=document.createElement('div');d.innerHTML=s||'';return(d.textContent||'').replace(/\s+/g,' ').trim()}
function date(s){return s?new Intl.DateTimeFormat('de-DE',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(s)):''}
function eventDate(text){const m=text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);if(!m)return null;return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]),23,59,59)}
async function loadNews(force=false){
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
document.querySelector('#refresh').addEventListener('click',()=>{loadNews(true);loadSchoolCalendar(true)});loadNews();
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
 for(let n=0;n<42;n++){const d=new Date(start);d.setDate(start.getDate()+n);const b=document.createElement('button');b.type='button';b.className='calendar-day';b.textContent=d.getDate();if(d.getMonth()!==m)b.classList.add('outside');if(dayKey(d)===today)b.classList.add('today');if(dayKey(d)===selected)b.classList.add('selected');const dayEvents=calendarState.events.filter(e=>d>=e.start&&d<=e.end);if(dayEvents.length)b.classList.add('has-event');if(dayEvents.some(e=>e.category==='Ferien'))b.classList.add('has-holiday');b.setAttribute('aria-label',d.toLocaleDateString('de-DE'));b.addEventListener('click',()=>{calendarState.selected=d;calendarState.month=new Date(d.getFullYear(),d.getMonth(),1);renderCalendar()});grid.append(b)}
 const agenda=document.querySelector('#agenda-list');agenda.replaceChildren();const now=new Date();now.setHours(0,0,0,0);const items=(calendarState.view==='list'?calendarState.events.filter(e=>e.end>=now&&e.start<=new Date(now.getFullYear()+1,now.getMonth(),now.getDate())):calendarState.events.filter(e=>e.start<=new Date(y,m+1,0)&&e.end>=new Date(y,m,1))).sort((a,b)=>a.start-b.start);
 document.querySelector('#calendar-count').textContent=items.length+(calendarState.view==='list'?' kommende Einträge':' Einträge im Monat');
 const upcoming=calendarState.events.filter(e=>e.end>=new Date(new Date().setHours(0,0,0,0))).sort((a,b)=>a.start-b.start)[0],spotlight=document.querySelector('#next-event');
 if(spotlight)spotlight.textContent=upcoming?upcoming.start.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})+(upcoming.end>upcoming.start?' – '+upcoming.end.toLocaleDateString('de-DE',{day:'2-digit',month:'long'}):'')+' · '+upcoming.title:'Alle aktuellen Termine findest du im Schulkalender.';
 if(!items.length){const p=document.createElement('p');p.className='calendar-empty';p.textContent=calendarState.loaded?(calendarState.view==='list'?'Aktuell sind keine zukünftigen Termine hinterlegt.':'Für diesen Monat sind keine Termine hinterlegt.'):'Termine werden geladen …';agenda.append(p)}
 for(const e of items){const row=document.createElement('div'),dateBox=document.createElement('div'),body=document.createElement('div'),num=document.createElement('b'),mon=document.createElement('small'),title=document.createElement('strong'),desc=document.createElement('p');row.className='agenda-item';if(e.category==='Ferien')row.classList.add('holiday-item');dateBox.className='agenda-date';if(e.category==='Ferien')dateBox.classList.add('holiday-date');num.textContent=e.start.getDate()+(dayKey(e.end)!==dayKey(e.start)?'–'+e.end.getDate():'');mon.textContent=months[e.start.getMonth()].slice(0,3);dateBox.append(num,mon);title.textContent=e.title;desc.textContent=e.start.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'long'})+(dayKey(e.end)!==dayKey(e.start)?' – '+e.end.toLocaleDateString('de-DE',{day:'2-digit',month:'long'}):'');if(e.category){const cat=document.createElement('span');cat.className='event-category'+(e.category==='Ferien'?' holiday-category':'');cat.textContent=e.category;body.append(title,cat,desc)}else body.append(title,desc);row.append(dateBox,body);agenda.append(row)}
}
async function loadSchoolCalendar(force=false){
 const target=document.querySelector('#agenda-list');if(!target||calendarState.loading)return;if(calendarState.loaded&&!force)return;calendarState.loading=true;target.innerHTML='<p class="calendar-loading">Termine werden von der Schulhomepage geladen …</p>';
 try{const data=await getSchoolJson('https://grundschule-hoefingen.de/wp-json/wp/v2/pages?slug=termine&_fields=content,title,link','calendar',force);if(!Array.isArray(data)||!data[0]?.content?.rendered)throw Error('Terminseite nicht gefunden');const pageEvents=parseSchoolEvents(data[0].content.rendered);const preserved=calendarState.events||[];const merged=[...preserved,...pageEvents,...officialCareEvents()];const unique=new Map();for(const e of merged)unique.set(dayKey(e.start)+'|'+dayKey(e.end)+'|'+e.title,e);calendarState.events=[...unique.values()].sort((a,b)=>a.start-b.start);if(!calendarState.events.length)throw Error('Keine Termine erkannt');calendarState.loaded=true;renderCalendar()}catch(e){calendarState.loaded=false;renderCalendar();target.innerHTML='<p class="calendar-empty">Die Termine konnten nicht automatisch eingelesen werden. Bitte nutze die <a href="https://grundschule-hoefingen.de/termine/" target="_blank" rel="noopener">offizielle Terminübersicht ↗</a>.</p>'}finally{calendarState.loading=false}
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

/* Mehr-Bereich, Farbschema und App-Sprache */
const moreSection=document.querySelector('#more');
function closeMore(){if(moreSection)moreSection.hidden=true}
function openMore(){closeCalendar();moreSection.hidden=false;document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')==='#more'));applyTranslations();requestAnimationFrame(()=>moreSection.scrollIntoView({behavior:'smooth',block:'start'}))}
document.querySelector('nav a[href="#more"]')?.addEventListener('click',e=>{e.preventDefault();openMore()});
document.querySelector('nav a[href="#"]')?.addEventListener('click',()=>closeMore());
document.querySelector('nav a[href="#news"]')?.addEventListener('click',()=>closeMore());
document.querySelector('nav a[href="#calendar"]')?.addEventListener('click',()=>closeMore());
const translations={
 de:{more:'Mehr',moreKicker:'WEITERE ANGEBOTE',moreTitle:'Mehr',schoolWebsite:'Schulhomepage',schoolWebsiteSub:'Zur offiziellen Website der Grundschule',imprint:'Impressum',imprintSub:'Anbieterkennzeichnung und Kontakt',settings:'Einstellungen',appearance:'Farbschema',appearanceSub:'Wie soll die App dargestellt werden?',system:'System',normal:'Normal',dark:'Dark',language:'Sprache',languageSub:'Sprache der App auswählen',translationNote:'Hinweis: Die Übersetzung erfolgt automatisiert und ungeprüft durch Google Übersetzer. Trotz größter Sorgfalt können Übersetzungsfehler oder inhaltliche Abweichungen auftreten. Maßgeblich ist im Zweifel die deutsche Originalfassung.',careKicker:'BETREUUNG & KONTAKT',careTitle:'Schulkindbetreuung',careLead:'Betreuung an der Grundschule Höfingen ist – je nach gebuchtem Baustein – morgens ab 07:00 Uhr und nachmittags bis 17:00 Uhr möglich.',careReliable:'Verlässliche Grundschule',careReliableText:'Betreuung vor Unterrichtsbeginn und nach dem Unterricht bis 13:30 Uhr. In dieser Zeit können die Kinder essen, spielen, malen oder die Lernzeit für Hausaufgaben nutzen. Die Eltern kontrollieren Richtigkeit und Vollständigkeit der Hausaufgaben.',paid:'Kostenpflichtig',careExtra:'Zusätzliche Früh- und Spätbetreuung',early:'Frühbetreuung',beforeClass:'bis Unterrichtsbeginn',between:'Zwischenzeiten',betweenText:'zwischen Unterricht und Nachmittagsveranstaltungen',late:'Spätbetreuung',afterClass:'freitags nach Unterrichtsende zusätzlich',careQuestions:'Fragen zu Buchung und Kosten?',careQuestionsText:'Die Buchbarkeit und die Kosten der einzelnen Betreuungsbausteine erfahren Sie direkt bei der Schulkindbetreuung.',phoneHours:'Telefonische Erreichbarkeit',monThu:'Montag–Donnerstag',fri:'Freitag',holidayCare:'Ferienbetreuung',holidayText:'Ferienzeiten, Betreuungstage und Schließtage stehen im jährlichen Ferienplan.',holidayPlan:'Ferienplan 2026 ↗',careSource:'Angaben laut offizieller Schulhomepage.',moreDetails:'Alle Details ↗'},
 en:{more:'More',moreKicker:'MORE OPTIONS',moreTitle:'More',schoolWebsite:'School website',schoolWebsiteSub:'Visit the official primary school website',imprint:'Legal notice',imprintSub:'Publisher information and contact',settings:'Settings',appearance:'Colour scheme',appearanceSub:'Choose how the app looks',system:'System',normal:'Light',dark:'Dark',language:'Language',languageSub:'Choose the app language',translationNote:'Disclaimer: Translations are generated automatically by Google Translate and are not reviewed. Errors or differences in meaning may occur. In case of doubt, the German original version is authoritative.',careKicker:'CHILDCARE & CONTACT',careTitle:'After-school care',careLead:'Depending on the selected option, childcare is available from 7:00 am until 5:00 pm.',careReliable:'Regular primary school care',careReliableText:'Care before lessons and after school until 1:30 pm, Monday to Friday. Children can eat, play, draw or use the learning time for homework. Parents are responsible for checking homework.',paid:'Fee-based',careExtra:'Additional early and late care',early:'Early care',beforeClass:'until lessons begin',between:'Between lessons',betweenText:'between lessons and afternoon activities',late:'Late care',afterClass:'also after lessons on Fridays',careQuestions:'Questions about booking and fees?',careQuestionsText:'Please contact the childcare team directly for availability and fees.',phoneHours:'Telephone hours',monThu:'Monday–Thursday',fri:'Friday',holidayCare:'Holiday care',holidayText:'Holiday dates, care days and closure days are listed in the annual holiday plan.',holidayPlan:'Holiday plan 2026 ↗',careSource:'Information from the official school website.',moreDetails:'Full details ↗'},
 tr:{more:'Daha fazla',moreKicker:'DİĞER SEÇENEKLER',moreTitle:'Daha fazla',schoolWebsite:'Okulun internet sitesi',schoolWebsiteSub:'İlkokulun resmî internet sitesini ziyaret edin',imprint:'Yasal bilgiler',imprintSub:'Yayıncı bilgileri ve iletişim',settings:'Ayarlar',appearance:'Renk teması',appearanceSub:'Uygulamanın görünümünü seçin',system:'Sistem',normal:'Açık',dark:'Koyu',language:'Dil',languageSub:'Uygulama dilini seçin',translationNote:'Yasal uyarı: Çeviriler Google Çeviri tarafından otomatik olarak yapılır ve kontrol edilmez. Çeviri hataları veya anlam farklılıkları olabilir. Şüphe durumunda Almanca orijinal metin esas alınmalıdır.',careKicker:'ÇOCUK BAKIMI VE İLETİŞİM',careTitle:'Okul sonrası bakım',careLead:'Seçilen bakım seçeneğine bağlı olarak sabah 07.00’den akşam 17.00’ye kadar bakım mümkündür.',careReliable:'Düzenli okul bakımı',careReliableText:'Derslerden önce ve okuldan sonra 13.30’a kadar, pazartesiden cumaya bakım sunulur. Çocuklar yemek yiyebilir, oynayabilir, resim yapabilir veya ödevleri için öğrenme saatinden yararlanabilir. Ödevlerin kontrolü velilere aittir.',paid:'Ücretlidir',careExtra:'Ek erken ve geç bakım',early:'Sabah bakımı',beforeClass:'dersler başlayana kadar',between:'Ders araları',betweenText:'dersler ile öğleden sonraki etkinlikler arasında',late:'Akşam bakımı',afterClass:'cuma günleri ders bitiminden sonra da',careQuestions:'Kayıt ve ücretler hakkında sorularınız mı var?',careQuestionsText:'Uygunluk ve ücret bilgileri için lütfen doğrudan okul bakım ekibiyle iletişime geçin.',phoneHours:'Telefonla ulaşılabilirlik',monThu:'Pazartesi–Perşembe',fri:'Cuma',holidayCare:'Tatil bakımı',holidayText:'Tatil tarihleri, bakım günleri ve kapalı günler yıllık tatil planında yer alır.',holidayPlan:'2026 tatil planı ↗',careSource:'Bilgiler okulun resmî internet sitesinden alınmıştır.',moreDetails:'Tüm ayrıntılar ↗'}
};
function applyTranslations(){
 const lang=localStorage.getItem('gs-language')||'de';
 document.documentElement.lang='de';
 document.querySelectorAll('[data-i18n]').forEach(el=>{const key=el.dataset.i18n;if(translations.de[key])el.textContent=translations.de[key]});
 if(lang!=='de')translateWholePage(lang);
}
function translateWholePage(lang){
 const select=document.querySelector('.goog-te-combo');
 if(select){select.value=lang;select.dispatchEvent(new Event('change'));return}
 window.__pendingSchoolAppLanguage=lang;
}
window.googleTranslateElementInit=function(){
 new google.translate.TranslateElement({pageLanguage:'de',includedLanguages:'en,tr',autoDisplay:false},'google_translate_element');
 const pending=window.__pendingSchoolAppLanguage;
 if(pending)translateWholePage(pending);
};
const googleScript=document.createElement('script');
googleScript.src='https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
googleScript.async=true;
document.head.appendChild(googleScript);
function applyLogo(){
 const choice=localStorage.getItem('gs-logo')||'school';
 const logo=document.querySelector('.brand .school-logo');
 if(logo){logo.src=choice==='community'?'./logo-alternativ.webp':'https://grundschule-hoefingen.de/wp-content/uploads/2023/03/logo-gsh_web-300x281.png';}
 document.querySelectorAll('[data-logo-choice]').forEach(b=>b.classList.toggle('active',b.dataset.logoChoice===choice));
}
document.querySelectorAll('[data-logo-choice]').forEach(b=>b.addEventListener('click',()=>{localStorage.setItem('gs-logo',b.dataset.logoChoice);applyLogo()}));
function applyTheme(){
 const choice=localStorage.getItem('gs-theme')||'system';
 const dark=choice==='dark'||(choice==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
 document.documentElement.dataset.theme=dark?'dark':'light';
 document.querySelectorAll('[data-theme-choice]').forEach(b=>b.classList.toggle('active',b.dataset.themeChoice===choice));
}
document.querySelectorAll('[data-theme-choice]').forEach(b=>b.addEventListener('click',()=>{localStorage.setItem('gs-theme',b.dataset.themeChoice);applyTheme()}));
document.querySelectorAll('[data-language-choice]').forEach(b=>b.addEventListener('click',()=>{localStorage.setItem('gs-language',b.dataset.languageChoice);applyTranslations();document.querySelectorAll('[data-language-choice]').forEach(x=>x.classList.toggle('active',x.dataset.languageChoice===b.dataset.languageChoice))}));
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{if((localStorage.getItem('gs-theme')||'system')==='system')applyTheme()});
applyTheme();applyTranslations();applyLogo();
document.querySelectorAll('[data-language-choice]').forEach(b=>b.classList.toggle('active',b.dataset.languageChoice===(localStorage.getItem('gs-language')||'de')));

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
  'formulare-info':'forms'
 };
 document.querySelectorAll('.info-section-item').forEach(section=>{
  section.addEventListener('toggle',()=>{if(section.open&&eventBySection[section.id])countEvent(eventBySection[section.id]);});
 });
 document.querySelectorAll('nav a[href="#news"]').forEach(a=>a.addEventListener('click',()=>countEvent('news')));
 document.querySelectorAll('a[href="#calendar"]').forEach(a=>a.addEventListener('click',()=>countEvent('calendar')));
})();
