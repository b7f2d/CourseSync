// Modified 2026-11-02: classroom, front-end entry, semester-selection and note-migration regression tests.
const {test}=require('node:test');const a=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const crypto=require('node:crypto');
const source=fs.readFileSync(__dirname+'/../index.tsx','utf8')
 .replace('import * as Scripting from "scripting";', 'const Scripting=globalThis.__sdk;')
 .replace("import { presentNativeCredentialForm, presentNativeTextForm, presentNativeRefreshForm } from './login-native';",
   'const presentNativeCredentialForm=(...args)=>globalThis.__nativeCredentialMock(...args);const presentNativeTextForm=(...args)=>globalThis.__nativeTextMock(...args);const presentNativeRefreshForm=(...args)=>globalThis.__nativeRefreshMock(...args);')
 .replace("import { presentNativeDashboard, presentNativeCalendarManager } from './login-native';",
   'const presentNativeDashboard=(...args)=>(globalThis.__nativeDashboardMock?globalThis.__nativeDashboardMock(...args):-1);const presentNativeCalendarManager=(...args)=>(globalThis.__calendarManagerMock?globalThis.__calendarManagerMock(...args):null);')
 .replace("import { createNativeProgressView } from './progress-native';",
   'const createNativeProgressView=(...args)=>globalThis.__progressUIFactory(...args);')
 .replace('export function launchCourseSync()', 'function launchCourseSync()');
async function env({mode="sync",hostEnv="intent"}={}){
 const files=new Map(),keys=new Map(),widgetRecords=new Map(),db=[],notices=[],requests=[];let serial=0,failSave=false,dropSave=false,failRemove=false,noRemove=false,seriesMode=false;
 const fm={joinPath:(x,y)=>x+'/'+y,libraryDirectory:()=>'/local',fileExists:p=>files.has(p)||p==='/local/CourseSync/CourseSync-v2',createDirectory:()=>{},writeString:(p,s)=>files.set(p,s),readString:p=>{if(!files.has(p))throw Error('missing');return files.get(p);},listContents:p=>[...files.keys()].filter(k=>k.startsWith(p+'/')).map(k=>k.slice(p.length+1)),remove:p=>files.delete(p),move:(from,to)=>{if(files.has(to))throw Error('exists');files.set(to,files.get(from));files.delete(from);}};
 const calendar={identifier:'calendar-dedicated',title:'课表',allowsContentModifications:true,isSubscribed:false},other={...calendar,identifier:'calendar-personal',title:'个人'};
 class Event{
  constructor(){this.identifier=null;this.attendees=[];this.isAllDay=false;this.notes='';this.location='';}
  async save(){requests.push(['save',this.identifier]);if(failSave)throw Error('save failed');if(dropSave)return;if(!this.identifier)this.identifier='event-'+(++serial);const row=copy(this),i=db.findIndex(e=>e.identifier===this.identifier&&+e.startDate===+this._originalStart);if(i>=0)db[i]=row;else{const j=db.findIndex(e=>e.identifier===this.identifier);if(j>=0)db[j]=row;else db.push(row);}}
  async remove(){requests.push(['remove',this.identifier,+this.startDate]);if(failRemove)throw Error('remove failed');if(noRemove)return;for(let i=db.length-1;i>=0;i--)if(db[i].identifier===this.identifier&&(seriesMode||+db[i].startDate===+this.startDate))db.splice(i,1);}
  async presentEdit(){requests.push(['edit',this.identifier]);return this;}
  static async between(lo,hi,cals){return db.filter(e=>+e.endDate>+lo&&+e.startDate<+hi&&cals.some(c=>c.identifier===e.calendar.identifier)).map(copy);}
 }
 function copy(x){const e=Object.assign(new Event(),x);e.startDate=new Date(x.startDate);e.endDate=new Date(x.endDate);e._originalStart=+e.startDate;return e;}
 class Notification{async schedule(){notices.push({title:this.title,body:this.body,identifier:this.identifier});}setTriggerDate(d){this.nextTriggerDate=d;}static async allPending(){return [];}static async removePending(){} }
 const sandbox={module:{exports:{}},process:{versions:{node:'24'}},console:{log(){},error(){}},FileManager:{local:()=>fm},UUID:{string:()=>crypto.randomUUID()},Timer:{schedule:(ms,repeat,cb)=>{const t=setTimeout(cb,ms);return {invalidate:()=>clearTimeout(t)}}},Keychain:{contains:k=>keys.has(k),get:k=>keys.get(k),set:(k,v)=>keys.set(k,v),remove:k=>keys.delete(k)},CalendarEvent:Event,Notification,Calendar:{forEvents:async()=>[calendar,other]},config:{runsInApp:false,runsWithSiri:true},args:{shortcutParameter:'sync'},Script:{name:()=> 'CourseSync',complete(){},setShortcutOutput(s){sandbox.output=s;}},Alert:class{constructor(){throw Error('UNEXPECTED FRONTEND PROMPT')}},Request:class{constructor(){throw Error('NETWORK NOT MOCKED')}}};
 Event.getAll=Event.between;
 const nativeScript={name:'CourseSync',env:hostEnv,queryParameters:mode==='menu'?{mode:'menu'}:{},exit:r=>{sandbox.output=r;},createRunURLScheme:(name,q)=>'scripting://run/'+encodeURIComponent(name)+'?mode='+q.mode};
 const sdk={Storage:{set:(key,value)=>{widgetRecords.set(key,JSON.parse(JSON.stringify(value)));return true;},get:key=>widgetRecords.get(key)||null},Script:nativeScript,Intent:{text:x=>x},FileManager:{appGroupDocumentsDirectory:'/local',existsSync:fm.fileExists,createDirectorySync:fm.createDirectory,readDirectorySync:fm.listContents,readAsStringSync:fm.readString,writeAsStringSync:fm.writeString,removeSync:fm.remove,renameSync:fm.move},Keychain:{contains:k=>keys.has(k),get:k=>keys.get(k)??null,set:(k,v)=>{keys.set(k,v);return true;},remove:k=>{keys.delete(k);return true;}},UUID:sandbox.UUID,CalendarEvent:Event,Calendar:{forEvents:async()=>[calendar,other],presentChooser:async()=>[calendar]},Notification:{schedule:async o=>{notices.push(o);return 'notice-'+notices.length;},getAllPendingsOfCurrentScript:async()=>[],removePendings:async()=>{}},Dialog:{actionSheet:async opts=>{const alert=new sandbox.Alert();alert.title=opts.title;alert.message=opts.message;for(const x of opts.actions)alert.addAction(x.label);if(opts.cancelButton)alert.addCancelAction('取消');return alert.presentSheet();},alert:async opts=>{const alert=new sandbox.Alert();alert.title=opts.title;alert.message=opts.message;alert.addAction('好');return alert.presentAlert();},confirm:async()=>{throw Error('UNEXPECTED CONFIRM');},prompt:async()=>{throw Error('UNEXPECTED PROMPT');}},fetch:async(...args)=>{if(sandbox.fetchImpl)return sandbox.fetchImpl(...args);throw Error('NETWORK NOT MOCKED');}};
 sandbox.__sdk=sdk;sandbox.__COURSESYNC_TEST__=true;sandbox.setTimeout=setTimeout;sandbox.clearTimeout=clearTimeout;sandbox.setInterval=setInterval;sandbox.clearInterval=clearInterval;sandbox.crypto=crypto.webcrypto;
 await vm.runInNewContext('(async()=>{'+source+'\nawait launchCourseSync(); globalThis.__testLaunch=launchCourseSync;})()',sandbox);
 sandbox.config=sandbox.module.exports.ScriptingAdapter.config;sandbox.args=sandbox.module.exports.ScriptingAdapter.args;
 const m=sandbox.module.exports,store=new m.Store();store.acquire();
 const state={version:1,owner:'installation-owner',calendarId:calendar.identifier,anchors:{'161':'2026-09-07'},semesters:{},minutes:0,failures:0};
 function add(rec,{owner=state.owner,cal=calendar,id,notes,offset=0,allDay=false}={}){const e=new Event();e.identifier=id||'event-'+(++serial);e.calendar=cal;e.title=rec.title;e.location=rec.location;e.notes=notes===undefined?m.notes(rec,owner,'2026-11-01T00:00:00Z'):notes;e.startDate=new Date(Date.parse(rec.start)+offset);e.endDate=new Date(Date.parse(rec.end)+offset);e.isAllDay=allDay;db.push(e);return e;}
 function baseline(events){state.semesters['161']={events,index:{},anchor:'2026-09-07',name:'2026-2027-1',lastSuccess:'2026-11-01T00:00:00Z'};return state;}
 return {m,sandbox,store,state,db,files,keys,widgetRecords,notices,requests,calendar,other,add,baseline,Event,setSaveFailure:v=>failSave=v,setDropSave:v=>dropSave=v,setRemoveFailure:v=>failRemove=v,setNoRemove:v=>noRemove=v,setSeries:v=>seriesMode=v};
}
const lesson=(extra={})=>({id:'lesson-1',sid:'161',title:'高等数学',week:1,su:1,eu:2,start:'2026-09-07T00:00:00.000Z',end:'2026-09-07T01:40:00.000Z',location:'仙林 教A101',teachers:['张老师'],...extra});
const raw=(activities)=>({studentTableVms:[{code:'sample-local',activities}]});
const activity=(x={})=>({courseName:'高等数学',weekday:1,startUnit:1,endUnit:2,weekIndexes:[1,2],startTime:'08:00',endTime:'09:40',campus:'仙林',room:'教A101',teachers:[{name:'张老师(001)'}],...x});
const tx=(before,target)=>({id:crypto.randomUUID(),sid:'161',anchor:'2026-09-07',name:'学期',before,target,stamp:new Date().toISOString(),changes:{added:0,removed:0,changed:0,examples:[]},skipped:[]});
const code=c=>e=>e&&e.code===c;

test('intent progress without an activity loader does not access background lifecycle APIs',async()=>{
 const calls=[];
 const e=await env();
 for(const name of ['LiveActivity','AppEvents','BackgroundKeeper']){
   Object.defineProperty(e.sandbox.__sdk,name,{get(){calls.push(name);throw Error('must not access '+name);}});
 }
 e.sandbox.__progressUIFactory=()=>{calls.push('progress');return {};};
 e.store.write(e.state);
 const progress=e.m.createProgress(e.state,e.store,false);
 await progress.start();
 progress('读取学期 161');
 await progress.finish(true);
 a.deepEqual(calls,[]);
 a.equal(e.state.lastStage,'读取学期 161');
 a.equal(e.store.read().lastStage,undefined);
 const sourceProgress=source.slice(source.indexOf('function createProgress('),source.indexOf('// Recognize a previously bound calendar'));
 a.doesNotMatch(sourceProgress,/LiveActivity|AppEvents|BackgroundKeeper|scenePhase|live_activity|COURSE_REFRESH_ACTIVITY/);
 a.equal(source.includes("import('./live_activity')"),false);
});

test('foreground progress stays native and does not touch background APIs',async()=>{
 const e=await env({hostEnv:'index'}),calls=[];
 for(const name of ['LiveActivity','AppEvents','BackgroundKeeper']){
   Object.defineProperty(e.sandbox.__sdk,name,{get(){calls.push(name);throw Error('unexpected '+name);}});
 }
 e.sandbox.__sdk.Navigation={present:()=>Promise.resolve()};
 e.sandbox.__progressUIFactory=()=>({show:()=>calls.push('sheet'),finish:()=>calls.push('close')});
 const progress=e.m.createProgress(e.state,e.store,true);
 await progress.start();
 progress('读取学期 161');
 await progress.finish(true);
 a.deepEqual(calls,[]);
 a.equal(e.state.lastStage,'读取学期 161');
});

test('shortcut entry starts sync without Live Activity, including old shortcut parameters',async()=>{
 const entry=fs.readFileSync(__dirname+'/../intent.tsx','utf8')
   .split('\n').filter(line=>!line.trimStart().startsWith('import ')).join('\n');
 for(const intent of [{},{shortcutParameter:{type:'text',value:'no-live-activity'}},
   {textsParameter:['live-activity'] }]){
   let calls=0,args;
   await vm.runInNewContext(entry,{Intent:intent,Script:{},launchCourseSync:(...values)=>{calls++;args=values;}});
   a.equal(calls,1);a.equal(args.length,0);
 }
 a.doesNotMatch(entry,/live_activity|LiveActivity|loadActivity/);
});

test('shortcut sync still returns Intent.text and writes calendar without background APIs',async()=>{
 const e=await env(),calls=[];
 for(const name of ['LiveActivity','AppEvents','BackgroundKeeper']){
   Object.defineProperty(e.sandbox.__sdk,name,{get(){calls.push(name);throw Error('unexpected '+name);}});
 }
 e.sandbox.__sdk.Intent.text=value=>({type:'text',value});
 loggedIn(e,raw([activity()]));
 await executeDaily(e);
 a.equal(e.sandbox.output.type,'text');
 a.match(e.sandbox.output.value,/刷新成功/);
 a.deepEqual(calls,[]);
 a.ok(e.db.length>0);
});

test('foreground sync tracks stages without presenting a transition and never delays verification',async()=>{
 const e=await env({hostEnv:'index'}),calls=[];
 e.sandbox.__sdk.Navigation={present:()=>{calls.push('present');}};
 const progress=e.m.createProgress(e.state,e.store,true);
 await progress.start();progress('等待二次认证');await progress.pause();progress.resume();
 progress('读取学期 161');await progress.finish('success');
 a.deepEqual(calls,[]);a.equal(e.state.lastStage,'读取学期 161');
});

test('background sync never opens any interactive progress UI',async()=>{
 const e=await env({hostEnv:'intent'}),calls=[];
 e.sandbox.__sdk.Navigation={present:()=>Promise.resolve()};
 e.sandbox.__progressUIFactory=()=>{calls.push('created');return {};};
 const progress=e.m.createProgress(e.state,e.store,false);
 progress('读取学期 161');await progress.start();progress.finish();
 a.deepEqual(calls,[]);
 a.equal(e.state.lastStage,'读取学期 161');
});

test('progress has no HTML and no artificial percentages',()=>{
 const start=source.indexOf('function createProgress(');
 const end=source.indexOf('// Recognize a previously bound calendar',start);
 a.ok(start>0&&end>start);
 const body=source.slice(start,end);
 a.doesNotMatch(body,/createNativeProgressView|Navigation\.present/);
 a.doesNotMatch(body,/WebView|loadHTML|evaluateJavaScript|window\.updateStage|percentage/);
});
test('widget mirror publishes only non-sensitive verified course fields',async()=>{
 const e=await env();
 const now=Date.parse('2026-11-03T06:10:00.000Z');
 e.baseline([lesson({start:'2026-11-03T05:30:00.000Z',end:'2026-11-03T06:55:00.000Z'})]);
 e.state.lastCheck='2026-11-03T06:00:00.000Z';
 e.state.personId='SENSITIVE_ID';e.state.password='SENSITIVE_PASSWORD';
 a.equal(e.m.publishWidgetCache(e.state,now),true);
 const saved=e.widgetRecords.get('CourseSync.Widget.Courses.v1');
 a.equal(saved.version,1);a.equal(saved.events.length,1);
 a.deepEqual(Object.keys(saved.events[0]).sort(),['end','id','location','start','teacher','title']);
 a.equal(saved.events[0].teacher,'张老师');
 a.doesNotMatch(JSON.stringify(saved),/SENSITIVE|password|owner|calendarId|Cookie/);
});
test('widget cache contains only current-window real lessons, never historical preview',async()=>{
  const e=await env();
  const now=Date.parse('2026-11-02T08:00:00Z');
  e.baseline([lesson({id:'real',start:'2026-11-03T02:00:00Z',end:'2026-11-03T03:30:00Z'})]);
  e.state.semesters.historical={
    name:'2024-2025-2',lastSuccess:'2025-06-15T08:00:00Z',
    events:[
      lesson({id:'old1',start:'2025-04-08T05:30:00Z',end:'2025-04-08T06:55:00Z'}),
      lesson({id:'old2',start:'2025-04-08T07:10:00Z',end:'2025-04-08T08:35:00Z'})
    ]
  };
  e.state.lastCheck='2026-11-02T07:00:00Z';
  const previous=JSON.stringify(e.state);
  a.equal(e.m.publishWidgetCache(e.state,now),true);
  const saved=e.widgetRecords.get('CourseSync.Widget.Courses.v1');
  a.equal(saved.events.length,1);
  a.equal(saved.events[0].id,'real');
  a.deepEqual(Object.keys(saved).sort(),['events','lastCheck','version']);
  a.equal(JSON.stringify(e.state),previous);
  a.doesNotMatch(JSON.stringify(saved),/old1|old2|password|cookie|calendarId/);
});
test('widget mirror blocks unverified transactions, filters old semesters, and keeps calendar sync independent',async()=>{
 const e=await env();
 const now=Date.parse('2026-11-03T06:10:00.000Z');
 e.baseline([lesson({start:'2026-11-03T05:30:00Z',end:'2026-11-03T06:55:00Z'}),
   lesson({id:'old',start:'2025-03-03T05:30:00Z',end:'2025-03-03T06:55:00Z'})]);
 e.state.lastCheck='2026-11-03T06:00:00.000Z';
 a.equal(e.m.publishWidgetCache(e.state,now),true);
 a.equal(e.widgetRecords.get('CourseSync.Widget.Courses.v1').events.length,1);
 e.state.tx=tx([],[]);
 a.equal(e.m.publishWidgetCache(e.state,now),false);
 a.equal(e.widgetRecords.get('CourseSync.Widget.Courses.v1').events.length,1);
});
test('widget mirroring fails safely if native Storage is absent or rejects writes',async()=>{
 const e=await env();
 e.baseline([lesson()]);e.state.lastCheck='2026-11-02T00:00:00Z';
 e.sandbox.__sdk.Storage.set=()=>{throw Error('private system detail');};
 a.equal(e.m.publishWidgetCache(e.state),false);
 a.equal(e.widgetRecords.size,0);
});
test('single file loads all APIs without Scriptable or network',async()=>{const e=await env();a.equal(typeof e.m.run,'function');});
test('school URL whitelist blocks credentials and other hosts',async()=>{const {m}=await env();for(const u of ['http://jwxt.nufe.edu.cn/','https://evil.test/','https://jwxt.nufe.edu.cn@evil.test/','https://jwxt.nufe.edu.cn:443/'])a.throws(()=>m.safeURL(u),code('DOMAIN_BLOCKED'));});
test('CourseSync imports verified legacy lesson state without modifying original files',async()=>{
  const e=await env();
  const oldDir='/local/NUFE-Local-Scripting/NUFE-Local-Scripting-v2';
  const newDir='/local/CourseSync/CourseSync-v2';
  e.store.release();
  e.files.set(oldDir,'directory');
  const original=JSON.stringify({...e.state,lastCheck:'2026-11-02T06:00:00Z'});
  const filename='state-0000000007.json';
  e.files.set(oldDir+'/'+filename,original);
  const migrated=new e.m.Store();
  a.equal(migrated.read().calendarId,e.calendar.identifier);
  a.equal(migrated.read().owner,e.state.owner);
  a.equal(migrated.read().lastCheck,'2026-11-02T06:00:00Z');
  a.equal(e.files.get(newDir+'/'+filename),original);
  a.equal(e.files.get(oldDir+'/'+filename),original);
});

test('CourseSync never imports legacy state while an earlier sync still holds its lock',async()=>{
  const e=await env();
  const oldDir='/local/NUFE-Local-Scripting/NUFE-Local-Scripting-v2';
  e.store.release();
  e.files.set(oldDir,'directory');
  e.files.set(oldDir+'/state-0000000007.json',JSON.stringify(e.state));
  e.files.set(oldDir+'/run-lock.json',JSON.stringify({token:'legacy',at:Date.now()}));
  a.throws(()=>new e.m.Store(),code('BUSY'));
  a.equal(e.files.has('/local/CourseSync/CourseSync-v2/state-0000000007.json'),false);
});

test('CourseSync migrates old device and iCloud Keychain aliases without deleting backups',async()=>{
  const e=await env();
  const legacyCloud=JSON.stringify({version:1,username:'legacy-test',password:'not-a-real-password'});
  e.keys.set('NUFE.Local.v1.cookies','[]');
  e.keys.set('NUFE.Local.v1.person','sample-person');
  e.keys.set('NUFE.Schedule.v1.icloud-credentials',legacyCloud);
  e.m.migrateLegacyKeychainData();
  a.equal(e.keys.get('CourseSync.Local.v1.cookies'),'[]');
  a.equal(e.keys.get('CourseSync.Local.v1.person'),'sample-person');
  a.equal(e.keys.get('CourseSync.v1.icloud-credentials'),legacyCloud);
  a.equal(e.keys.get('NUFE.Schedule.v1.icloud-credentials'),legacyCloud);
  a.equal(e.keys.get('CourseSync.Local.v1.migrated'),'1');
  // A post-migration change to the old namespace must never overwrite the new one.
  e.keys.set('NUFE.Local.v1.cookies','legacy-new');
  e.m.migrateLegacyKeychainData();
  a.equal(e.keys.get('CourseSync.Local.v1.cookies'),'[]');
});

test('NUFE endpoint settings keep default URLs and validate academic paths',async()=>{
  const e=await env(),m=e.m,d=m.ENDPOINT_DEFAULTS;
  a.equal(m.loadEndpointSettings().table,d.table);
  a.deepEqual(Object.keys(d),['auth','sso','table','semester','courses']);
  a.equal(m.termEndpoint(d.semester,161),'https://jwxt.nufe.edu.cn/student/ws/semester/get/161');
  a.equal(m.termEndpoint(d.courses,161),'https://jwxt.nufe.edu.cn/student/for-std/course-table/semester/161/print-data');
  a.throws(()=>m.termEndpoint(d.semester,'16/1'),code('ENDPOINT_CONFIG'));
  const adjusted={...d,table:'https://jwxt.nufe.edu.cn/student/for-std/course-table-v2'};
  a.equal(m.validateEndpointSettings(adjusted).table,adjusted.table);
  for(const table of ['http://jwxt.nufe.edu.cn/student/x','https://evil.test/student/x',
    'https://jwxt.nufe.edu.cn@evil.test/student/x','https://jwxt.nufe.edu.cn:443/student/x',
    'https://jwxt.nufe.edu.cn/student/../staff','https://jwxt.nufe.edu.cn/student/x?token=1',
    'https://jwxt.nufe.edu.cn/student/%2f','https://jwxt.nufe.edu.cn/student//double']){
    a.throws(()=>m.validateEndpointSettings({...d,table}),/ENDPOINT_CONFIG|DOMAIN_BLOCKED/);
  }
  a.throws(()=>m.validateEndpointSettings({...d,semester:d.semester.replace('{sid}','999')}),code('ENDPOINT_CONFIG'));
  a.throws(()=>m.validateEndpointSettings({...d,courses:d.courses+'/{sid}'}),code('ENDPOINT_CONFIG'));
  a.throws(()=>m.validateEndpointSettings({...d,auth:d.sso}),code('ENDPOINT_CONFIG'));
});

test('school selection restricts requests to the active school',async()=>{
  const {m}=await env();
  a.equal(m.NUFE_SCHOOL.name,'南京财经大学');
  a.equal(m.NUFE_SCHOOL.id,'nufe');
  a.equal(m.schoolById('nufe').endpoints.table,m.ENDPOINT_DEFAULTS.table);
  a.equal(m.schoolById('unverified-university'),null);
  a.throws(()=>m.safeURL('https://jwgl.usts.edu.cn/'),code('DOMAIN_BLOCKED'));
  m.activateSelectedSchool('usts');
  a.equal(m.safeURL('https://jwgl.usts.edu.cn/').host,'jwgl.usts.edu.cn');
  a.throws(()=>m.safeURL('https://jwxt.nufe.edu.cn/'),code('DOMAIN_BLOCKED'));
  a.throws(()=>m.safeURL('http://jwgl.usts.edu.cn/'),code('DOMAIN_BLOCKED'));
  a.equal(m.loadSelectedSchool(),'nufe');
});

test('manual setup uses fixed NUFE endpoints and retires old custom URLs',async()=>{
  const e=await env({hostEnv:'index'}),m=e.m,d=m.ENDPOINT_DEFAULTS;
  const oldKey='CourseSync.Local.v1.school-endpoints';
  const schoolKey='CourseSync.Local.v1.school-choice';
  e.keys.set(oldKey,JSON.stringify({version:1,values:{...d,
    table:'https://jwxt.nufe.edu.cn/student/for-std/course-table-v2'}}));
  const calls=[];
  e.sandbox.__nativeRefreshMock=async(schoolId,allowReuse)=>{
    calls.push({schoolId,allowReuse});
    return {kind:'credentials',schoolId:'nufe',
      username:'local-user',password:'not-a-real-password'};
  };
  const result=await m.prepareManualRefresh(e.state);
  a.equal(result.kind,'credentials');
  a.equal(result.username,'local-user');
  a.equal(result.password,'not-a-real-password');
  a.equal(m.loadEndpointSettings().table,d.table);
  a.equal(e.keys.has(oldKey),false);
  a.equal(e.keys.get(schoolKey),'nufe');
  a.equal(calls[0].schoolId,'nufe');
  a.equal(calls[0].allowReuse,false);
  a.equal(e.db.length,0);
  a.equal(e.keys.has('CourseSync.v1.icloud-credentials'),false);
});

test('NUFE setup with existing credentials can reuse them',async()=>{
  const e=await env({hostEnv:'index'}),m=e.m;
  e.keys.set('CourseSync.Local.v1.cookies','[]');
  e.sandbox.__nativeRefreshMock=async()=>({kind:'reuse',schoolId:'nufe'});
  a.equal((await m.prepareManualRefresh(e.state)).kind,'reuse');
  a.equal(e.keys.get('CourseSync.Local.v1.school-choice'),'nufe');
});

test('unexpected school ID is rejected without saving any configuration',async()=>{
  const e=await env({hostEnv:'index'});
  e.sandbox.__nativeRefreshMock=async()=>({kind:'credentials',
    schoolId:'unsupported',username:'student',password:'secret'});
  await a.rejects(()=>e.m.prepareManualRefresh(e.state),code('SCHOOL_UNSUPPORTED'));
  a.equal(e.keys.has('CourseSync.Local.v1.school-choice'),false);
  a.equal(e.requests.length,0);
});
test('USTS credentials, cookies and calendar state are scoped to the selected school',async()=>{
  const e=await env({hostEnv:'index'}),m=e.m;
  m.saveCredentials('nufe-sample','nufe-test-password');
  e.sandbox.__nativeRefreshMock=async()=>({kind:'reuse',schoolId:'usts'});
  await a.rejects(()=>m.prepareManualRefresh(e.state),code('SCHOOL_UNSUPPORTED'));
  e.sandbox.__nativeRefreshMock=async()=>({kind:'credentials',schoolId:'usts',username:'usts-sample',password:'usts-test-password'});
  await a.rejects(()=>m.prepareManualRefresh(e.state),code('SCHOOL_UNSUPPORTED'));
  e.keys.set('CourseSync.Local.v1.school-choice','usts');
  a.equal(m.loadSelectedSchool(),'usts');
  m.activateSelectedSchool(m.loadSelectedSchool());
  a.equal(m.readSavedCredentials(),null);
  a.notEqual(new m.Store().dir,e.store.dir);
  m.saveCredentials('usts-sample','usts-test-password');
  const jar=new m.CookieJar();
  jar.ingest('https://jwgl.usts.edu.cn/',{'set-cookie':'SESSION=school; Domain=usts.edu.cn; Path=/'});
  a.equal(jar.header('https://jwgl.usts.edu.cn/'),'SESSION=school');
  a.throws(()=>jar.header('https://jwxt.nufe.edu.cn/'),code('DOMAIN_BLOCKED'));
  m.activateSelectedSchool('nufe');
  a.equal(m.readSavedCredentials().username,'nufe-sample');
});
test('USTS sync resolves current and known historical dates automatically and skips unverified history',async()=>{
  const e=await env({hostEnv:'index'}),m=e.m;
  m.activateSelectedSchool('usts');
  const store=new m.Store();store.acquire();
  const state={...e.state,owner:'usts-test-installation',anchors:{},signedOut:true};
  store.write(state);
  const host='https://jwgl.usts.edu.cn/jwglxt';
  const login=host+'/xtgl/login_slogin.html';
  const home=host+'/xtgl/index_initMenu.html';
  const formHTML='<form action="/jwglxt/xtgl/login_slogin.html" method="post">'+
    '<input name="csrftoken" value="fixture"><input name="yhm"><input name="mm"><input name="mm"></form>';
  const cells=(values,tag)=>values.map(v=>`<${tag}>${v}</${tag}>`).join('');
  const weeks=[0,1,1,2,3,4,5,6,7,8];
  const titles='<tr><th>2026-2027学年1学期</th></tr><tr><th>月份</th></tr>';
  const teachingRows=Array.from({length:7},(_,day)=>{
    const days=weeks.map((week,col)=>{
      if(week===1&&((day===0)!==(col===1)))return '';
      const date=new Date(Date.UTC(2026,7,24)+(week*7+day)*86400000).toISOString().slice(0,10);
      return date;
    });
    return '<tr><td>'+day+'</td>'+days.map(date=>date?`<td id="${date}">日</td>`:'<td></td>').join('')+'</tr>';
  }).join('');
  const homeHTML='<div id="yhxxIndex"></div><div id="kbDiv"></div><table>'+titles+
    '<tr>'+cells(weeks.map(String),'th')+'</tr>'+teachingRows+'</table>';
  const timetable='<select id="xnm"><option value="2026" selected>2026-2027</option>'+
    '<option value="2023">2023-2024</option><option value="2022">2022-2023</option></select>'+
    '<select id="xqm"><option value="3" selected>1</option><option value="12">2</option></select>';
  const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:1024});
  const jwk=publicKey.export({format:'jwk'});
  const publicFields={modulus:Buffer.from(jwk.n,'base64url').toString('base64'),exponent:Buffer.from(jwk.e,'base64url').toString('base64')};
  let logins=0;
  const get=m.HTTP.prototype.get;
  m.HTTP.prototype.get=async function(url,opt={}){
    if(url.startsWith(home+'?'))return logins?{url:home,text:homeHTML}:{url:login,text:formHTML};
    if(url.includes('login_getPublicKey'))return {url,text:JSON.stringify(publicFields)};
    if(url.startsWith(login+'?')){
      const fields=new URLSearchParams(opt.body);
      a.equal(fields.get('yhm'),'sample-student');
      a.equal(fields.get('csrftoken'),'fixture');
      const encrypted=fields.getAll('mm');
      a.equal(encrypted.length,2);a.equal(encrypted[0],encrypted[1]);
      const padded=crypto.privateDecrypt({key:privateKey,padding:crypto.constants.RSA_NO_PADDING},Buffer.from(encrypted[0],'base64'));
      a.equal(padded[0],0);a.equal(padded[1],2);
      a.equal(padded.subarray(padded.indexOf(0,2)+1).toString(),'fixture-password');
      logins++;
      return {url:home,text:homeHTML};
    }
    if(url.includes('cxXskbcxIndex'))return {url,text:timetable};
    if(url.includes('cxXsgrkb')){
      const params=new URLSearchParams(opt.body),year=params.get('xnm'),term=params.get('xqm');
      return {url,text:JSON.stringify({xsxx:{XH_ID:'fixture-id',XNM:year,XQM:term,NJDM_ID:'2022'},kbList:term==='3'?[
        {kcmc:'示例课程',xqj:'2',jcs:'3-4',zcd:'1周,2周',xqh_id:'1',xqmc:'江枫',cdmc:'示例教室',xm:'示例教师'}
      ]:[]})};
    }
    if(url.includes('cxRjc'))return {url,text:JSON.stringify([
      {jcmc:'3',qssj:'09:55',jssj:'10:40'},{jcmc:'4',qssj:'10:50',jssj:'11:35'}
    ])};
    return get.call(this,url,opt);
  };
  await m.synchronize(state,store,e.calendar,true,null,{kind:'credentials',username:'sample-student',password:'fixture-password'});
  const starts=e.db.map(ev=>ev.startDate.toISOString()).sort();
  a.deepEqual(starts,['2023-08-29T01:55:00.000Z','2023-09-05T01:55:00.000Z','2026-09-01T01:55:00.000Z','2026-09-08T01:55:00.000Z']);
  a.equal(state.semesters['202303'].anchor,'2023-08-28');
  a.deepEqual(Array.from(state.termErrors,e=>[e.sid,e.code]),[['202203','ANCHOR']]);
  a.equal(m.readSavedCredentials().username,'sample-student');
  a.equal(state.signedOut,false);
  const ids=e.db.map(ev=>ev.identifier);
  await m.synchronize(state,store,e.calendar,false);
  a.deepEqual(e.db.map(ev=>ev.identifier),ids);
  a.equal(logins,1);
  store.release();
});
test('USTS successful exam query replaces unpublished future records',async()=>{
  const e=await env(),m=e.m;
  m.activateSelectedSchool('usts');
  const state={...e.state,availableSemesters:[{id:202603}]};
  const now=Date.parse('2026-11-16T00:00:00Z');
  const exam={kcmc:'示例考试',ksmc:'期末',kssj:'2026-12-18 (09:00-11:00)',cdmc:'示例考场'};
  let items=[exam];
  const http={json:async(url,{body})=>{
    a.match(url,/jwgl\.usts\.edu\.cn\/jwglxt\/kwgl\/kscx_cxXsksxxIndex\.html\?doType=query/);
    const p=new URLSearchParams(body);
    a.equal(p.get('xnm'),'2026');a.equal(p.get('xqm'),'3');
    a.equal(p.get('queryModel.currentPage'),'1');
    return {currentPage:1,totalPage:items.length?1:0,items};
  }};
  const sync=()=>m.syncExams(http,state,e.store,e.calendar,()=>{},now);
  await sync();
  a.equal(e.db.length,1);
  a.equal(e.db[0].startDate.toISOString(),'2026-12-18T01:00:00.000Z');
  const id=e.db[0].identifier;
  items=[{...exam,kssj:'未放开不可查'}];
  await sync();
  a.equal(e.db.length,0);
  items=[];await sync();
  a.equal(e.db.length,0);
});
test('exam refresh includes historical terms even without a course baseline',async()=>{
 const e=await env();
 e.m.activateSelectedSchool('usts');
 e.state.availableSemesters=[{id:202603},{id:202512}];
 const queried=[];
 const http={json:async(url,{body})=>{
  const params=new URLSearchParams(body);
  const sid=100*Number(params.get('xnm'))+Number(params.get('xqm'));
  queried.push(sid);
  if(sid===202603)return {currentPage:1,totalPage:0,items:[]};
  return {currentPage:1,totalPage:1,items:[
    {kcmc:'线性代数',ksmc:'期末',kssj:'2026-06-18 (09:00-11:00)',cdmc:'考场'}
  ]};
 }};
 await e.m.syncExams(http,e.state,e.store,e.calendar,()=>{},Date.parse('2026-11-16T00:00:00Z'));
 a.deepEqual(queried,[202603,202512]);
 a.deepEqual(e.db.map(ev=>ev.title),['（考试）线性代数']);
});
test('successful empty exam response clears all historical and future exams',async()=>{
 const e=await env();
 const now=Date.parse('2026-11-16T00:00:00Z');
 const previous={title:'（考试）历史考试',start:'2024-12-18T01:00:00.000Z',
   end:'2024-12-18T03:00:00.000Z',location:'旧考场'};
 const future={title:'（考试）未来考试',start:'2026-12-18T01:00:00.000Z',
   end:'2026-12-18T03:00:00.000Z',location:'新考场'};
 const older=e.add(previous,{notes:'同步：2024-12-01 09:00'});
 const next=e.add(future,{notes:'同步：2026-11-01 09:00'});
 const indexKey=ev=> '[COURSESYNC_EXAM '+e.state.owner+'] '+
   JSON.stringify([ev.title.slice(4),'期末',Date.parse(ev.start)]);
 e.state.examIndex={[older.identifier]:indexKey(previous),[next.identifier]:indexKey(future)};
 e.state.exams=[previous,future];
 const http={get:async()=>({url:'https://jwxt.nufe.edu.cn/student/for-std/exam-arrange',
   text:'<table id="exams"><tr class="tr-empty"><td>暂无</td></tr></table>'})};
 await e.m.syncExams(http,e.state,e.store,e.calendar,()=>{},now);
 a.equal(e.state.exams.length,0);
 a.deepEqual(e.db,[]);
 await e.m.syncExams(http,e.state,e.store,e.calendar,()=>{},now);
 a.equal(e.state.exams.length,0);
});
test('successful partial exam list replaces historical exam cache and calendar',async()=>{
 const e=await env();
 const now=Date.parse('2026-11-16T00:00:00Z');
 const old={title:'（考试）历史考试',start:'2024-12-18T01:00:00.000Z',
   end:'2024-12-18T03:00:00.000Z',location:'旧考场'};
 const owned=e.add(old,{notes:'同步：2024-12-01 09:00'});
 e.state.examIndex={[owned.identifier]:'[COURSESYNC_EXAM '+e.state.owner+'] '+
   JSON.stringify(['历史考试','期末',Date.parse(old.start)])};
 e.state.exams=[old];
 const row='<tr data-finished="true"><td><div class="time">2025-12-18 09:00~11:00</div></td>'+
   '<td><div>线性代数</div><div>期末</div></td><td>已结束</td></tr>';
 const http={get:async()=>({url:'https://jwxt.nufe.edu.cn/student/for-std/exam-arrange',
   text:'<table id="exams">'+row+'</table>'})};
 await e.m.syncExams(http,e.state,e.store,e.calendar,()=>{},now);
 a.equal(e.state.exams.length,1);
 a.equal(e.state.exams[0].title,'（考试）线性代数');
 a.deepEqual(e.db.map(x=>x.title),['（考试）线性代数']);
 await e.m.syncExams(http,e.state,e.store,e.calendar,()=>{},now);
 a.equal(e.state.exams.length,1);
 a.equal(e.db.length,1);
});
test('exam calendar migration verifies destination writes, retries without duplicates, and preserves unrelated events',async()=>{
 const e=await env();
 const {m,state,store,calendar,other}=e;
 state.examCalendarId=other.identifier;
 state.examCalendarTitle=other.title;
 const historic={title:'📝 历史考试',start:'2024-12-18T01:00:00.000Z',
   end:'2024-12-18T03:00:00.000Z',location:'旧考场'};
 const old=e.add(historic,{cal:other,notes:'同步：2024-12-01 09:00'});
 const key='[COURSESYNC_EXAM '+state.owner+'] '+JSON.stringify(['历史考试','期末',Date.parse(historic.start)]);
 state.examIndex={[old.identifier]:key};
 const personal=e.add({...historic,title:'个人日程'},{cal:other,notes:'个人'});
 const http={get:async()=>({url:'https://jwxt.nufe.edu.cn/student/for-std/exam-arrange',
   text:'<table id="exams"><tr class="tr-empty"><td>暂无</td></tr></table>'})};
 const sync=()=>m.syncExams(http,state,store,calendar,()=>{},Date.parse('2026-11-16T00:00:00Z'));
 e.setDropSave(true);
 await a.rejects(sync,code('CALENDAR_VERIFY'));
 a.deepEqual(e.db.map(ev=>ev.identifier),[old.identifier,personal.identifier]);
 e.setDropSave(false);
 e.setNoRemove(true);
 await a.rejects(sync,code('CALENDAR_VERIFY'));
 a.equal(e.db.filter(ev=>ev.calendar.identifier===calendar.identifier).length,1);
 a.equal(store.read().examCalendarId,other.identifier);
 e.setNoRemove(false);
 await sync();
 await sync();
 a.deepEqual(e.db.map(ev=>ev.identifier),[personal.identifier]);
 a.equal(Object.keys(store.read().examIndex||{}).length,0);
 a.equal(store.read().examCalendarId,undefined);
});

test('refresh moves the old suffix on an archived exam without touching other emoji titles',async()=>{
 const e=await env();
 const historic={title:'线性代数（考试）',start:'2024-12-18T01:00:00.000Z',
   end:'2024-12-18T03:00:00.000Z',location:'旧考场'};
 const owned=e.add(historic,{notes:'同步：2024-12-01 09:00'});
 const unrelated=e.add({...historic,title:'📝 随手记'},{notes:'个人'});
 const key='[COURSESYNC_EXAM '+e.state.owner+'] '+JSON.stringify(['线性代数','期末',Date.parse(historic.start)]);
 e.state.examIndex={[owned.identifier]:key};
 e.state.examTitleFormat='suffix';
 const http={get:async()=>({url:'https://jwxt.nufe.edu.cn/student/for-std/exam-arrange',
   text:'<table id="exams"><tr class="tr-empty"><td>暂无</td></tr></table>'})};
 const sync=()=>e.m.syncExams(http,e.state,e.store,e.calendar,()=>{},Date.parse('2026-11-16T00:00:00Z'));
 await sync();
 await sync();
 a.deepEqual(e.db.map(ev=>[ev.identifier,ev.title]),[
   [unrelated.identifier,'📝 随手记']
 ]);
 a.ok(e.requests.some(([kind,id])=>kind==='remove'&&id===owned.identifier));
});

test('cancel school selection leaves credentials and configuration unchanged',async()=>{
  const e=await env({hostEnv:'index'});
  e.sandbox.__nativeRefreshMock=async()=>null;
  const before=JSON.stringify([...e.keys]);
  a.equal(await e.m.prepareManualRefresh(e.state),null);
  a.equal(JSON.stringify([...e.keys]),before);
  a.equal(e.requests.length,0);
});

test('relative redirects resolve only inside trusted hosts',async()=>{const {m}=await env();a.equal(m.resolveURL('https://jwxt.nufe.edu.cn/student/login','../sso/login'),'https://jwxt.nufe.edu.cn/sso/login');a.throws(()=>m.resolveURL('https://jwxt.nufe.edu.cn/','//evil.test/'),code('DOMAIN_BLOCKED'));});
test('redacted request labels exclude all query credentials',async()=>{const {m}=await env();a.doesNotMatch(m.requestLabel('https://authserver.nufe.edu.cn/authserver/login?password=SECRET&username=STUDENT'),/SECRET|STUDENT|password|username/);});
test('nested semester id does not override top-level semester',async()=>{const {m}=await env();a.equal(m.topId('var currentSemester={calendarAssoc:{id:1},"id":161}','currentSemester'),161);});
test('week anchor requires real Monday',async()=>{const {m}=await env();a.equal(m.monday('2026-09-07'),'2026-09-07');for(const s of ['2026-09-08','2026-02-30','2026-9-7'])a.throws(()=>m.monday(s),code('ANCHOR'));});
test('generic semester start is not silently accepted as teaching anchor',async()=>{const {m}=await env();a.equal(m.explicitTeachingMonday({startDate:'2026-09-01'}),null);});
test('explicit first teaching week recognized',async()=>{const {m}=await env();a.equal(m.explicitTeachingMonday({firstTeachingWeekMonday:'2026-09-07'}),'2026-09-07');});
test('expand school activities uses UTC+8 and week indexes',async()=>{const {m}=await env();const r=m.expand(raw([activity()]),161,'2026-09-07');a.equal(r.events.length,2);a.equal(r.events[0].start,'2026-09-07T00:00:00.000Z');a.equal(r.events[1].start,'2026-09-14T00:00:00.000Z');a.equal(r.events[0].teachers[0],'张老师');});
test('duplicate source fails before writing',async()=>{const {m}=await env();a.throws(()=>m.expand(raw([activity(),activity()]),161,'2026-09-07'),code('DUPLICATE_SOURCE'));});
test('missing source table fails instead of becoming cancellation',async()=>{const {m}=await env();a.throws(()=>m.expand({},161,'2026-09-07'),code('SCHEMA'));});
test('missing lesson time fails closed',async()=>{const {m}=await env();a.throws(()=>m.expand(raw([activity({startTime:'',endTime:''})]),161,'2026-09-07'),code('TIME_MISSING'));});
test('week ranges outside 1..60 fail closed',async()=>{const {m}=await env();a.throws(()=>m.expand(raw([activity({weekIndexes:[0,61]})]),161,'2026-09-07'),code('SCHEMA'));});
test('identical schedules preserve logical IDs',async()=>{const {m}=await env();const p=m.plan([lesson()],[lesson({id:undefined})],()=> 'new');a.equal(p.events[0].id,'lesson-1');a.equal(p.added.length,0);a.equal(p.removed.length,0);a.equal(p.changed.length,0);});
test('classroom adjustment updates existing ID',async()=>{const {m}=await env();const p=m.plan([lesson()],[lesson({id:undefined,location:'教B202'})],()=> 'new');a.equal(p.events[0].id,'lesson-1');a.equal(p.changed.length,1);});
test('unique same-week move preserves ID and reports inference',async()=>{const {m}=await env();const p=m.plan([lesson()],[lesson({id:undefined,start:'2026-09-08T00:00:00.000Z',end:'2026-09-08T01:40:00.000Z'})],()=> 'new');a.equal(p.inferred.length,1);a.equal(p.events[0].id,'lesson-1');});
test('cancelled class leaves explicit deletion plan',async()=>{const {m}=await env();const p=m.plan([lesson()],[],()=> 'new');a.equal(p.removed.length,1);});
test('same includes teaching week metadata',async()=>{const {m}=await env();a.equal(m.same(lesson(),lesson({week:2})),false);});
test('AES CBC matches Node crypto for all supported key sizes',async()=>{const {m}=await env();for(const n of [16,24,32]){const key='K'.repeat(n),iv='I'.repeat(16),plain='学校密码\nlocal only';const cipher=crypto.createCipheriv('aes-'+n*8+'-cbc',Buffer.from(key),Buffer.from(iv));a.equal(m.aesCBC(plain,key,iv),Buffer.concat([cipher.update(plain,'utf8'),cipher.final()]).toString('base64'));}});
test('CAS fields never fall back to unrelated forms',async()=>{const {m}=await env();a.equal(await m.fieldsFrom('<form id="other"><input name="execution" value="secret"></form>','pwdFromId'),null);});
test('CAS form entities are decoded inertly',async()=>{const {m}=await env();const f=await m.fieldsFrom('<form id="pwdFromId"><input name="execution" value="e1&amp;s1"><input id="pwdEncryptSalt" value="1234567890123456"></form>','pwdFromId');a.equal(f.execution,'e1&s1');});
test('credentials save in Keychain only',async()=>{const e=await env();e.m.saveCredentials('  sample-student  ','not-a-real-password');a.equal(e.m.readSavedCredentials().username,'sample-student');a.ok(e.keys.has('CourseSync.v1.icloud-credentials'));a.ok(![...e.files.values()].some(s=>s.includes('not-a-real-password')));});
test('legacy credential removal alone does not revoke an existing school session',async()=>{
 const e=await env();e.keys.set('CourseSync.Local.v1.cookies','[]');
 e.m.saveCredentials('sample','local');e.m.removeSavedCredentials();
 a.equal(e.m.hasSavedCredentials(),false);
 a.ok(e.keys.has('CourseSync.Local.v1.cookies'));
});
test('real sign-out removes both device cookies and synced/legacy credentials but preserves calendar',async()=>{
 const e=await env();e.baseline([lesson()]);e.add(lesson());
 const before=JSON.stringify(e.db.map(ev=>({id:ev.identifier,title:ev.title,notes:ev.notes})));
 e.keys.set('CourseSync.Local.v1.cookies',JSON.stringify([{name:'SESSION',value:'local-session',domain:'jwxt.nufe.edu.cn',path:'/',expires:0}]));
 e.m.saveCredentials('sample','local-secret');
 e.keys.set('CourseSync.Local.v1.saved-login',JSON.stringify({version:1,username:'stale',password:'old-secret'}));
 e.sandbox.__sdk.Dialog.confirm=async()=>true;e.sandbox.__sdk.Dialog.alert=async()=>{};
 a.equal(await e.m.signOut(e.state,e.store),true);
 a.equal(e.keys.has('CourseSync.Local.v1.cookies'),false);
 a.equal(e.keys.has('CourseSync.Local.v1.saved-login'),false);
 a.equal(e.keys.has('CourseSync.v1.icloud-credentials'),false);
 a.equal(e.m.hasSavedCredentials(),false);
 a.equal(e.state.signedOut,true);
 a.equal(e.state.authPaused,true);
 a.equal(e.state.runStatus,'signed_out');
 a.equal(e.state.calendarId,e.calendar.identifier);
 a.equal(JSON.stringify(e.db.map(ev=>({id:ev.identifier,title:ev.title,notes:ev.notes}))),before);
 a.equal(e.requests.length,0);
 a.match(e.m.statusText(e.state),/已退出登录/);
 a.match(e.m.statusText(e.state),/立即刷新/);
 a.doesNotMatch(JSON.stringify(e.state),/local-secret|old-secret|local-session/);
});
test('cancelling sign-out retains the existing session and credentials',async()=>{
 const e=await env();
 e.keys.set('CourseSync.Local.v1.cookies','[]');
 e.m.saveCredentials('sample','not-real');
 e.sandbox.__sdk.Dialog.confirm=async()=>false;
 a.equal(await e.m.signOut(e.state,e.store),false);
 a.equal(e.keys.has('CourseSync.Local.v1.cookies'),true);
 a.equal(e.m.hasSavedCredentials(),true);
 a.equal(e.state.signedOut,undefined);
});
test('incomplete Keychain removal stays safely signed out and supports retry',async()=>{
 const e=await env();e.keys.set('CourseSync.Local.v1.cookies','[]');
 e.m.saveCredentials('sample','not-real');
 e.sandbox.__sdk.Dialog.confirm=async()=>true;
 e.sandbox.__sdk.Keychain.remove=()=>false;
 await a.rejects(()=>e.m.signOut(e.state,e.store),code('LOGOUT_INCOMPLETE'));
 a.equal(e.state.signedOut,true);
 a.equal(e.state.authPaused,true);
 a.equal(e.store.read().signedOut,true);
 a.equal(e.keys.has('CourseSync.Local.v1.cookies'),true);
 a.match(e.m.statusText(e.state),/已退出登录/);
});
test('invalid saved credentials do not leak raw errors',async()=>{const e=await env();e.keys.set('CourseSync.Local.v1.saved-login','{"password":"SENSITIVE"}');a.throws(()=>e.m.readSavedCredentials(),code('CREDENTIALS_INVALID'));});
test('Cookie storage rejects header injection',async()=>{const e=await env();e.keys.set('CourseSync.Local.v1.cookies',JSON.stringify([{name:'x',value:'bad\r\nInjected',domain:'jwxt.nufe.edu.cn',path:'/',expires:0}]));a.throws(()=>e.m.readCookieJar(),code('COOKIE_STORAGE'));});
test('Cookie storage rejects foreign domain',async()=>{const e=await env();e.keys.set('CourseSync.Local.v1.cookies',JSON.stringify([{name:'x',value:'token',domain:'evil.test',path:'/',expires:0}]));a.throws(()=>e.m.readCookieJar(),code('COOKIE_STORAGE'));});
test('school cookie uses allowed parent domain only',async()=>{const {m}=await env();const jar=new m.CookieJar();jar.ingest('https://authserver.nufe.edu.cn/authserver/login',{'Set-Cookie':'good=v; Domain=.nufe.edu.cn; Path=/, bad=x; Domain=.evil.test; Path=/'});a.equal(jar.header('https://jwxt.nufe.edu.cn/'),'good=v');a.equal(jar.rejected,1);});
test('expired cookie is removed instead of sent',async()=>{const {m}=await env();const jar=new m.CookieJar();jar.ingest('https://jwxt.nufe.edu.cn/student/login',{'set-cookie':'x=v; Path=/; Max-Age=0'});a.equal(jar.header('https://jwxt.nufe.edu.cn/'),'');});
test('empty store creates initial state',async()=>{const e=await env();a.equal(e.store.read().version,1);});
test('latest corrupt state never falls back to empty',async()=>{const e=await env();e.store.write(e.state);e.files.set('/local/CourseSync/CourseSync-v2/state-9999999999.json','{bad');a.throws(()=>e.store.read(),code('STATE_CORRUPT'));});
test('state duplicate IDs rejected before calendar access',async()=>{const e=await env();e.baseline([lesson(),lesson()]);a.throws(()=>e.m.validateState(e.state),code('STATE_CORRUPT'));});
test('state with lost owner never causes a fresh parallel import',async()=>{const e=await env();e.baseline([lesson()]);e.state.owner=null;a.throws(()=>e.m.validateState(e.state),code('STATE_CORRUPT'));});
test('lock rejects simultaneous writer',async()=>{const e=await env();const other=new e.m.Store();a.throws(()=>other.acquire(),code('BUSY'));});
test('lock loss blocks mutation',async()=>{const e=await env();e.files.delete('/local/CourseSync/CourseSync-v2/run-lock.json');a.throws(()=>e.store.write(e.state),code('LOCK_LOST'));});
test('owned markers parse exactly; foreign markers ignored',async()=>{const e=await env();const ev=e.add(lesson());a.equal(e.m.eventRecord(ev,e.state.owner).id,'lesson-1');a.equal(e.m.eventRecord(ev,'other-owner'),null);});
test('corrupt owned marker fails closed',async()=>{const e=await env();const ev=e.add(lesson(),{notes:'[NUFE_LOCAL_V1 installation-owner lesson-1]\n{"id":"wrong"}'});a.throws(()=>e.m.eventRecord(ev,e.state.owner),code('MARKER_CORRUPT'));});
test('adapter never scans personal calendar',async()=>{const e=await env();e.add(lesson());e.add(lesson({id:'foreign'}),{cal:e.other});const rows=await new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store).scan('2026-09-07',[lesson()]);a.equal(rows.length,1);});
test('series same native ID at different weeks is not collapsed',async()=>{const e=await env();e.add(lesson(),{id:'series'});e.add(lesson(),{id:'series',offset:7*86400000});const rows=await new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store).scan('2026-09-07',[lesson()]);a.equal(rows.length,2);});
test('different native IDs sharing logical marker retain both dates for replacement',async()=>{const e=await env();e.add(lesson());e.add(lesson(),{offset:7*86400000});const rows=await new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store).scan('2026-09-07',[lesson()]);a.equal(rows.length,2);});
test('unattended identical sync is idempotent',async()=>{const e=await env();e.add(lesson());const adapter=new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store);await e.m.applyTransaction(tx([lesson()],[lesson()]),adapter);await e.m.applyTransaction(tx([lesson()],[lesson()]),adapter);a.equal(e.db.length,1);a.equal(e.requests.length,0);});
test('write interruption after save resumes without duplicate',async()=>{const e=await env();const adapter=new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store),t=tx([],[lesson()]);let calls=0;await a.rejects(()=>e.m.applyTransaction(t,adapter,()=>{if(++calls===2)throw Error('interrupted')}));a.equal(e.db.length,1);await e.m.applyTransaction(t,adapter);a.equal(e.db.length,1);});
test('exact managed duplicates are automatically reduced to one',async()=>{const e=await env();e.add(lesson());e.add(lesson());await e.m.applyTransaction(tx([lesson()],[lesson()]),new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store));a.equal(e.db.length,1);});
test('cancellation deletes only authorized logical ID',async()=>{const e=await env();e.add(lesson());e.add(lesson(),{cal:e.other});await e.m.applyTransaction(tx([lesson()],[]),new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store));a.equal(e.db.length,1);a.equal(e.db[0].calendar.identifier,e.other.identifier);});
test('room change updates one event rather than appending',async()=>{const e=await env();e.add(lesson());await e.m.applyTransaction(tx([lesson()],[lesson({location:'教B'})]),new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store));a.equal(e.db.length,1);a.equal(e.db[0].location,'教B');});
test('silent save no-op fails post-write verification',async()=>{const e=await env();e.setDropSave(true);await a.rejects(()=>e.m.applyTransaction(tx([],[lesson()]),new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store)),code('CALENDAR_VERIFY'));});
test('silent deletion no-op fails post-write verification',async()=>{const e=await env();e.add(lesson());e.setNoRemove(true);await a.rejects(()=>e.m.applyTransaction(tx([lesson()],[]),new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store)),code('CALENDAR_VERIFY'));});
test('calendar write error retains transaction for recovery',async()=>{const e=await env();e.state.tx=tx([],[lesson()]);e.setSaveFailure(true);await a.rejects(()=>e.m.finishTx(e.state,e.store,new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store),()=>{}));a.ok(e.state.tx);a.ok(e.files.has(e.store.path(e.state.tx.backupName)));});
test('transaction snapshot exists before first mutation',async()=>{const e=await env();e.state.tx=tx([],[lesson()]);const adapter=new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store);const save=adapter.save.bind(adapter);adapter.save=async(...args)=>{a.ok(e.state.tx.backupName);a.ok(e.files.has(e.store.path(e.state.tx.backupName)));return save(...args)};await e.m.finishTx(e.state,e.store,adapter,()=>{});a.equal(e.state.tx,null);});
test('backup failure prevents every calendar write',async()=>{const e=await env();e.state.tx=tx([],[lesson()]);const old=e.store.fm.writeString;e.store.fm.writeString=(p,t)=>{if(p.includes('同步前'))return;old(p,t)};await a.rejects(()=>e.m.finishTx(e.state,e.store,new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store),()=>{}),code('BACKUP_FAILED'));a.equal(e.requests.length,0);});
test('dedicated cleanup requires an existing verified baseline',async()=>{const e=await env();e.add(lesson(),{notes:'old'});await a.rejects(()=>e.m.replaceDedicatedLegacy(e.calendar,e.state,e.store),code('EMPTY_SOURCE'));a.equal(e.requests.length,0);});
test('dedicated cleanup refuses to delete old entries when new lesson missing',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson(),{notes:'old'});await a.rejects(()=>e.m.replaceDedicatedLegacy(e.calendar,e.state,e.store),code('CALENDAR_VERIFY'));a.equal(e.requests.length,0);});
test('dedicated cleanup automatically removes unmarked old content and preserves new lesson',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());e.add(lesson(),{notes:'old ICS'});await e.m.replaceDedicatedLegacy(e.calendar,e.state,e.store);a.equal(e.db.length,1);a.equal(e.m.eventRecord(e.db[0],e.state.owner).id,'lesson-1');a.equal(e.state.lastLegacyCleanupRemaining,0);});
test('dedicated cleanup never deletes any other calendar content',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());e.add(lesson(),{notes:'old'});const foreign=e.add(lesson(),{cal:e.other,notes:'personal'});await e.m.replaceDedicatedLegacy(e.calendar,e.state,e.store);a.ok(e.db.some(x=>x.identifier===foreign.identifier));});
test('series removal of individual occurrences covers every visible date',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());for(let i=0;i<4;i++)e.add(lesson(),{id:'old-series',notes:'old recurring',offset:i*7*86400000});await e.m.replaceDedicatedLegacy(e.calendar,e.state,e.store);a.equal(e.db.length,1);a.equal(e.state.lastLegacyCleanupCount,4);});
test('whole-series native removal does not retry stale occurrence objects',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());e.setSeries(true);for(let i=0;i<4;i++)e.add(lesson(),{id:'old-series',notes:'old recurring',offset:i*7*86400000});await e.m.replaceDedicatedLegacy(e.calendar,e.state,e.store);a.equal(e.db.length,1);a.equal(e.state.lastLegacyCleanupCount,1);});
test('unverified legacy deletion reports failure, never success',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());e.add(lesson(),{notes:'old'});e.setNoRemove(true);await a.rejects(()=>e.m.replaceDedicatedLegacy(e.calendar,e.state,e.store),code('LEGACY_VERIFY'));a.equal(e.state.lastLegacyCleanupRemaining,1);});
test('legacy snapshot includes all observed occurrences before removal',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());for(let i=0;i<2;i++)e.add(lesson(),{id:'old-series',notes:'old recurring',offset:i*7*86400000});await e.m.replaceDedicatedLegacy(e.calendar,e.state,e.store);const backup=e.files.get(e.store.path(e.state.lastLegacyReportName));a.equal(JSON.parse(backup).events.length,3);a.match(JSON.parse(backup).limitation,/series deletion/);});
test('legacy invitation is preserved, preventing outbound cancellation',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());const ev=e.add(lesson(),{notes:'meeting invitation'});ev.attendees=[{name:'someone'}];await a.rejects(()=>e.m.replaceDedicatedLegacy(e.calendar,e.state,e.store),code('LEGACY_INVITATION'));a.ok(e.db.some(x=>x.identifier===ev.identifier));});
test('unbound calendar cannot be purged',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());await a.rejects(()=>e.m.replaceDedicatedLegacy(e.other,e.state,e.store),code('CALENDAR_READONLY'));a.equal(e.requests.length,0);});
test('ICS output escapes text and folds at 75 UTF8 bytes',async()=>{const {m}=await env();const text=m.ics([lesson({title:'中文'.repeat(80)+'\nX;,'})]);a.match(text,/\\nX\\;\\,/);for(const line of text.split('\r\n'))a.ok(Buffer.byteLength(line)<=75);a.match(text,/DTSTART:20260907T000000Z/);a.doesNotMatch(text,/教师|张老师/);});
test('diagnostics never expose native raw error contents',async()=>{const {m}=await env();a.doesNotMatch(m.errorMessage(Error('password=VERY_SECRET'),{lastStage:'测试阶段'}),/VERY_SECRET/);});
test('bounded work rejects hung WebView and clears timer',async()=>{const {m}=await env();await a.rejects(()=>m.bounded(new Promise(()=>{}),10,'WEBVIEW_TIMEOUT'),code('WEBVIEW_TIMEOUT'));});
test('paused background authentication sends one actionable notification, never daily repeats',async()=>{
 const e=await env();e.state.authPaused=true;e.state.lastError='AUTH_INTERACTIVE_REQUIRED';e.store.write(e.state);e.store.release();
 try { await e.m.run(); } catch(err) { console.error('RUN_ERROR:', err); }
 a.equal(e.notices.length,1);a.match(e.notices[0].title,/登录已失效/);
 a.match(e.notices[0].body,/验证码|二次认证/);a.match(e.sandbox.output,/刷新失败/);
 a.ok(e.store.read().authExpiryNotifiedAt);
 await e.m.run();a.equal(e.notices.length,1);
});
function loggedIn(e,sourceRaw){
 e.m.HTTP.prototype.get=async function(url){
  if(url.endsWith('/exam-arrange'))return {url,text:'<table id="exams"><tr class="tr-empty"><td>暂无“未结束”的考试安排</td></tr></table>'};
  return {url:'https://jwxt.nufe.edu.cn/student/for-std/course-table',text:'var personId=100;var currentSemester={"id":161};<select id="allSemesters"><option value="161">2026-2027-1</option></select>'};
 };
 e.m.HTTP.prototype.json=async function(url){return typeof sourceRaw==='function'?sourceRaw(url):sourceRaw;};
}
async function executeDaily(e){e.store.write(e.state);e.store.release();await e.m.run();}
test('background term rotation includes future terms and resumes from the previous cursor',async()=>{
 const {m}=await env();
 const info={current:3,semesters:[{id:1},{id:2},{id:3},{id:4},{id:5}]};
 const choose=cursor=>Array.from(m.selectTermIds(info,{lastBackgroundHistoryTerm:cursor},false));
 a.deepEqual(choose(undefined),[3,5,4]);
 a.deepEqual(choose(4),[3,2,1]);
 a.deepEqual(choose(1),[3,5,4]);
 a.deepEqual(choose(99),[3,5,4]);
 a.deepEqual(Array.from(m.selectTermIds(info,{lastBackgroundHistoryTerm:4,retryTermIds:[5,2]},false)),[3,5,2]);
 a.deepEqual(Array.from(m.selectTermIds({current:3,semesters:[{id:3}]},{},false)),[3]);
 a.deepEqual(Array.from(m.selectTermIds(info,{},true)),[3,1,2,4,5]);
});

test('automatic refresh checks every term and exams without rewriting unchanged events',async()=>{
 const e=await env(),queried=[];
 let readingExams=false;
 const table='https://jwxt.nufe.edu.cn/student/for-std/course-table';
 const exam='https://jwxt.nufe.edu.cn/student/for-std/exam-arrange';
 const oldNote='同步：2025-01-01 08:00';
 e.state.anchors['159']='2026-03-02';
 e.state.anchors['160']='2025-09-01';
 e.m.HTTP.prototype.get=async url=>{
   if(url===exam){
     readingExams=true;
     queried.push('exams');
     return {url,text:'<table id="exams"><tr data-finished="true"><td><div class="time">2026-07-02 08:00~10:00</div></td><td><div>统计学</div><div>期末</div></td><td>已结束</td></tr></table>'};
   }
   a.equal(url,table);
   return {url,text:'var personId=100;var currentSemester={"id":161};<select id="allSemesters"><option value="161">2026-2027-1</option><option value="159">2025-2026-2</option><option value="160">2025-2026-1</option></select>'};
 };
 e.m.HTTP.prototype.json=async url=>{
   readingExams=false;
   const sid=new URL(url).searchParams.get('semesterId');
   queried.push(sid);
   return raw([activity({weekIndexes:[1]})]);
 };
 await executeDaily(e);
 a.equal(e.store.read().runStatus,'success');
 a.equal(e.db.length,4);
 for(const event of e.db)event.notes=oldNote;
 const courseReads=[];
 const getEvents=e.Event.getAll;
 e.Event.getAll=(start,end,calendars)=>{
   if(!readingExams&&+end-+start===90*86400000)courseReads.push(+start);
   return getEvents(start,end,calendars);
 };
 let stateWrites=0;
 const writeFile=e.sandbox.__sdk.FileManager.writeAsStringSync;
 e.sandbox.__sdk.FileManager.writeAsStringSync=(file,contents)=>{
   if(/state-\d+\.json$/.test(file))stateWrites++;
   return writeFile(file,contents);
 };
 queried.length=0;e.requests.length=0;
 await e.m.run();
 a.deepEqual(queried,['161','160','159','exams']);
 a.deepEqual(e.requests,[]);
 a.equal(courseReads.length,new Set(courseReads).size,'overlapping course windows are read once');
 a.ok(courseReads.length<15,'the three course terms use fewer native reads than separate scans');
 a.ok(stateWrites<=8,'progress updates do not rewrite the state file');
 a.ok(e.db.every(event=>event.notes===oldNote));
 a.match(e.sandbox.output,/刷新成功/);

 const missing=e.db.findIndex(event=>event.title.includes('高等数学')&&event.startDate.getUTCMonth()===2);
 a.ok(missing>=0);
 e.db.splice(missing,1);
 await e.m.run();
 a.equal(e.store.read().runStatus,'success');
 a.equal(e.db.length,4);
 a.equal(e.db.filter(event=>event.notes===oldNote).length,3);

 const readTerm=e.m.HTTP.prototype.json;
 e.m.HTTP.prototype.json=async url=>{
   if(new URL(url).searchParams.get('semesterId')==='159')throw Object.assign(new Error('budget'),{code:'BUDGET'});
   return readTerm(url);
 };
 await e.m.run();
 const partial=e.store.read();
 a.equal(partial.runStatus,'partial');
 a.equal(partial.lastExamError,null);
 a.deepEqual(Array.from(partial.termErrors,error=>[error.sid,error.code]),[['159','BUDGET']]);
 a.equal(partial.exams.length,1);
 a.match(e.notices.at(-1).body,/2025-2026-2（BUDGET）.*预留时间/);

 e.m.HTTP.prototype.json=readTerm;
 queried.length=0;
 await e.m.run();
 a.deepEqual(queried,['161','159','160','exams']);
 a.equal(e.store.read().runStatus,'success');
});
test('an unreadable exam response reports the reason and stops after one exam request',async()=>{
 const e=await env();
 loggedIn(e,raw([activity({weekIndexes:[1]})]));
 const readPage=e.m.HTTP.prototype.get;
 let examRequests=0;
 e.m.HTTP.prototype.get=async url=>{
   if(!url.endsWith('/exam-arrange'))return readPage(url);
   examRequests++;
   return {url,text:'<html>unexpected response</html>'};
 };
 await executeDaily(e);
 a.equal(examRequests,1);
 a.equal(e.store.read().lastExamError,'EXAM_SCHEMA');
 a.match(e.sandbox.output,/部分完成.*EXAM_SCHEMA/);
 a.equal(e.notices.length,1);
 a.match(e.notices[0].body,/EXAM_SCHEMA/);
 a.equal(e.db.length,1);
});
test('successful background refresh skips notifications even when delivery is unavailable',async()=>{
 const e=await env();loggedIn(e,raw([activity({weekIndexes:[1]})]));
 let deliveryAttempts=0;
 e.sandbox.__sdk.Notification.schedule=async()=>{deliveryAttempts++;throw Error('notification denied');};
 await executeDaily(e);
 const s=e.store.read();a.equal(s.runStatus,'success');a.equal(s.lastError,null);
 a.equal(s.failures,0);a.equal(s.nextAttempt,undefined);a.equal(deliveryAttempts,0);
 a.match(e.sandbox.output,/刷新成功/);a.equal(e.db.length,1);
});
test('a held lock returns a Shortcut result before starting any wait or network work',async()=>{
 const e=await env();
 e.store.write(e.state);
 e.sandbox.__sdk.Intent.text=value=>({type:'text',value});
 e.sandbox.setTimeout=()=>{a.fail('a busy background run must not wait');};
 e.sandbox.fetchImpl=()=>{a.fail('a busy background run must not fetch');};
 await e.m.run();
 a.equal(e.sandbox.output.type,'text');
 a.match(e.sandbox.output.value,/前一任务仍在同步/);
 a.equal(e.notices.length,0);
 a.doesNotThrow(()=>e.store.check());
 e.store.release();
});

test('an unresponsive school request and notification still release the lock and exit the Intent',async()=>{
 const e=await env();
 const timers=[];
 let elapsed=0;
 e.sandbox.Date=class extends Date{static now(){return Date.now()+elapsed;}};
 const readCalendars=e.sandbox.__sdk.Calendar.forEvents;
 e.sandbox.__sdk.Calendar.forEvents=()=>{
   elapsed=4000;
   return readCalendars();
 };
 e.sandbox.setTimeout=(callback,ms)=>{
   timers.push(ms);
   return setTimeout(callback,1);
 };
 e.sandbox.fetchImpl=()=>new Promise(()=>{});
 e.sandbox.__sdk.Notification.schedule=()=>new Promise(()=>{});
 e.sandbox.__sdk.Intent.text=value=>({type:'text',value});
 await executeDaily(e);
 const [calendarTimeout,requestTimeout]=timers.filter(ms=>ms>1000);
 a.ok(calendarTimeout>24000&&calendarTimeout<=26000,'calendar setup shares the new 26-second budget');
 a.ok(requestTimeout>20000&&requestTimeout<=22000,'network uses the remainder after calendar setup');
 a.equal(timers.at(-1),1000,'notification delivery has a separate short timeout');
 a.equal(e.store.read().lastError,'BUDGET');
 a.equal(e.store.read().resultNoticeError,'NOTIFICATION_FAILED');
 a.equal(e.sandbox.output.type,'text');
 a.match(e.sandbox.output.value,/刷新失败/);
 a.doesNotThrow(()=>e.store.acquire());
 e.store.release();
});

test('a rejected widget reload does not interrupt a successful background sync',async()=>{
 const e=await env();
 let receiver;
 const widget={async reloadUserWidgets(){
   receiver=this;
   throw Error('WidgetKit unavailable');
 }};
 e.sandbox.__sdk.Widget=widget;
 loggedIn(e,raw([activity({weekIndexes:[1]})]));
 await executeDaily(e);
 a.equal(receiver,widget);
 a.equal(e.store.read().runStatus,'success');
 a.match(e.sandbox.output,/刷新成功/);
 a.equal(e.notices.length,0);
});

test('failure notification errors preserve the original network failure',async()=>{
 const e=await env();e.m.HTTP.prototype.get=async()=>{const error=Error('offline');error.code='NETWORK';throw error;};
 e.sandbox.__sdk.Notification.schedule=async()=>{throw Error('notification denied');};
 await executeDaily(e);const s=e.store.read();
 a.equal(s.lastError,'NETWORK');a.equal(s.failures,1);a.equal(s.resultNoticeError,'NOTIFICATION_FAILED');
 a.equal(s.lastFailure.stage,'尝试读取教务课表入口');
 a.notEqual(s.authNoticeError,'NOTIFICATION_FAILED');a.equal(e.db.length,0);
});
test('partial refresh notification failure keeps partial status and semester errors',async()=>{
 const e=await env();e.state.runStatus='partial';e.state.termErrors=[{sid:'160',code:'ANCHOR'}];
 e.sandbox.__sdk.Notification.schedule=async()=>{throw Error('notification denied');};
 await e.m.reportRefreshFailure('PARTIAL_SYNC',e.state,e.store);
 a.equal(e.store.read().runStatus,'partial');a.equal(e.state.termErrors[0].code,'ANCHOR');a.equal(e.state.failures,0);
});
test('compact status shows outcome and hides technical diagnostics',async()=>{
 const e=await env();
 for(const [status,label] of Object.entries({success:'上次刷新成功',partial:'部分学期未完成',failed:'上次刷新失败',cancelled:'上次操作已取消'})){
  e.state.runStatus=status;a.ok(e.m.statusText(e.state).includes('结果：'+label));
 }
 e.state.runStatus='success';e.state.lastCheck='2026-11-02T06:30:00.000Z';
 const concise=e.m.statusText(e.state);
 a.match(concise,/上次完成检查：2026-11-02 14:30/);
 a.doesNotMatch(concise,/未实时核验|非实时状态|最近步骤（北京时间）|自动登录凭据：|连续失败：|已导入学期：/);
 a.match(concise,/课表日历：/);
 e.state.resultNoticeError='NOTIFICATION_FAILED';
 a.match(e.m.statusText(e.state),/不影响已完成的课表同步/);
});

test('a saved cooldown and consecutive network failures never delay the next Shortcut run',async()=>{
 const e=await env();
 e.state.nextAttempt=Date.now()+60*60000;
 let attempts=0;
 e.m.HTTP.prototype.get=async()=>{
   attempts++;
   throw Object.assign(new Error('offline'),{code:'NETWORK'});
 };
 await executeDaily(e);
 a.equal(attempts,1);
 a.match(e.sandbox.output,/刷新失败/);
 a.equal(e.notices.length,1);
 await e.m.run();
 a.equal(attempts,2);
 a.equal(e.notices.length,2);
 a.equal(e.store.read().failures,2);
 a.equal(e.store.read().nextAttempt,e.state.nextAttempt);
 a.doesNotMatch(e.m.statusText(e.store.read()),/下次自动尝试/);
 loggedIn(e,raw([activity({weekIndexes:[1]})]));
 await e.m.run();
 a.equal(e.store.read().runStatus,'success');
 a.equal(e.store.read().lastError,null);
});
test('first unattended authentication failure delivers one specific alert and records it',async()=>{
 const e=await env();
 e.m.HTTP.prototype.get=async function(url){if(url.includes('/student/sso/login'))return {url:'https://authserver.nufe.edu.cn/authserver/login',text:'<form id="pwdFromId"></form>'};const er=new Error('AUTH_REQUIRED');er.code='AUTH_REQUIRED';throw er;};
 await executeDaily(e);
 const state=e.store.read();
 a.equal(state.lastError,'AUTH_REQUIRED');a.equal(state.authPaused,true);
 a.equal(e.notices.length,1);a.match(e.notices[0].title,/登录已失效/);
 a.match(e.notices[0].body,/手动登录/);a.ok(state.authExpiryNotifiedAt);
 await e.m.run();a.equal(e.notices.length,1);
});
test('auth notification may be sent again after a successful-login reset',async()=>{
 const e=await env();
 e.state.lastError='AUTH_INTERACTIVE_REQUIRED';
 a.equal(await e.m.notifyAuthExpiredOnce(e.state,e.store),true);
 a.equal(await e.m.notifyAuthExpiredOnce(e.state,e.store),false);
 a.equal(e.notices.length,1);
 e.state.authExpiryNotifiedAt=null;
 a.equal(await e.m.notifyAuthExpiredOnce(e.state,e.store),true);
 a.equal(e.notices.length,2);
});
test('notification denial records a safe status without throwing or deleting calendar data',async()=>{
 const e=await env();
 e.sandbox.__sdk.Notification.schedule=async()=>{throw Error('permission denied');};
 e.state.authPaused=true;e.state.lastError='AUTH_INTERACTIVE_REQUIRED';
 await e.m.reportBackgroundFailure('AUTH_INTERACTIVE_REQUIRED',e.state,e.store);
 a.equal(e.state.authNoticeError,'NOTIFICATION_FAILED');
 a.equal(e.state.authExpiryNotifiedAt,undefined);
 a.equal(e.db.length,0);
});
test('unclassified HTTP throttling and oversized replies have actionable explanations',async()=>{
 const e=await env();
 a.match(e.m.reasonFor('HTTP_429'),/429/);
 a.match(e.m.actionFor('HTTP_429'),/限流/);
 a.match(e.m.reasonFor('TOO_LARGE'),/上限/);
 a.match(e.m.actionFor('CALENDAR_READONLY'),/原日历/);
});
test('end-to-end daily refresh adds, adjusts, cancels and purges old series with one result',async()=>{
 const e=await env(),old=lesson(),cancelled=lesson({id:'cancelled',week:2,start:'2026-09-14T00:00:00.000Z',end:'2026-09-14T01:40:00.000Z'});
 e.baseline([old,cancelled]);e.add(old);e.add(cancelled);for(let i=0;i<3;i++)e.add(old,{id:'old-ics',notes:'legacy recurring course',offset:i*7*86400000});const personal=e.add(old,{cal:e.other,notes:'personal'});
 loggedIn(e,raw([activity({weekIndexes:[1,3],room:'教B202'})]));await executeDaily(e);
 const own=e.db.filter(x=>x.calendar.identifier===e.calendar.identifier);a.equal(own.length,2);a.ok(own.every(x=>x.location==='教B202'));a.ok(e.db.some(x=>x.identifier===personal.identifier));a.equal(e.notices.length,0);a.equal(e.store.read().runStatus,'success');a.equal(e.store.read().tx,null);a.ok(e.keys.has('CourseSync.Local.v1.person'));a.ok(e.keys.has('CourseSync.Local.v1.student'));
 // A second entire run must change neither logical nor native event IDs.
 const ids=own.map(x=>x.identifier).sort().join(',');e.notices.length=0;await e.m.run();a.equal(e.db.filter(x=>x.calendar.identifier===e.calendar.identifier).map(x=>x.identifier).sort().join(','),ids);a.equal(e.notices.length,0);
});
test('end-to-end malformed source preserves every old event and reports one failure',async()=>{const e=await env();e.baseline([lesson()]);const own=e.add(lesson()),legacy=e.add(lesson(),{notes:'old'});loggedIn(e,{});await executeDaily(e);a.ok(e.db.some(x=>x.identifier===own.identifier));a.ok(e.db.some(x=>x.identifier===legacy.identifier));a.equal(e.requests.length,0);a.equal(e.notices.length,1);a.match(e.notices[0].title,/失败/);a.equal(e.store.read().lastError,'SCHEMA');});
test('end-to-end unexpected empty source preserves old course and import',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());e.add(lesson(),{notes:'old'});loggedIn(e,raw([]));await executeDaily(e);a.equal(e.db.length,2);a.equal(e.requests.length,0);a.equal(e.store.read().lastError,'EMPTY_SOURCE');a.match(e.notices[0].title,/失败/);});
test('end-to-end failed calendar save never purges legacy data',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());e.add(lesson(),{notes:'old'});e.setSaveFailure(true);loggedIn(e,raw([activity({weekIndexes:[1],room:'changed'})]));await executeDaily(e);a.equal(e.db.length,2);a.ok(e.store.read().tx);a.equal(e.requests.filter(x=>x[0]==='remove').length,0);a.match(e.notices[0].title,/失败/);});
test('end-to-end school person change blocks all calendar writes',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());e.keys.set('CourseSync.Local.v1.person','another-person');loggedIn(e,raw([activity()]));await executeDaily(e);a.equal(e.requests.length,0);a.equal(e.store.read().lastError,'ACCOUNT_CHANGED');a.equal(e.store.read().authPaused,true);a.match(e.notices[0].title,/登录需要处理/);});
test('end-to-end changed student identity in data blocks replacement',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());e.keys.set('CourseSync.Local.v1.student','another-student');loggedIn(e,raw([activity()]));await executeDaily(e);a.equal(e.requests.length,0);a.equal(e.store.read().lastError,'ACCOUNT_CHANGED');});
test('end-to-end missing bound calendar never falls back to personal calendar',async()=>{const e=await env();e.state.calendarId='missing-calendar';e.add(lesson(),{cal:e.other,notes:'personal'});loggedIn(e,raw([activity()]));await executeDaily(e);a.equal(e.requests.length,0);a.equal(e.store.read().lastError,'CALENDAR_MISSING');a.equal(e.notices.length,1);});
test('second background invocation does not start while a previous lock is held',async()=>{
 const e=await env();e.store.write(e.state);
 const prev=e.m.acquireSyncSlot;
 // The OS budget is bounded; simulate a single wait tick with a short timeout.
 const result=await prev(new e.m.Store(),false,{backgroundWait:1,poll:2});
 a.equal(result,'still-running');
 a.equal(e.requests.length,0);
 a.equal(e.db.length,0);
 a.equal(e.store.read().failures,0);
});
test('manual school login saves to Keychain only after verified success',async()=>{
  const e=await env({hostEnv:'index'});let tableVisits=0;
  e.sandbox.__sdk.Navigation={present:()=>true};
  e.sandbox.__nativeCredentialMock=async()=>({
    username:'verified-student',password:'verified-password'
  });
  const html='var personId=100;var currentSemester={"id":161};';
  const http={jar:new e.m.CookieJar(),get:async(url,opt={})=>{
    if(url==='https://jwxt.nufe.edu.cn/student/for-std/course-table'){
      return {url,text:++tableVisits===1?'<html>login required</html>':html};
    }
    if(url==='https://jwxt.nufe.edu.cn/student/sso/login')return {
      url:'https://authserver.nufe.edu.cn/authserver/login',text:'<form id="pwdFromId"><input name="execution" value="e123"><input id="pwdEncryptSalt" value="1234567890123456"></form>'
    };
    if(opt.body)return {url:'https://jwxt.nufe.edu.cn/student/for-std/course-table',text:html};
    return {url,text:''};
  },authJSON:async()=>({isNeed:false})};
  const page=await e.m.coursePage(http,true);
  a.match(page,/personId=100/);
  const saved=e.m.readSavedCredentials();
  a.equal(saved.username,'verified-student');a.equal(saved.password,'verified-password');
  a.ok(e.keys.has('CourseSync.v1.icloud-credentials'));
  a.ok(![...e.files.values()].some(v=>String(v).includes('verified-password')));
});

test('failed school authentication never saves a password',async()=>{
  const e=await env({hostEnv:'index'});let visits=0;
  e.sandbox.__sdk.Navigation={present:()=>true};
  e.sandbox.__nativeCredentialMock=async()=>({
    username:'student',password:'invalid-password'
  });
  const http={jar:new e.m.CookieJar(),get:async(url,opt={})=>{
    if(url==='https://jwxt.nufe.edu.cn/student/for-std/course-table')return {url,text:'not authenticated'};
    if(url==='https://jwxt.nufe.edu.cn/student/sso/login')return {url:'https://authserver.nufe.edu.cn/authserver/login',text:'<form id="pwdFromId"><input name="execution" value="abc"><input id="pwdEncryptSalt" value="1234567890123456"></form>'};
    if(opt.body){visits++;return {url:'https://authserver.nufe.edu.cn/authserver/login',text:'invalid'};}
    return {url,text:''};
  },authJSON:async()=>({isNeed:false})};
  await a.rejects(()=>e.m.coursePage(http,true),code('LOGIN_FAILED'));
  a.equal(visits,1);
  a.equal(e.keys.has('CourseSync.v1.icloud-credentials'),false);
});
test('one SMS challenge requires only its code and selects the schools trusted-device option',async()=>{
 const e=await env();let prompts=0,codePosts=0,submitBodies=[];
 e.sandbox.__sdk.Dialog.prompt=async()=>{prompts++;return '654321';};
 const http={authJSON:async(url,opt)=>{
   if(url.includes('getDynamicCodeByReauth.do')){codePosts++;return {res:'success'};}
   submitBodies.push(opt.body);return {code:'success'};
 },get:async()=>({})};
 const page={url:'https://authserver.nufe.edu.cn/authserver/login',text:JSON.stringify({
   reAuthType:'3',service:'https://jwxt.nufe.edu.cn/student/sso/login',
   isSleepAccount:'0',isMultifactor:'true',reAuthUserId:'student'
 })};
 await e.m.mfa(http,page);
 a.equal(prompts,1);a.equal(codePosts,1);a.equal(submitBodies.length,1);
 a.match(submitBodies[0],/skipTmpReAuth=true/);
 a.match(submitBodies[0],/dynamicCode=654321/);
});
test('automatic login without credentials stops before submitting password',async()=>{const e=await env();let count=0;const http={get:async()=>{count++;return {url:'https://authserver.nufe.edu.cn/authserver/login',text:'<form id="pwdFromId"><input name="execution" value="e1"></form>'}}};await a.rejects(()=>e.m.coursePage(http,false),code('AUTH_REQUIRED'));a.equal(count,2);});
test('automatic login encountering MFA never opens UI or attempts codes',async()=>{const e=await env();const http={get:async()=>({url:'https://authserver.nufe.edu.cn/authserver/login',text:'isMultifactor=true'})};await a.rejects(()=>e.m.coursePage(http,false),code('AUTH_INTERACTIVE_REQUIRED'));});
test('automatic captcha requirement never encrypts or submits password',async()=>{const e=await env();let posts=0;const http={jar:new e.m.CookieJar(),get:async(url,opt)=>{if(opt&&opt.body)posts++;return {text:''}},authJSON:async()=>({isNeed:true})};const page={url:'https://authserver.nufe.edu.cn/authserver/login',text:'<form id="pwdFromId"><input name="execution" value="e1s1"><input id="pwdEncryptSalt" value="1234567890123456"></form>'};await a.rejects(()=>e.m.passwordLogin(http,page,'sample','local-password',false),code('AUTH_INTERACTIVE_REQUIRED'));a.equal(posts,0);});
test('cookie RFC default path also applies to directory endpoint itself',async()=>{const {m}=await env();const jar=new m.CookieJar();jar.ingest('https://jwxt.nufe.edu.cn/student/login',{'set-cookie':'x=v'});a.equal(jar.header('https://jwxt.nufe.edu.cn/student'),'x=v');a.equal(jar.header('https://jwxt.nufe.edu.cn/student/course'),'x=v');a.equal(jar.header('https://jwxt.nufe.edu.cn/students'),'');});
test('an invitation anywhere stops dedicated deletion before first remove',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());e.add(lesson(),{notes:'old'});const invitation=e.add(lesson(),{notes:'invitation'});invitation.attendees=[{name:'guest'}];await a.rejects(()=>e.m.replaceDedicatedLegacy(e.calendar,e.state,e.store),code('LEGACY_INVITATION'));a.equal(e.requests.filter(x=>x[0]==='remove').length,0);});

test('owned series is replaced with a standalone new target after backup',async()=>{const e=await env();e.add(lesson(),{id:'owned-series'});e.add(lesson(),{id:'owned-series',offset:7*86400000});e.setSeries(true);e.state.tx=tx([lesson()],[lesson()]);await e.m.finishTx(e.state,e.store,new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store),()=>{});a.equal(e.db.length,1);a.notEqual(e.db[0].identifier,'owned-series');a.equal(e.m.eventRecord(e.db[0],e.state.owner,e.m.storedEventIndex(e.state)).id,'lesson-1');});
test('orphan owned marker is removed only in successfully fetched term',async()=>{const e=await env();e.add(lesson());e.add(lesson({id:'orphan'}));e.add(lesson({id:'other-term',sid:'999'}));await e.m.applyTransaction(tx([lesson()],[lesson()]),new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store));a.equal(e.db.length,2);a.ok(e.db.some(x=>e.m.eventRecord(x,e.state.owner).sid==='999'));});
test('pending transaction does not resume before a fresh complete school fetch',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());e.state.tx=tx([lesson()],[]);loggedIn(e,{});await executeDaily(e);a.equal(e.db.length,1);a.equal(e.requests.length,0);a.ok(e.store.read().tx);a.equal(e.store.read().lastError,'SCHEMA');});
test('pending stale cancellation is rebased when fresh school data still includes class',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());e.state.tx=tx([lesson()],[]);loggedIn(e,raw([activity({weekIndexes:[1]})]));await executeDaily(e);a.equal(e.db.length,1);a.equal(e.requests.filter(x=>x[0]==='remove').length,0);a.equal(e.store.read().tx,null);a.equal(e.notices.length,0);});
test('main menu keeps refresh and available sign-out without removed status entry',async()=>{
 const e=await env({mode:'menu',hostEnv:'index'}),menus=[];
 e.sandbox.config.runsInApp=true;e.sandbox.args.shortcutParameter=null;
 e.keys.set('CourseSync.Local.v1.cookies','[]');
 e.sandbox.__sdk.Dialog.actionSheet=async opts=>{menus.push(opts.actions);return null;};
 e.store.write(e.state);e.store.release();await e.m.run();
 a.deepEqual(Array.from(menus[0],x=>x.label),['立即刷新','退出登录']);
 a.deepEqual(Array.from(menus[0],x=>!!x.destructive),[false,true]);
 a.equal(e.requests.length,0);
});
test('an upgraded NUFE installation replaces exams on successful empty response',async()=>{
 const e=await env({hostEnv:'index'}),alerts=[];
 const day=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
 let body='<tr data-finished="false"><td><div class="time">'+day+' 08:00~10:00</div><div><span>教学楼</span><span>101</span></div></td><td><div>测试 &amp; 统计</div><div>期末</div></td><td>未结束</td></tr>'+
   '<tr data-finished="true"><td><div class="time">2020-01-01 08:00~10:00</div></td><td><div>旧考试</div></td><td>已结束</td></tr>';
 e.m.saveCredentials('sample','test-only');
 e.keys.set('CourseSync.Local.v1.school','nufe');
 let schoolPrompts=0;
 e.sandbox.__nativeRefreshMock=async(schoolId,canReuse)=>{
   schoolPrompts++;
   a.equal(schoolId,'nufe');
   a.equal(canReuse,true);
   return {kind:'reuse',schoolId:'nufe'};
 };
 e.store.write(e.state);e.store.release();
 e.sandbox.__sdk.Dialog.actionSheet=async o=>o.actions.findIndex(x=>x.label==='立即刷新');
 e.sandbox.__sdk.Dialog.alert=async o=>alerts.push(o);
 e.sandbox.__sdk.Calendar.create=async()=>{throw Error('Unexpected separate calendar');};
 loggedIn(e,raw([activity({weekIndexes:[1]})]));
 const get=e.m.HTTP.prototype.get;
 e.m.HTTP.prototype.get=async url=>{
   if(url.endsWith('/course-table'))return get(url);
   a.equal(url,'https://jwxt.nufe.edu.cn/student/for-std/exam-arrange');
   return {url:url+'/info/123',text:'<table id="exams"><tbody>'+body+'</tbody></table>'};
 };
 await e.m.run();
 a.equal(schoolPrompts,1);
 a.equal(e.keys.get('CourseSync.Local.v1.school-choice'),'nufe');
 const exams=()=>e.db.filter(x=>x.title.startsWith('（考试）')||x.title.startsWith('🌟 '));
 a.equal(alerts.length,0,JSON.stringify(alerts));
 a.equal(exams().length,2);
 const upcoming=exams().find(x=>x.title==='（考试）测试 & 统计');
 const finished=exams().find(x=>x.title==='（考试）旧考试');
 const ids=()=>exams().map(x=>x.identifier).sort();
 const initialIds=ids();
 a.equal(upcoming.calendar.identifier,e.calendar.identifier);
 a.equal(finished.calendar.identifier,e.calendar.identifier);
 a.equal(upcoming.location,'教学楼 101');
 a.equal(upcoming.startDate.toISOString(),day+'T00:00:00.000Z');
 a.equal(finished.startDate.toISOString(),'2020-01-01T00:00:00.000Z');
 a.match(finished.notes,/^同步：\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
 e.store.acquire();
 const state=e.store.read();
 finished.title='🌟 旧考试';
 finished.notes=state.examIndex[finished.identifier];
 delete state.examIndex[finished.identifier];
 e.store.write(state);e.store.release();
 await e.m.run();
 a.equal(schoolPrompts,1);
 a.deepEqual(ids(),initialIds);
 a.equal(exams().find(x=>x.identifier===finished.identifier).title,'（考试）旧考试');
 a.match(exams().find(x=>x.identifier===finished.identifier).notes,/^同步：\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
 e.store.acquire();
 try{await e.m.replaceDedicatedLegacy(e.calendar,e.store.read(),e.store);}
 finally{e.store.release();}
 a.deepEqual(ids(),initialIds);
 body='<tr><td>无效响应</td></tr>';
 await e.m.run();
 a.match(alerts.at(-1).message,/EXAM_SCHEMA/);
 a.deepEqual(ids(),initialIds);
 body='<tr class="tr-empty"><td>暂无“未结束”的考试安排</td></tr>';
 await e.m.run();
 a.deepEqual(ids(),[]);
 a.equal(e.db.filter(x=>x.calendar.identifier===e.calendar.identifier).length,1);
});
test('shortcut sync suppresses menus even while Scriptable is foregrounded',async()=>{const e=await env();e.sandbox.config.runsInApp=true;e.baseline([lesson()]);e.add(lesson());loggedIn(e,raw([activity({weekIndexes:[1]})]));await executeDaily(e);a.equal(e.notices.length,0);});
test('legacy course reminders are cleared once after upgrading',async()=>{
 const e=await env();
 e.state.minutes=10;
 e.state.notificationMode='result-only-v1.9';
 let reads=0;
 const old='nufe-local-class-'+e.state.owner+'-one';
 const removed=[];
 e.sandbox.__sdk.Notification.getAllPendingsOfCurrentScript=async()=>{
   reads++;
   return [{identifier:old},{identifier:'another-feature'}];
 };
 e.sandbox.__sdk.Notification.removePendings=async ids=>removed.push(...ids);
 loggedIn(e,raw([activity({weekIndexes:[1]})]));
 await executeDaily(e);
 await e.m.run();
 a.equal(reads,1);
 a.deepEqual(removed,[old]);
 a.equal(e.store.read().minutes,0);
 a.equal(e.store.read().notificationMode,'result-only-v2');
 a.equal(e.notices.length,0);
});
test('Scripting foreground defaults to management menu',async()=>{const e=await env({hostEnv:'index'});a.equal(e.m.ScriptingAdapter.__mode,'menu');});
test('Scripting first provisioning creates a named iCloud calendar and syncs without a main menu',async()=>{
 const e=await env({hostEnv:'index'});
 e.sandbox.__nativeRefreshMock=async()=>({kind:'reuse',schoolId:'nufe'});e.state.calendarId=null;const alerts=[],all=[e.other];
 e.sandbox.__sdk.Calendar.forEvents=async()=>all;
 e.sandbox.__sdk.Calendar.create=async opts=>({identifier:'new-icloud',title:opts.title,source:{type:'calDAV',title:'iCloud'},allowsContentModifications:true,isSubscribed:false,save:async function(){all.push(this);}});
 e.sandbox.__sdk.Dialog.prompt=async()=> 'Custom Calendar';
 e.sandbox.__sdk.Dialog.alert=async o=>alerts.push(o);
 loggedIn(e,raw([activity({weekIndexes:[1]})]));await executeDaily(e);
 a.equal(e.store.read().calendarId,'new-icloud');
 a.equal(e.store.read().calendarTitle,'Custom Calendar');
 a.equal(e.store.read().runStatus,'success');
 a.equal(alerts.length,0);
});
test('calendar setup rejects existing-calendar selections for both first binding and recovery',async()=>{
 for(const lost of [false,true]){
   const e=await env({hostEnv:'index'}),h=missingCalendar(e,{lost});
   const oldId=e.state.calendarId;
   e.store.write(e.state);
   e.sandbox.__sdk.Navigation={present:async()=>null};
   e.sandbox.__calendarManagerMock=async()=>({action:'select',calendarId:e.other.identifier});
   const personal=e.add(lesson({title:'个人日程'}),{cal:e.other,notes:''});
   await a.rejects(()=>e.m.pickCalendar(e.state,e.store),code('CANCELLED'));
   a.equal(e.store.read().calendarId,oldId);
   a.deepEqual(e.db,[personal]);
   a.equal(h.created.length,0);
   a.deepEqual(e.requests,[]);
 }
});
test('calendar cancellation returns to the dashboard with a verified login and can resume on reopening',async()=>{
 for(const lost of [false,true]){
   const e=await env({hostEnv:'index'}),h=missingCalendar(e,{lost});
   const oldId=e.state.calendarId;
   const seen=[],alerts=[];
   let authForms=0,posts=0;
   e.sandbox.__sdk.Navigation={present:async()=>null};
   e.sandbox.__sdk.Dialog.alert=async alert=>alerts.push(alert);
   const credentials={username:'student-fixture',password:'password-fixture'};
   e.sandbox.__nativeRefreshMock=async()=>{
     authForms++;
     return {kind:'credentials',schoolId:'nufe',...credentials};
   };
   e.sandbox.__nativeCredentialMock=async()=>{authForms++;return {...credentials};};
   loggedIn(e,raw([activity({weekIndexes:[1]})]));
   const schoolGet=e.m.HTTP.prototype.get;
   const table='https://jwxt.nufe.edu.cn/student/for-std/course-table';
   const cas='https://authserver.nufe.edu.cn/authserver/login';
   e.m.HTTP.prototype.authJSON=async()=>({isNeed:false});
   e.m.HTTP.prototype.get=async function(url,options){
     if(url===table&&!posts)return {url,text:'login required'};
     if(url.endsWith('/student/sso/login'))return {
       url:cas,text:'<form id="pwdFromId"><input name="execution" value="fixture"><input id="pwdEncryptSalt" value="1234567890123456"></form>'
     };
     if(url===cas&&options?.body)posts++;
     return await schoolGet.call(this,url);
   };
   e.sandbox.__nativeDashboardMock=async options=>{
     seen.push({pending:options.state.calendarBindingPending,calendarId:options.state.calendarId,canSignOut:options.canSignOut});
     return options.state.calendarBindingPending?'dismiss':0;
   };
   e.sandbox.__calendarManagerMock=async()=>{
     seen.push({saved:e.m.readSavedCredentials()?.username,posts});
     return null;
   };
   await executeDaily(e);
   a.deepEqual(seen.slice(-2),[
     {saved:credentials.username,posts:1},
     {pending:true,calendarId:oldId,canSignOut:true}
   ]);
   a.equal(e.store.read().runStatus,'cancelled');
   a.equal(e.store.read().lastError,null);
   a.equal(e.store.read().failures,0);
   a.equal(e.store.read().signedOut===true,false);
   a.equal(h.created.length,0);
   a.deepEqual(e.requests,[]);
   a.deepEqual(alerts,[]);
   e.sandbox.__nativeDashboardMock=async options=>{
     a.equal(options.state.calendarBindingPending,true);
     return 0;
   };
   e.sandbox.__calendarManagerMock=async()=>({action:'create',title:'课程和考试'});
   await e.m.run();
   a.equal(authForms,1);
   a.equal(posts,1);
   a.equal(e.store.read().calendarId,'calendar-new');
   a.equal(e.store.read().calendarBindingPending,undefined);
   a.equal(e.store.read().runStatus,'success');
   a.ok(e.db.every(event=>event.calendar.identifier==='calendar-new'));
   a.ok(e.db.length>0);
   a.deepEqual(alerts,[]);
 }
});
test('Scripting first provisioning lets user create a custom-named iCloud calendar via native manager',async()=>{
 const e=await env({hostEnv:'index'});
 e.sandbox.__nativeRefreshMock=async()=>({kind:'reuse',schoolId:'nufe'});e.state.calendarId=null;const all=[e.other];
 e.sandbox.__sdk.Navigation={present:async()=>null};
 e.sandbox.__sdk.Calendar.forEvents=async()=>all;
 e.sandbox.__sdk.Calendar.create=async opts=>({identifier:'custom-icloud',title:opts.title,source:{type:'calDAV',title:'iCloud'},allowsContentModifications:true,isSubscribed:false,save:async function(){all.push(this);}});
 e.sandbox.__calendarManagerMock=async options=>{
   a.equal(options.calendars,undefined);
   return {action:'create',title:'我的课表'};
 };
 loggedIn(e,raw([activity({weekIndexes:[1]})]));await executeDaily(e);
 a.equal(e.store.read().calendarId,'custom-icloud');
 a.equal(e.store.read().calendarTitle,'我的课表');
});
test('Scripting first provisioning cancels cleanly when native calendar manager is dismissed',async()=>{
 const e=await env({hostEnv:'index'});
 e.sandbox.config.runsInApp=true;e.state.calendarId=null;
 let prompted=false;
 e.sandbox.__sdk.Navigation={present:async()=>null};
 e.sandbox.__sdk.Dialog.prompt=async()=>{prompted=true;return 'Fallback';};
 e.sandbox.__calendarManagerMock=async()=>null;
 await a.rejects(()=>e.m.pickCalendar(e.state,e.store),code('CANCELLED'));
 a.equal(prompted,false);
});
test('Scripting native secure random encrypts password with no WebView dependency',async()=>{const e=await env();const ciphertext=await e.m.encryptPassword('local-test-secret','1234567890123456');const cipher=crypto.createDecipheriv('aes-128-cbc',Buffer.from('1234567890123456'),Buffer.alloc(16));const plain=Buffer.concat([cipher.update(Buffer.from(ciphertext,'base64')),cipher.final()]);a.ok(plain.toString('utf8').endsWith('local-test-secret'));});
test('Scripting Keychain boolean failure prevents false saved-credential success',async()=>{const e=await env();e.sandbox.__sdk.Keychain.set=()=>false;a.throws(()=>e.m.saveCredentials('sample','local'),code('CREDENTIALS_UNAVAILABLE'));a.equal(e.keys.has('CourseSync.v1.icloud-credentials'),false);});
test('Scripting native fetch cancels redirect and exposes parsed cookie metadata',async()=>{const e=await env();let stopped=false;e.sandbox.fetchImpl=async(url,opt)=>{a.equal(opt.allowInsecureRequest,false);a.equal(await opt.handleRedirect({url:'https://jwxt.nufe.edu.cn/student/login'}),null);stopped=true;return {status:302,headers:{forEach:fn=>{fn('/student/login','location');},get:()=>null},cookies:[{name:'school',value:'local-token',domain:'jwxt.nufe.edu.cn',path:'/',expiresDate:null}],mimeType:'text/html',text:async()=>''};};const req=new e.m.ScriptingAdapter.Request('https://jwxt.nufe.edu.cn/student/sso/login');let redirected='';req.onRedirect=r=>{redirected=r.url;return null;};await req.loadString();a.ok(stopped);a.equal(redirected,'https://jwxt.nufe.edu.cn/student/login');a.equal(req.response.cookies[0].name,'school');});
test('school requests persist changed cookies and deletions only',async()=>{
 const e=await env(),writes=[];
 const headers=[undefined,'session=one; Path=/','session=one; Path=/','session=; Path=/; Max-Age=0'];
 e.sandbox.fetchImpl=async()=>{
   const cookie=headers.shift();
   return {status:200,headers:new Map(cookie?[['set-cookie',cookie]]:[]),text:async()=>''};
 };
 const http=new e.m.HTTP(new e.m.CookieJar(),cookies=>writes.push(cookies.map(cookie=>cookie.value)));
 for(let i=0;i<4;i++){
   http.last=0;
   await http.get('https://jwxt.nufe.edu.cn/student/for-std/course-table');
 }
 a.deepEqual(writes.map(values=>Array.from(values)),[['one'],[]]);
});
test('remaining slider WebView is ephemeral, does not expose JS evaluation and presents only local HTML',async()=>{
 const e=await env();let initialized=null;
 e.sandbox.__sdk.WebViewController=class{
   constructor(options){initialized=options;}
   async loadHTML(html){a.match(html,/Content-Security-Policy/);return true;}
   async present(options){a.equal(options.navigationTitle,'滑块验证');}
   dispose(){}
 };
 const w=new e.m.ScriptingAdapter.WebView();
 a.equal(initialized.ephemeral,true);
 a.equal(typeof w.evaluateJavaScript,'undefined');
 a.equal(typeof w.shouldAllowRequest,'undefined');
 await w.loadHTML('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'">');
 await w.present('滑块验证');
 w.inner.dispose();
});
test('Scripting recurrence flag detects even a single visible series instance',async()=>{const e=await env();const old=e.add(lesson());old.hasRecurrenceRules=true;old.recurrenceRules=[{frequency:'weekly',interval:1}];e.state.tx=tx([lesson()],[lesson()]);await e.m.finishTx(e.state,e.store,new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store),()=>{});a.equal(e.db.length,1);a.notEqual(e.db[0].identifier,old.identifier);});
test('Scripting process/module compatibility globals do not turn production startup into export-only mode',async()=>{const e=await env();e.store.write(e.state);e.store.release();e.sandbox.__COURSESYNC_TEST__=false;await vm.runInNewContext('(async()=>{'+source+'\nawait launchCourseSync();})()',e.sandbox);a.equal(e.notices.length,1);a.match(e.notices[0].title,/失败/);});

test('Scripting 3.2.1 entry parses as an ordinary script without a module async wrapper',()=>{a.doesNotThrow(()=>new vm.Script(source));});
test('production ordinary-script entry runs even with process and module compatibility globals',async()=>{const e=await env();e.store.write(e.state);e.store.release();e.sandbox.__COURSESYNC_TEST__=false;await vm.runInNewContext(source,e.sandbox);a.equal(e.notices.length,0);await vm.runInNewContext('launchCourseSync()',e.sandbox);a.equal(e.notices.length,1);a.match(e.notices[0].title,/失败/);});
test('two launchCourseSync calls independently exit with typed Intent.text',async()=>{
 const e=await env();
 e.state.signedOut=true;
 e.store.write(e.state);
 e.store.release();
 const exits=[];
 e.sandbox.__sdk.Intent.text=value=>({type:'text',value});
 e.sandbox.__sdk.Script.exit=value=>{exits.push(value);};
 e.sandbox.__COURSESYNC_TEST__=false;
 const first=e.sandbox.__testLaunch();
 a.equal(e.sandbox.__COURSESYNC_LAUNCH__,first);
 await first;
 const second=e.sandbox.__testLaunch();
 a.notEqual(first,second);
 a.equal(e.sandbox.__COURSESYNC_LAUNCH__,second);
 await second;
 a.equal(exits.length,2);
 for(const result of exits){
   a.equal(result.type,'text');
   a.match(result.value,/已退出登录/);
 }
});

test('intent finalizer returns Intent.text even when lock release throws',async()=>{
 const e=await env();
 e.state.signedOut=true;
 e.store.write(e.state);
 e.store.release();
 const original=e.m.Store.prototype.release;
 let released=0;
 e.m.Store.prototype.release=function(){released++;throw new Error('release failed');};
 e.sandbox.__sdk.Intent.text=value=>({type:'text',value});
 try{
   await e.m.run();
   a.ok(released>=1);
   a.equal(e.sandbox.output.type,'text');
   a.match(e.sandbox.output.value,/已退出登录/);
 }finally{e.m.Store.prototype.release=original;}
});

test('intent success returns a typed text value, not a raw string',async()=>{
 const e=await env();
 e.sandbox.__sdk.Intent.text=value=>({type:'text',value});
 loggedIn(e,raw([activity()]));
 await executeDaily(e);
 a.equal(e.sandbox.output.type,'text');
 a.match(e.sandbox.output.value,/刷新成功/);
});

test('intent startup errors use notification and text output without a dialog',async()=>{
 const e=await env(),alerts=[];
 e.store.release();
 e.sandbox.__sdk.FileManager.existsSync=()=>{throw new TypeError('private native detail must never be logged');};
 e.sandbox.__sdk.Intent.text=value=>({type:'text',value});
 e.sandbox.__sdk.Dialog.alert=async o=>alerts.push(o);
 e.sandbox.__COURSESYNC_TEST__=false;
 await vm.runInNewContext('(async()=>{'+source+'\nawait launchCourseSync();})()',e.sandbox);
 a.equal(alerts.length,0);
 a.ok(e.notices.some(n=>/启动失败/.test(n.title)));
 a.equal(e.sandbox.output.type,'text');
 a.match(e.sandbox.output.value,/刷新失败：STARTUP_TYPE/);
});
test('Notification schedules with specified identifier and trigger',async()=>{const e=await env();let scheduled=null;e.sandbox.__sdk.Notification.schedule=async o=>{scheduled=o;return 'notice-1';};const n=new e.m.ScriptingAdapter.Notification();n.identifier='nufe-test-123';n.title='Test';n.body='Body';n.setTriggerDate(new Date(Date.now()+60000));await n.schedule();a.equal(scheduled.identifier,'nufe-test-123');a.ok(scheduled.triggerDate||scheduled.trigger);});
test('VERIFIED_TERM_ANCHORS supports multiple academic years',async()=>{const {m}=await env();a.ok(m.VERIFIED_TERM_ANCHORS['2024-2025-1']);a.ok(m.VERIFIED_TERM_ANCHORS['2025-2026-1']);a.ok(m.VERIFIED_TERM_ANCHORS['2026-2027-1']);});
test('widget has a single dedicated Scripting entry with no legacy ListWidget renderer',()=>{
 const native=fs.readFileSync(__dirname+'/../index.tsx','utf8');
 const widget=fs.readFileSync(__dirname+'/../widget.tsx','utf8');
 a.doesNotMatch(native,/ListWidget|runsInWidget|widgetParameter|async function widget\(/);
 a.match(widget,/Widget\.present\(/);
});

test('course location omits campus while preserving room or building',async()=>{const {m}=await env();a.equal(m.expand(raw([activity()]),161,'2026-09-07').events[0].location,'教A101');a.equal(m.expand(raw([activity({room:'',building:'德业楼'})]),161,'2026-09-07').events[0].location,'德业楼');});
test('exam location omits campus while preserving room or building',async()=>{
 const e=await env();
 const now=Date.parse('2026-11-16T00:00:00Z');
 const rows=[
  '<tr data-finished="false"><td><div class="time">2026-12-18 09:00~11:00</div><div><span>仙林校区</span><span>博远楼101</span></div></td><td><div>高等数学</div><div>期末</div></td><td>未结束</td></tr>',
  '<tr data-finished="false"><td><div class="time">2026-12-19 14:00~16:00</div><div><span>仙林</span><span>德业楼</span><span>202</span></div></td><td><div>线性代数</div><div>期末</div></td><td>未结束</td></tr>',
  '<tr data-finished="false"><td><div class="time">2026-12-20 09:00~11:00</div><div><span>仙林校区</span></div></td><td><div>大学英语</div><div>期末</div></td><td>未结束</td></tr>',
  '<tr data-finished="false"><td><div class="time">2026-12-21 15:30~17:30</div><div><span>仙林校区</span><span>德经楼</span><span>德经楼Z1-116</span></div></td><td><div>金融风险管理</div><div>期末</div></td><td>未结束</td></tr>'
 ].join('');
 const http={get:async()=>({url:'https://jwxt.nufe.edu.cn/student/for-std/exam-arrange',text:'<table id="exams">'+rows+'</table>'})};
 await e.m.syncExams(http,e.state,e.store,e.calendar,()=>{},now);
 a.deepEqual(Array.from(e.state.exams,x=>[x.title,x.location]),[
  ['（考试）高等数学','博远楼101'],
  ['（考试）线性代数','德业楼 202'],
  ['（考试）大学英语',''],
  ['（考试）金融风险管理','德经楼Z1-116']
 ]);
 a.deepEqual(Array.from(e.db,x=>[x.title,x.location]),[
  ['（考试）高等数学','博远楼101'],
  ['（考试）线性代数','德业楼 202'],
  ['（考试）大学英语',''],
  ['（考试）金融风险管理','德经楼Z1-116']
 ]);
});
test('App refresh fetches all courses; scheduled sync rotates two other terms including future terms',async()=>{
 const e=await env(),fetched=[];
 e.m.HTTP.prototype.get=async()=>({
   url:'https://jwxt.nufe.edu.cn/student/for-std/course-table',
   text:'var personId=100;var currentSemester={"id":161};<select id="allSemesters"><option value="160">2025-2026-2</option><option value="159">2025-2026-1</option><option value="158">2024-2025-2</option><option value="157">2024-2025-1</option><option value="161">2026-2027-1</option><option value="162">2026-2027-2</option></select>'
 });
 e.state.anchors['162']='2027-03-01';
 let failHistorical=false;
 e.m.HTTP.prototype.json=async url=>{
   const sid=Number(new URL(url).searchParams.get('semesterId'));
   fetched.push(sid);
   if(failHistorical&&sid===160)throw Object.assign(Error('offline'),{code:'NETWORK'});
   return raw([activity({weekIndexes:[1]})]);
 };
 await e.m.synchronize(e.state,e.store,e.calendar,true,()=>{});
 a.deepEqual(fetched.splice(0),[161,157,158,159,160,162]);
 failHistorical=true;
 await e.m.synchronize(e.state,e.store,e.calendar,false,()=>{});
 a.deepEqual(fetched.splice(0),[161,162,160]);
 a.equal(e.state.termErrors[0].sid,'160');
 failHistorical=false;
 await e.m.synchronize(e.state,e.store,e.calendar,false,()=>{});
 a.deepEqual(fetched.splice(0),[161,160,159]);
 await e.m.synchronize(e.state,e.store,e.calendar,false,()=>{});
 a.deepEqual(fetched.splice(0),[161,158,157]);
 await e.m.synchronize(e.state,e.store,e.calendar,true,()=>{});
 a.deepEqual(fetched.splice(0),[161,157,158,159,160,162]);
 const pending=e.state.semesters['160'];
 e.state.tx={...tx(pending.events,pending.events),sid:'160',anchor:pending.anchor};
 e.store.write(e.state);
 await e.m.synchronize(e.state,e.store,e.calendar,true,()=>{});
 a.deepEqual(fetched,[160,161,157,158,159,162]);
 a.equal(e.state.termErrors.length,0);
});

test('readable event notes contain the synchronization timestamp only',async()=>{
 const {m}=await env();
 const text=m.readableNotes(lesson({teachers:['戴靓']}),'2026-11-01T17:22:37.760Z');
 a.equal(text,'同步：2026-11-02 01:22');
 a.doesNotMatch(text,/教师|NUFE_LOCAL|sid|week|JSON|第 2 周/);
});
test('indexed unmarked event remains identifiable after note migration',async()=>{
 const e=await env();const rec=lesson();e.baseline([rec]);const ev=e.add(rec);
 e.state.semesters['161'].index={[rec.id]:ev.identifier};
 ev.notes='教师：张老师\n同步：2026-11-02 01:22';
 const map=e.m.storedEventIndex(e.state);
 a.equal(e.m.eventRecord(ev,e.state.owner,map).id,rec.id);
});
test('legacy title with teacher suffix matches a verified new lesson',async()=>{
 const e=await env();const rec=lesson({title:'住宅产品开发与设计',teachers:['戴靓']});
 const ev=e.add(rec);ev.title='住宅产品开发与设计 - 戴靓';
 a.equal(e.m.matchesOldCourse(ev,rec),true);
 ev.title='其他个人事项';
 a.equal(e.m.matchesOldCourse(ev,rec),false);
});

test('notes migration keeps the same native event ID',async()=>{
  const e=await env(),rec=lesson();e.baseline([rec]);const ev=e.add(rec);
  e.state.semesters['161'].index={[rec.id]:ev.identifier};
  e.store.write(e.state);
  await e.m.polishTermNotes(e.calendar,e.state,e.store,'161',()=>{});
  a.equal(e.db.length,1);
  a.match(e.db[0].notes,/^同步：/);
  a.equal(e.db[0].title,'高等数学');
  a.doesNotMatch(e.db[0].notes,/教师|NUFE_LOCAL_V1|\\bweek\\b|\\bsid\\b/);
  a.equal(e.m.eventRecord(e.db[0],e.state.owner,e.m.storedEventIndex(e.state)).id,rec.id);
});
test('verified duplicated legacy title is removed without touching kept lesson',async()=>{
  const e=await env(),rec=lesson();e.baseline([rec]);const good=e.add(rec);
  e.state.semesters['161'].index={[rec.id]:good.identifier};
  const old=e.add(rec,{notes:'legacy calendar import'});old.title='高等数学 - 张老师';
  e.store.write(e.state);
  await e.m.removeMatchedOldCourses(e.calendar,e.state,e.store,'161',()=>{});
  a.equal(e.db.length,1);a.equal(e.db[0].identifier,good.identifier);
});

test('renaming a bound calendar never triggers an automatic rename',async()=>{
 const e=await env({hostEnv:'index'});
 e.calendar.title='My Calendar';let saves=0;e.calendar.save=async()=>{saves++;};
 e.state.calendarId=e.calendar.identifier;e.store.write(e.state);
 const selected=await e.m.pickCalendar(e.state,e.store);
 a.equal(selected.title,'My Calendar');a.equal(saves,0);
 a.equal(e.store.read().calendarTitle,'My Calendar');
});
test('calendar identity is independent of its title',async()=>{
 const e=await env();e.state.calendarId=e.calendar.identifier;e.calendar.title='Study 2026';
 const picked=await e.m.pickCalendar(e.state,e.store);
 a.equal(picked.identifier,e.state.calendarId);a.equal(picked.title,'Study 2026');
});
function missingCalendar(e,{lost=false}={}){
 const list=[e.other],created=[];
 e.sandbox.__sdk.Calendar.forEvents=async()=>list;
 e.sandbox.__sdk.Calendar.create=async o=>{
   created.push(o);
   return {identifier:'calendar-new',title:o.title,source:{type:'calDAV',title:'iCloud'},
     allowsContentModifications:true,isSubscribed:false,save:async function(){list.push(this);}};
 };
 e.sandbox.config.runsInApp=true;e.sandbox.args.shortcutParameter='setup';
 e.state.calendarId=lost?'calendar-gone':null;
 return {list,created};
}
const setName=(e,name='Custom lessons')=>{const asked=[];e.sandbox.__sdk.Dialog.prompt=async o=>{asked.push(o);return name;};return asked;};
test('first setup creates a custom-named iCloud calendar and binds its ID',async()=>{
 const e=await env({hostEnv:'index'}),h=missingCalendar(e),prompt=setName(e,'Semester ✨');
 const picked=await e.m.pickCalendar(e.state,e.store);
 a.equal(prompt.length,1);a.equal(h.created.length,1);
 a.equal(h.created[0].sourceType,'calDAV');a.equal(h.created[0].title,'Semester ✨');
 a.equal(picked.title,'Semester ✨');a.equal(e.store.read().calendarId,'calendar-new');
});
test('canceling calendar naming never creates or binds a calendar',async()=>{
 const e=await env({hostEnv:'index'}),h=missingCalendar(e);setName(e,null);
 await a.rejects(()=>e.m.pickCalendar(e.state,e.store),code('CANCELLED'));
 a.equal(h.created.length,0);a.equal(e.state.calendarId,null);
});
test('iCloud creation never falls back to a local calendar',async()=>{
 const e=await env({hostEnv:'index'}),h=missingCalendar(e);setName(e);
 e.sandbox.__sdk.Calendar.create=async options=>{h.created.push(options);throw Error('calendar unavailable');};
 await a.rejects(()=>e.m.pickCalendar(e.state,e.store),code('CALENDAR_CREATE_FAILED'));
 a.deepEqual(h.created.map(x=>x.sourceType),['calDAV']);
});
test('non-iCloud CalDAV creation must not silently bind a different account',async()=>{
 const e=await env({hostEnv:'index'}),h=missingCalendar(e);setName(e);
 e.sandbox.__sdk.Calendar.create=async o=>{h.created.push(o);return {identifier:'wrong-source',title:o.title,source:{type:'calDAV',title:'Other Account'},allowsContentModifications:true,isSubscribed:false,save:async function(){h.list.push(this);}};};
 await a.rejects(()=>e.m.pickCalendar(e.state,e.store),code('CALENDAR_NOT_ICLOUD'));
 a.equal(e.state.calendarId,null);a.equal(h.created.length,1);
});
test('failed create readback never adopts an unrelated same-name calendar',async()=>{
 const e=await env({hostEnv:'index'}),h=missingCalendar(e);setName(e,'School');
 e.sandbox.__sdk.Calendar.create=async o=>{h.created.push(o);return {identifier:'uncertain',title:o.title,save:async()=>{h.list.push({identifier:'other',title:o.title,source:{type:'calDAV',title:'iCloud'},allowsContentModifications:true,isSubscribed:false});}};};
 await a.rejects(()=>e.m.pickCalendar(e.state,e.store),code('CALENDAR_CREATE_FAILED'));
 a.equal(h.created.length,1);a.equal(e.state.calendarId,null);
});
test('empty calendar list reports permission instead of creating',async()=>{
 const e=await env({hostEnv:'index'}),h=missingCalendar(e);h.list.length=0;setName(e);
 await a.rejects(()=>e.m.pickCalendar(e.state,e.store),code('CALENDAR_PERMISSION'));
 a.equal(h.created.length,0);
});
test('missing calendar opens the same creation screen with a duplicate warning',async()=>{
 const e=await env({hostEnv:'index'}),h=missingCalendar(e,{lost:true});
 e.sandbox.__sdk.Navigation={present:async()=>null};
 e.sandbox.__calendarManagerMock=async options=>{
   a.equal(options.calendars,undefined);
   return {action:'create',title:'Replacement'};
 };
 const personal=e.add(lesson({title:'个人日程'}),{cal:e.other,notes:''});
 const picked=await e.m.pickCalendar(e.state,e.store);
 a.equal(picked.title,'Replacement');
 a.equal(e.store.read().calendarId,'calendar-new');
 a.equal(h.created.length,1);
 a.deepEqual(e.db,[personal]);
 a.deepEqual(e.requests,[]);
});
test('fallback creation prompt includes the same warning when the original calendar is missing',async()=>{
 const e=await env({hostEnv:'index'}),h=missingCalendar(e,{lost:true}),asked=setName(e,null);
 await a.rejects(()=>e.m.pickCalendar(e.state,e.store),code('CANCELLED'));
 a.equal(asked.length,1);
 a.equal(asked[0].confirmLabel,'创建并绑定');
 a.equal(asked[0].placeholder,'日历名称');
 a.equal(e.state.calendarId,'calendar-gone');
 a.equal(h.created.length,0);
});
test('pending transaction blocks creation of a replacement calendar',async()=>{
 const e=await env({hostEnv:'index'}),h=missingCalendar(e,{lost:true});setName(e);
 e.state.tx=tx([],[]);
 await a.rejects(()=>e.m.pickCalendar(e.state,e.store),code('CALENDAR_REBIND_UNSAFE'));
 a.equal(h.created.length,0);
});
test('canceled calendar creation does not proceed after another run owns cancellation',async()=>{
 const e=await env({hostEnv:'index'}),h=missingCalendar(e);
 e.sandbox.__sdk.Dialog.prompt=async()=>{a.equal(e.store.requestCancelActive(),true);return 'My schedule';};
 await a.rejects(()=>e.m.pickCalendar(e.state,e.store),code('SYNC_SUPERSEDED'));
 a.equal(h.created.length,0);
});
test('background sync never creates a calendar',async()=>{
 const e=await env(),created=[];e.state.calendarId='missing-calendar';
 e.sandbox.__sdk.Calendar.create=async o=>{created.push(o);throw Error('unexpected');};
 await a.rejects(()=>e.m.pickCalendar(e.state,e.store),code('CALENDAR_MISSING'));
 a.equal(created.length,0);
});
test('school semester start automatically anchors historical spring timetable without prompting',async()=>{
 const e=await env({hostEnv:'intent'});
 const http={json:async url=>{
   a.ok(url.endsWith('/student/ws/semester/get/140'));
   return {startDate:'2024-02-26'};
 }};
 const anchor=await e.m.chooseAnchor(140,'2023-2024-2',http,e.state,e.store,false);
 a.equal(anchor,'2024-02-26');
 a.equal(e.state.anchors['140'],'2024-02-26');
 a.equal(e.state.anchorSources['140'],'school-semester-start');
});
test('school non-Monday semester date is normalized to Monday automatically',async()=>{
 const e=await env();
 const anchor=await e.m.chooseAnchor(140,'2023-2024-2',{json:async()=>({beginDate:'2024-02-28'})},e.state,e.store,false);
 a.equal(anchor,'2024-02-26');
});
test('explicit teaching-week date is preferred over a generic term start date',async()=>{
 const e=await env();
 const date=await e.m.chooseAnchor(140,'2023-2024-2',
   {json:async()=>({startDate:'2024-02-19',firstTeachingWeekMonday:'2024-02-26'})},e.state,e.store,false);
 a.equal(date,'2024-02-26');
 a.equal(e.state.anchorSources['140'],'school-teaching-week');
});
test('missing official semester dates fails closed without importing or guessing',async()=>{
 const e=await env();
 await a.rejects(()=>e.m.chooseAnchor(140,'2023-2024-2',{json:async()=>({name:'2023-2024-2'})},e.state,e.store,false),
   code('ANCHOR'));
 a.equal(e.state.anchors['140'],undefined);
});

test('logout is direct with no save-password submenu and no calendar mutation',async()=>{
 const e=await env({hostEnv:'index'}),menus=[],alerts=[];
 e.keys.set('CourseSync.Local.v1.cookies','[]');
 e.m.saveCredentials('student','test-only-secret');
 e.store.write(e.state);e.store.release();
 e.sandbox.__sdk.Dialog.actionSheet=async options=>{
   menus.push(options.actions.map(x=>x.label));
   return options.actions.findIndex(x=>x.destructive||x.label==='退出登录');
 };
 e.sandbox.__sdk.Dialog.confirm=async options=>{
   a.match(options.message,/Cookie/);
   a.match(options.message,/课表与日历不会删除/);
   return true;
 };
 e.sandbox.__sdk.Dialog.alert=async o=>alerts.push(o);
 await e.m.run();
 a.deepEqual(Array.from(menus[0]),['立即刷新','退出登录']);
 a.equal(menus.length,1);
 a.equal(e.keys.has('CourseSync.Local.v1.cookies'),false);
 a.equal(e.m.hasSavedCredentials(),false);
 a.equal(e.store.read().signedOut,true);
 a.equal(e.store.read().calendarId,e.calendar.identifier);
 a.equal(e.requests.length,0);
 a.equal(alerts.at(-1).title,'已退出登录');
 a.equal(e.keys.get('CourseSync.Local.v1.school-reselect'),'nufe');
});
test('opening CourseSync after logout goes straight to login and keeps the bound calendar',async()=>{
 for(const id of ['nufe','usts']){
  const e=await env({hostEnv:'index'}),m=e.m;
  e.store.release();
  m.activateSelectedSchool(id);
  const store=new m.Store();store.acquire();
  store.write({...e.state,signedOut:true,authPaused:true});store.release();
  e.keys.set(id==='nufe'?'CourseSync.Local.v1.school-choice':'CourseSync.Local.v1.school-reselect',id);
  let dashboardPrompts=0,schoolPrompts=0;
  e.sandbox.__sdk.Dialog.actionSheet=async()=>{dashboardPrompts++;return null;};
  e.sandbox.__nativeRefreshMock=async(schoolId,allowReuse)=>{
    schoolPrompts++;
    a.equal(schoolId,'nufe');
    a.equal(allowReuse,false);
    return null;
  };
  await m.run();
  await m.run();
  a.equal(dashboardPrompts,0);
  a.equal(schoolPrompts,2);
  a.equal(store.read().calendarId,e.calendar.identifier);
  a.deepEqual(e.requests,[]);
 }
});
test('a legacy USTS binding opens the fixed NUFE entry without making school requests',async()=>{
 const e=await env({hostEnv:'index'});
 e.store.release();
 e.m.activateSelectedSchool('usts');
 const oldStore=new e.m.Store();
 oldStore.acquire();oldStore.write(e.state);oldStore.release();
 e.keys.set('CourseSync.Local.v1.school-choice','usts');
 let offered=null;
 e.sandbox.__nativeRefreshMock=async(schoolId,allowReuse)=>{offered=[schoolId,allowReuse];return null;};
 e.sandbox.__sdk.Dialog.actionSheet=async()=>{throw Error('Unexpected dashboard');};
 let networkCalls=0;
 e.sandbox.fetchImpl=async()=>{networkCalls++;throw Error('Unexpected network');};
 await e.m.run();
 a.deepEqual(offered,['nufe',false]);
 a.equal(networkCalls,0);
 a.equal(oldStore.read().calendarId,e.calendar.identifier);
 a.equal(e.keys.get('CourseSync.Local.v1.school-choice'),'usts');
});
test('background refresh after logout does not fall back to another school',async()=>{
 const e=await env();
 e.store.write(e.state);e.store.release();
 e.keys.set('CourseSync.Local.v1.school-reselect','usts');
 let networkCalls=0;
 e.sandbox.fetchImpl=async()=>{networkCalls++;throw Error('unexpected network');};
 await e.m.run();
 a.equal(networkCalls,0);
 a.match(e.sandbox.output,/登录南京财经大学/);
 a.equal(e.keys.get('CourseSync.Local.v1.school-reselect'),'usts');
});
test('a verified re-login clears the logout marker',async()=>{
 const e=await env({hostEnv:'index'});
 e.baseline([lesson()]);
 e.add(lesson());
 e.state.signedOut=true;
 e.state.authPaused=true;
 e.store.write(e.state);e.store.release();
 e.keys.set('CourseSync.Local.v1.school-reselect','nufe');
 e.sandbox.__nativeRefreshMock=async()=>({kind:'credentials',schoolId:'nufe',username:'test-user',password:'fixture-password'});
 e.sandbox.__sdk.Dialog.actionSheet=async()=>{throw Error('unexpected dashboard');};
 loggedIn(e,raw([activity({weekIndexes:[1]})]));
 await e.m.run();
 a.equal(e.keys.has('CourseSync.Local.v1.school-reselect'),false);
 a.equal(e.keys.get('CourseSync.Local.v1.school-choice'),'nufe');
 a.equal(e.store.read().signedOut,false);
 a.equal(e.store.read().calendarId,e.calendar.identifier);
});
test('successful verified synchronization clears signed-out state without changing calendar identity',async()=>{
 const e=await env();e.state.signedOut=true;e.state.authPaused=true;
 e.keys.set('CourseSync.Local.v1.cookies',JSON.stringify([{name:'SESSION',value:'stale',domain:'jwxt.nufe.edu.cn',path:'/',expires:0}]));
 e.baseline([lesson()]);e.add(lesson());
 loggedIn(e,raw([activity({weekIndexes:[1]})]));
 const cookieHeaders=[];const get=e.m.HTTP.prototype.get;
 e.m.HTTP.prototype.get=async function(...args){cookieHeaders.push(this.jar.header('https://jwxt.nufe.edu.cn/student/for-std/course-table'));return get.apply(this,args);};
 await e.m.synchronize(e.state,e.store,e.calendar,true,()=>{});
 a.ok(cookieHeaders.length>0);
 a.ok(cookieHeaders.every(header=>!header.includes('SESSION=stale')));
 a.equal(e.state.signedOut,false);
 a.equal(e.state.authPaused,false);
 a.equal(e.state.calendarId,e.calendar.identifier);
 a.equal(e.db.length,1);
});
test('a crash after persisting logout intent still offers credential cleanup retry',async()=>{
 const e=await env({hostEnv:'index'}),menus=[];
 e.state.signedOut=true;e.state.authPaused=true;
 e.keys.set('CourseSync.Local.v1.cookies','[]');
 e.m.saveCredentials('sample','stale-test');
 e.store.write(e.state);e.store.release();
 e.sandbox.__sdk.Dialog.actionSheet=async opts=>{menus.push(opts.actions.map(x=>x.label));return null;};
 await e.m.run();
 a.deepEqual(Array.from(menus[0]),['立即刷新','退出登录']);
 a.equal(e.requests.length,0);
});
test('signed-out environment diagnostics never reuse an undeleted school cookie',async()=>{
 const e=await env(),seen=[];
 e.state.signedOut=true;e.state.authPaused=true;
 e.keys.set('CourseSync.Local.v1.cookies',JSON.stringify([{name:'SESSION',value:'old-session',domain:'jwxt.nufe.edu.cn',path:'/',expires:0}]));
 e.sandbox.fetchImpl=async(url,options)=>{
   seen.push(options);
   return {status:200,headers:new Map(),cookies:[],mimeType:'text/html',text:async()=>'<html>login required</html>'};
 };
 const checks=await e.m.inspectEnvironment(e.state,e.store);
 a.equal(seen.length,1);
 a.equal(seen[0].headers?.Cookie||'', '');
 a.equal(checks.find(c=>c.name==='登录会话').level,'正常');
 a.match(checks.find(c=>c.name==='Cookie 存储').detail,/已退出登录/);
});
test('background sync after deliberate logout makes no school request or extra notification',async()=>{
 const e=await env();
 e.state.signedOut=true;e.state.authPaused=true;
 e.keys.set('CourseSync.Local.v1.cookies','[]');
 e.m.saveCredentials('student','test-secret');
 e.store.write(e.state);e.store.release();
 await e.m.run();
 a.equal(e.requests.length,0);
 a.equal(e.notices.length,0);
 a.equal(e.store.read().signedOut,true);
 a.equal(e.store.read().calendarId,e.calendar.identifier);
 a.match(e.sandbox.output,/已退出登录/);
});
test('project display name is CourseSync while stable internal identity is retained',()=>{
 const project=JSON.parse(fs.readFileSync(__dirname+'/../script.json','utf8'));
 a.equal(project.name,'CourseSync');
 a.match(project.description,/CourseSync/);
 a.equal(project.localizedNames.en,'CourseSync');
 a.equal(project.localizedNames.zh,'CourseSync');
});
test('source omits obsolete school name and supports existing calendar aliases',()=>{
 const oldName=String.fromCharCode(0x5357,0x8d22);
 const fullName=String.fromCharCode(0x5357,0x4eac,0x8d22,0x7ecf,0x5927,0x5b66);
 a.equal(source.includes(oldName),false);
 a.equal(source.includes(fullName),true); // The whitelisted school name is intentionally included.
 a.ok(source.includes('LEGACY_CALENDAR_TITLE'));
});

test('iCloud credentials use a synchronizable first-unlock entry without cloud cookies',async()=>{
 const e=await env();const calls=[],api=e.sandbox.__sdk.Keychain;
 const set=api.set.bind(api),get=api.get.bind(api),contains=api.contains.bind(api);
 api.set=(key,value,options)=>{calls.push(['set',key,options]);return set(key,value,options);};
 api.get=(key,options)=>{calls.push(['get',key,options]);return get(key,options);};
 api.contains=(key,options)=>{calls.push(['contains',key,options]);return contains(key,options);};
 e.m.saveCredentials('test-user','test-pass');
 a.ok(calls.some(([kind,key,opt])=>kind==='set'&&key==='CourseSync.v1.icloud-credentials'&&opt?.synchronizable===true&&opt.accessibility==='first_unlock'));
 a.ok(calls.some(([kind,key,opt])=>kind==='get'&&key==='CourseSync.v1.icloud-credentials'&&opt?.synchronizable===true));
 a.equal(e.keys.has('CourseSync.Local.v1.saved-login'),false);
 e.keys.set('CourseSync.Local.v1.cookies','[]');
 a.equal(e.keys.get('CourseSync.Local.v1.cookies'),'[]');
});
test('legacy local password migrates only after cloud read-back verification',async()=>{
 const e=await env();
 e.keys.set('CourseSync.Local.v1.saved-login',JSON.stringify({version:1,username:'sample',password:'secret'}));
 a.equal(e.m.migrateSavedCredentials(),'migrated');
 a.equal(e.keys.has('CourseSync.Local.v1.saved-login'),false);
 a.equal(e.m.readSavedCredentials().password,'secret');
});
test('cloud migration failure preserves old local password and cookie',async()=>{
 const e=await env(),old=JSON.stringify({version:1,username:'sample',password:'secret'});
 e.keys.set('CourseSync.Local.v1.saved-login',old);e.keys.set('CourseSync.Local.v1.cookies','[]');
 e.sandbox.__sdk.Keychain.set=(key,value,opts)=>opts?.synchronizable?false:(e.keys.set(key,value),true);
 a.throws(()=>e.m.migrateSavedCredentials(),code('CREDENTIALS_UNAVAILABLE'));
 a.equal(e.keys.get('CourseSync.Local.v1.saved-login'),old);
 a.equal(e.keys.get('CourseSync.Local.v1.cookies'),'[]');
});
test('a different iCloud account is not silently overwritten on migration',async()=>{
 const e=await env();
 const local=JSON.stringify({version:1,username:'local-user',password:'local-pass'});
 const cloud=JSON.stringify({version:1,username:'cloud-user',password:'cloud-pass'});
 e.keys.set('CourseSync.Local.v1.saved-login',local);
 e.keys.set('CourseSync.v1.icloud-credentials',cloud);
 a.equal(e.m.migrateSavedCredentials(),'conflict');
 a.equal(e.m.readSavedCredentials().username,'local-user');
 a.equal(e.keys.get('CourseSync.v1.icloud-credentials'),cloud);
});

test('native SMS input prepares the OTP UI and never saves a code',async()=>{
 const e=await env({hostEnv:'index'}),requests=[];
 e.sandbox.__sdk.Navigation={present:()=>true};
 e.sandbox.__nativeTextMock=async options=>{requests.push(options);return '123456';};
 const code=await e.m.input('学校二次认证','短信验证码',false,{kind:'sms'});
 a.equal(code,'123456');a.equal(requests.length,1);
 a.equal(requests[0].kind,'sms');
 a.equal(requests[0].label,'短信验证码');
 a.equal(e.keys.has('CourseSync.v1.icloud-credentials'),false);
});
test('native input cancellation never prompts twice',async()=>{
 const e=await env({hostEnv:'index'});let prompted=0;
 e.sandbox.__sdk.Navigation={present:()=>true};
 e.sandbox.__nativeTextMock=async()=>null;
 e.sandbox.__sdk.Dialog.prompt=async()=>{prompted++;throw Error('WRONG_PROMPT');};
 await a.rejects(()=>e.m.input('学校二次认证','短信验证码',false,{kind:'sms'}),code('CANCELLED'));
 a.equal(prompted,0);
});
test('native image captcha passes local image without exposing the answer',async()=>{
 const e=await env({hostEnv:'index'}),observed=[];const picture={id:'mock-image'};
 e.sandbox.__sdk.Navigation={present:()=>true};
 e.sandbox.__nativeTextMock=async options=>{observed.push(options);return 'ABCD';};
 a.equal(await e.m.input('图形验证码','输入图片中的字符',false,{kind:'captcha',image:picture}),'ABCD');
 a.equal(observed[0].image,picture);
 a.equal(observed[0].kind,'captcha');
});
test('password login contains no QR entry points',()=>{
 a.equal(source.includes('qrLogin('),false);
 a.equal(source.includes('qrCode/getToken'),false);
 a.equal(source.includes('QR_EXPIRED'),false);
 a.equal(source.includes('选择学校登录方式'),false);
});
test('foreground native login receives passwords only after explicit submission',async()=>{
 const e=await env({hostEnv:'index'});
 const requests=[];
 e.sandbox.__sdk.Navigation={present:()=>true};
 e.sandbox.__nativeCredentialMock=async title=>{
   requests.push(title);
   return {username:'student',password:'secret'};
 };
 const r=await e.m.credentialForm({title:'保存登录凭据'});
 a.equal(r.username,'student');
 a.equal(r.password,'secret');
 a.deepEqual(requests,['保存登录凭据']);
 a.equal(e.keys.has('CourseSync.v1.icloud-credentials'),false);
});

test('dismissed native login cancels instead of launching a fallback form',async()=>{
 const e=await env({hostEnv:'index'});let prompts=0,confirmations=0;
 e.sandbox.__sdk.Navigation={present:()=>true};
 e.sandbox.__nativeCredentialMock=async()=>null;
 e.sandbox.__sdk.Dialog.prompt=async()=>{prompts++;throw Error('WRONG_PROMPT');};
 e.sandbox.__sdk.Dialog.confirm=async()=>{confirmations++;throw Error('WRONG_CONFIRM');};
 await a.rejects(()=>e.m.credentialForm(),code('CANCELLED'));
 a.equal(prompts,0);a.equal(confirmations,0);
});

test('native credential sheet failure asks consent before system prompts',async()=>{
 const e=await env({hostEnv:'index'});
 e.sandbox.__sdk.Navigation={present:()=>true};
 e.sandbox.__nativeCredentialMock=async()=>{throw Error('NATIVE_FAILURE');};
 let confirms=0;
 e.sandbox.__sdk.Dialog.confirm=async options=>{
   confirms++;
   a.match(options.message,/NATIVE_FORM_UNAVAILABLE/);
   return false;
 };
 await a.rejects(()=>e.m.credentialForm(),code('CANCELLED'));
 a.equal(confirms,1);
});

test('when native navigation is unavailable, system prompts require consent',async()=>{
 const e=await env({hostEnv:'index'}),prompts=[],confirms=[];
 e.sandbox.__sdk.Dialog.confirm=async o=>{confirms.push(o);return true;};
 e.sandbox.__sdk.Dialog.prompt=async o=>{prompts.push(o);return prompts.length===1?'student-id':'safe-password';};
 const result=await e.m.credentialForm();
 a.equal(result.username,'student-id');a.equal(result.password,'safe-password');
 a.equal(confirms.length,1);a.equal(prompts.length,2);
 a.equal(prompts[1].obscureText,true);
 a.equal(e.keys.has('CourseSync.v1.icloud-credentials'),false);
});

test('declining native fallback cancels before requesting any password',async()=>{
 const e=await env({hostEnv:'index'});let prompted=0;
 e.sandbox.__sdk.Dialog.confirm=async()=>false;
 e.sandbox.__sdk.Dialog.prompt=async()=>{prompted++;return 'SHOULD_NOT_BE_USED';};
 await a.rejects(()=>e.m.credentialForm(),code('CANCELLED'));
 a.equal(prompted,0);
});

test('interactive credential screen cannot open in background jobs',async()=>{
 const e=await env({hostEnv:'intent'});
 await a.rejects(()=>e.m.credentialForm(),code('AUTH_INTERACTIVE_REQUIRED'));
});

test('slider only accepts plausible bounded, manually-dragged trajectories',async()=>{
 const e=await env();const validate=e.m.validSliderResult;
 const valid={canvasLength:280,moveLength:122,tracks:[
   {a:0,b:0,c:0},{a:40,b:1,c:110},{a:122,b:2,c:50}
 ]};
 a.equal(validate(valid),true);
 a.equal(validate({...valid,moveLength:1000}),false);
 a.equal(validate({...valid,tracks:[{a:0,b:0,c:0}]}),false);
 a.equal(validate({...valid,tracks:[{a:0,b:0,c:0},{a:'100',b:0,c:10}]}),false);
 a.equal(validate({...valid,tracks:new Array(1001).fill({a:2,b:0,c:20})}),false);
});
test('calendar titles with a legacy teacher suffix map to the canonical course',async()=>{
 const e=await env(),rec=lesson();
 const old=e.add(rec,{notes:'[NUFE_LOCAL_V1 '+e.state.owner+' '+rec.id+']\n'+JSON.stringify({sid:rec.sid,id:rec.id,week:rec.week,su:rec.su,eu:rec.eu,teachers:rec.teachers})});
 a.equal(e.m.eventRecord(old,e.state.owner).title,'高等数学');
 old.title='高等数学（张老师）';
 a.equal(e.m.eventRecord(old,e.state.owner).title,'高等数学');
 a.equal(e.m.matchesOldCourse(old,rec),true);
});
test('a newly written marked event recovers the base title without an index',async()=>{
 const e=await env(),rec=lesson();
 await new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store).save(rec,null,'2026-11-02T03:00:00Z');
 a.equal(e.db.length,1);
 a.equal(e.db[0].title,'高等数学');
 a.doesNotMatch(e.db[0].notes,/张老师|teachers/);
 const adapter=new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store);
 const index=await e.m.applyTransaction(tx([], [rec]),adapter);
 a.equal(index[rec.id],e.db[0].identifier);
 a.deepEqual(e.requests.map(x=>x[0]),['save']);
});
test('teacher changes preserve logical identity without rewriting the native event',async()=>{
 const e=await env(),rec=lesson(),after=lesson({teachers:['李老师']});
 e.add(rec);
 const native=e.db[0].identifier;
 const p=e.m.plan([rec],[{...after,id:undefined}],()=> 'different-id');
 a.equal(p.events[0].id,rec.id);
 await e.m.applyTransaction(tx([rec],[after]),new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store));
 a.equal(e.db.length,1);
 a.equal(e.db[0].identifier,native);
 a.equal(e.db[0].title,'高等数学');
 a.deepEqual(e.requests,[]);
});
test('v2 readable notes migrate to v3 title and timestamp in place',async()=>{
 const e=await env(),rec=lesson(),ev=e.add(rec,{notes:'教师：张老师\\n同步：2026-11-02 01:22'.replace('\\n','\n')});
 e.baseline([rec]);e.state.semesters['161'].notesFormat=2;
 e.state.semesters['161'].index={[rec.id]:ev.identifier};
 const before=ev.identifier;
 e.store.write(e.state);
 await e.m.polishTermNotes(e.calendar,e.state,e.store,'161',()=>{});
 a.equal(e.db.length,1);a.equal(e.db[0].identifier,before);
 a.equal(e.db[0].title,'高等数学');
 a.match(e.db[0].notes,/^同步：/);
 a.doesNotMatch(e.db[0].notes,/教师：/);
 a.equal(e.state.semesters['161'].notesFormat,3);
});

test('automatic refresh removes a legacy teacher suffix from an indexed course in place',async()=>{
 const e=await env();
 const source=raw([activity({courseName:'中国税制（双语）',teachers:[{name:'高玉胭(001)'}],weekIndexes:[1]})]);
 loggedIn(e,source);
 const rec={...e.m.expand(source,161,'2026-09-07').events[0],id:'tax-course'};
 const ev=e.add(rec,{notes:'同步：2026-11-02 08:35'});
 ev.title='中国税制（双语）（高玉胭）';
 e.baseline([rec]);
 const term=e.state.semesters['161'];
 term.index={[rec.id]:ev.identifier};
 term.notesFormat=3;
 term.legacyMatchedCleanAt=term.lastSuccess;
 await executeDaily(e);
 a.match(e.sandbox.output,/刷新成功/);
 a.equal(e.db.length,1);
 a.equal(e.db[0].identifier,ev.identifier);
 a.equal(e.db[0].title,'中国税制（双语）');
 a.match(e.db[0].notes,/^同步：[^\n]+$/);
 a.equal(e.db[0].location,ev.location);
 a.equal(+e.db[0].startDate,+ev.startDate);
 a.equal(e.store.read().semesters['161'].events[0].teachers[0],'高玉胭');
});

test('credential status identifies legacy-only and synchronized item read-back',async()=>{
 const e=await env();
 a.equal(e.m.credentialStorageStatus(),'未保存账号密码');
 const legacy=JSON.stringify({version:1,username:'legacy',password:'placeholder'});
 e.keys.set('CourseSync.Local.v1.saved-login',legacy);
 a.match(e.m.credentialStorageStatus(),/仅检测到本机旧凭据/);
 e.m.saveCredentials('school-id','fake-password');
 a.equal(e.m.credentialStorageStatus(),'iCloud 可同步凭据已保存');
 a.doesNotMatch(e.m.credentialStorageStatus(),/其他设备|未核验/);
 a.doesNotMatch(e.m.credentialStorageStatus(),/fake-password|school-id/);
});
test('Keychain diagnostics report only the local readable state, not cross-device verification',async()=>{
 const e=await env();
 e.m.saveCredentials('student','secret');
 const report=e.m.environmentCheckText(await e.m.inspectEnvironment(e.state,e.store),e.state);
 a.match(report,/自动登录凭据：本机凭据读取正常/);
 a.doesNotMatch(report,/其他设备|云同步.*核验/);
 a.doesNotMatch(report,/secret|student/);
});
test('credential status cannot claim success for invalid stored JSON',async()=>{
 const e=await env();
 e.keys.set('CourseSync.v1.icloud-credentials','{broken');
 a.match(e.m.credentialStorageStatus(),/数据异常/);
 a.doesNotMatch(e.m.credentialStorageStatus(),/iCloud 可同步凭据已保存/);
});
test('credential status surfaces dual-key migration instead of hiding it',async()=>{
 const e=await env(),r=JSON.stringify({version:1,username:'test',password:'placeholder'});
 e.keys.set('CourseSync.Local.v1.saved-login',r);
 e.keys.set('CourseSync.v1.icloud-credentials',r);
 a.match(e.m.credentialStorageStatus(),/旧本机凭据，请检查迁移/);
});


test('v3 notes refresh after another successful unchanged-term sync',async()=>{
 const e=await env(),rec=lesson(),ev=e.add(rec);
 e.baseline([rec]);const term=e.state.semesters['161'];
 term.index={[rec.id]:ev.identifier};
 term.notesFormat=3;
 term.lastSuccess='2026-11-02T00:35:00.000Z';
 ev.notes='同步：2026-11-02 08:35';
 e.store.write(e.state);
 const original=ev.identifier;
 const beforeWrites=e.requests.filter(x=>x[0]==='save').length;
 await e.m.polishTermNotes(e.calendar,e.state,e.store,'161',()=>{});
 a.equal(e.db.length,1);
 a.equal(e.db[0].identifier,original);
 a.equal(e.db[0].title,'高等数学');
 a.equal(e.db[0].notes,'同步：2026-11-02 08:35');
 a.equal(e.requests.filter(x=>x[0]==='save').length,beforeWrites);
 term.lastSuccess='2026-11-02T01:07:00.000Z';
 e.store.write(e.state);
 await e.m.polishTermNotes(e.calendar,e.state,e.store,'161',()=>{});
 a.equal(e.db.length,1);
 a.equal(e.db[0].identifier,original);
 a.equal(e.db[0].notes,'同步：2026-11-02 09:07');
 a.equal(e.state.semesters['161'].notesFormat,3);
 a.equal(e.requests.filter(x=>x[0]==='save').length,beforeWrites+1);
});
test('no-op event save cannot falsely report a timestamp update',async()=>{
 const e=await env(),rec=lesson(),ev=e.add(rec);
 e.baseline([rec]);const term=e.state.semesters['161'];
 term.index={[rec.id]:ev.identifier};
 term.notesFormat=3;
 term.lastSuccess='2026-11-02T01:07:00.000Z';
 e.store.write(e.state);e.setDropSave(true);
 await a.rejects(()=>e.m.polishTermNotes(e.calendar,e.state,e.store,'161',()=>{}),code('CALENDAR_VERIFY'));
 a.equal(e.db[0].notes.includes('同步：2026-11-02 09:07'),false);
 a.equal(e.db.length,1);
});
test('timestamp-only refresh updates multiple course events without changing IDs',async()=>{
 const e=await env(),first=lesson(),second=lesson({id:'lesson-2',start:'2026-09-14T00:00:00.000Z',end:'2026-09-14T01:40:00.000Z',week:2});
 const a1=e.add(first),a2=e.add(second),ids=[a1.identifier,a2.identifier];
 e.baseline([first,second]);
 const term=e.state.semesters['161'];
 term.index={[first.id]:ids[0],[second.id]:ids[1]};
 term.notesFormat=3;term.lastSuccess='2026-11-02T01:07:00.000Z';e.store.write(e.state);
 await e.m.polishTermNotes(e.calendar,e.state,e.store,'161',()=>{});
 a.deepEqual(e.db.map(x=>x.identifier),ids);
 a.ok(e.db.every(x=>x.notes==='同步：2026-11-02 09:07'));
});

test('manual cancellation request only targets the exact previous lock token',async()=>{
 const e=await env(),waiter=new e.m.Store(),lockFile=e.store.path('run-lock.json');
 const before=e.files.get(lockFile);
 a.equal(waiter.requestCancelActive(),true);
 a.equal(e.files.get(lockFile),before);
 a.throws(()=>e.store.check(),code('SYNC_SUPERSEDED'));
 e.store.release();
 a.equal(e.files.has(lockFile),false);
 a.equal(e.files.has(e.store.path('run-cancel.json')),false);
 waiter.acquire();
 a.doesNotThrow(()=>waiter.check());
 waiter.release();
});
test('interrupted transaction journal is retained until next owner can recover',async()=>{
 const e=await env(),newcomer=new e.m.Store(),old=lesson();
 e.state.tx=tx([old],[]);e.store.write(e.state);
 a.equal(newcomer.requestCancelActive(),true);
 a.throws(()=>e.store.write(e.state),code('SYNC_SUPERSEDED'));
 e.store.release();
 const got=await e.m.acquireSyncSlot(newcomer,false,{backgroundWait:5,poll:1});
 a.equal(got,'acquired');
 a.equal(newcomer.read().tx.sid,'161');
 newcomer.release();
});
test('responsive sync heartbeat prevents cancel takeover even when lock was started long ago',async()=>{
 const e=await env(),lock=e.store.path('run-lock.json'),hb=e.store.path('run-heartbeat.json');
 const p=JSON.parse(e.files.get(lock));
 e.files.set(lock,JSON.stringify({...p,at:Date.now()-180000}));
 e.files.set(hb,JSON.stringify({token:p.token,at:Date.now()}));
 const waiter=new e.m.Store();
 a.equal(waiter.requestCancelActive(),true);
 a.equal(waiter.recoverStalledCancellation(1000),false);
 a.equal(JSON.parse(e.files.get(lock)).token,p.token);
 a.throws(()=>waiter.acquire(),code('BUSY'));
 e.store.release();
});
test('cancelled orphan lock may be safely reassigned after inactivity, with transaction preserved',async()=>{
 const e=await env(),lock=e.store.path('run-lock.json'),hb=e.store.path('run-heartbeat.json');
 e.state.tx=tx([lesson()],[]);e.store.write(e.state);
 const prior=JSON.parse(e.files.get(lock));
 e.files.set(lock,JSON.stringify({...prior,at:Date.now()-180000}));
 e.files.set(hb,JSON.stringify({token:prior.token,at:Date.now()-180000}));
 e.state.lastStageAt=new Date(Date.now()-180000).toISOString();
 e.store.write(e.state);
 // The write above refreshes activity, so simulate actual process suspension.
 e.files.set(hb,JSON.stringify({token:prior.token,at:Date.now()-180000}));
 const saved=e.store.read();saved.lastStageAt=new Date(Date.now()-180000).toISOString();
 const stateName=[...e.files.keys()].filter(x=>/state-\d{10}\.json$/.test(x)).sort().at(-1);
 e.files.set(stateName,JSON.stringify(saved));
 const waiter=new e.m.Store();
 a.equal(waiter.requestCancelActive(),true);
 a.equal(waiter.recoverStalledCancellation(120000),true);
 a.equal(e.files.has(lock),false);
 a.throws(()=>e.store.check(),code('LOCK_LOST'));
 waiter.acquire();
 a.equal(waiter.read().tx.sid,'161');
 a.doesNotThrow(()=>waiter.check());
 e.store.release(); // Old owner may not delete the new owner's lock.
 a.equal(e.files.has(lock),true);
 a.doesNotThrow(()=>waiter.check());
 waiter.release();
});
test('cancel request for another token cannot reclaim or delete a valid task',async()=>{
 const e=await env(),other=new e.m.Store(),cancel=e.store.path('run-cancel.json'),lock=e.store.path('run-lock.json');
 const owner=JSON.parse(e.files.get(lock));
 e.files.set(cancel,JSON.stringify({token:'unrelated-owner',at:Date.now()}));
 a.equal(other.recoverStalledCancellation(1),false);
 a.equal(JSON.parse(e.files.get(lock)).token,owner.token);
 e.store.release();
});
test('cancelling a suspended task resumes through ordinary lock acquisition',async()=>{
 const e=await env(),old=e.store.path('run-lock.json'),hb=e.store.path('run-heartbeat.json');
 const lock=JSON.parse(e.files.get(old));
 e.files.set(old,JSON.stringify({...lock,at:Date.now()-180000}));
 e.files.set(hb,JSON.stringify({token:lock.token,at:Date.now()-180000}));
 e.sandbox.__sdk.Dialog.actionSheet=async()=>1;
 const waiter=new e.m.Store();
 const result=await e.m.acquireSyncSlot(waiter,true,{foregroundWait:100,poll:1});
 a.equal(result,'acquired');
 a.notEqual(JSON.parse(e.files.get(old)).token,lock.token);
 a.doesNotThrow(()=>waiter.check());
 waiter.release();
});
test('nonmatching and stale cancellation tokens cannot terminate a new owner',async()=>{
 const e=await env(),lock=e.store.path('run-lock.json'),cancel=e.store.path('run-cancel.json');
 const token=JSON.parse(e.files.get(lock)).token;
 e.files.set(cancel,JSON.stringify({token:'other-task',at:Date.now()}));
 a.doesNotThrow(()=>e.store.check());
 e.store.release();
 e.files.set(cancel,JSON.stringify({token,at:Date.now()}));
 const next=new e.m.Store();next.acquire();
 a.doesNotThrow(()=>next.check());
 a.equal(e.files.has(cancel),false);
 next.release();
});
test('foreground conflict offers a wait-or-cancel choice only on contention',async()=>{
 const e=await env(),seen=[];
 e.sandbox.__sdk.Dialog.actionSheet=async o=>{seen.push(o);return 1;};
 const second=new e.m.Store();
 const result=await e.m.acquireSyncSlot(second,true,{foregroundWait:1,poll:2});
 a.equal(result,'still-running');
 a.equal(seen.length,1);
 a.deepEqual(Array.from(seen[0].actions,x=>x.label),['等待完成','取消前次任务并刷新']);
 a.throws(()=>e.store.check(),code('SYNC_SUPERSEDED'));
 e.store.release();
});
test('waiting task acquires lock only after original run releases it',async()=>{
 const e=await env(),second=new e.m.Store();
 setTimeout(()=>e.store.release(),5);
 const status=await e.m.acquireSyncSlot(second,false,{backgroundWait:150,poll:10});
 a.equal(status,'acquired');
 a.doesNotThrow(()=>second.check());
 second.release();
});

test('no recovery buttons are offered for successful runs or ordinary network failure',async()=>{
 const e=await env();
 a.equal(e.m.availableRecovery(null,e.state,e.store),null);
 a.equal(e.m.availableRecovery('NETWORK',e.state,e.store),null);
 a.equal(e.m.availableRecovery('LOGIN_SCHEMA',e.state,e.store),null);
});
test('a malformed Cookie storage error offers only local session reset',async()=>{
 const e=await env();
 const r=e.m.availableRecovery('COOKIE_STORAGE',e.state,e.store);
 a.equal(r.kind,'cookie');a.equal(r.label,'清除异常 Cookie');
 e.keys.set('CourseSync.Local.v1.cookies','local-bad-cookie');
 e.keys.set('CourseSync.v1.icloud-credentials',JSON.stringify({version:1,username:'sample',password:'fake'}));
 e.state.authPaused=true;e.state.lastError='COOKIE_STORAGE';
 e.store.write(e.state);e.sandbox.__sdk.Dialog.alert=async()=>{};
 await e.m.applyRecovery('cookie',e.state,e.store);
 a.equal(e.keys.has('CourseSync.Local.v1.cookies'),false);
 a.equal(e.keys.has('CourseSync.v1.icloud-credentials'),true);
 a.equal(e.state.authPaused,false);
 a.equal(e.state.lastError,null);
});
test('status offers self-check with recovery only on a matching failure and never offers detailed logs',async()=>{
 const e=await env(),confirms=[],alerts=[];
 e.sandbox.__sdk.Dialog.confirm=async o=>{confirms.push(o);return true;};
 e.sandbox.__sdk.Dialog.alert=async o=>{alerts.push(o);};
 e.state.lastError='COOKIE_STORAGE';e.state.runStatus='failed';
 a.equal(await e.m.showRunStatus(e.state,e.store),'cookie');
 a.deepEqual(confirms.slice(0,2).map(o=>o.confirmLabel),['环境自检','清除异常 Cookie']);
 a.doesNotMatch(confirms[0].message,/连续失败：|最近步骤|详细运行记录/);
 a.doesNotMatch(confirms[1].message,/详细运行记录/);
 e.state.runStatus='success';
 a.equal(await e.m.showRunStatus(e.state,e.store),null);
 a.equal(confirms.length,3); // Only the overview prompt; no recovery on success.
 a.equal(alerts.length,1);
 a.equal(alerts[0].title,'环境自检');
 a.doesNotMatch(alerts[0].message,/详细运行记录/);
});

test('environment inspection only reads existing local state and never mutates data',async()=>{
 const e=await env();
 const oldKeys=JSON.stringify([...e.keys]),oldFiles=JSON.stringify([...e.files]),oldEvents=e.db.length;
 const results=await e.m.inspectEnvironment(e.state,e.store);
 a.ok(results.length>=7);
 a.equal(results.find(x=>x.name==='本地状态').level,'正常');
 a.equal(results.find(x=>x.name==='目标日历').level,'正常');
 a.equal(results.find(x=>x.name==='学校连接').level,'待确认');
 a.match(e.m.environmentCheckText(results,e.state),/只读检查/);
 a.equal(JSON.stringify([...e.keys]),oldKeys);
 a.equal(JSON.stringify([...e.files]),oldFiles);
 a.equal(e.db.length,oldEvents);
 a.equal(e.requests.length,0);
});
test('live school session probe verifies authentication using existing cookies',async()=>{
 const e=await env(),seen=[];
 e.keys.set('CourseSync.Local.v1.cookies',JSON.stringify([{name:'SESSION',value:'local-test-cookie',domain:'jwxt.nufe.edu.cn',hostOnly:true,path:'/',expires:0}]));
 e.sandbox.fetchImpl=async(url,options)=>{
   seen.push({url,options});
   return {status:200,headers:new Map(),cookies:[],mimeType:'text/html',
     text:async()=>'<html>var personId=100;var currentSemester={"id":161};</html>'};
 };
 const checks=await e.m.inspectEnvironment(e.state,e.store);
 const auth=checks.find(x=>x.name==='登录会话');
 a.equal(auth.level,'正常');a.match(auth.detail,/刚刚使用本机 Cookie 验证成功/);
 a.equal(seen.length,1);a.ok(seen[0].options.headers.Cookie.includes('SESSION=local-test-cookie'));
 a.equal(seen[0].options.method,'GET');a.equal(seen[0].options.body,undefined);
 a.equal(e.keys.has('CourseSync.Local.v1.cookies'),true);
 a.equal(e.state.runStatus,undefined);
});
test('login-required redirect is classified as expired instead of successful',async()=>{
 const e=await env();
 e.sandbox.fetchImpl=async(url,options)=>{
   if(options.handleRedirect)await options.handleRedirect({url:'https://authserver.nufe.edu.cn/authserver/login'});
   throw Error('redirect intercepted');
 };
 const checks=await e.m.inspectEnvironment(e.state,e.store);
 a.equal(checks.find(x=>x.name==='登录会话').level,'注意');
 a.match(checks.find(x=>x.name==='登录会话').detail,/重新认证/);
});
test('unclassifiable page remains unverified even with HTTP 200',async()=>{
 const e=await env();
 e.sandbox.fetchImpl=async()=>({status:200,headers:new Map(),cookies:[],mimeType:'text/html',text:async()=>'<html>hello</html>'});
 const checks=await e.m.inspectEnvironment(e.state,e.store);
 a.equal(checks.find(x=>x.name==='登录会话').level,'待确认');
 a.equal(checks.find(x=>x.name==='学校连接').level,'正常');
});
test('authentication probe never submits a stored password or follows untrusted URLs',async()=>{
 const e=await env();
 e.keys.set('CourseSync.v1.icloud-credentials',JSON.stringify({version:1,username:'student',password:'SECRET'}));
 const seen=[];
 e.sandbox.fetchImpl=async(url,options)=>{
   seen.push({url,options});
   if(options.handleRedirect)await options.handleRedirect({url:'https://external.invalid/login'});
   throw Error('redirect intercepted');
 };
 const checks=await e.m.inspectEnvironment(e.state,e.store);
 a.equal(checks.find(x=>x.name==='登录会话').level,'待确认');
 a.equal(seen.length,1);
 a.ok(!JSON.stringify(seen[0]).includes('SECRET'));
 a.equal(e.keys.has('CourseSync.v1.icloud-credentials'),true);
});
test('self-check distinguishes an inaccessible original calendar from a healthy one',async()=>{
 const e=await env();
 e.sandbox.__sdk.Calendar.forEvents=async()=>[e.other];
 const checks=await e.m.inspectEnvironment(e.state,e.store);
 a.equal(checks.find(x=>x.name==='目标日历').level,'注意');
 a.match(checks.find(x=>x.name==='目标日历').detail,/原日历当前不可见/);
 a.equal(e.state.calendarId,e.calendar.identifier);
});
test('self-check flags pending transactions and does not clear their journal',async()=>{
 const e=await env(),t=tx([],[lesson()]);
 e.state.tx=t;e.store.write(e.state);
 const before=e.files.get(e.store.path('run-lock.json'));
 const checks=await e.m.inspectEnvironment(e.state,e.store);
 a.equal(checks.find(x=>x.name==='同步任务').level,'待确认'); // valid ownership is never assumed stale
 a.equal(e.state.tx,t);
 a.equal(e.files.get(e.store.path('run-lock.json')),before);
 a.match(e.m.statusText(e.state),/需要恢复上次写入/);
});
test('live school connectivity probe uses stored session Cookie but never saved password',async()=>{
 const e=await env(),seen=[];
 e.keys.set('CourseSync.Local.v1.cookies',JSON.stringify([{name:'SESSION',value:'secret',domain:'jwxt.nufe.edu.cn',path:'/',expires:0}]));
 e.sandbox.fetchImpl=async(url,options)=>{seen.push({url,options});return {status:200,headers:new Map(),cookies:[],mimeType:'text/html',text:async()=>'<html>safe</html>'};};
 const checks=await e.m.inspectEnvironment(e.state,e.store);
 a.equal(checks.find(x=>x.name==='学校连接').level,'正常');
 a.equal(seen.length,1);
 a.match(seen[0].url,/^https:\/\/jwxt\.nufe\.edu\.cn\//);
 a.ok(seen[0].options.headers?.Cookie?.includes('SESSION=secret'));
 a.ok(!seen[0].options.body);
 a.ok(!JSON.stringify(seen[0].options).includes('password'));
 a.equal(e.keys.has('CourseSync.Local.v1.cookies'),true);
});
test('self-check failure report includes actionable error code without secrets',async()=>{
 const e=await env();e.state.runStatus='failed';e.state.lastError='NETWORK_DNS';
 const report=e.m.environmentCheckText(await e.m.inspectEnvironment(e.state,e.store),e.state);
 a.match(report,/NETWORK_DNS/);
 a.match(report,/检查 DNS/);
 a.doesNotMatch(report,/Cookie=|password=|学号\s*\d+/i);
});
test('invalid lock recovery cannot clear a live valid lock',async()=>{
 const e=await env(),path=e.store.path('run-lock.json'),before=e.files.get(path);
 e.sandbox.__sdk.Dialog.alert=async()=>{};
 e.sandbox.__sdk.Dialog.confirm=async()=>{throw Error('should not ask to clear active lock');};
 await e.m.applyRecovery('lock',e.state,e.store);
 a.equal(e.files.get(path),before);
});
test('recovery backup option appears only when the matching backup exists',async()=>{
 const e=await env();
 e.state.lastSyncBackupName='known.json';
 a.equal(e.m.availableRecovery('CALENDAR_VERIFY',e.state,e.store),null);
 e.files.set(e.store.path('known.json'),'{}');
 a.equal(e.m.availableRecovery('CALENDAR_VERIFY',e.state,e.store).kind,'backup');
 a.equal(e.m.availableRecovery('NETWORK',e.state,e.store),null);
});

test('offline agenda excludes ended lessons and deduplicates cached semesters',async()=>{
 const e=await env();
 const upcoming={title:'课程甲',start:'2026-11-10T00:00:00.000Z',end:'2026-11-10T02:00:00.000Z',location:'教室'};
 const old={...upcoming,title:'旧课',start:'2026-11-08T00:00:00.000Z',end:'2026-11-08T02:00:00.000Z'};
 const result=e.m.offlineAgenda({semesters:{a:{events:[old,upcoming]},b:{events:[upcoming]}}},Date.parse('2026-11-09T00:00:00Z'));
 a.equal(result.split('课程甲').length-1,1);a.ok(!result.includes('旧课'));a.match(result,/08:00–10:00/);
});

test('NUFE free classroom query prioritizes Boyuan > Boguan > Bowen and lowest floor',async()=>{
 const e=await env();
 const http={
   json:async(url,opt)=>{
     a.match(url,/ws\/room-borrow\/free-list/);
     return {
       roomList:[
         {id:1,nameZh:'德经楼Z1-205',building:{nameZh:'德经楼'},floor:2},
         {id:2,nameZh:'博文楼JA414',building:{nameZh:'博文楼'},floor:4},
         {id:3,nameZh:'博文楼JA105',building:{nameZh:'博文楼'},floor:1},
         {id:4,nameZh:'博观楼JB202',building:{nameZh:'博观楼'},floor:2},
         {id:5,nameZh:'博观楼JB101',building:{nameZh:'博观楼'},floor:1},
         {id:6,nameZh:'博远楼JC203',building:{nameZh:'博远楼'},floor:2},
         {id:7,nameZh:'博远楼JC101',building:{nameZh:'博远楼'},floor:1}
       ]
     };
   }
 };
 const rooms=await e.m.queryFreeRoomsForPeriod(http,'2026-11-16',['1','2','3','4']);
 a.deepEqual(rooms.map(r=>r.nameZh),[
   '博远楼JC101',
   '博远楼JC203',
   '博观楼JB101',
   '博观楼JB202',
   '博文楼JA105',
   '博文楼JA414'
 ]);
});

test('room recommendations preserve every ranked room and only combine continuous periods',async()=>{
 const {m}=await env();
 const a1={id:1,nameZh:'博远楼JC101'},a2={id:2,nameZh:'博远楼JC203'},b={id:3,nameZh:'博观楼JB105'};
 const describe=rows=>Array.from(rows,({period,room})=>period+'：'+room);
 a.deepEqual(describe(m.resolveDayRooms([a1,a2],[a1,a2],[a1,b])),[
  '建议教室：全天：博远楼JC101','上午：博远楼JC101、博远楼JC203',
  '下午：博远楼JC101、博远楼JC203','晚上：博远楼JC101、博观楼JB105']);
 a.equal(m.resolveDayRooms([a1],[a1,a2],[b])[0].room,'白天：博远楼JC101\n晚上：博观楼JB105');
 a.equal(m.resolveDayRooms([a1],[a2],[a2,b])[0].room,'上午：博远楼JC101\n下午至晚上：博远楼JC203');
 a.equal(m.resolveDayRooms([a1],[a2],[b])[0].room,'上午：博远楼JC101\n下午：博远楼JC203\n晚上：博观楼JB105');
});

test('NUFE free classroom query only requests today in China time and merges periods without modifying calendar',async()=>{
 const e=await env();
 const dbCountBefore=e.db.length;
 const requestedSegments=[];
 const http={
   get:async(url)=>({url:'https://jwxt.nufe.edu.cn/student/for-std/course-table',text:'var personId=100;var currentSemester={"id":161};<select id="allSemesters"><option value="161">2026-2027-1</option></select>'}),
   json:async(url,{body})=>{
     const p=JSON.parse(body);
     requestedSegments.push(p.dateTimeSegmentCmd);
     const units=p.dateTimeSegmentCmd.units;
       // 今天：上午、下午为同一个博远楼JC101，晚上为博远楼JC403 -> 合并为白天+晚上
       if(units.includes('1'))return {roomList:[{id:101,nameZh:'博远楼JC101',building:{nameZh:'博远楼'},floor:1}]};
       if(units.includes('6'))return {roomList:[{id:101,nameZh:'博远楼JC101',building:{nameZh:'博远楼'},floor:1}]};
       return {roomList:[{id:403,nameZh:'博远楼JC403',building:{nameZh:'博远楼'},floor:4}]};
   }
 };
 const progress=[];
 const result=await e.m.queryFreeRoomsToday(http,()=>{},value=>progress.push(value),Date.parse('2026-11-15T16:30:00Z'));
 a.deepEqual(progress,[0.25,1]);
 a.equal(result.date,'2026-11-16');
 a.deepEqual(JSON.parse(JSON.stringify(result.rooms)),[
   {period:'建议教室',room:'白天：博远楼JC101\n晚上：博远楼JC403'},
   {period:'上午',room:'博远楼JC101'},
   {period:'下午',room:'博远楼JC101'},
   {period:'晚上',room:'博远楼JC403'}
 ]);
 a.equal(requestedSegments.length,3);
 for(const segment of requestedSegments){
   a.equal(segment.startDateTime,'2026-11-16');
   a.equal(segment.endDateTime,'2026-11-16');
 }
 a.equal(e.db.length,dbCountBefore);
});

test('NUFE dashboard loads classroom rows and retryable failures without extra dialogs or calendar sync',async()=>{
 const e=await env({hostEnv:'index'});
 e.keys.set('CourseSync.Local.v1.cookies','[]');
 e.store.write(e.state);
 e.store.release();
 const dbCountBefore=e.db.length;
 const shownDialogs=[];
 e.sandbox.__sdk.Dialog.actionSheet=async opts=>{shownDialogs.push(opts);return -1;};
 e.sandbox.__sdk.Dialog.alert=async opts=>{shownDialogs.push(opts);};
 e.sandbox.__sdk.Navigation={present:async()=>null};
 const progress=[];
 let results, failure, cancelled, roomRequests=0, offline=false;
 e.sandbox.__nativeDashboardMock=async opts=>{
   a.equal(typeof opts.loadFreeRooms,'function');
   results=await opts.loadFreeRooms(()=>true,value=>progress.push(value));
   offline=true;
   failure=await opts.loadFreeRooms(()=>true);
   cancelled=await opts.loadFreeRooms(()=>false);
   return 'dismiss';
 };
 e.sandbox.fetchImpl=async(url,options)=>{
   if(url.includes('free-list')){
     roomRequests++;
     if(offline)throw Error('offline');
     return {
       status:200,headers:new Map(),cookies:[],mimeType:'application/json',
       text:async()=>JSON.stringify({roomList:[{id:101,nameZh:'博远楼JC101',building:{nameZh:'博远楼'},floor:1}]})
     };
   }
   return {
     status:200,headers:new Map(),cookies:[],mimeType:'text/html',
     text:async()=>'var personId=100;var currentSemester={"id":161};<select id="allSemesters"><option value="161">2026-2027-1</option></select>'
   };
 };
 await e.m.run();
 a.equal(results.kind,'ready');
 a.deepEqual(progress,[0.25,1]);
 a.equal(results.rooms[0].room,'全天：博远楼JC101');
 a.equal(results.rooms.length,4);
 a.equal(failure.kind,'error');
 a.match(failure.message,/查询失败/);
 a.match(cancelled.message,/已取消/);
 a.equal(roomRequests,6);
 a.deepEqual(shownDialogs,[]);
 a.equal(e.db.length,dbCountBefore);
});

test('widgetCacheProjection includes synced exams alongside courses',async()=>{
 const e=await env();
 const now=Date.UTC(2026,10,20,0,0);
 const courseStart='2026-11-21T00:00:00.000Z',courseEnd='2026-11-21T01:40:00.000Z';
 const examStart='2026-11-25T01:00:00.000Z',examEnd='2026-11-25T03:00:00.000Z';
 e.state.lastCheck='2026-11-20T00:00:00.000Z';
 e.state.semesters['161']={events:[lesson({start:courseStart,end:courseEnd})]};
 e.state.exams=[{id:'exam-1',title:'📝 线性代数',start:examStart,end:examEnd,location:'博远楼 202'}];
 const payload=e.m.widgetCacheProjection(e.state,now);
 a.ok(payload);
 a.equal(payload.events.length,2);
 a.ok(payload.events.some(ev=>ev.title==='（考试）线性代数'&&ev.location==='博远楼 202'));
});

test('glass dialog preserves selected action, cancellation and input without invoking system dialog',async()=>{
 const e=await env({mode:'menu',hostEnv:'index'}), calls=[];
 e.sandbox.__nativeDialogMock=async options=>{calls.push(options);return {index:1,value:'My Calendar'};};
 e.sandbox.__sdk.Dialog.actionSheet=async()=>{throw Error('unexpected system dialog');};
 const dialog=new e.m.ScriptingAdapter.Alert();
 dialog.title='选择'; dialog.addAction('第一项');dialog.addDestructiveAction('第二项');dialog.addCancelAction('取消');
 a.equal(await dialog.presentSheet(),1);
 a.equal(calls[0].actions[1].destructive,true);
 a.equal(calls[0].cancelLabel,'取消');
 const prompt=new e.m.ScriptingAdapter.Alert();prompt.addTextField('名称','CourseSync');prompt.addAction('保存');prompt.addCancelAction('取消');
 e.sandbox.__nativeDialogMock=async()=>({index:0,value:'My Calendar'});
 a.equal(await prompt.presentAlert(),0);a.equal(prompt.textFieldValue(0),'My Calendar');
 e.sandbox.__nativeDialogMock=async()=>null;
 a.equal(await prompt.presentAlert(),-1);
});

test('type-error diagnostics report only safe local source coordinates',async()=>{
 const {m}=await env();
 const error=new TypeError('secret-password');error.stack='TypeError: secret-password\n at f (/secret-user/private/index.tsx:123:45)';
 const report=m.errorMessage(error,{lastStage:'保存同步结果'});
 a.match(report,/代码位置：index 123:45/);
 a.doesNotMatch(report,/secret-password|secret-user|private/);
});

test('dashboard errors are not attributed to the previous run exam stage',async()=>{
 const e=await env({hostEnv:'index'}), alerts=[];
 e.state.lastStage='更新考试日程';
 e.sandbox.__sdk.Navigation={present:async()=>null};
 e.sandbox.__nativeDashboardMock=async()=>{throw new TypeError('fixture');};
 e.sandbox.__sdk.Dialog.alert=async options=>alerts.push(options);
 await executeDaily(e);
 a.equal(alerts.length,1);
 a.match(alerts[0].message,/阶段：打开主菜单/);
 a.doesNotMatch(alerts[0].message,/阶段：更新考试日程/);
});

test('classroom fallback finds the longest consecutive free lessons without relaxing full-period lists',async()=>{
 const {m}=await env();const called=[];
 const room={id:11,nameZh:'博远楼JC101',building:{nameZh:'博远楼'},floor:1};
 const http={json:async(_url,{body})=>{
   const units=JSON.parse(body).dateTimeSegmentCmd.units;called.push(units.join(','));
   return {roomList:units.includes('10')?[]:[room]};
 }};
 const rows=await m.queryDayRooms(http,'2026-11-23');
 for(const segment of ['1,2,3,4,5','6,7,8,9,10','11,12,13','6','7','8','9','10'])a.ok(called.includes(segment));
 a.equal(rows[2].period,'下午');a.match(rows[2].room,/无完整时段/);
 a.match(rows[0].room,/上午：博远楼JC101（第1—5节）/);
 a.match(rows[0].room,/下午：博远楼JC101（第6—9节）/);
 a.match(rows[0].room,/晚上：博远楼JC101（第11—13节）/);
});

test('classroom fallback preserves daytime continuity and adds the available evening lessons',async()=>{
 const {m}=await env();
 const day={id:1,nameZh:'博远楼JC101',building:{nameZh:'博远楼'},floor:1};
 const night={id:2,nameZh:'博观楼JB201',building:{nameZh:'博观楼'},floor:2};
 const http={json:async(_url,{body})=>{
   const units=JSON.parse(body).dateTimeSegmentCmd.units;
   return {roomList:units.length>1?(units[0]==='11'?[]:[day]):(['11','12'].includes(units[0])?[night]:[])};
 }};
 const rows=await m.queryDayRooms(http,'2026-11-23');
 a.equal(rows[0].room,'白天：博远楼JC101（第1—10节）\n晚上：博观楼JB201（第11—12节）');
 a.equal(rows[1].room,'博远楼JC101');a.equal(rows[2].room,'博远楼JC101');
 a.match(rows[3].room,/无完整时段/);
});

test('classroom fallback preserves afternoon-evening continuity and adds morning lessons',async()=>{
 const {m}=await env();
 const shared={id:1,nameZh:'博远楼JC101',building:{nameZh:'博远楼'},floor:1};
 const morning={id:2,nameZh:'博观楼JB201',building:{nameZh:'博观楼'},floor:2};
 const http={json:async(_url,{body})=>{
   const units=JSON.parse(body).dateTimeSegmentCmd.units;
   return {roomList:units.length>1?(units[0]==='1'?[]:[shared]):(['2','3','4'].includes(units[0])?[morning]:[])};
 }};
 const rows=await m.queryDayRooms(http,'2026-11-23');
 a.equal(rows[0].room,'上午：博观楼JB201（第2—4节）\n下午至晚上：博远楼JC101（第6—13节）');
 a.match(rows[1].room,/无完整时段/);a.equal(rows[2].room,'博远楼JC101');a.equal(rows[3].room,'博远楼JC101');
});

test('no free lessons is reported honestly and a failed individual query is not treated as empty',async()=>{
 const {m}=await env();
 let mode='empty';
 const http={json:async(_url,{body})=>{
   const units=JSON.parse(body).dateTimeSegmentCmd.units;
   if(mode==='fail'&&units.length===1&&units[0]==='7')throw Error('network');
   return {roomList:[]};
 }};
 const rows=await m.queryDayRooms(http,'2026-11-23');
 for(const label of ['上午','下午','晚上'])a.match(rows[0].room,new RegExp(label+'：无可用教室'));
 mode='fail';await a.rejects(()=>m.queryDayRooms(http,'2026-11-23'),/network/);
});

test('fallback prefers longest contiguous block then building priority and ignores gaps',async()=>{
 const {m}=await env();
 const preferred={id:1,nameZh:'博远楼JC101',building:{nameZh:'博远楼'},floor:1};
 const longer={id:2,nameZh:'博观楼JB101',building:{nameZh:'博观楼'},floor:1};
 const http={json:async(_url,{body})=>{
   const units=JSON.parse(body).dateTimeSegmentCmd.units;
   if(units.length>1)return {roomList:[]};
   const n=Number(units[0]);
   return {roomList:[...(n===1||n===3?[preferred]:[]),...(n>=2&&n<=4?[longer]:[])]};
 }};
 const rows=await m.queryDayRooms(http,'2026-11-23');
 a.match(rows[0].room,/上午：博观楼JB101（第2—4节）/);
 a.match(rows[0].room,/下午：无可用教室/);a.match(rows[0].room,/晚上：无可用教室/);
});
