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
 const files=new Map(),keys=new Map(),db=[],notices=[],requests=[];let serial=0,failSave=false,dropSave=false,failRemove=false,noRemove=false,seriesMode=false;
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
 const sdk={Script:nativeScript,Intent:{text:x=>x},FileManager:{appGroupDocumentsDirectory:'/local',existsSync:fm.fileExists,createDirectorySync:fm.createDirectory,readDirectorySync:fm.listContents,readAsStringSync:fm.readString,writeAsStringSync:fm.writeString,removeSync:fm.remove,renameSync:fm.move},Keychain:{contains:k=>keys.has(k),get:k=>keys.get(k)??null,set:(k,v)=>{keys.set(k,v);return true;},remove:k=>{keys.delete(k);return true;}},UUID:sandbox.UUID,CalendarEvent:Event,Calendar:{forEvents:async()=>[calendar,other],presentChooser:async()=>[calendar]},Notification:{schedule:async o=>{notices.push(o);return 'notice-'+notices.length;},getAllPendingsOfCurrentScript:async()=>[],removePendings:async()=>{}},Dialog:{actionSheet:async opts=>{const alert=new sandbox.Alert();alert.title=opts.title;alert.message=opts.message;for(const x of opts.actions)alert.addAction(x.label);if(opts.cancelButton)alert.addCancelAction('取消');return alert.presentSheet();},alert:async opts=>{const alert=new sandbox.Alert();alert.title=opts.title;alert.message=opts.message;alert.addAction('好');return alert.presentAlert();},confirm:async()=>{throw Error('UNEXPECTED CONFIRM');},prompt:async()=>{throw Error('UNEXPECTED PROMPT');}},fetch:async(...args)=>{if(sandbox.fetchImpl)return sandbox.fetchImpl(...args);throw Error('NETWORK NOT MOCKED');}};
 sandbox.__sdk=sdk;sandbox.__COURSESYNC_TEST__=true;sandbox.setTimeout=setTimeout;sandbox.clearTimeout=clearTimeout;sandbox.setInterval=setInterval;sandbox.clearInterval=clearInterval;sandbox.crypto=crypto.webcrypto;
 await vm.runInNewContext('(async()=>{'+source+'\nawait launchCourseSync(); globalThis.__testLaunch=launchCourseSync;})()',sandbox);
 sandbox.config=sandbox.module.exports.ScriptingAdapter.config;sandbox.args=sandbox.module.exports.ScriptingAdapter.args;
 const m=sandbox.module.exports,store=new m.Store();store.acquire();
 const state={version:1,owner:'installation-owner',calendarId:calendar.identifier,anchors:{'161':'2026-09-07'},semesters:{},minutes:0,failures:0};
 function add(rec,{owner=state.owner,cal=calendar,id,notes,offset=0,allDay=false}={}){const e=new Event();e.identifier=id||'event-'+(++serial);e.calendar=cal;e.title=rec.title;e.location=rec.location;e.notes=notes===undefined?m.notes(rec,owner,'2026-11-01T00:00:00Z'):notes;e.startDate=new Date(Date.parse(rec.start)+offset);e.endDate=new Date(Date.parse(rec.end)+offset);e.isAllDay=allDay;db.push(e);return e;}
 function baseline(events){state.semesters['161']={events,index:{},anchor:'2026-09-07',name:'2026-2027-1',lastSuccess:'2026-11-01T00:00:00Z'};return state;}
 return {m,sandbox,store,state,db,files,keys,notices,requests,calendar,other,add,baseline,Event,setSaveFailure:v=>failSave=v,setDropSave:v=>dropSave=v,setRemoveFailure:v=>failRemove=v,setNoRemove:v=>noRemove=v,setSeries:v=>seriesMode=v};
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
test('foreground progress batches disk checkpoints while retaining every diagnostic stage',async()=>{
 const e=await env({hostEnv:'index'});
 let now=Date.now(),writes=0;
 e.sandbox.Date=class extends Date{static now(){return now;}};
 const write=e.store.write.bind(e.store);
 e.store.write=state=>{writes++;return write(state);};
 const progress=e.m.createProgress(e.state,e.store,true);
 for(let i=1;i<=12;i++){
   progress('阶段 '+i);
   now+=300;
 }
 a.equal(writes,1);
 a.equal(e.state.lastStage,'阶段 12');
 a.equal(e.state.stageHistory.length,12);
 now+=1500;
 progress('开始核验');
 a.equal(writes,2);
 a.equal(e.store.read().lastStage,'开始核验');
 a.equal(e.store.read().stageHistory.length,13);
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

test('school selection restricts requests to the fixed NUFE school',async()=>{
  const {m}=await env();
  a.equal(m.NUFE_SCHOOL.name,'南京财经大学');
  a.equal(m.NUFE_SCHOOL.id,'nufe');
  a.equal(m.schoolById('nufe').endpoints.table,m.ENDPOINT_DEFAULTS.table);
  a.equal(m.schoolById('unverified-university'),null);
  a.throws(()=>m.activateSelectedSchool('unverified-university'),code('SCHOOL_UNSUPPORTED'));
  a.equal(m.safeURL('https://jwxt.nufe.edu.cn/').host,'jwxt.nufe.edu.cn');
  a.throws(()=>m.safeURL('https://other.edu.cn/'),code('DOMAIN_BLOCKED'));
  a.throws(()=>m.safeURL('http://jwxt.nufe.edu.cn/'),code('DOMAIN_BLOCKED'));
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
test('exam reconciliation leaves a verified course untouched when an old exam index points to it',async()=>{
 const e=await env(),record=lesson(),course=e.add(record,{notes:''});
 e.baseline([record]);
 e.state.semesters['161'].index={[record.id]:course.identifier};
 const start=Date.parse(record.start);
 e.state.examIndex={[course.identifier]:'[COURSESYNC_EXAM '+e.state.owner+'] '+JSON.stringify([record.title,'期末',start])};
 const http={get:async()=>({url:'https://jwxt.nufe.edu.cn/student/for-std/exam-arrange',text:
   '<table id="exams"><tr data-finished="false"><td><div class="time">2026-09-07 08:00~09:40</div></td><td><div>高等数学</div><div>期末</div></td><td>未结束</td></tr></table>'})};
 await e.m.syncExams(http,e.state,e.store,e.calendar,()=>{},start-86400000);
 a.equal(e.db.find(event=>event.identifier===course.identifier).title,record.title);
 a.equal(e.requests.some(([,id])=>id===course.identifier),false);
 a.deepEqual(e.db.map(event=>event.title).sort(),['（考试）高等数学',record.title].sort());
});
test('an exam that becomes detached on save is not recorded as verified',async()=>{
 const e=await env();
 const now=Date.parse('2026-11-16T00:00:00Z');
 const url='https://jwxt.nufe.edu.cn/student/for-std/exam-arrange';
 const row='<tr data-finished="false"><td><div class="time">2026-12-18 09:00~11:00</div></td>'+
   '<td><div>线性代数</div><div>期末</div></td><td>未结束</td></tr>';
 const save=e.Event.prototype.save;
 e.Event.prototype.save=async function(){
   this.isDetached=true;
   return save.call(this);
 };
 await a.rejects(()=>e.m.syncExams({get:async()=>({url,text:'<table id="exams">'+row+'</table>'})},
   e.state,e.store,e.calendar,()=>{},now),code('MANAGED_SERIES'));
 a.equal(e.state.exams,undefined);
 a.equal(e.state.examIndex,undefined);
 a.equal(e.db.length,1);
 a.match(e.db[0].notes,/^\[COURSESYNC_EXAM /);
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
test('manual refresh reports success in the unlocked dashboard and reuses verified schedules',async()=>{
 const e=await env({hostEnv:'index'}),seen=[];
 e.keys.set('CourseSync.Local.v1.school-choice','nufe');
 e.keys.set('CourseSync.Local.v1.cookies','[]');
 e.sandbox.__sdk.Navigation={present:async()=>null};
 e.sandbox.__nativeDashboardMock=async({state})=>{
   a.equal(e.store.fm.fileExists(e.store.path('run-lock.json')),false);
   seen.push(state.runStatus);
   return seen.length%2===1?0:'dismiss';
 };
 loggedIn(e,raw([activity({weekIndexes:[1]})]));
 await executeDaily(e);
 const snapshots=()=>[...e.files.keys()].filter(path=>path.includes('同步前快照-'));
 a.equal(snapshots().length,1);
 const original=e.db[0].identifier;
 e.db[0].notes='手动修改的课程备注';
 await e.m.run();
 a.deepEqual(seen,[undefined,'success','success','success']);
 a.equal(snapshots().length,1);
 a.equal(e.db[0].identifier,original);
 a.equal(e.db[0].notes,'');
});
test('the dashboard explains an incomplete refresh or pending calendar recovery',async()=>{
 const e=await env({hostEnv:'index'});
 e.sandbox.__sdk.Navigation={present:async()=>null};
 const messages=[];
 e.sandbox.__nativeDashboardMock=async({statusMessage})=>{
   messages.push(statusMessage);
   return 'dismiss';
 };
 e.state.runStatus='partial';
 e.state.lastExamError='EXAM_SCHEMA';
 await executeDaily(e);
 a.match(messages[0],/考试日程未更新完成.*EXAM_SCHEMA/);
 e.store.acquire();
 const state=e.store.read();
 state.tx=tx([],[]);
 e.store.write(state);
 e.store.release();
 await e.m.run();
 a.match(messages[1],/日历写入待恢复/);
});
test('account and classroom actions are available without a calendar binding',async()=>{
 const e=await env({hostEnv:'index'});
 e.state.calendarId=null;
 e.keys.set('CourseSync.Local.v1.cookies','[]');
 e.sandbox.__sdk.Navigation={present:async()=>null};
 let dashboard;
 e.sandbox.__nativeDashboardMock=async options=>{dashboard=options;return 'dismiss';};
 e.sandbox.__sdk.Calendar.forEvents=async()=>{throw new Error('no calendar access');};
 await executeDaily(e);
 a.equal(dashboard.state.calendarId,null);
 a.equal(dashboard.canSignOut,true);
 a.equal(typeof dashboard.loadFreeRooms,'function');
 a.equal(e.requests.length,0);
});
test('a failed diagnostic checkpoint does not interrupt a foreground refresh',async()=>{
 const e=await env({hostEnv:'index'});
 loggedIn(e,raw([activity({weekIndexes:[1]})]));
 const write=e.store.write.bind(e.store);
 const initialStage='尝试读取教务课表入口';
 let failed=false;
 e.store.write=state=>{
   if(!failed&&state.lastStage===initialStage){failed=true;throw new Error('diagnostics unavailable');}
   return write(state);
 };
 await e.m.synchronize(e.state,e.store,e.calendar,true);
 a.equal(failed,true);
 a.equal(e.store.read().tx,null);
 a.equal(e.db.length,1);
});
test('cancelling a busy refresh or logout returns to the dashboard',async()=>{
 for(const action of [0,1]){
   const e=await env({hostEnv:'index'});
   e.keys.set('CourseSync.Local.v1.cookies','[]');
   e.store.write(e.state);
   if(action===1)e.store.release();
   e.sandbox.__sdk.Navigation={present:async()=>null};
   e.sandbox.__sdk.Dialog.actionSheet=async()=>-1;
   e.sandbox.__sdk.Dialog.confirm=async()=>false;
   const selection=[action,'dismiss'];
   let shown=0;
   e.sandbox.__nativeDashboardMock=async()=>{
     shown++;
     return selection.shift()??'dismiss';
   };
   await e.m.run();
   a.equal(shown,2);
   a.equal(e.keys.get('CourseSync.Local.v1.cookies'),'[]');
   a.equal(e.store.read().signedOut,undefined);
   e.store.release();
 }
});
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

test('automatic refresh leaves blank notes untouched and clears edited notes in place',async t=>{
 const e=await env(),queried=[];
 const table='https://jwxt.nufe.edu.cn/student/for-std/course-table';
 const exam='https://jwxt.nufe.edu.cn/student/for-std/exam-arrange';
 e.state.anchors['159']='2026-03-02';
 e.state.anchors['160']='2025-09-01';
 e.m.HTTP.prototype.get=async url=>{
   if(url===exam){
     queried.push('exams');
     return {url,text:'<table id="exams"><tr data-finished="true"><td><div class="time">2026-07-02 08:00~10:00</div></td><td><div>统计学</div><div>期末</div></td><td>已结束</td></tr></table>'};
   }
   a.equal(url,table);
   return {url,text:'var personId=100;var currentSemester={"id":161};<select id="allSemesters"><option value="161">2026-2027-1</option><option value="159">2025-2026-2</option><option value="160">2025-2026-1</option></select>'};
 };
 e.m.HTTP.prototype.json=async url=>{
   const sid=new URL(url).searchParams.get('semesterId');
   queried.push(sid);
   return raw([activity({weekIndexes:[1]})]);
 };
 await executeDaily(e);
 a.equal(e.store.read().runStatus,'success');
 a.equal(e.db.length,4);
 a.ok(e.db.every(event=>!event.notes));
 const courseReads=[];
 const getEvents=e.Event.getAll;
 e.Event.getAll=(start,end,calendars)=>{
   if(end-start===180*86400000)courseReads.push(+start);
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
 a.equal(e.requests.filter(request=>request[0]==='save').length,0);
 t.diagnostic('Course calendar reads across three unchanged terms: '+courseReads.length);
 a.equal(courseReads.length,6,'reuse the verified course rows across terms');
 a.equal(stateWrites,2,'persist only the run start and the verified result');
 a.ok(e.db.every(event=>!event.notes));
 a.match(e.sandbox.output,/刷新成功/);

 const ids=e.db.map(event=>event.identifier).sort();
 const examEvent=e.db.find(event=>event.title.startsWith('（考试）'));
 const courseEvent=e.db.find(event=>event.title==='高等数学');
 examEvent.notes='手动修改的考试备注';
 courseEvent.notes='手动修改的课程备注';
 e.requests.length=0;
 await e.m.run();
 a.deepEqual(e.requests.filter(([kind])=>kind==='save').map(([,id])=>id).sort(),
   [examEvent.identifier,courseEvent.identifier].sort());
 a.deepEqual(e.db.map(event=>event.identifier).sort(),ids);
 a.ok(e.db.every(event=>!event.notes));

 const missing=e.db.findIndex(event=>event.title.includes('高等数学')&&event.startDate.getUTCMonth()===2);
 a.ok(missing>=0);
 e.db.splice(missing,1);
 await e.m.run();
 a.equal(e.store.read().runStatus,'success');
 a.equal(e.db.length,4);
 a.ok(e.db.every(event=>!event.notes));

 const readTerm=e.m.HTTP.prototype.json;
 e.m.HTTP.prototype.json=async url=>{
   if(new URL(url).searchParams.get('semesterId')==='159')throw Object.assign(new Error('budget'),{code:'BUDGET'});
   return readTerm(url);
 };
 await e.m.run();
 const deferred=e.store.read();
 a.equal(deferred.runStatus,'success');
 a.equal(deferred.lastExamError,null);
 a.equal(deferred.termErrors.length,0);
 a.equal(deferred.exams.length,1);
 a.equal(e.notices.length,0);
 a.match(e.sandbox.output,/刷新成功/);

 e.m.HTTP.prototype.json=readTerm;
 queried.length=0;
 await e.m.run();
 a.deepEqual(queried,['161','160','159','exams']);
 a.equal(e.store.read().runStatus,'success');
});
test('shortcut verifies and saves current course changes before starting the exam request',async()=>{
 const e=await env();
 loggedIn(e,raw([activity({weekIndexes:[1]})]));
 await executeDaily(e);
 loggedIn(e,raw([activity({weekIndexes:[1],room:'教B202'})]));
 const readPage=e.m.HTTP.prototype.get;
 let verifiedBeforeExams=false;
 e.m.HTTP.prototype.get=async url=>{
   if(url.endsWith('/exam-arrange')){
     verifiedBeforeExams=e.store.read().tx===null&&e.db.some(event=>event.location==='教B202'&&!event.notes);
   }
   return readPage(url);
 };
 await e.m.run();
 a.equal(verifiedBeforeExams,true);
 a.equal(e.store.read().runStatus,'success');
});
test('slow or failed exams leave the same verified course rotation as fast exams',async t=>{
 for(const outcome of ['fast','slow','failed'])await t.test(outcome,async()=>{
   const e=await env(),queried=[];
   e.state.lastBackgroundHistoryTerm=159;
   const initialTime=Date.now();
   let elapsed=0;
   e.sandbox.Date=class extends Date{static now(){return initialTime+elapsed;}};
   e.m.HTTP.prototype.get=async url=>{
     if(url.endsWith('/exam-arrange')){
       queried.push('exams');
       if(outcome!=='fast')elapsed=17000;
       if(outcome==='failed')throw Object.assign(new Error('exam timeout'),{code:'BUDGET'});
       return {url,text:'<table id="exams"><tr class="tr-empty"><td>暂无考试安排</td></tr></table>'};
     }
     return {url,text:'var personId=100;var currentSemester={"id":161};<select id="allSemesters"><option value="161">2026-2027-1</option><option value="160">2025-2026-1</option><option value="159">2025-2026-2</option></select>'};
   };
   e.m.HTTP.prototype.json=async url=>{
     queried.push(new URL(url).searchParams.get('semesterId'));
     return raw([activity({weekIndexes:[1]})]);
   };
   await executeDaily(e);
   const state=e.store.read();
   a.deepEqual(queried,['161','160','159','exams']);
   a.equal(state.lastBackgroundHistoryTerm,159);
   a.deepEqual(Object.keys(state.semesters).sort(),['159','160','161']);
   a.equal(e.db.filter(event=>event.title==='高等数学'&&!event.notes).length,3);
   a.equal(state.lastExamError,outcome==='failed'?'BUDGET':null);
   a.equal(state.runStatus,outcome==='failed'?'partial':'success');
 });
});
test('the course rotation leaves a fixed exam reserve even when the current term runs late',async()=>{
 const e=await env(),queried=[];
 const initialTime=Date.now();
 let elapsed=0;
 e.sandbox.Date=class extends Date{static now(){return initialTime+elapsed;}};
 loggedIn(e,url=>{
   const sid=new URL(url).searchParams.get('semesterId');
   queried.push(sid);
   if(sid==='161')elapsed=13000;
   return raw([activity({weekIndexes:[1]})]);
 });
 const readPage=e.m.HTTP.prototype.get;
 e.m.HTTP.prototype.get=async function(url){
   const page=await readPage(url);
   if(url.endsWith('/exam-arrange')){
     queried.push('exams');
     a.ok(this.deadline-e.sandbox.Date.now()>=6000);
     return page;
   }
   return {...page,text:page.text.replace('</select>','<option value="160">2025-2026-1</option></select>')};
 };
 await executeDaily(e);
 const state=e.store.read();
 a.deepEqual(queried,['161','exams']);
 a.equal(state.lastBackgroundHistoryTerm,undefined);
 a.equal(state.lastExamError,null);
 a.equal(state.runStatus,'success');
});
test('course and exam response cookies stay local to their own phases across background runs',async()=>{
 const e=await env();
 const originalGet=e.m.HTTP.prototype.get;
 const cookieKey='CourseSync.Local.v1.cookies';
 const sessionCookie={name:'session',value:'course',domain:'jwxt.nufe.edu.cn',hostOnly:true,path:'/',expires:0};
 e.keys.set(cookieKey,JSON.stringify([sessionCookie]));
 loggedIn(e,raw([activity({weekIndexes:[1]})]));
 const readCourses=e.m.HTTP.prototype.json;
 e.m.HTTP.prototype.json=async function(url){
   this.jar.set({...sessionCookie,value:'course-response'});
   return readCourses.call(this,url);
 };
 const readPage=e.m.HTTP.prototype.get,courseCookies=[],examCookies=[];
 e.m.HTTP.prototype.get=async function(url){
   if(url.endsWith('/exam-arrange'))return originalGet.call(this,url);
   courseCookies.push(this.jar.header(url));
   return readPage(url);
 };
 e.sandbox.fetchImpl=async (_url,{headers})=>{
   examCookies.push(headers.Cookie);
   return new Response('<table id="exams"><tr class="tr-empty"><td>暂无考试安排</td></tr></table>',{
     headers:{'Set-Cookie':'session=exam; Path=/'}
   });
 };
 await executeDaily(e);
 await e.m.run();
 a.deepEqual(courseCookies,['session=course','session=course']);
 a.deepEqual(examCookies,courseCookies);
 a.deepEqual(JSON.parse(e.keys.get(cookieKey)),[sessionCookie]);
 a.equal(e.store.read().runStatus,'success');
});
test('an interrupted rotating calendar transaction is reported as partial and resumed first',async()=>{
 const e=await env(),queried=[];
 e.state.anchors['160']='2025-09-01';
 let elapsed=0;
 const initialTime=Date.now();
 e.sandbox.Date=class extends Date{static now(){return initialTime+elapsed;}};
 loggedIn(e,url=>{
   const sid=new URL(url).searchParams.get('semesterId');
   queried.push(sid);
   return raw([activity({weekIndexes:[1]})]);
 });
 const readPage=e.m.HTTP.prototype.get;
 e.m.HTTP.prototype.get=async url=>{
   const page=await readPage(url);
   if(url.endsWith('/exam-arrange')){queried.push('exams');return page;}
   return {...page,text:page.text.replace('</select>','<option value="160">2025-2026-1</option></select>')};
 };
 const writeFile=e.sandbox.__sdk.FileManager.writeAsStringSync;
 let stalled=false;
 e.sandbox.__sdk.FileManager.writeAsStringSync=(filename,body)=>{
   writeFile(filename,body);
   if(!stalled&&/state-\d+\.json$/.test(filename)&&JSON.parse(body).tx?.sid==='160'){
     stalled=true;
     elapsed=7000;
   }
 };
 await executeDaily(e);
 const partial=e.store.read();
 a.deepEqual(queried.splice(0),['161','160','exams']);
 a.equal(partial.runStatus,'partial');
 a.equal(partial.lastExamError,null);
 a.equal(partial.tx.sid,'160');
 a.match(e.sandbox.output,/部分完成/);
 elapsed=0;
 await e.m.run();
 a.deepEqual(queried,['160','161','exams']);
 a.equal(e.store.read().tx,null);
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
 a.equal(e.store.read().audit.at(-1).status,'partial');
 a.match(e.sandbox.output,/部分完成：课程已核验 · 考试未完成[\s\S]*EXAM_SCHEMA/);
 a.equal(e.notices.length,1);
 a.match(e.notices[0].body,/EXAM_SCHEMA/);
 a.equal(e.db.length,1);
});
const examTitleForRecovery='（考试）期末测试';
const examDayForRecovery='2026-09-08';
function withRecoveryExam(e){
 const get=e.m.HTTP.prototype.get;
 e.m.HTTP.prototype.get=async function(url){
   if(!url.endsWith('/exam-arrange'))return get.call(this,url);
   return {url,text:'<table id="exams"><tr data-finished="false"><td><div class="time">'+examDayForRecovery+
     ' 08:00~09:40</div></td><td><div>期末测试</div><div>期末</div></td><td>未结束</td></tr></table>'};
 };
}
test('course and exam writes recover separately after an interrupted save',async t=>{
 for(const failedPhase of ['courses','exams'])await t.test(failedPhase,async()=>{
   const e=await env();
   loggedIn(e,raw([activity({weekIndexes:[1]})]));
   withRecoveryExam(e);
   const save=e.Event.prototype.save;
   let interrupted=false;
   e.Event.prototype.save=async function(){
     const phase=this.title===examTitleForRecovery?'exams':'courses';
     await save.call(this);
     if(!interrupted&&phase===failedPhase){interrupted=true;throw new Error('save acknowledgement lost');}
   };
   await executeDaily(e);
   const partial=e.store.read();
   const completedPhase=failedPhase==='courses'?'exams':'courses';
   a.equal(partial.runStatus,'partial');
   a.equal(partial.syncResults[failedPhase],'failed');
   a.equal(partial.syncResults[completedPhase],'success');
   a.equal(Boolean(partial.tx),failedPhase==='courses');
   a.equal(e.db.length,2);
   const completed=e.db.find(event=>(event.title===examTitleForRecovery)===(completedPhase==='exams'));
   a.equal(completed.notes,'');

   e.requests.length=0;
   await e.m.run();
   const recovered=e.store.read();
   a.equal(recovered.runStatus,'success');
   a.equal(recovered.tx,null);
   a.equal(e.db.length,2);
   a.ok(e.db.every(event=>!event.notes));
   a.ok(e.db.some(event=>event.identifier===completed.identifier));
   a.ok(e.requests.every(([,id])=>id!==completed.identifier));
   a.equal(e.db.find(event=>event.title==='高等数学').startDate.toISOString(),'2026-09-07T00:00:00.000Z');
   a.equal(e.db.find(event=>event.title===examTitleForRecovery).startDate.toISOString(),'2026-09-08T00:00:00.000Z');
   a.ok(e.db.every(event=>event.timeZone==='Asia/Shanghai'));
 });
});
test('a verified identity can refresh exams when course semester metadata is unavailable',async()=>{
 const e=await env();
 loggedIn(e,()=>{throw new Error('course data request should not start');});
 withRecoveryExam(e);
 const readPage=e.m.HTTP.prototype.get;
 e.m.HTTP.prototype.get=async function(url){
   const page=await readPage.call(this,url);
   return url.endsWith('/exam-arrange')?page:{...page,text:'var personId=100;'};
 };
 await executeDaily(e);
 const state=e.store.read();
 a.equal(state.runStatus,'partial');
 a.equal(state.lastCourseError,'SCHEMA');
 a.equal(state.syncResults.courses,'failed');
 a.equal(state.syncResults.exams,'success');
 a.deepEqual(e.db.map(event=>event.title),[examTitleForRecovery]);
});
test('a current semester timeout leaves the exam phase its reserved time',async()=>{
 const e=await env();
 const initialTime=Date.now();
 let elapsed=0,examRemaining=0;
 e.sandbox.Date=class extends Date{static now(){return initialTime+elapsed;}};
 loggedIn(e,[]);
 withRecoveryExam(e);
 e.m.HTTP.prototype.json=async function(){
   elapsed=this.deadline-initialTime+1;
   throw Object.assign(new Error('course timeout'),{code:'BUDGET'});
 };
 const readPage=e.m.HTTP.prototype.get;
 e.m.HTTP.prototype.get=async function(url){
   if(url.endsWith('/exam-arrange'))examRemaining=this.deadline-e.sandbox.Date.now();
   return readPage.call(this,url);
 };
 await executeDaily(e);
 a.equal(examRemaining,5999);
 a.equal(e.store.read().termErrors[0].code,'BUDGET');
 a.equal(e.store.read().syncResults.exams,'success');
 a.deepEqual(e.db.map(event=>event.title),[examTitleForRecovery]);
});
test('two failed phases report both errors without advancing the last verified refresh',async()=>{
 const e=await env();
 e.state.lastCheck='2026-09-01T00:00:00.000Z';
 loggedIn(e,{});
 const readPage=e.m.HTTP.prototype.get;
 e.m.HTTP.prototype.get=async url=>url.endsWith('/exam-arrange')?{url,text:'<html>unexpected</html>'}:readPage(url);
 await executeDaily(e);
 const state=e.store.read();
 a.equal(state.runStatus,'failed');
 a.equal(state.lastCheck,e.state.lastCheck);
 a.equal(state.audit.at(-1).courses,'failed');
 a.equal(state.audit.at(-1).exams,'failed');
 a.match(e.sandbox.output,/刷新失败：课程未完成 · 考试未完成[\s\S]*（SCHEMA）/);
 a.match(e.notices[0].body,/EXAM_SCHEMA/);
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
 a.ok(calendarTimeout>18000&&calendarTimeout<=20000,'calendar setup shares the 20-second work budget');
 a.ok(requestTimeout>14000&&requestTimeout<=16000,'network uses the remainder after calendar setup');
 a.equal(timers.at(-1),1000,'notification delivery has a separate short timeout');
 a.equal(e.store.read().lastError,'BUDGET');
 a.equal(e.store.read().resultNoticeError,'NOTIFICATION_FAILED');
 a.equal(e.sandbox.output.type,'text');
 a.match(e.sandbox.output.value,/刷新失败/);
 a.doesNotThrow(()=>e.store.acquire());
 e.store.release();
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
test('daily refresh updates managed courses, deduplicates matching imports and preserves unrelated events',async()=>{
 const e=await env(),old=lesson(),cancelled=lesson({id:'cancelled',week:2,start:'2026-09-14T00:00:00.000Z',end:'2026-09-14T01:40:00.000Z'});
 e.baseline([old,cancelled]);e.add(old);e.add(cancelled);
 e.add(old,{id:'old-ics',notes:'legacy calendar import'});
 e.add({...old,location:'教B202'},{id:'old-ics',notes:'legacy calendar import',offset:14*86400000});
 const personal=e.add(old,{cal:e.other,notes:'personal'});
 const unrelated=e.add(lesson({title:'个人安排'}),{notes:'personal'});
 const conflictingRoom=e.add(lesson({location:'校外培训室'}),{notes:'personal'});
 const invitation=e.add(old,{notes:'invitation'});invitation.attendees=[{name:'guest'}];
 loggedIn(e,raw([activity({weekIndexes:[1,3],room:'教B202'})]));await executeDaily(e);
 const managed=()=>e.db.filter(x=>x.calendar.identifier===e.calendar.identifier&&e.m.storedEventIndex(e.store.read()).has(x.identifier));
 const own=managed();a.equal(own.length,2);a.ok(own.every(x=>x.location==='教B202'));
 for(const event of [personal,unrelated,invitation,conflictingRoom])a.ok(e.db.some(x=>x.identifier===event.identifier));
 a.equal(e.db.some(x=>x.identifier==='old-ics'),false);
 a.equal(e.notices.length,0);a.equal(e.store.read().runStatus,'success');a.equal(e.store.read().tx,null);
 a.ok(e.keys.has('CourseSync.Local.v1.person'));a.ok(e.keys.has('CourseSync.Local.v1.student'));
 // A second entire run must change neither logical nor native event IDs.
 const ids=own.map(x=>x.identifier).sort().join(',');e.notices.length=0;await e.m.run();
 a.equal(managed().map(x=>x.identifier).sort().join(','),ids);a.equal(e.notices.length,0);
});
test('malformed course source preserves old events while exams still complete',async()=>{
 const e=await env();
 e.baseline([lesson()]);
 const own=e.add(lesson()),legacy=e.add(lesson(),{notes:'old'});
 loggedIn(e,{});
 let examRequests=0;
 const readPage=e.m.HTTP.prototype.get;
 e.m.HTTP.prototype.get=async url=>{
   if(url.endsWith('/exam-arrange'))examRequests++;
   return readPage(url);
 };
 await executeDaily(e);
 a.ok(e.db.some(x=>x.identifier===own.identifier));
 a.ok(e.db.some(x=>x.identifier===legacy.identifier));
 a.equal(e.requests.length,0);
 a.equal(examRequests,1);
 a.equal(e.notices.length,1);
 a.match(e.notices[0].title,/部分完成/);
 a.match(e.sandbox.output,/课程未完成 · 考试已核验[\s\S]*SCHEMA/);
 a.equal(e.store.read().termErrors[0].code,'SCHEMA');
});
test('end-to-end unexpected empty source preserves old course and import',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());e.add(lesson(),{notes:'old'});loggedIn(e,raw([]));await executeDaily(e);a.equal(e.db.length,2);a.equal(e.requests.length,0);a.equal(e.store.read().termErrors[0].code,'EMPTY_SOURCE');a.match(e.notices[0].title,/部分完成/);});
test('end-to-end failed calendar save never purges legacy data',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());e.add(lesson(),{notes:'old'});e.setSaveFailure(true);loggedIn(e,raw([activity({weekIndexes:[1],room:'changed'})]));await executeDaily(e);a.equal(e.db.length,2);a.ok(e.store.read().tx);a.equal(e.requests.filter(x=>x[0]==='remove').length,0);a.match(e.notices[0].title,/部分完成/);});
test('end-to-end school person change blocks all calendar writes',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());e.keys.set('CourseSync.Local.v1.person','another-person');loggedIn(e,raw([activity()]));await executeDaily(e);a.equal(e.requests.length,0);a.equal(e.store.read().lastError,'ACCOUNT_CHANGED');a.equal(e.store.read().authPaused,true);a.match(e.notices[0].title,/登录需要处理/);});
test('a student identity mismatch in course data stops both sync phases',async()=>{
 const e=await env();
 e.baseline([lesson()]);
 e.add(lesson());
 e.keys.set('CourseSync.Local.v1.student','another-student');
 loggedIn(e,raw([activity()]));
 const get=e.m.HTTP.prototype.get;
 let examRequests=0;
 e.m.HTTP.prototype.get=async url=>{
   if(url.endsWith('/exam-arrange'))examRequests++;
   return get(url);
 };
 await executeDaily(e);
 a.equal(e.requests.length,0);
 a.equal(examRequests,0);
 a.equal(e.store.read().lastError,'ACCOUNT_CHANGED');
 a.equal(e.store.read().authPaused,true);
});
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
test('a different verified school account cannot replace the bound login or session',async()=>{
  const e=await env({hostEnv:'index'});
  const table='https://jwxt.nufe.edu.cn/student/for-std/course-table';
  const cas='https://authserver.nufe.edu.cn/authserver/login';
  const key='CourseSync.Local.v1.cookies';
  const cookie=value=>({name:'SESSION',value,domain:'jwxt.nufe.edu.cn',hostOnly:true,path:'/',expires:0});
  const original=JSON.stringify([cookie('bound-session')]);
  e.keys.set(key,original);
  e.keys.set('CourseSync.Local.v1.person','100');
  e.m.saveCredentials('bound-student','bound-password');
  let submitted=false,person=200,sessionCookie='other-session';
  const page=()=> 'var personId='+person+';var currentSemester={"id":161};';
  e.m.HTTP.prototype.authJSON=async()=>({isNeed:false});
  e.m.HTTP.prototype.get=async function(url,opt={}){
    if(url===table)return {url,text:submitted?page():'login required'};
    if(url.endsWith('/student/sso/login'))return {
      url:cas,text:'<form id="pwdFromId"><input name="execution" value="e123"><input id="pwdEncryptSalt" value="1234567890123456"></form>'
    };
    if(url===cas&&opt.body){
      submitted=true;
      this.jar.set(cookie(sessionCookie));
      this.persist(this.jar.cookies);
      return {url:table,text:page()};
    }
    return {url,text:''};
  };
  const manualAuth={kind:'credentials',username:'other-student',password:'other-password'};
  await a.rejects(()=>e.m.synchronize(e.state,e.store,e.calendar,true,null,manualAuth),code('ACCOUNT_CHANGED'));
  a.equal(submitted,true);
  a.equal(e.keys.get(key),original);
  a.equal(e.m.readSavedCredentials().username,'bound-student');
  a.equal(e.m.readSavedCredentials().password,'bound-password');
  a.deepEqual(e.requests,[]);
  person=100;sessionCookie='renewed-session';submitted=false;
  e.m.HTTP.prototype.json=async()=>raw([activity({weekIndexes:[1]})]);
  await e.m.synchronize(e.state,e.store,e.calendar,true,null,
    {kind:'credentials',username:'bound-student',password:'renewed-password'});
  a.equal(e.m.readSavedCredentials().password,'renewed-password');
  a.ok(JSON.parse(e.keys.get(key)).some(item=>item.value==='renewed-session'));
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

test('owned series is replaced with a standalone new target after backup',async()=>{const e=await env();e.add(lesson(),{id:'owned-series'});e.add(lesson(),{id:'owned-series',offset:7*86400000});e.setSeries(true);e.state.tx=tx([lesson()],[lesson()]);await e.m.finishTx(e.state,e.store,new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store),()=>{});a.equal(e.db.length,1);a.notEqual(e.db[0].identifier,'owned-series');a.equal(e.m.eventRecord(e.db[0],e.state.owner,e.m.storedEventIndex(e.state)).id,'lesson-1');});
test('orphan owned marker is removed only in successfully fetched term',async()=>{const e=await env();e.add(lesson());e.add(lesson({id:'orphan'}));e.add(lesson({id:'other-term',sid:'999'}));await e.m.applyTransaction(tx([lesson()],[lesson()]),new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store));a.equal(e.db.length,2);a.ok(e.db.some(x=>e.m.eventRecord(x,e.state.owner).sid==='999'));});
test('pending transaction does not resume before a fresh complete school fetch',async()=>{const e=await env();e.baseline([lesson()]);e.add(lesson());e.state.tx=tx([lesson()],[]);loggedIn(e,{});await executeDaily(e);a.equal(e.db.length,1);a.equal(e.requests.length,0);a.ok(e.store.read().tx);a.equal(e.store.read().termErrors[0].code,'SCHEMA');a.equal(e.store.read().syncResults.exams,'success');});
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
 a.equal(finished.notes,'');
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
 a.equal(exams().find(x=>x.identifier===finished.identifier).notes,'');
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
     if(options.state.calendarBindingPending)return 0;
     a.equal(options.state.runStatus,'success');
     a.equal(options.state.calendarTitle,'课程和考试');
     a.equal(e.store.fm.fileExists(e.store.path('run-lock.json')),false);
     return 'dismiss';
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
test('a detached course is replaced once and the next refresh performs no calendar writes',async()=>{
 const e=await env();
 loggedIn(e,raw([activity({weekIndexes:[1]})]));
 await executeDaily(e);
 const old=e.db[0];
 old.isDetached=true;
 await e.m.run();
 a.equal(e.store.read().runStatus,'success');
 a.equal(e.db.length,1);
 a.notEqual(e.db[0].identifier,old.identifier);
 a.ok(!e.db[0].isDetached);
 e.requests.length=0;
 await e.m.run();
 a.equal(e.store.read().runStatus,'success');
 a.deepEqual(e.requests,[]);
});
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

test('indexed unmarked event remains identifiable after note migration',async()=>{
 const e=await env();const rec=lesson();e.baseline([rec]);const ev=e.add(rec);
 e.state.semesters['161'].index={[rec.id]:ev.identifier};
 ev.notes='';
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
  a.equal(e.db[0].notes,'');
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
test('a replacement binds despite an older pending journal and courses archive it before writing',async()=>{
 const e=await env({hostEnv:'index'}),h=missingCalendar(e,{lost:true});setName(e);
 const oldCalendar={...e.calendar,identifier:'calendar-gone'};
 const old=e.add(lesson(),{cal:oldCalendar});
 const stale=lesson({title:'不可重放的旧事务'});
 e.state.tx=tx([lesson()],[stale]);
 const picked=await e.m.pickCalendar(e.state,e.store);
 a.equal(h.created.length,1);
 a.equal(e.store.read().calendarId,picked.identifier);
 const journal=e.store.read().tx;
 a.equal(journal.calendarId,oldCalendar.identifier);
 a.deepEqual(JSON.parse(JSON.stringify(journal.target)),[stale]);
 a.equal(e.requests.length,0);

 loggedIn(e,raw([activity({courseName:'教务系统的新课程',weekIndexes:[1]})]));
 const writeFile=e.sandbox.__sdk.FileManager.writeAsStringSync;
 e.sandbox.__sdk.FileManager.writeAsStringSync=(filename,body)=>{
   if(!filename.includes('课程事务-'))writeFile(filename,body);
 };
 await e.m.synchronize(e.state,e.store,picked,true,()=>{});
 a.equal(e.state.lastCourseError,'BACKUP_FAILED');
 a.equal(e.state.syncResults.exams,'success');
 a.equal(e.store.read().calendarId,picked.identifier);
 a.equal(e.store.read().tx.calendarId,oldCalendar.identifier);
 a.equal(e.requests.length,0);

 e.sandbox.__sdk.FileManager.writeAsStringSync=writeFile;
 await e.m.synchronize(e.state,e.store,picked,true,()=>{});
 const updated=e.store.read();
 a.equal(updated.tx,null);
 a.equal(e.files.get(e.store.path(updated.lastArchivedCourseJournal)),JSON.stringify(journal,null,2));
 a.deepEqual(e.db.map(event=>[event.calendar.identifier,event.title]),[
   [old.calendar.identifier,old.title],[picked.identifier,'教务系统的新课程']
 ]);
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
   a.match(options.message,/本机的教务会话/);
   a.match(options.message,/iCloud 钥匙串/);
   a.match(options.message,/日历事件会保留/);
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
  const e=await env({hostEnv:'index'}),m=e.m;
  e.store.release();
  m.activateSelectedSchool('nufe');
  const store=new m.Store();store.acquire();
  store.write({...e.state,signedOut:true,authPaused:true});store.release();
  e.keys.set('CourseSync.Local.v1.school-choice','nufe');
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
});
test('background refresh after logout does not fall back to another school',async()=>{
 const e=await env();
 e.store.write(e.state);e.store.release();
 e.keys.set('CourseSync.Local.v1.school-reselect','legacy-school');
 let networkCalls=0;
 e.sandbox.fetchImpl=async()=>{networkCalls++;throw Error('unexpected network');};
 await e.m.run();
 a.equal(networkCalls,0);
 a.match(e.sandbox.output,/登录南京财经大学/);
 a.equal(e.keys.get('CourseSync.Local.v1.school-reselect'),'legacy-school');
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
 a.match(project.description,/Apple 日历.*空闲教室/);
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
test('older course notes are cleared in place and the current title is kept',async()=>{
 const e=await env(),rec=lesson(),ev=e.add(rec,{notes:'教师：张老师\\n同步：2026-11-02 01:22'.replace('\\n','\n')});
 e.baseline([rec]);e.state.semesters['161'].notesFormat=2;
 e.state.semesters['161'].index={[rec.id]:ev.identifier};
 const before=ev.identifier;
 e.store.write(e.state);
 await e.m.polishTermNotes(e.calendar,e.state,e.store,'161',()=>{});
 a.equal(e.db.length,1);a.equal(e.db[0].identifier,before);
 a.equal(e.db[0].title,'高等数学');
 a.equal(e.db[0].notes,'');
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
 a.equal(e.db[0].notes,'');
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


test('clearing old notes is idempotent across unchanged-term syncs',async()=>{
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
 a.equal(e.db[0].notes,'');
 a.equal(e.requests.filter(x=>x[0]==='save').length,beforeWrites+1);
 term.lastSuccess='2026-11-02T01:07:00.000Z';
 e.store.write(e.state);
 await e.m.polishTermNotes(e.calendar,e.state,e.store,'161',()=>{});
 a.equal(e.db.length,1);
 a.equal(e.db[0].identifier,original);
 a.equal(e.db[0].notes,'');
 a.equal(e.state.semesters['161'].notesFormat,3);
 a.equal(e.requests.filter(x=>x[0]==='save').length,beforeWrites+1);
});
test('no-op event save cannot falsely report that notes were cleared',async()=>{
 const e=await env(),rec=lesson(),ev=e.add(rec);
 e.baseline([rec]);const term=e.state.semesters['161'];
 term.index={[rec.id]:ev.identifier};
 term.notesFormat=3;
 term.lastSuccess='2026-11-02T01:07:00.000Z';
 e.store.write(e.state);e.setDropSave(true);
 await a.rejects(()=>e.m.polishTermNotes(e.calendar,e.state,e.store,'161',()=>{}),code('CALENDAR_VERIFY'));
 a.equal(e.db[0].notes,ev.notes);
 a.equal(e.db.length,1);
});
test('clearing notes on multiple courses preserves their IDs',async()=>{
 const e=await env(),first=lesson(),second=lesson({id:'lesson-2',start:'2026-09-14T00:00:00.000Z',end:'2026-09-14T01:40:00.000Z',week:2});
 const a1=e.add(first),a2=e.add(second),ids=[a1.identifier,a2.identifier];
 e.baseline([first,second]);
 const term=e.state.semesters['161'];
 term.index={[first.id]:ids[0],[second.id]:ids[1]};
 term.notesFormat=3;term.lastSuccess='2026-11-02T01:07:00.000Z';e.store.write(e.state);
 await e.m.polishTermNotes(e.calendar,e.state,e.store,'161',()=>{});
 a.deepEqual(e.db.map(x=>x.identifier),ids);
 a.ok(e.db.every(x=>!x.notes));
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

test('NUFE free classrooms group by building and numbered floor with De buildings first',async()=>{
 const e=await env();
 const http={
   json:async(url,opt)=>{
     a.match(url,/ws\/room-borrow\/free-list/);
     return {
       roomList:[
         {id:21,nameZh:'德经楼Z1-101',building:{nameZh:'德经楼'},floor:1},
         {id:22,nameZh:'德经楼Z1-201',building:{nameZh:'德经楼'},floor:2},
         {id:23,nameZh:'德济楼Z2-101',building:{nameZh:'德济楼'},floor:'1'},
         {id:24,nameZh:'德济楼Z2-201',building:{nameZh:'德济楼'},floor:2},
         {id:25,nameZh:'德正楼Z3-101',building:{nameZh:'德正楼'},floor:1},
         {id:26,nameZh:'德正楼Z3-201',building:{nameZh:'德正楼'},floor:2},
         {id:27,nameZh:'德业楼Z4-101',building:{nameZh:'德业楼'},floor:1},
         {id:28,nameZh:'德业楼Z4-201',building:{nameZh:'德业楼'},floor:2},
         {id:1,nameZh:'德经楼Z1-205',building:{nameZh:'德经楼'},floor:1},
         {id:90,nameZh:'德业楼Z4S318',building:{nameZh:'德业楼'},floor:1},
         {id:91,nameZh:'德业楼Z4S118',building:{nameZh:'德业楼'},floor:1},
         {id:92,nameZh:'德经楼Z1S106',building:{nameZh:'德经楼'},floor:1},
         {id:93,nameZh:'德业楼Z4N118',building:{nameZh:'德业楼'},floor:1},
         {id:94,nameZh:'德业楼Z4118',building:{nameZh:'德业楼'},floor:1},
         {id:95,nameZh:'博远楼JCS101',building:{nameZh:'博远楼'},floor:1},
         {id:96,nameZh:'博观楼JB101微',building:{nameZh:'博观楼'},floor:1},
         {id:97,nameZh:'博文楼JA101S',building:{nameZh:'博文楼'},floor:1},
         {id:98,nameZh:'博文楼JB101',building:{nameZh:'博文楼'},floor:1},
         {id:99,nameZh:'德业楼Z4-118',building:{nameZh:'德业楼'},floor:3},
         {id:2,nameZh:'博文楼JA414',building:{nameZh:'博文楼'},floor:4},
         {id:3,nameZh:'博文楼JA105',building:{nameZh:'博文楼'},floor:1},
         {id:4,nameZh:'博观楼JB202',building:{nameZh:'博观楼'},floor:2},
         {id:5,nameZh:'博观楼JB101',building:{nameZh:'博观楼'},floor:1},
         {id:6,nameZh:'博远楼JC203',building:{nameZh:'博远楼'},floor:2},
         {id:7,nameZh:'博远楼JC101',building:{nameZh:'博远楼'},floor:1},
         {id:8,name:'JC104',buildingName:'博远楼',floor:4},
         {id:9,nameZh:'博远楼 JC102',building:{nameZh:'博远楼'}}
       ]
     };
   }
 };
 const rooms=await e.m.queryFreeRoomsForPeriod(http,'2026-11-16',['1','2','3','4']);
 a.deepEqual(JSON.parse(JSON.stringify(rooms)),[
   {name:'德经楼',floors:[{floor:1,roomCodes:['Z1-101']}]},
   {name:'德济楼',floors:[{floor:1,roomCodes:['Z2-101']}]},
   {name:'德正楼',floors:[{floor:1,roomCodes:['Z3-101']}]},
   {name:'德业楼',floors:[{floor:1,roomCodes:['Z4-101']}]},
   {name:'博远楼',floors:[{floor:1,roomCodes:['JC101','JC102','JC104']},{floor:2,roomCodes:['JC203']}]}
 ]);
});

test('NUFE free classroom query queries lesson 10 separately for today in China time without modifying calendar',async()=>{
 const e=await env();
 const dbCountBefore=e.db.length;
 const requestedSegments=[];
 const http={
   get:async(url)=>({url:'https://jwxt.nufe.edu.cn/student/for-std/course-table',text:'var personId=100;var currentSemester={"id":161};<select id="allSemesters"><option value="161">2026-2027-1</option></select>'}),
   json:async(url,{body})=>{
     const p=JSON.parse(body);
     requestedSegments.push(p.dateTimeSegmentCmd);
     const units=p.dateTimeSegmentCmd.units;
       if(units.includes('1'))return {roomList:[{id:101,nameZh:'博远楼JC101',building:{nameZh:'博远楼'},floor:1}]};
       if(units.length===1&&units[0]==='10')return {roomList:[{id:202,nameZh:'博观楼JB202',buildingName:'博观楼',floor:2}]};
       if(units.includes('6'))return {roomList:[{id:101,nameZh:'博远楼JC101',building:{nameZh:'博远楼'},floor:1}]};
       return {roomList:[{id:403,nameZh:'博远楼JC403',building:{nameZh:'博远楼'},floor:4}]};
   }
 };
 const progress=[];
 const result=await e.m.queryFreeRooms(http,()=>{},value=>progress.push(value),Date.parse('2026-11-15T16:30:00Z'));
 a.deepEqual(progress,[0.25,1]);
 a.equal(result.date,'2026-11-16');
 a.deepEqual(JSON.parse(JSON.stringify(result.rooms)),[
   {period:'上午',units:['1','2','3','4','5'],buildings:[{name:'博远楼',floors:[{floor:1,roomCodes:['JC101']}]}]},
   {period:'下午',units:['6','7','8','9'],buildings:[{name:'博远楼',floors:[{floor:1,roomCodes:['JC101']}]}]},
   {period:'第10节',units:['10'],buildings:[]},
   {period:'晚上',units:['11','12','13'],buildings:[{name:'博远楼',floors:[{floor:4,roomCodes:['JC403']}]}]}
 ]);
 a.deepEqual(requestedSegments.map(segment=>segment.units.join(',')),['1,2,3,4,5','6,7,8,9','10','11,12,13']);
 for(const segment of requestedSegments){
   a.equal(segment.startDateTime,'2026-11-16');
   a.equal(segment.endDateTime,'2026-11-16');
 }
 a.equal(e.db.length,dbCountBefore);
});

test('classroom query uses the new Beijing date when login crosses midnight',async()=>{
 const e=await env(),dates=[];
 let now=Date.parse('2026-11-23T15:59:59Z');
 e.sandbox.Date=class extends Date{static now(){return now;}};
 const room={nameZh:'博远楼JC101',buildingName:'博远楼',floor:1};
 const http={
   get:async()=> {
     now+=2000;
     return {url:'https://jwxt.nufe.edu.cn/student/for-std/course-table',text:'var personId=100;var currentSemester={"id":161};<select id="allSemesters"><option value="161">2026-2027-1</option></select>'};
   },
   json:async(_url,{body})=>{
     dates.push(JSON.parse(body).dateTimeSegmentCmd.startDateTime);
     return {roomList:[room]};
   }
 };
 const result=await e.m.queryFreeRooms(http);
 a.equal(result.date,'2026-11-24');
 a.deepEqual(dates,Array(4).fill('2026-11-24'));
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
       status:200,headers:new Map([['Set-Cookie','room=session; Path=/']]),cookies:[],mimeType:'application/json',
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
 a.deepEqual(JSON.parse(JSON.stringify(results.rooms)),[
   {period:'上午',units:['1','2','3','4','5'],buildings:[{name:'博远楼',floors:[{floor:1,roomCodes:['JC101']}]}]},
   {period:'下午',units:['6','7','8','9'],buildings:[{name:'博远楼',floors:[{floor:1,roomCodes:['JC101']}]}]},
   {period:'第10节',units:['10'],buildings:[{name:'博远楼',floors:[{floor:1,roomCodes:['JC101']}]}]},
   {period:'晚上',units:['11','12','13'],buildings:[{name:'博远楼',floors:[{floor:1,roomCodes:['JC101']}]}]}
 ]);
 a.equal(failure.kind,'error');
 a.match(failure.message,/设备没有可用的网络连接/);
 a.match(cancelled.message,/已取消/);
 a.equal(roomRequests,8);
 a.equal(e.keys.get('CourseSync.Local.v1.cookies'),'[]');
 a.deepEqual(shownDialogs,[]);
 a.equal(e.db.length,dbCountBefore);
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

test('an empty or filtered classroom period needs no additional requests',async()=>{
 const {m}=await env(),requested=[];
 const room={id:11,nameZh:'博远楼JC101',buildingName:'博远楼',floor:1};
 const computerRoom={nameZh:'德业楼Z4S118',buildingName:'德业楼',floor:1};
 const http={json:async(_url,{body})=>{
   const units=JSON.parse(body).dateTimeSegmentCmd.units;
   requested.push(units.join(','));
   return {roomList:units[0]==='1'?[room]:units[0]==='6'?[computerRoom]:[]};
 }};
 const rows=await m.queryDayRooms(http,'2026-11-23');
 a.deepEqual(requested,['1,2,3,4,5','6,7,8,9','10','11,12,13']);
 a.deepEqual(JSON.parse(JSON.stringify(rows)),[
   {period:'上午',units:['1','2','3','4','5'],buildings:[{name:'博远楼',floors:[{floor:1,roomCodes:['JC101']}]}]},
   {period:'下午',units:['6','7','8','9'],buildings:[]},
   {period:'第10节',units:['10'],buildings:[]},
   {period:'晚上',units:['11','12','13'],buildings:[]}
 ]);
});

test('a failed classroom request is reported as an error',async()=>{
 const {m}=await env(),progress=[];
 const http={json:async(_url,{body})=>{
   const units=JSON.parse(body).dateTimeSegmentCmd.units;
   if(units[0]==='6')throw Error('network');
   return {roomList:[]};
 }};
 await a.rejects(()=>m.queryDayRooms(http,'2026-11-23',value=>progress.push(value)),/network/);
 a.deepEqual(progress,[]);
});

test('classroom lists hide repeated IDs and room codes even when the supplied IDs differ',async()=>{
 const {m}=await env();
 const x={id:10,nameZh:'博远楼JC101',buildingName:'博远楼',floor:1};
 const sameId={...x,nameZh:'博远楼JC102'};
 const sameNameWithoutId={...x,id:undefined};
 const sameNameWithDifferentId={...x,id:11};
 const other={id:12,nameZh:'德经楼Z1-101',buildingName:'德经楼',floor:1};
 const rows=await m.queryDayRooms({json:async()=>({roomList:[x,x,sameId,sameNameWithoutId,sameNameWithDifferentId,other]})},'2026-11-23');
 for(const row of rows)a.deepEqual(JSON.parse(JSON.stringify(row.buildings)),[
   {name:'德经楼',floors:[{floor:1,roomCodes:['Z1-101']}]},
   {name:'博远楼',floors:[{floor:1,roomCodes:['JC101']}]}
 ]);
});
test('concurrent HTTP requests recheck shared request spacing after waking',()=>{
 const http=source.slice(source.indexOf('class HTTP {'),source.indexOf('function schoolSession('));
 a.match(http,/while\(wait>0\)[\s\S]*wait=1050-\(Date\.now\(\)-this\.last\);\s*\}\s*this\.last=Date\.now\(\)/);
});

test('rollback restores plain room text from a former two-line location without changing event ID',async()=>{
 const e=await env(),rec=lesson({location:'德业楼 Z4-110'});
 const old=e.add(rec);
 old.location=rec.location+'\n南京财经大学仙林校区南门';
 const id=old.identifier;
 await e.m.applyTransaction(tx([rec],[rec]),new e.m.CalendarAdapter(e.calendar,e.state.owner,e.store));
 a.equal(e.db.length,1);
 a.equal(e.db[0].identifier,id);
 a.equal(e.db[0].location,rec.location);
 a.equal(e.db[0].structuredLocation,undefined);
});
test('rollback clears a previously assigned pin on an otherwise unchanged course',async()=>{
 const e=await env(),rec=lesson({location:'德业楼 Z4-110'});
 const old=e.add(rec,{notes:'同步：2026-11-01 08:00'});
 old.structuredLocation={title:rec.location,radius:0,geoLocation:{latitude:32.1082,longitude:118.9192}};
 e.baseline([rec]);
 e.state.semesters['161'].index={[rec.id]:old.identifier};
 await e.m.polishTermNotes(e.calendar,e.state,e.store,161,()=>{});
 a.equal(e.db.length,1);
 a.equal(e.db[0].identifier,old.identifier);
 a.equal(e.db[0].location,rec.location);
 a.equal(e.db[0].structuredLocation,null);
});

test('rollback removes structured exam locations while preserving classroom text and event identity',async()=>{
 const e=await env(),now=Date.parse('2026-11-16T00:00:00Z');
 const html='<table id="exams"><tr data-finished="false"><td><div class="time">2026-12-18 09:00~11:00</div><div><span>仙林校区</span><span>博观楼JB407</span></div></td><td><div>高等数学</div><div>期末</div></td><td>未结束</td></tr></table>';
 const http={get:async()=>({url:'https://jwxt.nufe.edu.cn/student/for-std/exam-arrange',text:html})};
 await e.m.syncExams(http,e.state,e.store,e.calendar,()=>{},now);
 const old=e.db[0],id=old.identifier;
 old.structuredLocation={title:old.location,radius:0,geoLocation:{latitude:32.1082,longitude:118.9192}};
 await e.m.syncExams(http,e.state,e.store,e.calendar,()=>{},now);
 a.equal(e.db.length,1);a.equal(e.db[0].identifier,id);
 a.equal(e.db[0].location,'博观楼JB407');a.equal(e.db[0].structuredLocation,null);
});

test('plain text native structured object is not treated as a leftover coordinate',async()=>{
 const e=await env(),rec=lesson({location:'德业楼 Z4-110'}),old=e.add(rec,{notes:''});
 e.baseline([rec]);const term=e.state.semesters['161'];term.index={[rec.id]:old.identifier};
 term.lastSuccess='2026-11-01T00:00:00.000Z';term.notesFormat=3;
 old.structuredLocation={title:rec.location,geoLocation:null,radius:0};
 const writes=e.requests.filter(x=>x[0]==='save').length;
 await e.m.polishTermNotes(e.calendar,e.state,e.store,161,()=>{});
 a.equal(e.requests.filter(x=>x[0]==='save').length,writes);
 a.equal(e.db[0].location,rec.location);
});
test('native automatic map resolution does not cause CALENDAR_VERIFY after plain room save',async()=>{
 const e=await env(),rec=lesson({location:'德业楼 Z4-110'}),old=e.add(rec,{notes:'同步：2026-11-01 08:00'});
 const nativePin={title:rec.location,geoLocation:{latitude:32.1082,longitude:118.9192},radius:0};
 old.structuredLocation=nativePin;
 e.baseline([rec]);e.state.semesters['161'].index={[rec.id]:old.identifier};
 const save=e.Event.prototype.save;
 e.Event.prototype.save=async function(){this.structuredLocation=nativePin;return save.call(this);};
 await e.m.polishTermNotes(e.calendar,e.state,e.store,161,()=>{});
 a.equal(e.db.length,1);a.equal(e.db[0].identifier,old.identifier);
 a.equal(e.db[0].location,rec.location);
});
test('CookieJar expires Epoch-dated Set-Cookie headers instead of keeping them as session cookies',async()=>{
 const {m}=await env();
 const jar=new m.CookieJar();
 jar.ingest('https://jwxt.nufe.edu.cn/',{'set-cookie':'SESSION=abc; Path=/; Secure'});
 a.equal(jar.header('https://jwxt.nufe.edu.cn/'),'SESSION=abc');
 jar.ingest('https://jwxt.nufe.edu.cn/',{'set-cookie':'SESSION=deleted; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'});
 a.equal(jar.header('https://jwxt.nufe.edu.cn/'),'');
 jar.ingest('https://jwxt.nufe.edu.cn/',{'set-cookie':'SID=1; Path=/'});
 jar.ingest('https://jwxt.nufe.edu.cn/',{'set-cookie':'SID=0; Path=/; Max-Age=-1'});
 a.equal(jar.header('https://jwxt.nufe.edu.cn/'),'');
});
test('NUFE free classroom query sends the chosen date and normalized lesson units',async()=>{
 const e=await env();
 const requested=[];
 const http={
  get:async()=>({url:'https://jwxt.nufe.edu.cn/student/for-std/course-table',text:'var personId=100;var currentSemester={"id":161};<select id="allSemesters"><option value="161">2026-2027-1</option></select>'}),
  json:async(_url,{body})=>{
   const seg=JSON.parse(body).dateTimeSegmentCmd;
   requested.push(seg);
   return {roomList:[{id:301,nameZh:'博远楼JC301',buildingName:'博远楼',floor:3}]};
  }
 };
 const result=await e.m.queryFreeRooms(http,()=>{},()=>{},Date.parse('2026-11-23T04:00:00Z'),()=>{},[
  {period:'自选时段',units:['10','8','9','9']}
 ],'2026-12-01');
 a.deepEqual(requested,[{startDateTime:'2026-12-01',endDateTime:'2026-12-01',units:['8','9','10']}]);
 a.deepEqual(JSON.parse(JSON.stringify(result)),{
  date:'2026-12-01',
  rooms:[{period:'自选时段',units:['8','9','10'],buildings:[{name:'博远楼',floors:[{floor:3,roomCodes:['JC301']}]}]}]
 });
});
test('classroom lookup rejects impossible selected dates before contacting the school',async()=>{
 const {m}=await env();
 const http={get:async()=>{throw new Error('unexpected auth request');}};
 await a.rejects(()=>m.queryFreeRooms(http,undefined,undefined,undefined,undefined,undefined,'2027-02-29'),code('ROOM_DATE'));
});
