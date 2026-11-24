// Shared, read-only data projection for the Scripting Home Screen widget.
// The main sync engine remains the only writer of this App Group state.
const HOUR = 3600000;
const DAY = 24 * HOUR;
const BEIJING = 8 * HOUR;
const STATE_DIR = 'CourseSync/CourseSync-v2';
const LEGACY_STATE_DIR = 'NUFE-Local-Scripting/NUFE-Local-Scripting-v2';
const NAMES = ['一','二','三','四','五','六','日'];

// Read the shared snapshots exactly as the sync engine does without requiring
// statSync file metadata calls.
const MIRROR_KEY='CourseSync.Widget.Courses.v1';
const LEGACY_MIRROR_KEY='NUFE.Schedule.Widget.Courses.v1';
// Storage is private to the CourseSync project (no shared:true). The
// widget can use it even when the extension does not expose a FileManager
// App Group root. The legacy file reader is a fallback for existing installs.
export function readWidgetMirror(storage,now=Date.now()){
  if(!storage||typeof storage.get!=='function')return {kind:'empty',code:'STORAGE_UNAVAILABLE'};
  let obj;
  try{
    obj=storage.get(MIRROR_KEY);
    if(obj==null)obj=storage.get(LEGACY_MIRROR_KEY);
  }catch(_){return {kind:'invalid',code:'STORAGE_READ'};}
  if(obj==null)return {kind:'empty',code:'STORAGE_EMPTY'};
  if(!obj||obj.version!==1||!Array.isArray(obj.events)||
     obj.events.length>400||typeof obj.lastCheck!=='string')
    return {kind:'invalid',code:'STORAGE_SCHEMA'};
  if(obj.coverageEnd!==undefined){
    const end=typeof obj.coverageEnd==='string'?Date.parse(obj.coverageEnd):NaN;
    if(!Number.isFinite(end))return {kind:'invalid',code:'STORAGE_SCHEMA'};
    if(now>=end)return {kind:'empty',code:'CACHE_EXPIRED'};
  }
  for(const e of obj.events){
    if(!e||typeof e.title!=='string'||typeof e.start!=='string'||
       typeof e.end!=='string'||typeof e.location!=='string'||
       (e.teacher!==undefined&&typeof e.teacher!=='string'))
      return {kind:'invalid',code:'STORAGE_SCHEMA'};
  }
  return {kind:'ready',state:{lastCheck:obj.lastCheck,
    semesters:{widget:{events:obj.events}}}};
}

export function loadBestWidgetState(files,storage){
  const mirror=readWidgetMirror(storage);
  if(mirror.kind==='ready')return mirror;
  // Access App Group only as an optional fallback; never fabricate its path.
  const file=loadWidgetState(files);
  if(file.kind==='ready')return file;
  if(mirror.code==='CACHE_EXPIRED')return mirror;
  if(file.code==='GROUP_PATH'&&mirror.code==='STORAGE_EMPTY')
    return {kind:'empty',code:'OPEN_MAIN_ONCE'};
  if(file.code==='GROUP_PATH'&&mirror.code==='STORAGE_UNAVAILABLE')
    return {kind:'invalid',code:'STORAGE_UNAVAILABLE'};
  if(mirror.kind==='invalid')return mirror;
  return file;
}

export function loadWidgetState(files) {
  let root;
  try {
    root = files.appGroupDocumentsDirectory;
    if(typeof root!=='string'||!root) return {kind:'invalid',code:'GROUP_PATH'};
    root = root.replace(/\\/g,'/').replace(/\/$/,'');
  }catch(_){return {kind:'invalid',code:'GROUP_PATH'};}
  let dir = root + '/' + STATE_DIR;
  try{
    if(!files.existsSync(dir)){
      const legacy=root+'/'+LEGACY_STATE_DIR;
      if(!files.existsSync(legacy))return {kind:'empty',code:'NO_CACHE_DIR'};
      dir=legacy;
    }
  }catch(_){return {kind:'invalid',code:'CACHE_ACCESS'};}
  let names;
  try {
    names = files.readDirectorySync(dir,false)
      .map(x=>String(x).split('/').pop())
      .filter(x=>/^state-\d{10}\.json$/.test(x)).sort();
  }catch(_){return {kind:'invalid',code:'CACHE_LIST'};}
  if(!names.length)return {kind:'empty',code:'NO_STATE'};
  const filename = dir + '/' + names[names.length-1];
  let raw;
  try {raw=files.readAsStringSync(filename);}
  catch(_){return {kind:'invalid',code:'CACHE_READ'};}
  if(typeof raw!=='string'||!raw.length||raw.length>4*1024*1024)
    return {kind:'invalid',code:'CACHE_SIZE'};
  let state;
  try {state=JSON.parse(raw);}
  catch(_){return {kind:'invalid',code:'CACHE_JSON'};}
  if(!state||state.version!==1||!state.semesters||
     typeof state.semesters!=='object'||Array.isArray(state.semesters))
    return {kind:'invalid',code:'CACHE_SCHEMA'};
  if(!state.lastCheck&&!state.exams?.length&&!Object.values(state.semesters).some(term=>term?.events?.length))
    return {kind:'empty',code:'NO_SYNC_YET'};
  return {kind:'ready',state};
}

function plainText(value,limit){
  return String(value||'').trim().slice(0,limit);
}
function timeString(ms){
  return new Date(ms+BEIJING).toISOString().slice(11,16);
}
function safeCourse(event,weekStart,weekEnd){
  if(!event||typeof event!=='object'||typeof event.title!=='string')return null;
  if(typeof event.start!=='string'||typeof event.end!=='string')return null;
  const start=Date.parse(event.start),end=Date.parse(event.end);
  if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||
     start<weekStart||start>=weekEnd||end-start>DAY) return null;
  const day=Math.floor((start-weekStart)/DAY);
  if(day<0||day>6)return null;
  const teacher=typeof event.teacher==='string'?event.teacher:
    Array.isArray(event.teachers)?event.teachers.filter(x=>typeof x==='string').join('、'):'';
  return {id:plainText(event.id,100),title:plainText(event.title,90),
    location:plainText(event.location,65),teacher:plainText(teacher,75),start,end,day,
    startLabel:timeString(start),endLabel:timeString(end)};
}

// Use the school calendar week, including Saturday and Sunday.
export function buildWidgetModel(state,now=Date.now()){
  const at=now instanceof Date?now.getTime():Number(now);
  if(!Number.isFinite(at))throw Error('WIDGET_TIME');
  const local=new Date(at+BEIJING);
  const todayStart=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())-BEIJING;
  const today=(local.getUTCDay()+6)%7;
  const start=todayStart-today*DAY,end=start+7*DAY;
  const courses=[];
  const semesters=state&&state.semesters&&typeof state.semesters==='object'
    ?Object.values(state.semesters):[];
  const groups=[...semesters.map(semester=>semester?.events),state?.exams];
  for(const events of groups){
    if(!Array.isArray(events))continue;
    for(const ev of events){
      const course=safeCourse(ev,start,end);
      if(course)courses.push(course);
    }
  }
  courses.sort((a,b)=>a.start-b.start||a.title.localeCompare(b.title));
  const days=Array.from({length:7},(_,index)=>{
    const dayStart=start+index*DAY;
    const date=new Date(dayStart+BEIJING);
    return {
      index,label:'周'+NAMES[index],
      number:date.getUTCDate(),month:date.getUTCMonth()+1,
      dateLabel:(date.getUTCMonth()+1)+'/'+date.getUTCDate(),
      today:index===today,
      courses:courses.filter(c=>c.day===index).map(c=>({
        ...c,status:c.end<=at?'done':c.start<=at?'current':'upcoming'
      }))
    };
  });
  const boundaries=[todayStart+DAY];
  for(const c of courses){
    if(c.start>at)boundaries.push(c.start);
    if(c.end>at)boundaries.push(c.end);
  }
  const nextAt=Math.min(...boundaries.filter(t=>t>at));
  const updated=state&&typeof state.lastCheck==='string'?Date.parse(state.lastCheck):NaN;
  return {start,at,days,courses,today,nextAt,
    updated:Number.isFinite(updated)?updated:null,
    outdated:Number.isFinite(updated)&&at-updated>7*DAY,
    empty:courses.length===0};
}

// Keep entries in time order and make room for today's current or next item.
export function selectVisibleCourses(day,limit=1){
  const all=Array.isArray(day?.courses)?day.courses:[];
  const n=Math.max(0,Math.min(all.length,Math.trunc(limit)||0));
  const focus=day?.today?all.findIndex(course=>course.status!=='done'):-1;
  const offset=focus>=n?Math.min(focus,all.length-n):0;
  return {courses:all.slice(offset,offset+n),hidden:Math.max(0,all.length-n)};
}

// The small widget gives today's current or next appointment room for details.
export function selectTodayCourse(day){
  const courses=day.courses;
  const at=courses.findIndex(c=>c.status!=='done');
  const index=at<0?courses.length-1:at;
  return {course:courses[index],remaining:courses.length-index-1};
}

export function widgetReloadDate(model){
  // WidgetKit schedules are best effort. Do not continuously request minute
  // updates; only request an update at the next class boundary or day rollover.
  const at=model.at,delta=Math.max(60000,model.nextAt-at+1000);
  return new Date(at+Math.min(delta,DAY));
}
