// @ts-nocheck
import * as Scripting from "scripting";
// Native forms are loaded only in the foreground.
let __COURSESYNC_BOOT_PHASE='初始化运行接口';
async function __COURSESYNC_REPORT_STARTUP(error){
  const api=name=>Scripting[name]??globalThis[name];
  const known=error&&typeof error.code==='string'&&/^[A-Z][A-Z0-9_]{0,60}$/.test(error.code)?error.code:
    error&&error.name==='TypeError'?'STARTUP_TYPE':error&&error.name==='ReferenceError'?'STARTUP_REFERENCE':'STARTUP_FAILED';
  const message='阶段：'+__COURSESYNC_BOOT_PHASE+'\n错误代码：'+known+'\n脚本尚未完成启动。请保留这段错误信息；不要分享密码或 Cookie。';
  console.error('[CourseSync] '+known+' · '+__COURSESYNC_BOOT_PHASE);
  if(api('Script')?.env==='index'){
    try{await api('Dialog').alert({title:'课表启动失败',message});}
    catch(_){try{await api('Notification').schedule({title:'CourseSync · 启动失败',body:message,silent:true});}catch(__){}}
  }else{
    try{await bounded(api('Notification').schedule({title:'CourseSync · 启动失败',body:message,silent:true}),1000,'NOTIFICATION_FAILED');}catch(_){}
  }
  const __intent=Scripting.Intent??globalThis.Intent;
  const __hostScript=Scripting.Script??globalThis.Script;
  const msg='刷新失败：'+known;
  // A Shortcuts result must remain an IntentValue, including on startup errors.
  // Never fall back to a bare string or silently fabricate a successful exit.
  try{
    if(typeof __hostScript?.exit!=='function'||typeof __intent?.text!=='function')
      throw new Error('Intent text/Script exit unavailable');
    __hostScript.exit(__intent.text(msg));
  }catch(exitError){
    console.error('[CourseSync] Intent startup exit failed');
    throw exitError;
  }
}
async function bounded(work,milliseconds,code){
  let timer;
  const alarm=new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Object.assign(new Error(code),{code})),milliseconds);
  });
  try{return await Promise.race([work,alarm]);}
  finally{clearTimeout(timer);}
}
async function __NUFE_START(){
  try{
    console.log('[CourseSync] 正在启动');
const hostAPI=name=>Scripting[name]??globalThis[name];
const HostScript=hostAPI('Script')||{},HostFiles=hostAPI('FileManager')||{},HostKeys=hostAPI('Keychain')||{};
const HostCalendar=hostAPI('Calendar')||{},HostEvent=hostAPI('CalendarEvent'),HostDialog=hostAPI('Dialog')||{};
const HostNotification=hostAPI('Notification')||{},hostFetch=hostAPI('fetch');
const __query=HostScript.queryParameters||{};
const __intent=hostAPI('Intent');
let __intentText='';try{const p=__intent?.shortcutParameter;if(p?.type==='text')__intentText=String(p.value||'');}catch(_){}
const __mode=String(__query.mode||__intentText||(HostScript.env==='index'?'menu':'sync')).trim().toLowerCase()==='menu'?'menu':'sync';
let __shortcutOutput=null;
const __webviews=new Set();
// Leave time after the Intent's work budget for the result and cleanup.
const backgroundDeadline=HostScript.env==='intent'?Date.now()+20000:Infinity;
const BACKGROUND_ROTATION_MS=6000, BACKGROUND_EXAM_RESERVE_MS=6000;
const FOREGROUND_EXAM_RESERVE_MS=60000;
let calendarReadDeadline=backgroundDeadline;
const awaitNotification=work=>backgroundDeadline===Infinity?work:bounded(work,1000,'NOTIFICATION_FAILED');
const config={runsInApp:HostScript.env==='index',runsWithSiri:true};
let presentNativeCredentialForm,presentNativeTextForm,presentNativeRefreshForm;
let presentNativeDashboard,presentNativeCalendarManager,presentNativeDialog;
// Test-only injections simulate the index host without invoking native modules.
if(globalThis.__COURSESYNC_TEST__){
  presentNativeCredentialForm=(...a)=>globalThis.__nativeCredentialMock(...a);
  presentNativeTextForm=(...a)=>globalThis.__nativeTextMock(...a);
  presentNativeRefreshForm=(...a)=>globalThis.__nativeRefreshMock(...a);
  presentNativeDialog=(...a)=>globalThis.__nativeDialogMock?globalThis.__nativeDialogMock(...a):Promise.reject(new Error('No native dialog mock'));
  presentNativeDashboard=(...a)=>globalThis.__nativeDashboardMock?globalThis.__nativeDashboardMock(...a):-1;
  presentNativeCalendarManager=(...a)=>globalThis.__calendarManagerMock?globalThis.__calendarManagerMock(...a):null;
}else if(config.runsInApp){
  const native=await import('./login-native');
  ({presentNativeCredentialForm,presentNativeTextForm,presentNativeRefreshForm,
    presentNativeDashboard,presentNativeCalendarManager,presentNativeDialog}=native);
}

const args={shortcutParameter:__mode==='menu'?'':'sync'};
let __exitAttempted=false;
const Script={name:()=>HostScript.name,setShortcutOutput:value=>{__shortcutOutput=String(value);},complete:()=>{
  // Cleanup must never suppress the result returned to Shortcuts.
  for(const w of __webviews)try{w.dispose();}catch(_){}
  __webviews.clear();
  if(__exitAttempted)return;
  if(typeof HostScript.exit!=='function'||typeof __intent?.text!=='function')
    throw new Error('Intent text/Script exit unavailable');
  const result=__intent.text(__shortcutOutput||'处理完成');
  __exitAttempted=true;
  HostScript.exit(result);
}};
const FileManager={local:()=>({
  libraryDirectory:()=>HostFiles.appGroupDocumentsDirectory+'/CourseSync',
  joinPath:(a,b)=>a.replace(/\/$/,'')+'/'+b,
  fileExists:p=>HostFiles.existsSync(p),createDirectory:(p,r)=>HostFiles.createDirectorySync(p,r),
  listContents:p=>HostFiles.readDirectorySync(p,false).map(n=>String(n).split('/').pop()),readString:p=>HostFiles.readAsStringSync(p),
  writeString:(p,text)=>HostFiles.writeAsStringSync(p,text),remove:p=>HostFiles.removeSync(p),
  move:(from,to)=>{if(HostFiles.existsSync(to)){const e=new Error('BUSY');e.code='BUSY';throw e;}HostFiles.renameSync(from,to);}
})};
const __keyOptions={synchronizable:false,accessibility:'first_unlock_this_device'};
const Keychain={
 contains:key=>HostKeys.contains(key,{synchronizable:false}),get:key=>HostKeys.get(key,{synchronizable:false}),
 set:(key,value)=>{if(HostKeys.set(key,value,__keyOptions)!==true||HostKeys.get(key,{synchronizable:false})!==value){const e=new Error('CREDENTIALS_UNAVAILABLE');e.code='CREDENTIALS_UNAVAILABLE';throw e;}},
 remove:key=>{if(HostKeys.remove(key,{synchronizable:false})!==true){const e=new Error('CREDENTIALS_UNAVAILABLE');e.code='CREDENTIALS_UNAVAILABLE';throw e;}}
};
// Only account/password credentials use iCloud Keychain. Session cookies,
// person IDs, fingerprints and the original local keys remain device-only.
const __cloudOptions={synchronizable:true,accessibility:'first_unlock'};
const CloudKeychain={
  contains:key=>HostKeys.contains(key,{synchronizable:true}),
  get:key=>HostKeys.get(key,{synchronizable:true}),
  set:(key,value)=>{
    if(HostKeys.set(key,value,__cloudOptions)!==true||
       HostKeys.get(key,{synchronizable:true})!==value){
      const e=new Error('CREDENTIALS_UNAVAILABLE');e.code='CREDENTIALS_UNAVAILABLE';throw e;
    }
  },
  remove:key=>{
    if(HostKeys.remove(key,{synchronizable:true})!==true){
      const e=new Error('CREDENTIALS_UNAVAILABLE');e.code='CREDENTIALS_UNAVAILABLE';throw e;
    }
  }
};
const UUID=hostAPI('UUID');
const Timer={schedule:(ms,repeats,callback)=>{const id=repeats?setInterval(callback,ms):setTimeout(callback,ms);return {invalidate:()=>repeats?clearInterval(id):clearTimeout(id)};}};
const Calendar={forEvents:()=>HostCalendar.forEvents(),create:options=>HostCalendar.create(options)};
function CalendarEvent(){return new HostEvent();}
CalendarEvent.between=(from,to,calendars)=>HostEvent.getAll(from,to,calendars);
class Alert{
 constructor(){this.title='';this.message='';this.actions=[];this.fields=[];this.values=[];this.cancel=false;this.cancelLabel='取消';}
 addAction(label){this.actions.push({label});}addDestructiveAction(label){this.actions.push({label,destructive:true});}
 addCancelAction(label){this.cancel=true;this.cancelLabel=label;}
 addTextField(placeholder,value=''){this.fields.push({placeholder,value,secure:false});}
 addSecureTextField(placeholder,value=''){this.fields.push({placeholder,value,secure:true});}
 textFieldValue(i){return this.values[i]??'';}
 async presentGlass(){
   if(!config.runsInApp||typeof presentNativeDialog!=='function')return undefined;
   try{return await presentNativeDialog({title:this.title,message:this.message,actions:this.actions,cancel:this.cancel,cancelLabel:this.cancelLabel,field:this.fields[0]});}catch(_){return undefined;}
 }
 async presentSheet(){const result=await this.presentGlass();if(result!==undefined)return result===null?-1:result.index;const n=await HostDialog.actionSheet({title:this.title,message:this.message,actions:this.actions,cancelButton:this.cancel});return n==null?-1:n;}
 async presentAlert(){
   const result=await this.presentGlass();
   if(result!==undefined){if(result===null)return -1;if(this.fields.length)this.values=[result.value];return result.index;}
   if(this.fields.length){const f=this.fields[0];const value=await HostDialog.prompt({title:this.title,message:this.message,placeholder:f.placeholder,defaultValue:f.value,obscureText:f.secure,cancelLabel:this.cancelLabel,confirmLabel:this.actions[0]?.label||'继续'});if(value===null)return -1;this.values=[value];return 0;}
   if(this.cancel&&this.actions.length===1)return await HostDialog.confirm({title:this.title,message:this.message,cancelLabel:this.cancelLabel,confirmLabel:this.actions[0].label})?0:-1;
   if(this.actions.length>1)return this.presentSheet();
   await HostDialog.alert({title:this.title,message:this.message,buttonLabel:this.actions[0]?.label||'好'});return 0;
 }
}
class Request{
 constructor(url){this.url=url;this.method='GET';this.headers={};this.timeoutInterval=15;this.body=null;this.onRedirect=null;}
 async execute(binary){
   const r=await hostFetch(this.url,{method:this.method,headers:this.headers,...(this.body?{body:this.body}:{}),timeout:this.timeoutInterval,allowInsecureRequest:false,
     debugLabel:'学校官方服务请求',handleRedirect:async next=>{if(this.onRedirect)this.onRedirect(next);return null;}});
   const headers={};r.headers.forEach((value,name)=>{headers[name]=value;});
   this.response={statusCode:r.status,headers,cookies:r.cookies||[],mimeType:r.mimeType||r.headers.get('content-type')||''};
   return binary?await r.data():await r.text();
 }
 async loadString(){return this.execute(false);}async load(){return this.execute(true);}
}
class WebView{
 constructor(){
   const Controller=hostAPI('WebViewController');
   if(typeof Controller!=='function')fail('WEBVIEW_UNAVAILABLE');
   this.inner=new Controller({ephemeral:true});__webviews.add(this.inner);
 }
 async loadHTML(html){if(!await this.inner.loadHTML(html))fail('WEBVIEW_LOAD_FAILED');}
 async present(title='NUFE 验证'){await this.inner.present({navigationTitle:title});}
}
class Notification{
 constructor(){this.identifier='';this.title='';this.body='';this.sound=null;this.openURL=null;this.triggerDate=null;}
 setTriggerDate(date){this.triggerDate=date;}
 async schedule(){
   const options={title:this.title,body:this.body,silent:this.sound===null,threadIdentifier:'NUFE-Local-refresh',tapAction:{type:'openURL',url:this.openURL||HostScript.createRunURLScheme(HostScript.name,{mode:'menu'})}};
   if(this.identifier)options.identifier=this.identifier;
   if(this.triggerDate){
     const diff=Math.max(1,Math.round((this.triggerDate.getTime()-Date.now())/1000));
     const Trigger=hostAPI('TimeIntervalNotificationTrigger');
     if(Trigger)options.trigger=new Trigger({timeInterval:diff,repeats:false});
     else options.triggerDate=this.triggerDate;
   }
   return awaitNotification(HostNotification.schedule(options));
 }
 static async allPending(){return awaitNotification(HostNotification.getAllPendingsOfCurrentScript());}
 static async removePending(ids){if(ids.length)await awaitNotification(HostNotification.removePendings(ids));}
}
const Data=hostAPI('Data'),Image={fromData:data=>hostAPI('UIImage').fromData(data)};
const QuickLook={present:image=>hostAPI('QuickLook').previewImage(image)};

// SPDX-License-Identifier: GPL-3.0-only
// CourseSync: native Scripting timetable sync engine.
'use strict';
const ENDPOINT_KEY='CourseSync.Local.v1.school-endpoints';
const JW='https://jwxt.nufe.edu.cn';
const ENDPOINT_DEFAULTS=Object.freeze({
  auth:'https://authserver.nufe.edu.cn/authserver',
  sso:JW+'/student/sso/login',
  table:JW+'/student/for-std/course-table',
  semester:JW+'/student/ws/semester/get/{sid}',
  courses:JW+'/student/for-std/course-table/semester/{sid}/print-data'
});
let AUTH=ENDPOINT_DEFAULTS.auth;
let SSO=ENDPOINT_DEFAULTS.sso;
let TABLE=ENDPOINT_DEFAULTS.table;
let SEMESTER_ENDPOINT=ENDPOINT_DEFAULTS.semester;
let COURSE_DATA_ENDPOINT=ENDPOINT_DEFAULTS.courses;
const SCHOOL_KEY='CourseSync.Local.v1.school';
const SCHOOL_CHOICE_KEY='CourseSync.Local.v1.school-choice';
const SCHOOL_RESELECT_KEY='CourseSync.Local.v1.school-reselect';
const activeSchoolId='nufe';
const NUFE_SCHOOL=Object.freeze({id:'nufe',name:'南京财经大学',endpoints:ENDPOINT_DEFAULTS});
function schoolKey(key){return key;}
function schoolById(id){return id===NUFE_SCHOOL.id?NUFE_SCHOOL:null;}
function loadSelectedSchool(fallback='nufe',strict=false){
  try{
    if(Keychain.contains(SCHOOL_CHOICE_KEY)){
      const choice=Keychain.get(SCHOOL_CHOICE_KEY);
      if(schoolById(choice))return choice;
    }
    if(strict)return fallback;
    if(!Keychain.contains(SCHOOL_KEY))return fallback;
    const id=Keychain.get(SCHOOL_KEY);
    return schoolById(id)?id:fallback;
  }catch(_){return fallback;}
}
function activateSelectedSchool(id){
  const school=schoolById(id);
  assert(school,'SCHOOL_UNSUPPORTED');
  activateEndpointSettings(school.endpoints);
  return school;
}
const KEY = 'CourseSync.Local.v1.cookies';
// Scripting Keychain is device/app-level credential storage; never store this key in JSON state.
const CRED_KEY = 'CourseSync.Local.v1.saved-login'; // Legacy device-only credential key.
const CLOUD_CRED_KEY = 'CourseSync.v1.icloud-credentials';
// One-time, readback-verified migration from NUFE-Schedule's Keychain keys.
// Originals remain available for rollback until the user explicitly logs out.
const LEGACY_DEVICE_KEYS=Object.freeze([
  [ENDPOINT_KEY,'NUFE.Local.v1.school-endpoints'],
  [KEY,'NUFE.Local.v1.cookies'],
  [CRED_KEY,'NUFE.Local.v1.saved-login'],
  ['CourseSync.Local.v1.device','NUFE.Local.v1.device'],
  ['CourseSync.Local.v1.person','NUFE.Local.v1.person'],
  ['CourseSync.Local.v1.student','NUFE.Local.v1.student']
]);
const LEGACY_CLOUD_CRED_KEY='NUFE.Schedule.v1.icloud-credentials';
const LEGACY_IMPORT_KEY='CourseSync.Local.v1.migrated';
function migrateLegacyKeychainData(){
  if(Keychain.contains(LEGACY_IMPORT_KEY))return;
  try{
    for(const [current,old] of LEGACY_DEVICE_KEYS){
      if(Keychain.contains(current)||!Keychain.contains(old))continue;
      const value=Keychain.get(old);
      if(typeof value!=='string')fail('CREDENTIALS_INVALID');
      Keychain.set(current,value);
      if(Keychain.get(current)!==value)fail('CREDENTIALS_UNAVAILABLE');
    }
    if(!CloudKeychain.contains(CLOUD_CRED_KEY)&&CloudKeychain.contains(LEGACY_CLOUD_CRED_KEY)){
      const value=CloudKeychain.get(LEGACY_CLOUD_CRED_KEY);
      if(typeof value!=='string')fail('CREDENTIALS_INVALID');
      CloudKeychain.set(CLOUD_CRED_KEY,value);
      if(CloudKeychain.get(CLOUD_CRED_KEY)!==value)fail('CREDENTIALS_UNAVAILABLE');
    }
    Keychain.set(LEGACY_IMPORT_KEY,'1');
    if(Keychain.get(LEGACY_IMPORT_KEY)!=='1')fail('CREDENTIALS_UNAVAILABLE');
  }catch(e){
    if(e?.code==='CREDENTIALS_INVALID')throw e;
    fail('CREDENTIALS_UNAVAILABLE');
  }
}

function credentialRecord(raw){
  let saved;try{saved=JSON.parse(raw);}catch(_){fail('CREDENTIALS_INVALID');}
  if(!saved||saved.version!==1||typeof saved.username!=='string'||typeof saved.password!=='string'||
     !/^.{1,100}$/.test(saved.username)||!saved.password||saved.password.length>512)fail('CREDENTIALS_INVALID');
  return saved;
}
function localCredentialRaw(){return Keychain.contains(schoolKey(CRED_KEY))?Keychain.get(schoolKey(CRED_KEY)):null;}
function cloudCredentialRaw(){return CloudKeychain.contains(schoolKey(CLOUD_CRED_KEY))?CloudKeychain.get(schoolKey(CLOUD_CRED_KEY)):null;}
function hasSavedCredentials(){
  try{
    if(Keychain.contains(schoolKey(CRED_KEY)))return true; // Retain login during migration/offline sync.
    return CloudKeychain.contains(schoolKey(CLOUD_CRED_KEY));
  }catch(_){fail('CREDENTIALS_UNAVAILABLE');}
}
function readSavedCredentials(){
  // A pre-migration device keeps using its own account if a different Apple ID
  // credential appears in iCloud. Never silently switch an existing account.
  let raw;
  try{raw=localCredentialRaw()||cloudCredentialRaw();}catch(_){fail('CREDENTIALS_UNAVAILABLE');}
  return raw===null?null:credentialRecord(raw);
}
function migrateSavedCredentials(){
  // Safe lazy migration: never remove the old local value before a verified
  // synchronized read-back. A mismatch with an existing cloud account is
  // reported rather than overwritten by an automatic background run.
  const local=localCredentialRaw();
  if(!local)return 'cloud-or-empty';
  credentialRecord(local);
  let remote=cloudCredentialRaw();
  if(remote&&remote!==local)return 'conflict';
  if(!remote){CloudKeychain.set(schoolKey(CLOUD_CRED_KEY),local);remote=cloudCredentialRaw();}
  if(remote!==local)fail('CREDENTIALS_UNAVAILABLE');
  Keychain.remove(schoolKey(CRED_KEY));
  return 'migrated';
}
function saveCredentials(username,password){
  username=String(username||'').trim();
  if(!username||username.length>100||typeof password!=='string'||!password||password.length>512)fail('CREDENTIALS_INVALID');
  const value=JSON.stringify({version:1,username,password});
  // Store ONLY the selected credentials in iCloud, never the session cookies.
  try{
    CloudKeychain.set(schoolKey(CLOUD_CRED_KEY),value);
    if(Keychain.contains(schoolKey(CRED_KEY))){
      // Avoid a stale local value shadowing the newly saved cloud password.
      Keychain.set(schoolKey(CRED_KEY),value);
      Keychain.remove(schoolKey(CRED_KEY));
    }
  }catch(_){fail('CREDENTIALS_UNAVAILABLE');}
}
function removeSavedCredentials(){
  try{
    // Deleting a synchronized item also deletes the other devices' copies.
    if(CloudKeychain.contains(schoolKey(CLOUD_CRED_KEY)))CloudKeychain.remove(schoolKey(CLOUD_CRED_KEY));
    if(Keychain.contains(schoolKey(CRED_KEY)))Keychain.remove(schoolKey(CRED_KEY));
    if(CloudKeychain.contains(LEGACY_CLOUD_CRED_KEY))
      CloudKeychain.remove(LEGACY_CLOUD_CRED_KEY);
    if(Keychain.contains('NUFE.Local.v1.saved-login'))
      Keychain.remove('NUFE.Local.v1.saved-login');
  }catch(_){fail('CREDENTIALS_UNAVAILABLE');}
}
// The following is only a local read-back check, not proof that iCloud has
// already delivered this item to a second device. No secret values are logged.
function credentialStorageStatus(){
  let cloud=false,local=false;
  try {
    cloud=CloudKeychain.contains(schoolKey(CLOUD_CRED_KEY));
    local=Keychain.contains(schoolKey(CRED_KEY));
    if(cloud)credentialRecord(CloudKeychain.get(schoolKey(CLOUD_CRED_KEY)));
    if(local)credentialRecord(Keychain.get(schoolKey(CRED_KEY)));
  }catch(_){return '凭据不可读取或数据异常';}
  if(cloud&&local)return 'iCloud 可同步凭据已保存；检测到旧本机凭据，请检查迁移';
  if(cloud)return 'iCloud 可同步凭据已保存';
  if(local)return '仅检测到本机旧凭据，尚未迁移至 iCloud';
  return '未保存账号密码';
}

const DAY = 86400000;
function fail(code) { const e = new Error(code); e.code = code; throw e; }
function assert(ok, code = 'SCHEMA') { if (!ok) fail(code); }
function clone(x) { return JSON.parse(JSON.stringify(x)); }
function uuid() { return UUID.string().toLowerCase(); }
function enc(x) { return encodeURIComponent(String(x)); }
function form(o) { return Object.entries(o).map(([k,v]) => enc(k)+'='+enc(v)).join('&'); }
function safeURL(s) {
  // Deliberately strict: credentials, alternate ports, encoded hosts, HTTP rejected.
  const m = /^https:\/\/([a-z0-9.-]+)(\/[^\s\\#]*)?$/.exec(s);
  const hosts=['authserver.nufe.edu.cn','jwxt.nufe.edu.cn'];
  assert(m&&hosts.includes(m[1]), 'DOMAIN_BLOCKED');
  return {host:m[1], path:(m[2] || '/').split('?')[0]};
}
function resolveURL(base, loc) {
  if (/^https:\/\//.test(loc)) { safeURL(loc); return loc; }
  assert(!/^[a-z]+:|^\/\/|[\\\r\n]/i.test(loc),'DOMAIN_BLOCKED');
  const host = safeURL(base).host;
  let path = loc.startsWith('/') ? loc : loc.startsWith('?') ? safeURL(base).path+loc : safeURL(base).path.replace(/[^/]*$/, '')+loc;
  const parts=[];
  for(const p of path.split('/')) { if(p==='..') parts.pop(); else if(p!=='.') parts.push(p); }
  const out='https://'+host+parts.join('/'); safeURL(out); return out;
}
// Local editable paths only: credentials never go to an untrusted host.
function validateEndpointSettings(value) {
  assert(value&&typeof value==='object'&&!Array.isArray(value),'ENDPOINT_CONFIG');
  const result={};
  for(const key of Object.keys(ENDPOINT_DEFAULTS)){
    const raw=value[key];
    assert(typeof raw==='string'&&raw===raw.trim()&&raw.length<=220,'ENDPOINT_CONFIG');
    const template=key==='semester'||key==='courses';
    assert(raw.split('{sid}').length===(template?2:1),'ENDPOINT_CONFIG');
    const checked=template?raw.replace('{sid}','123'):raw;
    assert(/^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9_./-]+$/.test(checked)&&
      !checked.slice(8).includes('//')&&
      !checked.split('/').some(p=>p==='.'||p==='..'),'ENDPOINT_CONFIG');
    let parsed;
    const host=checked.slice(8).split('/')[0];
    parsed={host,path:checked.slice(8+host.length)};
    if(key==='auth')assert(parsed.host==='authserver.nufe.edu.cn'&&
      /^\/authserver(?:\/|$)/.test(parsed.path),'ENDPOINT_CONFIG');
    else assert(parsed.host==='jwxt.nufe.edu.cn'&&
      /^\/student\//.test(parsed.path),'ENDPOINT_CONFIG');
    result[key]=raw;
  }
  return result;
}
function loadEndpointSettings(){return {...ENDPOINT_DEFAULTS};}
function activateEndpointSettings(value){
  const valid=validateEndpointSettings(value);
  AUTH=valid.auth;SSO=valid.sso;TABLE=valid.table;
  SEMESTER_ENDPOINT=valid.semester;COURSE_DATA_ENDPOINT=valid.courses;
}
function termEndpoint(template,sid){
  const id=String(sid);
  assert(/^\d{1,12}$/.test(id),'ENDPOINT_CONFIG');
  const url=template.replace('{sid}',id);
  safeURL(url);return url;
}
async function prepareManualRefresh(state,forceCredentials=false){
  if(!config.runsInApp)fail('AUTH_INTERACTIVE_REQUIRED');
  const allowReuse=!forceCredentials&&!state?.signedOut&&activeSchoolId===NUFE_SCHOOL.id&&canOfferSignOut(state);
  let response;
  try{
    response=await presentNativeRefreshForm(NUFE_SCHOOL.id,allowReuse,NUFE_SCHOOL.name+'登录');
  }catch(_){fail('ENDPOINT_UI');}
  if(!response)return null;
  assert(response.schoolId===NUFE_SCHOOL.id,'SCHOOL_UNSUPPORTED');
  assert(response.kind==='reuse'||response.kind==='credentials','SCHOOL_UNSUPPORTED');
  if(response.kind==='reuse')assert(!forceCredentials&&!state?.signedOut&&activeSchoolId===NUFE_SCHOOL.id,'SCHOOL_UNSUPPORTED');
  else assert(typeof response.username==='string'&&typeof response.password==='string'&&
    response.username.trim().length>0&&response.username.length<=100&&
    response.password.length>0&&response.password.length<=512,'CREDENTIALS_INVALID');
  try{
    if(Keychain.contains(ENDPOINT_KEY))Keychain.remove(ENDPOINT_KEY);
    if(Keychain.contains(ENDPOINT_KEY))fail('ENDPOINT_STORAGE');
    Keychain.set(SCHOOL_CHOICE_KEY,NUFE_SCHOOL.id);
  }catch(_){fail('ENDPOINT_STORAGE');}
  activateSelectedSchool(NUFE_SCHOOL.id);
  if(response.kind==='reuse')return {kind:'reuse'};
  return {kind:'credentials',username:response.username.trim(),password:response.password};
}

function topId(html, name) {
  const m = new RegExp('\\b'+name+'\\s*=\\s*\\{').exec(html); if(!m) return null;
  let depth=0, quote=null;
  for(let i=m.index+m[0].length-1; i<html.length; i++) {
    const c=html[i];
    if(quote) { if(c==='\\') i++; else if(c===quote) quote=null; }
    else if(c==='"'||c==="'") { quote=c; if(depth===1) { const k=/^(['"])id\1\s*:\s*(\d+)/.exec(html.slice(i)); if(k)return +k[2]; } }
    else if(c==='{')depth++; else if(c==='}'&&--depth===0)break;
  } return null;
}
function pagePerson(html){
  const match=/\bpersonId\s*=\s*([1-9]\d*)\b/.exec(html);
  assert(match,'AUTH_REQUIRED');
  return match[1];
}
function authenticatedPerson(response){
  const {host,path}=safeURL(response.url);
  assert(host===safeURL(JW).host&&path!=='/student/login','AUTH_REQUIRED');
  return pagePerson(response.text);
}
function pageInfo(html) {
  const person=pagePerson(html),sid=topId(html,'currentSemester');
  assert(sid,'SCHEMA');
  const select=/<select\b[^>]*id=["']allSemesters["'][^>]*>([\s\S]*?)<\/select>/i.exec(html);
  const semesters=[]; if(select)for(const m of select[1].matchAll(/<option\b[^>]*value=["'](\d+)["'][^>]*>([^<]*)<\/option>/g))semesters.push({id:+m[1],name:m[2].trim()});
  if(!semesters.some(s=>s.id===sid))semesters.unshift({id:sid,name:String(sid)});
  return {person,current:sid,semesters};
}
function verifyBoundPerson(person,bind=false){
  const key=schoolKey('CourseSync.Local.v1.person');
  if(Keychain.contains(key))assert(Keychain.get(key)===person,'ACCOUNT_CHANGED');
  else if(bind)Keychain.set(key,person);
}
function hm(s) { const m=/^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(String(s)); assert(m&&+m[1]<24&&+m[2]<60,'TIME_MISSING'); return m[1].padStart(2,'0')+':'+m[2]; }
function monday(s) { assert(/^\d{4}-\d{2}-\d{2}$/.test(s),'ANCHOR'); const d=new Date(s+'T00:00:00Z'); assert(Number.isFinite(+d)&&d.toISOString().slice(0,10)===s&&d.getUTCDay()===1,'ANCHOR'); return s; }
function detailMonday(detail) {
  for(const k of ['startDate','beginDate','startOn','start']) {
    const v=detail&&detail[k]; if(typeof v!=='string')continue;
    const s=v.slice(0,10), d=new Date(s+'T00:00:00Z');
    if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==s)continue;
    d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7); return d.toISOString().slice(0,10);
  } return null;
}
// Clear structured pins on CourseSync-managed events, including the previous
// building-map experiment. All normal locations are plain classroom text.
function hasRetiredCalendarPin(event){
  // EventKit may represent a plain text location as a structured object too.
  // Only a real coordinate needs migration, never the presence of an object.
  try{
    const geo=event.structuredLocation?.geoLocation;
    return Number.isFinite(geo?.latitude)&&Number.isFinite(geo?.longitude);
  }catch(_){return false;}
}
function restoreCalendarRoom(event,room){
  // Coordinate removal is best-effort: native calendar may resolve a text
  // location again. Verification must only cover the authoritative room text.
  if(hasRetiredCalendarPin(event)){
    try{event.structuredLocation=null;}catch(_){}
  }
  event.location=room;
}

function expand(raw, sid, anchor, teachingDates=null) {
  const anchorMs=Date.parse(monday(anchor)+'T00:00:00Z');
  assert(raw&&Array.isArray(raw.studentTableVms)&&raw.studentTableVms.length===1,'SCHEMA');
  const vm=raw.studentTableVms[0]; assert(vm&&Array.isArray(vm.activities),'SCHEMA');
  const acts=vm.activities, starts={}, ends={};
  for(const a of acts) { assert(a&&typeof a==='object','SCHEMA'); if(a.startTime) {const t=hm(a.startTime); if(starts[a.startUnit]&&starts[a.startUnit]!==t)starts[a.startUnit]='conflict'; else starts[a.startUnit]=t;} if(a.endTime){const t=hm(a.endTime);if(ends[a.endUnit]&&ends[a.endUnit]!==t)ends[a.endUnit]='conflict';else ends[a.endUnit]=t;} }
  const events=[], skipped=[], weekDates=new Map();
  for(const a of acts) {
    if(!a.weekday&&!a.startUnit) {skipped.push(String(a.courseName||'未排课'));continue;}
    const wd=Number(a.weekday),su=Number(a.startUnit),eu=Number(a.endUnit||a.startUnit);
    assert(Number.isInteger(wd)&&wd>=1&&wd<=7&&Number.isInteger(su)&&su>=1&&Number.isInteger(eu)&&eu>=su,'SCHEMA');
    assert(typeof a.courseName==='string'&&a.courseName.trim()&&Array.isArray(a.weekIndexes)&&a.weekIndexes.length,'SCHEMA');
    const st=hm(a.startTime||starts[su]), et=hm(a.endTime||ends[eu]);assert(et>st,'TIME_MISSING');
    const weeks=[...new Set(a.weekIndexes.map(Number))].sort((a,b)=>a-b);
    assert(weeks.every(w=>Number.isInteger(w)&&w>=1&&w<=60),'SCHEMA');
    assert(a.teachers==null||Array.isArray(a.teachers),'SCHEMA');
    const teachers=(a.teachers||[]).map(t=>String(typeof t==='object'&&t ? t.name||t.teacherName||'':t||'').replace(/\s*[(（].*$/,'').trim()).filter(Boolean).sort();
    for(const week of weeks) {
      const slotKey=week*10+wd;
      let date;
      if(teachingDates)date=teachingDates.get(slotKey);
      else{
        date=weekDates.get(slotKey);
        if(!date){
          date=new Date(anchorMs+((week-1)*7+wd-1)*DAY).toISOString().slice(0,10);
          weekDates.set(slotKey,date);
        }
      }
      assert(date,'ANCHOR');
      events.push({sid:String(sid),title:a.courseName.trim(),week,su,eu,start:new Date(date+'T'+st+':00+08:00').toISOString(),end:new Date(date+'T'+et+':00+08:00').toISOString(),location:[a.room||a.building].filter(Boolean).join(' '),teachers});
    }
  }
  events.sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title)||a.location.localeCompare(b.location));
  // Duplicate records cannot be distinguished safely without an authoritative instance ID.
  const signatures=events.map(e=>JSON.stringify(e));assert(new Set(signatures).size===events.length,'DUPLICATE_SOURCE');
  return {events,skipped,studentCode:String(vm.code||'')};
}
function same(a,b) { return sameCalendarCourse(a,b)&&JSON.stringify(a.teachers)===JSON.stringify(b.teachers); }
function sameCalendarCourse(a,b) {
  return ['sid','title','start','end','location','week','su','eu'].every(k=>a[k]===b[k]);
}
function groupBy(items,keyOf){
  const groups=new Map();
  for(const item of items){
    const key=keyOf(item), bucket=groups.get(key);
    if(bucket)bucket.push(item);
    else groups.set(key,[item]);
  }
  return groups;
}
function plan(old, incoming, newId) {
  const out=incoming.map(x=>({...x})),used=new Set(),paired=new Set(),inferred=[],ambiguous=[];
  function pair(before,after,guess=false){
    after.id=before.id;used.add(before);paired.add(after);
    if(guess)inferred.push(after.id);
  }
  const lessonKey=e=>e.sid+'\0'+e.title;
  const timeKey=e=>e.sid+'\0'+e.title+'\0'+e.start+'\0'+e.end;
  const byTime=groupBy(old,timeKey);
  // Match exact name+time first, irrespective of room / teacher changes.
  for(const next of out){
    const matches=byTime.get(timeKey(next));
    if(matches?.length===1&&!used.has(matches[0]))pair(matches[0],next);
  }
  const oldByName=groupBy(old.filter(e=>!used.has(e)),lessonKey);
  for(const [key,next] of groupBy(out,lessonKey)){
    let ns=next.filter(e=>!paired.has(e)),os=oldByName.get(key)||[];
    if(!ns.length||!os.length)continue;
    // One unmatched instance in the same teaching week is an explainable inference.
    const oldByWeek=groupBy(os,e=>e.week);
    for(const [week,rows] of groupBy(ns,e=>e.week)){
      const before=oldByWeek.get(week);
      if(rows.length===1&&before?.length===1)pair(before[0],rows[0],true);
    }
    ns=ns.filter(e=>!paired.has(e));os=os.filter(e=>!used.has(e));
    if(ns.length===1&&os.length===1&&Math.abs(Date.parse(ns[0].start)-Date.parse(os[0].start))<=14*DAY)pair(os[0],ns[0],true);
    else if(ns.length&&os.length)ambiguous.push(key.split('\0')[1]);
  }
  const oldById=new Map(old.map(event=>[event.id,event]));
  const added=[],changed=[];
  for(const event of out){
    if(!event.id)event.id=newId();
    const before=oldById.get(event.id);
    if(!before)added.push(event);
    else if(!same(before,event))changed.push(event);
  }
  return {events:out,added,removed:old.filter(event=>!used.has(event)),changed,inferred,ambiguous};
}
// AES key expansion + AES-CBC/PKCS#7, tested against Node's crypto for 128/192/256 bits.
function utf8(s) { return Array.from(unescape(encodeURIComponent(s)),c=>c.charCodeAt(0)); }
function b64(bytes) { const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';let out='';for(let i=0;i<bytes.length;i+=3){const n=(bytes[i]<<16)|((bytes[i+1]||0)<<8)|(bytes[i+2]||0);out+=chars[n>>>18]+chars[(n>>>12)&63]+(i+1<bytes.length?chars[(n>>>6)&63]:'=')+(i+2<bytes.length?chars[n&63]:'=');}return out; }
const AES_MUL=(a,b)=>{let r=0;for(let i=0;i<8;i++){if(b&1)r^=a;a=((a<<1)^((a&128)?0x11b:0))&255;b>>=1;}return r;};
let aesSBox;
function aesCBC(message,keyString,ivString) {
  const key=utf8(keyString),iv=utf8(ivString);assert([16,24,32].includes(key.length)&&iv.length===16,'CRYPTO');
  const sb=aesSBox??=Uint8Array.from({length:256},(_,a)=>{
    let v=0;
    if(a){v=1;for(let i=0;i<254;i++)v=AES_MUL(v,a);}
    let s=v;
    for(let i=1;i<5;i++)s^=((v<<i)|(v>>>(8-i)))&255;
    return s^0x63;
  });
  const xtime=x=>((x<<1)^((x&128)?0x11b:0))&255;
  const nr=key.length/4+6,w=key.slice();let rc=1;
  while(w.length<16*(nr+1)){let t=w.slice(-4),i=w.length;if(i%key.length===0){t=[sb[t[1]]^rc,sb[t[2]],sb[t[3]],sb[t[0]]];rc=xtime(rc);}else if(key.length===32&&i%32===16)t=t.map(x=>sb[x]);for(let j=0;j<4;j++)w.push(w[i-key.length+j]^t[j]);}
  const data=utf8(message),pad=16-data.length%16;data.push(...Array(pad).fill(pad));let prev=iv,out=[];
  const s=new Uint8Array(16),before=new Uint8Array(16);
  for(let offset=0;offset<data.length;offset+=16){
    for(let i=0;i<16;i++)s[i]=data[offset+i]^prev[i]^w[i];
    for(let r=1;r<=nr;r++){
      for(let i=0;i<16;i++)before[i]=sb[s[i]];
      for(let col=0;col<4;col++)for(let row=0;row<4;row++)s[4*col+row]=before[4*((col+row)%4)+row];
      if(r!==nr)for(let c=0;c<16;c+=4){const a=s[c],b=s[c+1],d=s[c+2],e=s[c+3],t=a^b^d^e;s[c]^=t^xtime(a^b);s[c+1]^=t^xtime(b^d);s[c+2]^=t^xtime(d^e);s[c+3]^=t^xtime(e^a);}
      for(let i=0;i<16;i++)s[i]^=w[16*r+i];
    }
    const block=Array.from(s);out.push(...block);prev=block;
  }
  return b64(out);
}
async function encryptPassword(password,salt){
  assert(globalThis.crypto&&typeof globalThis.crypto.getRandomValues==='function','CRYPTO');
  const bytes=new Uint8Array(80);globalThis.crypto.getRandomValues(bytes);
  const chars='ABCDEFGHJKMNPQRSTWXYZabcdefhijkmnprstwxyz2345678';
  const random=Array.from(bytes,x=>chars[x%chars.length]).join('');
  return aesCBC(random.slice(0,64)+password,salt.trim(),random.slice(64));
}
// A server may emit several Set-Cookie headers, including attributes with commas
// in their Expires dates. Do not treat the entire header as a single cookie.
function splitSetCookie(value) {
  if(Array.isArray(value))return value.flatMap(splitSetCookie);
  if(typeof value!=='string')return [];
  // State-aware splitting: Expires dates and quoted cookie values may contain commas.
  const result=[];let start=0,attributeStart=0,quoted=false,escaped=false;
  const push=end=>{
    const item=value.slice(start,end).replace(/^\s*(?:set-cookie:\s*)?/i,'').trim();
    if(item)result.push(item);
  };
  for(let i=0;i<value.length;i++){
    const c=value[i];
    if(c==='"'&&!escaped){quoted=!quoted;continue;}
    if(quoted){escaped=c==='\\'&&!escaped;continue;}
    escaped=false;
    if(c===';'){attributeStart=i+1;continue;}
    if(c==='\n'&&/^\s*(?:set-cookie:\s*)?[^=;,\s]+=/i.test(value.slice(i+1))){
      push(i);start=i+1;attributeStart=start;continue;
    }
    if(c!==','||!/^\s*[^=;,\s]+=/i.test(value.slice(i+1)))continue;
    const attribute=value.slice(attributeStart,i).trim();
    if(/^expires\s*=/i.test(attribute)){
      const date=attribute.replace(/^expires\s*=\s*/i,'');
      if(!Number.isFinite(Date.parse(date)))continue;
    }
    push(i);start=i+1;attributeStart=start;
  }
  push(value.length);return result;
}
function cookieDomain(raw) {
  if(typeof raw!=='string')return '';
  return raw.trim().replace(/^"|"$/g,'').replace(/^\./,'').toLowerCase();
}
function schoolCookieDomains(){
  return ['nufe.edu.cn','authserver.nufe.edu.cn','jwxt.nufe.edu.cn'];
}
function allowedCookieDomain(issuer,domain) {
  // Domain=scoped cookies may cover the NUFE parent domain or one of the
  // two explicitly trusted servers, and must domain-match their issuer.
  return schoolCookieDomains().includes(domain)&&
    (issuer===domain||issuer.endsWith('.'+domain));
}
class CookieJar {
  constructor(cookies=[]) {this.cookies=cookies;this.rejected=0;this.lastRejected=0;}
  ingest(url,headers,native=[]) {
    const u=safeURL(url),key=Object.keys(headers).find(k=>k.toLowerCase()==='set-cookie');
    const raw=key?splitSetCookie(headers[key]):[];
    let accepted=0,rejected=0;
    const accept=c=>{
      const domain=cookieDomain(c.domain);
      if(!allowedCookieDomain(u.host,domain)||!c.name||typeof c.name!=='string'||
         typeof c.value!=='string'||!/^[^\x00-\x20\x7f()<>@,;:\\"/\[\]?={}]+$/.test(c.name)||
         /[\x00-\x1f\x7f;\r\n]/.test(c.value)||!c.path||!c.path.startsWith('/')){
        rejected++;return;
      }
      this.set({...c,domain});accepted++;
    };
    if(raw.length) {
      for(const line of raw) {
        const parts=line.split(';'),match=/^\s*([^=\s]+)=(.*)$/.exec(parts.shift());
        if(!match){rejected++;continue;}
        const c={name:match[1],value:match[2],domain:u.host,hostOnly:true,
          path:u.path.slice(0,u.path.lastIndexOf('/'))||'/',expires:0};
        let age=null;
        for(const part of parts) {
          const p=part.trim(),i=p.indexOf('='),k=(i<0?p:p.slice(0,i)).trim().toLowerCase(),v=i<0?'':p.slice(i+1).trim();
          if(k==='domain'){c.domain=v;c.hostOnly=false;}
          if(k==='path'&&v.startsWith('/'))c.path=v;
          if(k==='max-age'&&/^-?\d+$/.test(v))age=Number(v);
          if(k==='expires'){const parsed=Date.parse(v);if(Number.isFinite(parsed))c.expires=Math.max(1,parsed);}
        }
        if(age!==null)c.expires=Math.max(1,Date.now()+age*1000);
        accept(c);
      }
    }else if(Array.isArray(native)) {
      // When Scripting hides Set-Cookie, use its parsed cookies instead.
      // In particular, preserve parent-domain cookies so CAS can hand the
      // authenticated session back to the course system.
      for(const c of native) {
        if(!c||typeof c!=='object'){rejected++;continue;}
        const domain=cookieDomain(c.domain||u.host);
        const validDate=c.expiresDate?Date.parse(c.expiresDate):NaN;
        accept({name:c.name,value:c.value,domain,
          hostOnly:domain!==u.host?false:true,path:c.path||'/',
          expires:Number.isFinite(validDate)?Math.max(1,validDate):0});
      }
    }
    this.rejected+=rejected;this.lastRejected=rejected;
    return {accepted,rejected};
  }
  set(c) {assert(typeof c.name==='string'&&typeof c.value==='string'&&!/[\r\n;]/.test(c.name+c.value),'COOKIE_FORMAT');this.cookies=this.cookies.filter(x=>!(x.name===c.name&&x.domain===c.domain&&x.path===c.path));if(!c.expires||c.expires>Date.now())this.cookies.push(c);}
  header(url) {const u=safeURL(url),now=Date.now(),matched=this.cookies.filter(c=>(!c.expires||c.expires>now)&&(c.hostOnly?u.host===c.domain:u.host===c.domain||u.host.endsWith('.'+c.domain))&&(u.path===c.path||u.path.startsWith(c.path.endsWith('/')?c.path:c.path+'/')));if(matched.length>1)matched.sort((a,b)=>b.path.length-a.path.length);return matched.map(c=>c.name+'='+c.value).join('; ');}
}
// Request progress must not contain query strings, account IDs, tokens or cookies.
function requestLabel(url) {
  const u=safeURL(url),p=u.path;
  const host=u.host==='authserver.nufe.edu.cn'?'认证服务器':'教务系统';
  const steps=[['/checkNeedCaptcha.htl','检查验证码'],['/bfp/info','注册设备'],['/student/sso/login','单点登录'],['/student/for-std/course-table','课表入口'],['/login','提交认证'],['/getCaptcha.htl','图形验证码'],['/print-data','读取课表数据'],['/semester/get/','读取学期信息'],['/exam-arrange','读取考试日程'],['/room-borrow/free-list','查询空闲教室']];
  return host+' · '+((steps.find(([part])=>p.includes(part))||[])[1]||'安全请求');
}
function networkErrorCode(error) {
  // Only check fixed OS error classes. Never store raw native error strings.
  const message=String(error&&error.message||'');
  if(/-1009\b|offline|internet connection appears to be offline/i.test(message))return 'NETWORK_OFFLINE';
  if(/-1003\b|could not find the server|dns|host not found/i.test(message))return 'NETWORK_DNS';
  if(/-1200\b|certificate|ssl|tls/i.test(message))return 'NETWORK_TLS';
  if(/-1005\b|connection was lost|connection reset/i.test(message))return 'NETWORK_LOST';
  if(/-1001\b|timed out|timeout/i.test(message))return 'NETWORK_TIMEOUT';
  return 'NETWORK';
}
class HTTP {
  constructor(jar,persist=()=>{},before=()=>{},trace=()=>{},deadline=Infinity) {
    this.jar=jar;this.persist=persist;this.before=before;this.trace=trace;this.deadline=deadline;this.last=0;
    this.savedCookies=JSON.stringify(jar.cookies);
  }
  withPrivateCookies(deadline=this.deadline) {
    const client=new HTTP(new CookieJar([...this.jar.cookies]),undefined,this.before,this.trace,deadline);
    client.last=this.last;
    return client;
  }
  async get(url,opt={}) {
    let method=opt.body?'POST':'GET',body=opt.body||null;
    const started=Date.now(),chainLimit=75000;
    const trace=opt.trace??this.trace;
    for(let hop=0;hop<12;hop++) {
      if(Date.now()-started>=chainLimit)fail('NETWORK_CHAIN_TIMEOUT');
      safeURL(url);this.before();trace('发送 '+method+' '+requestLabel(url));
      // Concurrent callers may wake together. Recheck the shared gate before
      // reserving the next start; do not serialize the network response itself.
      let wait=1050-(Date.now()-this.last);
      while(wait>0){
        if(this.deadline-Date.now()<=wait)fail('BUDGET');
        await bounded(new Promise(r=>Timer.schedule(wait,false,r)),Math.min(3000,chainLimit-(Date.now()-started)),'NETWORK_CHAIN_TIMEOUT');
        this.before();
        if(Date.now()-started>=chainLimit)fail('NETWORK_CHAIN_TIMEOUT');
        wait=1050-(Date.now()-this.last);
      }
      this.last=Date.now();
      const req=new Request(url);req.method=method;req.timeoutInterval=15;req.allowInsecureRequest=false;
      req.headers={Accept:opt.binary?'image/*':'application/json, text/html;q=0.9, */*;q=0.8',Cookie:this.jar.header(url)};
      if(opt.ajax)req.headers['X-Requested-With']='XMLHttpRequest';
      if(body){req.body=body;req.headers['Content-Type']=opt.json?'application/json':'application/x-www-form-urlencoded';}
      let redirect=null;req.onRedirect=r=>{redirect=r.url;return null;};
      const now=Date.now(),remaining=chainLimit-(now-started),runRemaining=this.deadline-now;
      if(runRemaining<=0)fail('BUDGET');
      if(remaining<=0)fail('NETWORK_CHAIN_TIMEOUT');
      const requestLimit=Math.min(25000,remaining);
      const timeoutCode=runRemaining<=requestLimit?'BUDGET':remaining<=25000?'NETWORK_CHAIN_TIMEOUT':'NETWORK_TIMEOUT';
      let value;
      try{value=await bounded(opt.binary?req.load():req.loadString(),Math.min(requestLimit,runRemaining),timeoutCode);}
      catch(e){fail(e?.code===timeoutCode?timeoutCode:networkErrorCode(e));}
      this.before();
      const res=req.response;assert(res,'NETWORK');trace('收到 HTTP '+res.statusCode+' '+requestLabel(url));
      const cookieStatus=this.jar.ingest(url,res.headers||{},res.cookies||[]);
      if(cookieStatus.rejected)trace('已安全忽略 '+cookieStatus.rejected+' 条不符合域名或格式规则的 Cookie（内容未记录）');
      if(cookieStatus.accepted){
        const cookies=JSON.stringify(this.jar.cookies);
        if(cookies!==this.savedCookies){
          this.persist(this.jar.cookies);
          this.savedCookies=cookies;
        }
      }
      if(res.statusCode>=300&&res.statusCode<400){
        const k=Object.keys(res.headers||{}).find(k=>k.toLowerCase()==='location');
        const target=redirect||(k&&res.headers[k]);assert(target,'REDIRECT');
        const next=resolveURL(url,target);
        if([307,308].includes(res.statusCode)&&body&&safeURL(next).host!==safeURL(url).host)fail('DOMAIN_BLOCKED');
        if(res.statusCode===303||([301,302].includes(res.statusCode)&&method==='POST')){method='GET';body=null;}
        url=next;continue;
      }
      if(res.statusCode===401||res.statusCode===403)fail('AUTH_REQUIRED');assert(res.statusCode>=200&&res.statusCode<300,'HTTP_'+res.statusCode);
      if(typeof value==='string')assert(value.length<=2*1024*1024,'TOO_LARGE');
      return {url,text:value,response:res};
    }fail('REDIRECT');
  }
  async json(url,opt={}) {const r=await this.get(url,{ajax:true,...opt});if(safeURL(r.url).host==='authserver.nufe.edu.cn'||safeURL(r.url).path==='/student/login')fail('AUTH_REQUIRED');try{return JSON.parse(r.text);}catch(_){fail('SCHEMA');}}
  async authJSON(url,opt={}) {const r=await this.get(url,{ajax:true,...opt});try{return JSON.parse(r.text);}catch(_){fail('SCHEMA');}}
}
function schoolSession(jar,checkpoint,trace,deadline){
  const key=schoolKey(KEY),initial=JSON.stringify(jar.cookies);
  const http=new HTTP(jar,undefined,checkpoint,trace,deadline);
  return {http,commitCookies(){
    checkpoint();
    const cookies=JSON.stringify(jar.cookies);
    if(cookies!==initial)Keychain.set(key,cookies);
  }};
}
async function legacyInput(title,label,secure=false) {
  const a=new Alert();a.title=title;
  if(secure)a.addSecureTextField(label);else a.addTextField(label);
  a.addAction('继续');a.addCancelAction('取消');
  if(await a.presentAlert()<0)fail('CANCELLED');
  return a.textFieldValue(0);
}
async function input(title,label,secure=false,options={}) {
  if(config.runsInApp&&typeof hostAPI('Navigation')?.present==='function'){
    try {
      const code=await presentNativeTextForm({
        title,label,kind:secure?'secure':options.kind||'text',image:options.image||null
      });
      if(code===null)fail('CANCELLED');
      return code;
    }catch(e){
      if(e?.code==='CANCELLED')throw e;
      const recover=await confirm('原生输入窗口不可用','无法打开原生输入窗口。是否改用系统输入框继续？','使用系统输入框','取消');
      if(!recover)fail('CANCELLED');
    }
  }
  return await legacyInput(title,label,secure);
}
async function confirm(title,message,confirmLabel='确认',cancelLabel='取消') {const a=new Alert();a.title=title;a.message=message;a.addAction(confirmLabel);a.addCancelAction(cancelLabel);return await a.presentAlert()===0;}
async function notice(title,message) {const a=new Alert();a.title=title;a.message=message;a.addAction('好');await a.presentAlert();}
// Read known login-form inputs as inert text; no WebView, no embedded page scripts.
// Values are decoded only after selection. Never log or persist form fields.
function htmlAttributeValue(value) {
  return String(value||'').replace(/&(#x[0-9a-f]+|#[0-9]+|amp|quot|apos|lt|gt|nbsp);/gi,(_,entity)=>{
    const e=entity.toLowerCase();
    if(e[0]==='#'){const n=e[1]==='x'?parseInt(e.slice(2),16):parseInt(e.slice(1),10);return Number.isInteger(n)&&n>=0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'\uFFFD';}
    return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[e];
  });
}
function attributes(tag) {
  const attrs={};
  for(const m of tag.matchAll(/([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    const key=m[1].toLowerCase();if(!Object.prototype.hasOwnProperty.call(attrs,key))attrs[key]=htmlAttributeValue(m[2]??m[3]??m[4]??'');
  }
  return attrs;
}
function inputs(html){return [...html.matchAll(/<input\b[^>]*>/gi)].map(m=>attributes(m[0]));}
const EXAM_PATH='/student/for-std/exam-arrange';
const EXAM_MARKER='[COURSESYNC_EXAM ';
const LEGACY_EXAM_ICON='📝 ';
const EXAM_LABEL='（考试）';
function examTitle(title,limit=Infinity){
  if(title.startsWith(LEGACY_EXAM_ICON))title=title.slice(LEGACY_EXAM_ICON.length);
  if(title.startsWith(EXAM_LABEL))title=title.slice(EXAM_LABEL.length);
  if(title.endsWith(EXAM_LABEL))title=title.slice(0,-EXAM_LABEL.length);
  return EXAM_LABEL+title.trim().slice(0,limit-EXAM_LABEL.length);
}
const isExamEvent=(ev,state)=>String(ev?.notes||'').startsWith(EXAM_MARKER)||
  String(ev?.title||'').startsWith(EXAM_LABEL)||
  Object.prototype.hasOwnProperty.call(state?.examIndex||{},ev?.identifier)||
  (/^同步：\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(ev?.notes||'')&&
    (String(ev?.title||'').startsWith(LEGACY_EXAM_ICON)||String(ev?.title||'').endsWith(EXAM_LABEL)));
function examRows(html) {
  const clean=html.replace(/<!--[\s\S]*?-->/g,'');
  const table=[...clean.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table\s*>/gi)]
    .find(m=>attributes(m[1]).id==='exams');
  assert(table,'EXAM_SCHEMA');
  const text=markup=>htmlAttributeValue(markup.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
  const examLocation=raw=>{
    const parts=raw.replace(/^(?:(?:仙林|福建路|桥头)(?:校区)?|\S+校区)(?:\s+|$)/,'').trim().split(/\s+/).filter(Boolean);
    return parts.filter((part,idx)=>idx===parts.length-1||!parts[idx+1].startsWith(part)).join(' ');
  };
  const rows=[];
  let empty=false;
  for(const row of table[2].matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr\s*>/gi)){
    const attrs=attributes(row[1]);
    const cells=[...row[2].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td\s*>/gi)].map(m=>m[1]);
    if(attrs.class?.split(/\s+/).includes('tr-empty')&&cells.length===1&&text(cells[0]).includes('暂无')){
      empty=true;
      continue;
    }
    assert(cells.length===3&&['true','false'].includes(attrs['data-finished']),'EXAM_SCHEMA');
    const time=[...cells[0].matchAll(/<div\b([^>]*)>([\s\S]*?)<\/div\s*>/gi)]
      .find(m=>attributes(m[1]).class?.split(/\s+/).includes('time'));
    const title=/<div\b[^>]*>([\s\S]*?)<\/div\s*>/i.exec(cells[1]);
    assert(time&&title&&text(title[1]),'EXAM_SCHEMA');
    rows.push({title:text(title[1]),time:text(time[2]),kind:text(cells[1].replace(title[0],'')),
      location:examLocation(text(cells[0].replace(time[0],'')))});
  }
  assert(empty||rows.length,'EXAM_SCHEMA');
  return rows;
}
async function fetchExamRows(http) {
  const response=await http.get(JW+EXAM_PATH);
  const target=safeURL(response.url);
  if(target.host!==safeURL(JW).host||target.path==='/student/login')fail('AUTH_REQUIRED');
  assert(target.path===EXAM_PATH||/^\/student\/for-std\/exam-arrange\/info\/\d+$/.test(target.path),'EXAM_SCHEMA');
  return examRows(response.text);
}
function indexedExamWindows(index,prefix){
  const ranges=[];
  for(const key of new Set(Object.values(index))){
    let start;
    try{start=JSON.parse(key.slice(prefix.length))[2];}catch(_){continue;}
    if(Number.isFinite(start))ranges.push([start-DAY,start+DAY]);
  }
  return ranges;
}
async function migrateLegacyExamCalendar(state,store,calendar,windows,progress,checkpoint,examKey){
  const legacyId=state.examCalendarId;
  if(!legacyId||legacyId===calendar.identifier){
    if(legacyId||state.examCalendarTitle){
      delete state.examCalendarId;
      delete state.examCalendarTitle;
      store.write(state);
    }
    return;
  }
  const legacy=(await visibleCalendars()).find(c=>c.identifier===legacyId);
  assert(liveCalendar(legacy),'EXAM_CALENDAR_UNAVAILABLE');
  progress('合并考试日历');
  const prefix=EXAM_MARKER+state.owner+'] ';
  const index=Object.assign(Object.create(null),state.examIndex);
  const keyOf=ev=>examKey(ev,index);
  const ranges=[...windows,...dedicatedWindows(state),...indexedExamWindows(index,prefix)].sort((a,b)=>a[0]-b[0]);
  const merged=[];
  for(const [start,end] of ranges){
    const last=merged[merged.length-1];
    if(last&&start<=last[1])last[1]=Math.max(last[1],end);
    else merged.push([start,end]);
  }
  const readOwned=async cal=>{
    const found=new Map();
    for(const [start,end] of merged){
      for(let at=start;at<end;at+=90*DAY){
        checkpoint();
        for(const ev of await calendarRows(at,Math.min(at+90*DAY,end),cal)){
          if(keyOf(ev))found.set(occurrenceKey(ev),ev);
        }
      }
    }
    return [...found.values()];
  };
  const old=await readOwned(legacy);
  assert(old.every(ev=>isStandaloneEvent(ev)&&!ev.attendees?.length),'MANAGED_SERIES');
  if(old.length){
    const existing=new Map((await readOwned(calendar)).map(ev=>[keyOf(ev),ev]));
    for(const ev of old){
      const key=keyOf(ev),start=+ev.startDate,end=+ev.endDate;
      let destination=existing.get(key);
      if(!destination){
        checkpoint();
        const copy=new CalendarEvent();
        copy.calendar=calendar;copy.title=examTitle(ev.title);copy.location=ev.location||'';
        copy.startDate=new Date(start);copy.endDate=new Date(end);
        copy.timeZone=ev.timeZone||'Asia/Shanghai';copy.notes=key;
        if(ev.url)copy.url=ev.url;
        for(const alarm of ev.alarms||[])copy.addAlarm(alarm);
        await copy.save();
        destination=(await calendarRows(start,end,calendar)).find(item=>
          keyOf(item)===key&&item.title===copy.title&&+item.startDate===start&&+item.endDate===end&&
          (item.location||'')===(ev.location||''));
        assert(destination,'CALENDAR_VERIFY');
        existing.set(key,destination);
      }
      assert(isStandaloneEvent(destination)&&!destination.attendees?.length,'MANAGED_SERIES');
      index[destination.identifier]=key;
      state.examIndex=index;
      store.write(state);
      checkpoint();
      await ev.remove();
      assert(!(await calendarRows(start,end,legacy)).some(item=>occurrenceKey(item)===occurrenceKey(ev)),'CALENDAR_VERIFY');
      delete index[ev.identifier];
      store.write(state);
    }
  }
  delete state.examCalendarId;
  delete state.examCalendarTitle;
  store.write(state);
}
async function upgradeExamTitles(state,store,calendar,index,prefix,windows,checkpoint,examKey){
  if(state.examTitleFormat==='prefix')return;
  for(const [start,end] of [...windows,...indexedExamWindows(index,prefix)]){
    for(let at=start;at<end;at+=90*DAY){
      checkpoint();
      for(const ev of await calendarRows(at,Math.min(at+90*DAY,end),calendar)){
        const previous=String(ev.title||'');
        if(!previous.startsWith(LEGACY_EXAM_ICON)&&!previous.endsWith(EXAM_LABEL))continue;
        const title=examTitle(previous);
        if(title===previous)continue;
        const key=examKey(ev,index);
        if(!key)continue;
        assert(isStandaloneEvent(ev)&&!ev.attendees?.length,'MANAGED_SERIES');
        checkpoint();
        const oldId=ev.identifier;
        ev.title=title;
        await ev.save();
        assert((await calendarRows(+ev.startDate,+ev.endDate,calendar)).some(item=>
          item.identifier===ev.identifier&&item.title===title),'CALENDAR_VERIFY');
        if(ev.identifier!==oldId){
          delete index[oldId];
          index[ev.identifier]=key;
          state.examIndex=index;
          store.write(state);
        }
      }
    }
  }
  state.examTitleFormat='prefix';
  store.write(state);
}
async function syncExams(http,state,store,calendar,progress,now=Date.now(),checkpoint=()=>store.check()) {
  progress('读取考试日程');
  const end=now+366*DAY;
  const prefix=EXAM_MARKER+state.owner+'] ';
  const courseIndex=storedEventIndex(state);
  const examKey=(ev,index)=>{
    const notes=String(ev.notes||'');
    if(courseIndex.has(ev.identifier)||notes.startsWith('[NUFE_LOCAL_V1 '))return null;
    const key=notes.startsWith(prefix)?notes:index[ev.identifier];
    return typeof key==='string'&&key.startsWith(prefix)?key:null;
  };
  const target=new Map();
  const rowsFromSchool=await fetchExamRows(http);
  for(const row of rowsFromSchool){
    const time=/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2})\s*[~～–-]\s*(\d{2}:\d{2})$/.exec(row.time);
    assert(time,'EXAM_SCHEMA');
    const [,day,from,to]=time;
    const start=Date.parse(day+'T'+from+':00+08:00'),stop=Date.parse(day+'T'+to+':00+08:00');
    assert(Number.isFinite(start)&&Number.isFinite(stop)&&localDateTime(new Date(start).toISOString())===day+' '+from&&
      localDateTime(new Date(stop).toISOString())===day+' '+to&&stop>start&&stop<=end,'EXAM_SCHEMA');
    const key=prefix+JSON.stringify([row.title,row.kind,start]);
    assert(!target.has(key),'EXAM_SCHEMA');
    target.set(key,{title:examTitle(row.title),start,stop,location:row.location});
  }
  progress('更新考试日程');
  assert(calendar.identifier===state.calendarId&&liveCalendar(calendar),'CALENDAR_READONLY');
  // Every successful school response is authoritative, including an empty list.
  // Scan historical managed exams as well so deletions are reflected in EventKit,
  // rather than merely dropping them from the local record.
  state.lastStage='考试：计算核验范围';
  const windowSize=90*DAY;
  const storedIndex=state.examIndex||{};
  const storedStarts=Object.values(storedIndex).map(key=>{
    try{
      if(typeof key!=='string'||!key.startsWith(prefix))return NaN;
      const parsed=JSON.parse(key.slice(prefix.length));
      return Number(parsed[2]);
    }catch(_){return NaN;}
  });
  const priorStarts=(state.exams||[]).map(exam=>Date.parse(exam.start));
  const historical=new Set([...target.values()].map(exam=>exam.start)
    .concat(storedStarts,priorStarts).filter(start=>Number.isFinite(start)&&start<now)
    .map(start=>Math.floor(start/windowSize)*windowSize));
  const windows=[[now,end],...[...historical].map(start=>[start,Math.min(start+windowSize,now)])];
  checkpoint();
  state.lastStage='考试：合并旧日历';
  await migrateLegacyExamCalendar(state,store,calendar,windows,progress,checkpoint,examKey);
  state.lastStage='考试：核对旧标题';
  const index=Object.assign(Object.create(null),state.examIndex);
  await upgradeExamTitles(state,store,calendar,index,prefix,windows,checkpoint,examKey);
  const keyOf=ev=>examKey(ev,index);
  const read=async()=>{
    const owned=new Map();
    for(const [start,stop] of windows){
      checkpoint();
      for(const ev of await calendarRows(start,stop,calendar)){
        const key=keyOf(ev);
        if(key){
          assert(isStandaloneEvent(ev)&&!ev.attendees?.length,'MANAGED_SERIES');
          owned.set(occurrenceKey(ev),ev);
        }
      }
    }
    checkpoint();return [...owned.values()];
  };
  state.lastStage='考试：读取已有日程';
  const rows=await read();
  if(!rows.length&&!target.size){
    if((state.exams?.length||0)>0||Object.keys(state.examIndex||{}).length>0){
      state.exams=[];
      state.examIndex={};
      store.write(state);
    }
    return;
  }
  const current=new Map();
  for(const ev of rows){
    const key=keyOf(ev);
    if(!current.has(key))current.set(key,ev);
  }
  const matches=(ev,exam)=>ev.title===exam.title&&+ev.startDate===exam.start&&
    +ev.endDate===exam.stop&&(ev.location||'')===exam.location;
  state.lastStage='考试：保存日程';
  let saved=false;
  for(const [key,exam] of target){
    const existing=current.get(key);
    if(existing&&matches(existing,exam)&&!hasRetiredCalendarPin(existing))continue;
    checkpoint();
    const ev=existing||new CalendarEvent();
    ev.calendar=calendar;ev.title=exam.title;ev.notes=key;restoreCalendarRoom(ev,exam.location);
    ev.isAllDay=false;ev.timeZone='Asia/Shanghai';ev.startDate=new Date(exam.start);ev.endDate=new Date(exam.stop);
    await ev.save();
    saved=true;
  }
  const written=saved?await read():rows;
  const writtenByKey=groupBy(written,keyOf);
  for(const [key,exam] of target)assert(writtenByKey.get(key)?.some(ev=>matches(ev,exam)),'CALENDAR_VERIFY');
  state.lastStage='考试：核对并清理旧日程';
  const kept=new Set();
  let removed=false;
  for(const ev of written){
    const key=keyOf(ev),exam=target.get(key);
    if(exam&&matches(ev,exam)&&!kept.has(key)){kept.add(key);continue;}
    checkpoint();
    await ev.remove();
    removed=true;
    delete index[ev.identifier];
  }
  const final=removed?await read():written;
  assert(final.length===target.size&&new Set(final.map(keyOf)).size===target.size&&
    final.every(ev=>target.has(keyOf(ev))&&matches(ev,target.get(keyOf(ev)))),'CALENDAR_VERIFY');
  // Persist new mappings before clearing recovery markers. A verified no-op
  // can keep the existing on-disk snapshot until the final refresh result.
  const mappingsChanged=final.some(ev=>storedIndex[ev.identifier]!==keyOf(ev));
  for(const ev of final)index[ev.identifier]=keyOf(ev);
  state.examIndex=index;
  const exams=[...target.values()].map((exam,idx)=>({
    id:'exam-'+exam.start+'-'+idx,
    title:exam.title,
    start:new Date(exam.start).toISOString(),
    end:new Date(exam.stop).toISOString(),
    location:exam.location||''
  }));
  const snapshotChanged=JSON.stringify(state.exams)!==JSON.stringify(exams);
  state.exams=exams;
  if(saved||removed||mappingsChanged||snapshotChanged)store.write(state);
  state.lastStage='考试：清空备注';
  let notesChanged=false;
  for(const ev of final){
    if(!ev.notes)continue;
    notesChanged=true;
    checkpoint();
    const oldId=ev.identifier,key=keyOf(ev);
    ev.notes='';
    await ev.save();
    if(ev.identifier!==oldId){delete index[oldId];index[ev.identifier]=key;store.write(state);}
  }
  if(notesChanged){
    const polished=await read();
    assert(polished.length===target.size&&new Set(polished.map(keyOf)).size===target.size&&
      polished.every(ev=>!ev.notes&&target.has(keyOf(ev))&&matches(ev,target.get(keyOf(ev)))),'CALENDAR_VERIFY');
  }
}
async function fieldsFrom(html,id) {
  // Limit the HTML parser to a document-sized page, never execute or load its resources.
  assert(typeof html==='string'&&html.length<=2*1024*1024,'LOGIN_SCHEMA');
  const forms=[...html.matchAll(/<form\b[^>]*>[\s\S]*?<\/form\s*>/gi)];
  const match=forms.find(m=>attributes(m[0].match(/^<form\b[^>]*>/i)[0]).id===id);
  if(!match)return null;
  const body=match?match[0]:html;
  const selected=inputs(body),all=body===html?selected:inputs(html),out={};
  for(const v of selected)if(v.name)out[v.name]=v.value||'';
  const lookup=(attr,v)=>selected.find(x=>x[attr]===v)||all.find(x=>x[attr]===v);
  const salt=lookup('id','pwdEncryptSalt');if(salt)out.salt=salt.value||'';
  for(const name of ['execution','lt'])if(!out[name]){const x=lookup('name',name);if(x)out[name]=x.value||'';}
  return out;
}
async function fallbackCredentialForm({title='CourseSync 登录'}={}){
  const username=(await legacyInput(title,'学号')).trim();
  const password=await legacyInput(title,'密码（安全输入）',true);
  if(!username||username.length>100||!password||password.length>512)fail('CREDENTIALS_INVALID');
  return {username,password};
}
async function credentialForm({title='CourseSync 登录'}={}){
  if(!config.runsInApp)fail('AUTH_INTERACTIVE_REQUIRED');
  let code='NATIVE_FORM_UNAVAILABLE';
  if(typeof hostAPI('Navigation')?.present==='function'){
    try{
      const native=await presentNativeCredentialForm(title);
      if(!native)fail('CANCELLED');
      return native;
    }catch(e){
      if(e?.code==='CANCELLED')throw e;
      if(typeof e?.code==='string'&&/^[A-Z0-9_]{1,40}$/.test(e.code))code=e.code;
    }
  }
  // The only fallback is still a native iOS Dialog (two secure prompts).
  // Ask before showing them; never silently downgrade the combined form.
  const consent=await confirm('原生登录窗口不可用','无法打开账号密码窗口（'+code+'）。是否改用系统安全输入框？','继续','取消登录');
  if(!consent)fail('CANCELLED');
  return await fallbackCredentialForm({title});
}
function validSliderResult(value) {
  if(!value||value.canvasLength!==280||!Number.isFinite(value.moveLength)||
     value.moveLength<=0||value.moveLength>240)return false;
  const tracks=value.tracks;
  return Array.isArray(tracks)&&tracks.length>=2&&tracks.length<=1000&&
    tracks.every(t=>t&&['a','b','c'].every(k=>Number.isFinite(t[k]))&&
      t.a>=0&&t.a<=240&&Math.abs(t.b)<=800&&t.c>=0&&t.c<=600000);
}
async function humanSlider(http) {
  await http.get(AUTH+'/common/toSliderCaptcha.htl',{ajax:true});
  const j=await http.authJSON(AUTH+'/common/openSliderCaptcha.htl?_='+Date.now());
  assert(typeof j.bigImage==='string'&&typeof j.smallImage==='string'&&j.bigImage.length<700000&&j.smallImage.length<700000,'CAPTCHA');
  const small=Array.from(Data.fromBase64String(j.smallImage).getBytes());const key=String.fromCharCode(...small.slice(-16));assert(/^[A-Za-z0-9]{16}$/.test(key),'CAPTCHA');
  const imageType=s=>s.startsWith('iVBOR')?'image/png':s.startsWith('/9j/')?'image/jpeg':fail('CAPTCHA');
  const w=new WebView();
  let submitted=null;
  try {
    if(typeof w.inner.addScriptMessageHandler!=='function')fail('WEBVIEW_UNAVAILABLE');
    await bounded(w.inner.addScriptMessageHandler('nufeSlider',payload=>{
      // Local drag data is untrusted: reject malformed or oversized trajectories
      // instead of encrypting arbitrary WebKit messages for the school server.
      if(submitted||!validSliderResult(payload))return false;
      submitted=payload;
      try{w.inner.dismiss();}catch(_){}
      return true;
    }),12000,'WEBVIEW_TIMEOUT');
  const html=`<meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; base-uri 'none'"><style>body{font:17px -apple-system;padding:20px}#stage{position:relative;width:280px;height:155px}img{position:absolute;height:155px}#bg{width:280px}#piece{left:0}#track{position:relative;width:280px;height:44px;background:#ddd;margin-top:20px;touch-action:none}#knob{position:absolute;width:40px;height:44px;background:#2084ee;touch-action:none}</style><p>亲自拖动拼图滑块，松开后点击下方提交验证。</p><div id="stage"><img id="bg"><img id="piece"></div><div id="track"><div id="knob"></div></div><button id="submit" disabled type="button" style="margin-top:14px;padding:12px 22px;border-radius:10px;background:#238BFF;color:white;border:0">提交验证</button><p id="status"></p><script>
  const bg=document.getElementById('bg'),piece=document.getElementById('piece'),knob=document.getElementById('knob');
  bg.onload=piece.onload=()=>{if(!bg.naturalWidth||!piece.naturalWidth)return;piece.style.width=Math.max(0,piece.naturalWidth*280/bg.naturalWidth-2)+'px';};
  bg.src=${JSON.stringify('data:'+imageType(j.bigImage)+';base64,'+j.bigImage)};piece.src=${JSON.stringify('data:'+imageType(j.smallImage)+';base64,'+j.smallImage)};
  let active=false,x=0,y=0,lastAt=0,last=null,tracks=[];window.result=null;
  knob.onpointerdown=e=>{e.preventDefault();document.getElementById('submit').disabled=true;knob.setPointerCapture(e.pointerId);active=true;x=e.clientX;y=e.clientY;lastAt=Date.now();last=null;tracks=[{a:0,b:0,c:0}];window.result=null;};
  knob.onpointermove=e=>{if(!active)return;const dx=e.clientX-x,dy=e.clientY-y;if(dx<0||dx+40>280)return;knob.style.left=Math.max(0,dx-1)+'px';piece.style.left=dx+'px';const now=Date.now(),dt=now-lastAt;if(dt<20)return;const p={a:dx,b:dy,c:dt};if(last&&Math.hypot(p.a-last.a,p.b-last.b)<2)return;tracks.push(p);last=p;lastAt=now;};
  knob.onpointerup=e=>{if(!active)return;active=false;const dx=Math.max(0,Math.min(240,e.clientX-x));if(dx<=0)return;tracks.push({a:dx,b:e.clientY-y,c:Date.now()-lastAt});window.result={canvasLength:280,moveLength:dx,tracks};document.getElementById('status').textContent='已记录，请点击提交验证。';document.getElementById('submit').disabled=false;};knob.onpointercancel=()=>{active=false;window.result=null;document.getElementById('submit').disabled=true;};document.getElementById('submit').onclick=async()=>{if(!window.result)return;const button=document.getElementById('submit');button.disabled=true;try{const ok=await window.webkit.messageHandlers.nufeSlider.postMessage(window.result);if(!ok){button.disabled=false;document.getElementById('status').textContent='滑动数据无效，请重新拖动。';}}catch(_){button.disabled=false;}};</script>`;
    await bounded(w.loadHTML(html),12000,'WEBVIEW_TIMEOUT');
    await w.present();
    if(!submitted)fail('CANCELLED');
    const sign=await encryptPassword(JSON.stringify(submitted),key);
    const answer=await http.authJSON(AUTH+'/common/verifySliderCaptcha.htl',{body:form({sign})});
    assert(answer.errorCode===1,'CAPTCHA');
  }finally{
    // WebKit may suspend JS immediately after dismissal. Never evaluate
    // JavaScript after present(), and always release the ephemeral controller.
    try{w.inner.dispose();}catch(_){}
    __webviews.delete(w.inner);
  }
}
function reauthValue(html,key) {const m=new RegExp('"'+key+'"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"').exec(html);return m?JSON.parse('"'+m[1]+'"'):'';}
async function mfa(http,r) {
  const type=reauthValue(r.text,'reAuthType');assert(type==='3'||type==='10','MFA_UNSUPPORTED');
  const service=reauthValue(r.text,'service')||SSO;assert(service===SSO,'DOMAIN_BLOCKED');
  function endpoint(suffix, fallback){const m=new RegExp('["\']([^"\']*'+suffix.replace('.','\\.')+')["\']').exec(r.text);let u=m?m[1]:fallback;if(u.startsWith('/')&&!u.startsWith('/authserver/'))u=AUTH+u;else u=resolveURL(r.url,u);assert(safeURL(u).host==='authserver.nufe.edu.cn','DOMAIN_BLOCKED');return u;}
  if(type==='3') {
    const j=await http.authJSON(endpoint('getDynamicCodeByReauth.do',AUTH+'/dynamicCode/getDynamicCodeByReauth.do'),{body:form({userName:reauthValue(r.text,'reAuthUserId'),authCodeTypeName:'reAuthDynamicCodeType'})});assert(['success','other_success'].includes(j.res),'MFA_SEND');
  }
  const code=await input('学校二次认证',type==='3'?'短信验证码':'身份验证器动态口令',
    false,{kind:type==='3'?'sms':'totp'});
  const data={service,reAuthType:type,isMultifactor:reauthValue(r.text,'isMultifactor')||'true',password:'',dynamicCode:type==='3'?code:'',uuid:'',answer1:'',answer2:'',otpCode:type==='10'?code:''};
  // Use the school's existing trusted-device flag when offered. Only the
  // school determines its lifetime; the script does not guarantee 180 days.
  if(reauthValue(r.text,'isSleepAccount')==='0')data.skipTmpReAuth='true';
  const j=await http.authJSON(endpoint('reAuthSubmit.do',AUTH+'/reAuthCheck/reAuthSubmit.do'),{body:form(data)});assert(!['reAuth_failed','reAuth_unauthorized'].includes(j.code),'MFA_FAILED');
  await http.get(AUTH+'/login?'+form({service}));
}
// Password authentication is shared by manual login and the ONE automatic retry.
// Captcha, slider, OTP and MFA remain interactive-only.
async function passwordLogin(http,r,username,password,interactive,onStage=()=>{}) {
  try {
    onStage('解析学校登录表单');
    const fields=await fieldsFrom(r.text,'pwdFromId');assert(fields,'LOGIN_SCHEMA');assert(fields.salt,'LOGIN_SALT_MISSING');assert(fields.execution,'LOGIN_EXECUTION_MISSING');
    const deviceKey='CourseSync.Local.v1.device';let device=Keychain.contains(deviceKey)?Keychain.get(deviceKey):uuid().replace(/-/g,'').toUpperCase();Keychain.set(deviceKey,device);
    onStage('注册设备指纹');
    await http.get(AUTH+'/bfp/info?'+form({bfp:device,_:Date.now()}),{ajax:true});
    if(!http.jar.cookies.some(c=>c.name==='MULTIFACTOR_BROWSER_FINGERPRINT'))http.jar.set({name:'MULTIFACTOR_BROWSER_FINGERPRINT',value:device,domain:'authserver.nufe.edu.cn',hostOnly:true,path:'/',expires:0});
    onStage('查询是否需要验证码');
    const need=await http.authJSON(AUTH+'/checkNeedCaptcha.htl?'+form({username,_:Date.now()}));assert(typeof need.isNeed==='boolean','CAPTCHA');
    let captcha='';if(need.isNeed||/\b_badCredentialsCount\s*=\s*["']?0\b/.test(r.text)) {
      if(!interactive)fail('AUTH_INTERACTIVE_REQUIRED');
      if(/\bcaptchaSwitch\s*=\s*["']?2\b/.test(r.text)){await onStage('等待图形验证');await humanSlider(http);}
      else {
        await onStage('等待图形验证');
        const image=await http.get(AUTH+'/getCaptcha.htl?'+Date.now(),{binary:true});
        assert(/^image\/(png|jpeg|gif)/.test(image.response.mimeType||''),'CAPTCHA');
        // Keep the school image in memory. Show it together with the input
        // in one native sheet when the Scripting UIImage API can decode it.
        const UI=hostAPI('UIImage');
        let rendered=null;
        if(interactive&&config.runsInApp&&typeof UI?.fromData==='function'){
          try{rendered=UI.fromData(image.text);}catch(_){}
        }
        if(rendered){
          captcha=await input('图形验证码','输入图片中的字符',false,
            {kind:'captcha',image:rendered});
        }else{
          // Older host versions still have the native image preview and
          // native text input fallback; never silently omit the challenge.
          await QuickLook.present(Image.fromData(image.text));
          captcha=await input('图形验证码','输入刚才图片中的字符',false,
            {kind:'captcha'});
        }
      }
    }
    onStage(interactive?'本机加密登录密码（原生安全随机数）':'使用 Keychain 凭据进行本机密码加密');
    const encrypted=await encryptPassword(password,fields.salt);password='';
    onStage('提交学校认证请求');
    r=await http.get(r.url,{body:form({username,password:encrypted,captcha,rememberMe:'true',_eventId:'submit',cllt:'userNameLogin',dllt:'generalLogin',lt:fields.lt||'',execution:fields.execution})});
    if(/reAuthSubmit|isMultifactor=true/.test(r.text+' '+r.url)){
      if(!interactive)fail('AUTH_INTERACTIVE_REQUIRED');
      await onStage('等待二次认证');await mfa(http,r);
    }else if(safeURL(r.url).host==='authserver.nufe.edu.cn'&&/\/login(?:\?|$)/.test(r.url)){
      fail(interactive?'LOGIN_FAILED':'AUTO_LOGIN_REJECTED');
    }
    onStage('认证完成后读取课表页面');
    r=await http.get(TABLE);
    try{authenticatedPerson(r);}catch(_){fail(interactive?'LOGIN_FAILED':'AUTO_LOGIN_REJECTED');}
    return r.text;
  }finally{password='';}
}
async function coursePage(http,interactive,onStage=()=>{},manualAuth=null) {
  const accept=(response,optional=false)=>{
    let person;
    try{person=authenticatedPerson(response);}
    catch(error){if(optional&&error.code==='AUTH_REQUIRED')return false;throw error;}
    verifyBoundPerson(person);
    return true;
  };
  onStage('尝试读取教务课表入口');
  let r;
  try{r=await http.get(TABLE);}catch(e){if(e.code!=='AUTH_REQUIRED')throw e;}
  if(r&&accept(r,true))return r.text;
  // Explicit SSO is needed: student/login does not redirect itself to CAS.
  onStage('学校单点登录跳转');
  r=await http.get(SSO);if(accept(r,true))return r.text;
  if(safeURL(r.url).host!=='authserver.nufe.edu.cn') {r=await http.get(TABLE);accept(r);return r.text;}
  if(/reAuthSubmit|isMultifactor=true/.test(r.text+' '+r.url)){
    if(!interactive)fail('AUTH_INTERACTIVE_REQUIRED');
    await onStage('等待二次认证');await mfa(http,r);onStage('认证完成后读取课表页面');r=await http.get(TABLE);accept(r);return r.text;
  }
  // Reuse the verified on-device/Keychain credentials without showing the
  // school/account wizard again. Foreground still permits a native CAPTCHA/MFA
  // challenge when the school explicitly requires it.
  let account=manualAuth?.kind==='credentials'?manualAuth:readSavedCredentials();
  let shouldSave=manualAuth?.kind==='credentials';
  if(!account){
    if(!interactive)fail('AUTH_REQUIRED');
    await onStage('等待输入学校登录信息');
    account=await credentialForm({title:'CourseSync 登录'});
    shouldSave=true;
  }else{
    onStage('Cookie 已失效，使用 Keychain 凭据自动登录');
  }
  let page;
  try{
    page=await passwordLogin(http,r,account.username,account.password,interactive,onStage);
  }catch(e){
    // A rejected stored password is not an excuse to repeat it forever.
    // Ask once in the foreground, and only for a verified login rejection.
    if(!interactive||shouldSave||!['LOGIN_FAILED','AUTO_LOGIN_REJECTED'].includes(e?.code))throw e;
    await onStage('等待输入学校登录信息');
    account=await credentialForm({title:'更新 CourseSync 登录信息'});
    shouldSave=true;
    // Restart the CAS form to get fresh execution/salt values.
    const fresh=await http.get(SSO);
    page=await passwordLogin(http,fresh,account.username,account.password,true,onStage);
  }
  // The school can accept a password for a different account than this binding.
  verifyBoundPerson(pagePerson(page));
  if(shouldSave)saveCredentials(account.username,account.password);
  if(manualAuth?.kind==='credentials')manualAuth.password='';
  return page;
}

// Immutable generation files: a new file is written and read back before old versions
// are pruned. Corrupt latest generation fails closed; it never becomes an empty state.
class Store {
  constructor() {
    this.fm=FileManager.local();
    this.dir=this.fm.joinPath(this.fm.libraryDirectory(),schoolKey('CourseSync-v2'));
    if(!this.fm.fileExists(this.dir))this.fm.createDirectory(this.dir,true);
    this.token=null;this.generation=0;this.lastHeartbeat=0;
    this.migrateLegacyState();
  }
  migrateLegacyState(){
    const states=()=>this.fm.listContents(this.dir)
      .filter(n=>/^state-\d{10}\.json$/.test(n)).sort();
    if(states().length)return;
    const legacy=HostFiles.appGroupDocumentsDirectory+
      '/NUFE-Local-Scripting/NUFE-Local-Scripting-v2';
    if(!this.fm.fileExists(legacy))return;
    let oldNames;
    try{oldNames=this.fm.listContents(legacy)
      .filter(n=>/^state-\d{10}\.json$/.test(n)).sort();}
    catch(_){fail('STATE_CORRUPT');}
    if(!oldNames.length)return;
    const lock=legacy+'/run-lock.json';
    if(this.fm.fileExists(lock)){
      try{
        const owner=JSON.parse(this.fm.readString(lock));
        if(Number.isFinite(owner?.at)&&Date.now()-owner.at<20*60000)
          fail('BUSY');
      }catch(e){if(e?.code==='BUSY')throw e;fail('LOCK_CORRUPT');}
    }
    const last=oldNames[oldNames.length-1];
    let original;
    try{
      original=this.fm.readString(legacy+'/'+last);
      assert(typeof original==='string'&&original.length<4*1024*1024,'STATE_CORRUPT');
      validateState(JSON.parse(original));
    }catch(_){fail('STATE_CORRUPT');}
    const target=this.path(last);
    this.fm.writeString(target,original);
    assert(this.fm.readString(target)===original,'STATE_WRITE');
    // The original files remain untouched to permit an explicit rollback.
  }
  path(n){return this.fm.joinPath(this.dir,n);}
  read() {const names=this.fm.listContents(this.dir).filter(n=>/^state-\d{10}\.json$/.test(n)).sort();if(!names.length)return {version:1,owner:null,calendarId:null,anchors:{},semesters:{},minutes:10,failures:0};const name=names[names.length-1];this.generation=+name.slice(6,16);try{const s=JSON.parse(this.fm.readString(this.path(name)));validateState(s);return s;}catch(_){fail('STATE_CORRUPT');}}
  write(s) {this.check();const name='state-'+String(++this.generation).padStart(10,'0')+'.json',text=JSON.stringify(s);this.fm.writeString(this.path(name),text);assert(this.fm.readString(this.path(name))===text,'STATE_WRITE');const names=this.fm.listContents(this.dir).filter(n=>/^state-\d{10}\.json$/.test(n)).sort();for(const old of names.slice(0,-4))this.fm.remove(this.path(old));}
  acquire() {const p=this.path('run-lock.json');if(this.fm.fileExists(p)){try{const l=JSON.parse(this.fm.readString(p));if(Date.now()-l.at<20*60000)fail('BUSY');}catch(e){if(e.code==='BUSY')throw e;fail('LOCK_CORRUPT');}}
    if(this.fm.fileExists(p))this.fm.remove(p);
    const token=uuid(),candidate=this.path('lock-'+token+'.tmp');this.fm.writeString(candidate,JSON.stringify({token,at:Date.now()}));
    try{this.fm.move(candidate,p);}catch(_){if(this.fm.fileExists(candidate))this.fm.remove(candidate);fail('BUSY');}this.token=token;
    // Old cancellation requests target exact lock tokens; never apply one to a
    // subsequent run. Only the active owner can clear its own request on exit.
    const cancel=this.path('run-cancel.json');
    if(this.fm.fileExists(cancel)){
      try{const r=JSON.parse(this.fm.readString(cancel));if(r.token!==token)this.fm.remove(cancel);}catch(_){}
    }
    this.check();
  }
  // A lightweight, token-scoped activity mark. It does not extend the lock's
  // original 20-minute maximum lifetime, but distinguishes a responsive owner
  // from a suspended/killed task while the user requests cancellation.
  heartbeat(){
    const now=Date.now();
    if(!this.token||now-this.lastHeartbeat<10000)return;
    try{
      this.fm.writeString(this.path('run-heartbeat.json'),
        JSON.stringify({token:this.token,at:now}));
      this.lastHeartbeat=now;
    }catch(_){} // Diagnostics must never interrupt verified calendar writes.
  }
  // Only a user-requested cancellation of the SAME token may take over a
  // demonstrably unresponsive task. Never blindly delete a healthy live lock.
  recoverStalledCancellation(minIdleMs=90000){
    const p=this.path('run-lock.json'),cancel=this.path('run-cancel.json');
    if(!this.fm.fileExists(p)||!this.fm.fileExists(cancel))return false;
    let raw,l,c;
    try{raw=this.fm.readString(p);l=JSON.parse(raw);c=JSON.parse(this.fm.readString(cancel));}
    catch(_){return false;}
    if(!l||typeof l.token!=='string'||!Number.isFinite(l.at)||
      !c||c.token!==l.token||!Number.isFinite(c.at))return false;
    // A fresh cancellation must be requested by the foreground user.
    if(Date.now()-c.at>5*60000||c.at<l.at)return false;
    const heartbeatFile=this.path('run-heartbeat.json');
    let hbRaw=null,hb=null;
    try{if(this.fm.fileExists(heartbeatFile)){
      hbRaw=this.fm.readString(heartbeatFile);hb=JSON.parse(hbRaw);
    }}catch(_){return false;}
    let lastActivity=l.at;
    if(hb&&hb.token===l.token&&Number.isFinite(hb.at))
      lastActivity=Math.max(lastActivity,hb.at);
    // Fast path: an actively pulsing writer is not an orphan. Avoid parsing
    // multi-year local state on every polling iteration.
    if(Date.now()-lastActivity<Math.max(60000,minIdleMs))return false;
    // Legacy installations do not yet write a heartbeat. The last recorded
    // sync stage is another reliable sign that the previous run is moving.
    try{const state=this.read();const stageAt=Date.parse(state.lastStageAt||'');
      if(Number.isFinite(stageAt)&&stageAt>=l.at)lastActivity=Math.max(lastActivity,stageAt);
    }catch(_){return false;} // Never take over if state is unreadable.
    if(Date.now()-lastActivity<Math.max(60000,minIdleMs))return false;
    // Another owner could have refreshed the mark while we inspected state.
    try{
      if(!this.fm.fileExists(p)||this.fm.readString(p)!==raw)return false;
      if(hbRaw!==null&&this.fm.readString(heartbeatFile)!==hbRaw)return false;
      const staged=this.path('orphan-lock-'+l.token+'.tmp');
      this.fm.move(p,staged); // Atomic rename, never delete a different token.
      try{this.fm.remove(staged);}catch(_){}
      return true;
    }catch(_){return false;}
  }
  // Cancellation is a cooperative handoff, not a forced termination. The old
  // task must acknowledge it at its next existing safety checkpoint.
  requestCancelActive(){
    const p=this.path('run-lock.json'),cancel=this.path('run-cancel.json');
    if(!this.fm.fileExists(p))return false;
    let current,raw;
    try{raw=this.fm.readString(p);current=JSON.parse(raw);}catch(_){fail('LOCK_CORRUPT');}
    if(!current||typeof current.token!=='string'||!Number.isFinite(current.at))fail('LOCK_CORRUPT');
    if(Date.now()-current.at>=20*60000)return false;
    this.fm.writeString(cancel,JSON.stringify({token:current.token,at:Date.now()}));
    // If the owner changed during the request, never request termination of
    // the new holder; the token remains scoped to the previous invocation.
    if(!this.fm.fileExists(p)||this.fm.readString(p)!==raw)return false;
    return true;
  }
  check(){
    if(!this.token)fail('LOCK_LOST');
    const p=this.path('run-lock.json');let l;
    try{l=JSON.parse(this.fm.readString(p));}catch(_){fail('LOCK_LOST');}
    assert(l.token===this.token&&Date.now()-l.at<20*60000,'LOCK_LOST');
    const cancel=this.path('run-cancel.json');
    if(this.fm.fileExists(cancel)){
      let r=null;try{r=JSON.parse(this.fm.readString(cancel));}catch(_){}
      if(r&&r.token===this.token)fail('SYNC_SUPERSEDED');
    }
    this.heartbeat();
  }
  release(){
    if(!this.token)return;
    const p=this.path('run-lock.json'),cancel=this.path('run-cancel.json');
    try{
      const owner=JSON.parse(this.fm.readString(p));
      if(owner.token===this.token){
        if(this.fm.fileExists(cancel)){
          try{if(JSON.parse(this.fm.readString(cancel)).token===this.token)this.fm.remove(cancel);}catch(_){}
        }
        const heartbeatFile=this.path('run-heartbeat.json');
        if(this.fm.fileExists(heartbeatFile)){
          try{if(JSON.parse(this.fm.readString(heartbeatFile)).token===this.token)
            this.fm.remove(heartbeatFile);}catch(_){}
        }
        this.fm.remove(p);
      }
    }catch(_){}
    this.token=null;this.lastHeartbeat=0;
  }
}
function validateRecords(events,code='STATE_CORRUPT') {
  assert(Array.isArray(events),code);const ids=new Set();
  for(const e of events){
    assert(e&&typeof e.id==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(e.id)&&!ids.has(e.id),code);ids.add(e.id);
    assert(typeof e.sid==='string'&&/^\d+$/.test(e.sid)&&typeof e.title==='string'&&e.title.trim()&&typeof e.location==='string',code);
    assert(typeof e.start==='string'&&typeof e.end==='string'&&Number.isFinite(Date.parse(e.start))&&Date.parse(e.end)>Date.parse(e.start),code);
    assert([e.week,e.su,e.eu].every(Number.isInteger)&&e.week>=1&&e.week<=60&&e.su>=1&&e.eu>=e.su&&Array.isArray(e.teachers)&&e.teachers.every(t=>typeof t==='string'),code);
  }
}
function validateState(s){
  assert(s&&s.version===1&&s.semesters&&typeof s.semesters==='object'&&!Array.isArray(s.semesters)&&s.anchors&&typeof s.anchors==='object'&&!Array.isArray(s.anchors),'STATE_CORRUPT');
  const allIds=new Set();
  assert(s.owner===null||typeof s.owner==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(s.owner),'STATE_CORRUPT');
  if(s.examIndex!=null)assert(s.owner&&typeof s.examIndex==='object'&&!Array.isArray(s.examIndex)&&
    Object.entries(s.examIndex).every(([id,key])=>id&&typeof key==='string'&&key.startsWith(EXAM_MARKER+s.owner+'] ')),'STATE_CORRUPT');
  for(const [sid,t] of Object.entries(s.semesters)){
    assert(/^\d+$/.test(sid)&&t&&typeof t==='object','STATE_CORRUPT');validateRecords(t.events);
    for(const e of t.events){assert(s.owner&&s.calendarId&&e.sid===sid&&!allIds.has(e.id),'STATE_CORRUPT');allIds.add(e.id);}
  }
  if(s.tx){
    const t=s.tx;
    assert(typeof t.sid==='string'&&typeof t.anchor==='string'&&typeof t.stamp==='string'&&Number.isFinite(Date.parse(t.stamp)),'STATE_CORRUPT');
    assert(t.calendarId==null||typeof t.calendarId==='string'&&t.calendarId.length>0,'STATE_CORRUPT');
    monday(t.anchor);validateRecords(t.before);validateRecords(t.target);
    assert([...t.before,...t.target].every(e=>e.sid===t.sid)&&t.changes&&
      ['added','removed','changed'].every(key=>Number.isInteger(t.changes[key])&&t.changes[key]>=0),'STATE_CORRUPT');
  }
}
function readCookieJar(){
  try{
    const data=Keychain.contains(schoolKey(KEY))?JSON.parse(Keychain.get(schoolKey(KEY))):[];
    assert(Array.isArray(data)&&data.length<=500,'COOKIE_STORAGE');
    for(const c of data)assert(c&&schoolCookieDomains().includes(c.domain)&&typeof c.name==='string'&&/^[^\x00-\x20\x7f()<>@,;:\\"/\[\]?={}]+$/.test(c.name)&&typeof c.value==='string'&&!/[\x00-\x1f\x7f;]/.test(c.value)&&typeof c.path==='string'&&c.path.startsWith('/')&&typeof c.expires==='number'&&Number.isFinite(c.expires),'COOKIE_STORAGE');
    return new CookieJar(data);
  }catch(_){fail('COOKIE_STORAGE');}
}
function occurrenceKey(ev){return String(ev.identifier)+'\0'+(+ev.startDate)+'\0'+(+ev.endDate);}
async function calendarRows(start,end,calendar){
  const remaining=calendarReadDeadline-Date.now();
  if(remaining<=0)fail('BUDGET');
  const rows=await bounded(CalendarEvent.between(new Date(start),new Date(end),[calendar]),
    Math.min(20000,remaining),remaining<=20000?'BUDGET':'CALENDAR_TIMEOUT');
  assert(Array.isArray(rows),'CALENDAR_PERMISSION');
  // Defend even if a bridge returns events outside its requested calendar.
  return rows.filter(e=>e&&e.calendar&&e.calendar.identifier===calendar.identifier);
}
function assertNonRecurring(rows){
  const ids=new Map(),logical=new Map();
  for(const {ev,rec} of rows){
    const occ=occurrenceKey(ev),known=ids.get(ev.identifier);
    assert(!known||known===occ,'MANAGED_SERIES');ids.set(ev.identifier,occ);
    const key=rec.sid+'\0'+rec.id,dates=logical.get(key)||new Set();dates.add(rec.start+'\0'+rec.end);logical.set(key,dates);
    assert(dates.size===1,'MANAGED_SERIES');
    assert(!Array.isArray(ev.attendees)||!ev.attendees.length,'MANAGED_INVITATION');
    assert(!ev.isAllDay&&!ev.hasRecurrenceRules&&!ev.recurrenceRules?.length,'MANAGED_SERIES');
  }
}
function writeVerified(store,name,text){
  store.check();store.fm.writeString(store.path(name),text);
  assert(store.fm.fileExists(store.path(name))&&store.fm.readString(store.path(name))===text,'BACKUP_FAILED');return name;
}

function marker(e,owner) {return '[NUFE_LOCAL_V1 '+owner+' '+e.id+']';}
function legacyCalendarTitle(e){
  const names=[...new Set((e.teachers||[]).map(x=>String(x).trim()).filter(Boolean))];
  return e.title+(names.length?'（'+names.join('、')+'）':'');
}
function originalTitleFromCalendar(display,teachers){
  const names=[...new Set((teachers||[]).map(x=>String(x).trim()).filter(Boolean))];
  const suffix=names.length?'（'+names.join('、')+'）':'';
  return suffix&&String(display).endsWith(suffix)?String(display).slice(0,-suffix.length):String(display);
}
function notes(e,owner) {
  // The marker is temporary until the verified native event index is committed.
  // Include canonical course title so a killed shortcut can recover a new event.
  return marker(e,owner)+'\n'+JSON.stringify({sid:e.sid,id:e.id,title:e.title,week:e.week,su:e.su,eu:e.eu});
}
// The local state retains course metadata after the temporary marker is cleared.
// Legacy marked events remain recognized during migration and recovery.
function storedEventIndex(state){
  const map=new Map();
  for(const term of Object.values(state?.semesters||{})){
    const records=new Map((term.events||[]).map(e=>[e.id,e]));
    for(const [id,native] of Object.entries(term.index||{})){
      const record=records.get(id);
      if(!record||typeof native!=='string'||!native)continue;
      if(map.has(native)&&map.get(native).id!==id)fail('STATE_CORRUPT');
      map.set(native,record);
    }
  }
  return map;
}
function eventRecord(ev,owner,byNative=null) {
  const m=/^\[NUFE_LOCAL_V1 ([^ \]]+) ([^ \]]+)\]\n([^\n]+)/.exec(ev.notes||'');
  let meta=null;
  if(m){
    if(m[1]!==owner)return null;
    try{meta=JSON.parse(m[3]);}catch(_){fail('MARKER_CORRUPT');}
    assert(meta.id===m[2],'MARKER_CORRUPT');
  }else if(byNative instanceof Map)meta=byNative.get(ev.identifier)||null;
  if(!meta)return null;
  const indexed=byNative instanceof Map?byNative.get(ev.identifier):null;
  // New markers include the original course name. Legacy markers do not.
  // The indexed record is authoritative for unmarked events.
  const canonical=typeof meta.title==='string'&&meta.title?meta.title:
    typeof indexed?.title==='string'&&indexed.title?indexed.title:
    originalTitleFromCalendar(ev.title||'',meta.teachers||[]);
  const actual=String(ev.title||'');
  const teachers=meta.teachers??indexed?.teachers??[];
  const expected=legacyCalendarTitle({title:canonical,teachers});
  // Treat an unexpected manual title edit as a changed course, not a match.
  const title=actual===canonical||actual===expected?canonical:actual;
  const rec={...meta,title,teachers,location:ev.location||'',start:ev.startDate.toISOString(),end:ev.endDate.toISOString()};
  validateRecords([rec],'MARKER_CORRUPT');return rec;
}
function isStandaloneEvent(ev){
  return !ev.isAllDay&&!ev.isDetached&&!ev.hasRecurrenceRules&&!ev.recurrenceRules?.length;
}
class CalendarAdapter {
  constructor(calendar,owner,store,budget=()=>store.check(),state=null){
    this.calendar=calendar;this.owner=owner;this.store=store;this.budget=budget;
    this.byNative=storedEventIndex(state);this.hasMarkerWrites=false;this.verifiedWindows=new Map();
  }
  async scan(anchor,events=[],{reuseWindows=false,refreshWindows=false}={}) {
    // Chunked bounded queries avoid EventKit's multi-year predicate limit.
    let lo=Date.parse(anchor+'T00:00:00+08:00')-30*DAY,hi=lo+500*DAY;
    for(const e of events){lo=Math.min(lo,Date.parse(e.start)-DAY);hi=Math.max(hi,Date.parse(e.end)+DAY);}
    assert(Number.isFinite(lo)&&Number.isFinite(hi)&&hi-lo<4*366*DAY,'SCAN_RANGE');
    // Unchanged terms can share aligned reads. Post-write checks refresh them
    // before the next term can reuse them. Transactions always use fresh reads.
    if(!reuseWindows)this.verifiedWindows.clear();
    const aligned=reuseWindows||refreshWindows;
    const found=new Map(),windowSize=180*DAY;
    const first=aligned?Math.floor(lo/windowSize)*windowSize:lo;
    for(let start=first;start<hi;start+=windowSize){
      this.budget();
      this.store.check();
      let rows=reuseWindows?this.verifiedWindows.get(start):undefined;
      if(!rows){
        const end=aligned?start+windowSize:Math.min(hi,start+windowSize);
        const calendarEvents=await calendarRows(start,end,this.calendar);
        this.store.check();
        rows=[];
        for(const ev of calendarEvents){
          const rec=eventRecord(ev,this.owner,this.byNative);
          if(rec)rows.push({ev,rec});
        }
        if(aligned)this.verifiedWindows.set(start,rows);
      }
      for(const row of rows){
        const {ev}=row;
        if(aligned&&(+ev.endDate<=lo||+ev.startDate>=hi))continue;
        found.set(occurrenceKey(ev),row);
      }
    }
    return [...found.values()];
  }
  async save(e,existing){this.store.check();if(existing)assert(existing.calendar&&existing.calendar.identifier===this.calendar.identifier&&eventRecord(existing,this.owner,this.byNative),'FOREIGN_EVENT');const ev=existing||new CalendarEvent();ev.calendar=this.calendar;ev.title=e.title;restoreCalendarRoom(ev,e.location);ev.notes=notes(e,this.owner);ev.isAllDay=false;ev.timeZone='Asia/Shanghai';ev.startDate=new Date(e.start);ev.endDate=new Date(e.end);await ev.save();this.byNative.set(ev.identifier,e);this.hasMarkerWrites=true;return ev.identifier;}
  async remove(ev){this.store.check();assert(ev.calendar&&ev.calendar.identifier===this.calendar.identifier&&eventRecord(ev,this.owner,this.byNative),'FOREIGN_EVENT');await ev.remove();this.store.check();}
}
async function applyTransaction(tx,adapter,budget=()=>{}) {
  validateRecords(tx.before);validateRecords(tx.target);
  assert(tx.sid&&[...tx.before,...tx.target].every(e=>e.sid===tx.sid),'STATE_CORRUPT');
  const live=await adapter.scan(tx.anchor,[...tx.before,...tx.target]),byId=new Map();
  for(const x of live){if(x.rec.sid!==tx.sid)continue;const list=byId.get(x.rec.id)||[];list.push(x);byId.set(x.rec.id,list);}
  // In this user's disposable dedicated calendar, old marked series can be
  // replaced too. Create a standalone target first, then remove old occurrences.
  // Do not edit a recurring occurrence in place: its save span is not exposed.
  for(const list of byId.values())assert(list.every(x=>!Array.isArray(x.ev.attendees)||!x.ev.attendees.length),'MANAGED_INVITATION');
  const replacements=new Set();
  for(const [id,list] of byId){
    const dates=new Set(list.map(x=>x.rec.start+'\0'+x.rec.end));
    if(dates.size>1||list.some(({ev})=>!isStandaloneEvent(ev))||!list.every(x=>sameCalendarCourse(x.rec,list[0].rec)))replacements.add(id);
  }
  for(const e of tx.target){budget();const primary=(byId.get(e.id)||[])[0];if(replacements.has(e.id)||!primary||!sameCalendarCourse(primary.rec,e))await adapter.save(e,replacements.has(e.id)?null:primary&&primary.ev);}
  const targetIds=new Set(tx.target.map(e=>e.id));
  const removed=new Set([...tx.before.filter(e=>!targetIds.has(e.id)).map(e=>e.id),...[...byId.keys()].filter(id=>!targetIds.has(id))]);
  for(const [id,list] of byId){
    const drops=removed.has(id)||replacements.has(id)?list:targetIds.has(id)?list.slice(1):[];
    for(const item of drops){
      budget();const fresh=await calendarRows(+item.ev.startDate-1000,+item.ev.endDate+1000,adapter.calendar);
      const current=fresh.find(e=>e.identifier===item.ev.identifier&&+e.startDate===+item.ev.startDate&&+e.endDate===+item.ev.endDate);
      if(current)await adapter.remove(current); // A previous removal may already remove a series.
    }
  }
  budget();const after=await adapter.scan(tx.anchor,[...tx.before,...tx.target]),index={};
  const verified=new Map();
  for(const row of after){
    if(row.rec.sid!==tx.sid)continue;
    assert(!removed.has(row.rec.id)&&!verified.has(row.rec.id),'CALENDAR_VERIFY');
    verified.set(row.rec.id,row);
  }
  for(const e of tx.target){
    const row=verified.get(e.id);
    assert(row&&isStandaloneEvent(row.ev)&&!row.ev.attendees?.length&&sameCalendarCourse(row.rec,e),'CALENDAR_VERIFY');
    index[e.id]=row.ev.identifier;
  }
  return index;
}

async function notify(id,body) {const n=new Notification();n.identifier='nufe-local-'+id;n.title='CourseSync';n.body=body;n.sound='default';n.openURL=HostScript.createRunURLScheme(HostScript.name,{mode:'menu'});await n.schedule();}

// Session invalidation is known only after a school's request redirects to auth.
// Deduplicate the alert for this expired session: each scheduled run must not nag.
async function notifyAuthExpiredOnce(state,store) {
  if(state.authExpiryNotifiedAt)return false;
  const n=new Notification();n.identifier='nufe-local-auth-expired-'+state.owner;
  const code=state.lastError;
  n.title=['LOGIN_SCHEMA','LOGIN_SALT_MISSING','LOGIN_EXECUTION_MISSING','MFA_UNSUPPORTED','WEBVIEW_TIMEOUT','ACCOUNT_CHANGED','CREDENTIALS_INVALID','CREDENTIALS_UNAVAILABLE'].includes(code)?'CourseSync · 登录需要处理':'CourseSync · 登录已失效';
  n.body=code==='AUTH_INTERACTIVE_REQUIRED'?'Cookie 已失效，学校要求验证码或二次认证。课表已保留，请打开 Scripting 手动验证。':
    code==='AUTO_LOGIN_REJECTED'?'Cookie 已失效，保存的账号密码未能通过学校认证。课表已保留，请在 Scripting 中更新凭据。':
    code==='CREDENTIALS_INVALID'||code==='CREDENTIALS_UNAVAILABLE'?'自动读取本地登录凭据失败。课表已保留，请在 Scripting 中检查凭据设置。':
    code==='ACCOUNT_CHANGED'?'自动登录使用的账号与原课表绑定账号不一致。程序已停止写入；请在 Scripting 中核对学号。':
    code==='WEBVIEW_TIMEOUT'?'Cookie 失效后本地密码加密组件未能及时响应。课表已保留，请打开 Scripting 前台手动同步。':
    code==='AUTH_REQUIRED'?'学校会话已失效，且未找到可用自动登录凭据。课表已保留，请打开 Scripting 手动登录。':
    '自动登录未能完成。课表已保留，请在 Scripting 中检查登录状态或完成认证。';
  n.sound='default';n.openURL=HostScript.createRunURLScheme(HostScript.name,{mode:'menu'});
  await n.schedule();
  state.authExpiryNotifiedAt=new Date().toISOString();state.authNoticeError=null;
  store.write(state);return true;
}
// Reconcile OLD unmarked ICS imports with the course events that this installation
// ACTUALLY created, in the SAME selected writable calendar. Never infer from a
// school lesson alone that an unrelated calendar event should be destroyed.
function legacyText(value){
  const text=String(value||'');
  return (typeof text.normalize==='function'?text.normalize('NFC'):text).replace(/\s+/g,' ').trim();
}
function legacyEventKey(e){
  if(!e||e.isAllDay||!e.title||!e.startDate||!e.endDate)return null;
  const a=Date.parse(e.startDate),b=Date.parse(e.endDate);
  if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a)return null;
  return legacyText(e.title)+'\u0000'+a+'\u0000'+b;
}
function legacyLocationCompatible(a,b){
  const first=legacyText(a),second=legacyText(b);
  return !first||!second||first===second;
}
function selectLegacyDuplicates(rows,owner,state){
  const managed=new Map(),duplicates=[], uncertain=[];
  for(const ev of rows){
    if(typeof ev.notes!=='string'||!ev.notes.startsWith('[NUFE_LOCAL_V1 '+owner+' '))continue;
    const rec=eventRecord(ev,owner),key=legacyEventKey(ev);
    if(!rec||!key)continue;
    const array=managed.get(key)||[];array.push(ev);managed.set(key,array);
  }
  for(const ev of rows){
    const key=legacyEventKey(ev);if(!key||!managed.has(key))continue;
    if(isExamEvent(ev,state)||typeof ev.notes==='string'&&ev.notes.startsWith('[NUFE_LOCAL_V1 '))continue;
    if(Array.isArray(ev.attendees)&&ev.attendees.length)continue;
    const counterpart=managed.get(key).find(own=>legacyLocationCompatible(own.location,ev.location));
    if(counterpart)duplicates.push({ev,managed:counterpart,key});
    else uncertain.push(ev);
  }
  return {duplicates,uncertain,managedCount:[...managed.values()].reduce((n,v)=>n+v.length,0)};
}
async function scanLegacyDuplicates(calendar,state,progress=()=>{}){
  const terms=Object.values(state.semesters||{}).flatMap(t=>t.events||[]);
  if(!terms.length)fail('CLEANUP_NO_BASELINE');
  let low=Infinity,high=-Infinity;
  for(const e of terms){const a=Date.parse(e.start),b=Date.parse(e.end);if(Number.isFinite(a)&&Number.isFinite(b)){low=Math.min(low,a);high=Math.max(high,b);}}
  if(!Number.isFinite(low)||!Number.isFinite(high)||high-low>3*366*DAY)fail('SCAN_RANGE');
  const rows=new Map();
  // A recurring series may use one identifier for MANY different occurrences.
  // Dedupe by identifier AND occurrence time, never by identifier alone.
  // Otherwise every week except one silently disappears from the cleanup scan.
  for(let t=low-DAY;t<high+DAY;t+=45*DAY){
    progress('检查旧课程和考试：'+localDateTime(new Date(t).toISOString()).slice(0,10));
    const data=await calendarRows(t,Math.min(high+DAY,t+45*DAY),calendar);
    for(const e of data){
      if(!e||!e.identifier||!e.startDate||!e.endDate)continue;
      const start=+e.startDate,end=+e.endDate;
      if(!Number.isFinite(start)||!Number.isFinite(end))continue;
      rows.set(e.identifier+'\u0000'+start+'\u0000'+end,e);
    }
  }
  const allRows=[...rows.values()];return {...selectLegacyDuplicates(allRows,state.owner,state),rows:allRows,low:low-DAY,high:high+DAY};
}
function backupLegacyICS(events){
  const safe=events.map((e,i)=>({
    id:'legacy-backup-'+i+'-'+String(e.identifier||'unknown').replace(/[^\w-]/g,'').slice(0,50),
    title:e.title||'',start:e.startDate.toISOString(),end:e.endDate.toISOString(),
    location:e.location||'',description:e.notes||''
  }));
  return ics(safe);
}
function dedicatedWindows(state){
  const windows=[];
  for(const term of Object.values(state.semesters||{})){
    if(!term.anchor)continue;
    const start=Date.parse(monday(term.anchor)+'T00:00:00+08:00')-30*DAY;
    windows.push([start,start+500*DAY]);
    for(const e of term.events||[])windows.push([Date.parse(e.start)-DAY,Date.parse(e.end)+DAY]);
  }
  windows.sort((a,b)=>a[0]-b[0]);const out=[];
  for(const w of windows){const last=out[out.length-1];if(last&&w[0]<=last[1])last[1]=Math.max(last[1],w[1]);else out.push(w.slice());}
  assert(out.every(w=>Number.isFinite(w[0])&&Number.isFinite(w[1])),'SCAN_RANGE');return out;
}
function recurrenceSnapshot(e){
  return (e.recurrenceRules||[]).map(r=>({identifier:r.identifier,frequency:r.frequency,interval:r.interval,firstDayOfTheWeek:r.firstDayOfTheWeek,daysOfTheWeek:r.daysOfTheWeek,daysOfTheMonth:r.daysOfTheMonth,daysOfTheYear:r.daysOfTheYear,weeksOfTheYear:r.weeksOfTheYear,monthsOfTheYear:r.monthsOfTheYear,setPositions:r.setPositions}));
}
function snapshotFields(e){return {recurrenceRules:recurrenceSnapshot(e),hasRecurrenceRules:!!e.hasRecurrenceRules,occurrenceDate:e.occurrenceDate?new Date(e.occurrenceDate).toISOString():null,isDetached:!!e.isDetached,identifier:e.identifier,title:e.title||'',notes:e.notes||'',location:e.location||'',start:e.startDate.toISOString(),end:e.endDate.toISOString(),allDay:!!e.isAllDay};}
function snapshotSignature(e){return JSON.stringify(snapshotFields(e));}
async function clearLegacyReminders(state,store){
  if(state.notificationMode==='result-only-v2')return;
  const prefix='nufe-local-class-'+state.owner+'-';
  try{
    const pending=await Notification.allPending();
    await Notification.removePending(pending.map(n=>n.identifier).filter(id=>typeof id==='string'&&id.startsWith(prefix)));
    state.notificationMode='result-only-v2';
    state.minutes=0;
    state.reminderError=null;
  }catch(_){state.reminderError='NOTIFICATION_FAILED';}
  store.write(state);
}
function localDateTime(iso){return new Date(Date.parse(iso)+8*3600000).toISOString().slice(0,16).replace('T',' ');}
function ics(events,stamp=new Date().toISOString()) {
  const esc=s=>String(s).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
  const date=s=>new Date(s).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  let lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//NUFE Local//CN','CALSCALE:GREGORIAN'];
  for(const e of events){
    lines.push('BEGIN:VEVENT','UID:'+e.id+'@nufe-local','DTSTAMP:'+date(stamp),'DTSTART:'+date(e.start),'DTEND:'+date(e.end),'SUMMARY:'+esc(e.title),'LOCATION:'+esc(e.location));
    if(typeof e.description==='string')lines.push('DESCRIPTION:'+esc(e.description));
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');return lines.map(line=>{let result='',part='',n=0;for(const c of line){const cp=c.codePointAt(0);const bytes=cp<=0x7f?1:cp<=0x7ff?2:cp<=0xffff?3:4;if(n+bytes>75){result+=part+'\r\n';part=' ';n=1;}part+=c;n+=bytes;}return result+part;}).join('\r\n')+'\r\n';
}
const ERRORS={CLEANUP_NO_BASELINE:'尚未完成首次同步，不能识别哪些课程和考试由本脚本管理。',CLEANUP_TX_PENDING:'上次课表写入事务仍未完成，请先恢复同步。',CLEANUP_BACKUP_FAILED:'清理前的备份文件写入失败，已停止删除。',AUTH_REQUIRED:'登录态已失效或需要验证，请解锁并在 Scripting 内重新登录。旧课表已保留。',LOGOUT_INCOMPLETE:'退出登录尚未完成：部分会话或保存的凭据无法清除。后台自动登录已暂停，请解锁后重试。',LOGIN_FAILED:'登录未完成：请检查账号密码，或重新运行完成学校验证。不会自动重试密码。',LOGIN_SCHEMA:'学校登录页面结构已变化，已停止提交。',MFA_UNSUPPORTED:'学校要求了当前不支持的二次认证方式。请使用学校官方渠道完成认证，或联系维护者适配。',MFA_FAILED:'二次认证未通过，请重新运行。',MFA_SEND:'学校未发送验证码，请稍后重新运行。',CAPTCHA:'验证码未通过或数据结构变化，请重新运行并亲自验证。',SCHEMA:'学校数据不完整或结构变化，未用它覆盖旧课表。',TIME_MISSING:'课程和考试缺少可靠起止时间，已保留旧课表。',ANCHOR:'学校校历未提供可确认的教学周日期，已保留该学期的原有课程和考试。',STATE_CORRUPT:'最新本地状态损坏。已停止同步；请保留文件并联系维护者，不要删除缓存。',NETWORK:'网络连接失败，旧课表已保留。',NETWORK_TIMEOUT:'学校请求等待超过 25 秒。可查看状态中的最后请求阶段；旧课表已保留。',WEBVIEW_TIMEOUT:'本机输入界面未及时响应，已终止等待。',BUSY:'已有同步正在运行。本次不会并发修改日历；请等待前次完成。',LOCK_CORRUPT:'同步锁文件已损坏。请保留本地状态文件以便排查。',DOMAIN_BLOCKED:'请求指向未经允许的地址，已阻止。',ACCOUNT_CHANGED:'检测到其他账号，已停止同步。请使用原账号；本版不自动切换账号。',REVIEW:'存在需人工核对的课程和考试变动，请在 Scripting 内运行。',CALENDAR_MISSING:'保存的日历绑定无法匹配。请在 Scripting 内点「立即刷新」，按提示新建专用 iCloud 日历。',CALENDAR_NOT_VISIBLE:'Scripting 看不到可写入的「课表」日历。请在 iPhone 设置中给 Scripting「日历完全访问」权限，再重试。',CALENDAR_PERMISSION:'读取 iPhone 日历列表失败。请在设置中允许 Scripting 完全访问日历。',CALENDAR_REBIND_UNSAFE:'原日历仍有未完成的同步，请恢复该日历并完成同步后再试。',BUDGET:'本次执行预算已用尽。下次运行将从已保存的事务继续。',DUPLICATE_SOURCE:'学校返回无法区分的重复课程和考试，已保留旧课表。',CANCELLED:'已取消。',MARKER_CORRUPT:'日历课程和考试身份信息校验失败，请保留本地状态及备份，不要删除或重建课表日历。'};
// For every error show a safe, concrete explanation and the next action.
// Unknown runtime errors are called unknown instead of guessing that the password is wrong.
const ERROR_GUIDE={
  EXAM_SCHEMA:['教务系统返回的考试列表或考试时间无法识别。','请在教务系统中核对考试信息，再试一次。'],
  SCHOOL_UNSUPPORTED:['学校不在当前支持名单中，已停止请求且未修改课表。','首次登录时请在学校下拉菜单中选择已支持的学校。'],
  ENDPOINT_CONFIG:['学校预设接口格式异常，已停止请求。','请更新 CourseSync 或联系维护者检查学校接口配置。'],
  ENDPOINT_UI:['Scripting 原生登录页面未能打开；当前配置未修改。','更新 Scripting 后在前台重新点击「立即刷新」。'],
  ENDPOINT_STORAGE:['本机钥匙串未能保存学校选择或清理旧接口设置，未确认更改成功。','解锁 iPhone 后重新登录。'],
  TX_TERM_UNAVAILABLE:['待恢复事务的学期已不在学校可访问学期列表中，未恢复旧目标或删除课程和考试。','需要检查学校学期列表；保留本地备份和事务。'],
  EMPTY_SOURCE:['教务课表意外变空或没有可验证的新课程和考试，未清理旧内容。','等学校数据恢复后重试；若确实全部停课，需人工核对。'],
  LEGACY_CHANGED:['备份后旧事件发生了变化，本次停止清理。','稍后刷新重新备份核对；新课程和考试已保留。'],
  LEGACY_VERIFY:['部分旧内容仍然可见，或 iCloud 尚未反映删除，不能报告刷新成功。','稍后再运行；将重新抓取、备份、扫描，不重复创建已有课程和考试。'],

  RETRY_LATER:['上次刷新失败，当前处于退避等待期，未重复请求学校。','稍后重试；可前台运行查看上次失败原因。'],
  PARTIAL_SYNC:['部分学期读取或同步失败，不能报告整次刷新成功。','查看状态中的学期错误。'],
  NOTIFICATION_FAILED:['课表写入已核验，但课程和考试提醒提交失败。','检查 Scripting 通知权限。'],

  COOKIE_STORAGE:['本机 Cookie 存储损坏或格式异常，未尝试发送。','请记录错误代码并联系维护者处理；不要删除课表日历。'],
  BACKUP_FAILED:['同步或核对前的本地备份无法写入或校验，已停止写入。','检查存储空间，保留现有状态。'],
  CALENDAR_TIMEOUT:['读取 Apple 日历超过 20 秒，未继续写入。','解锁设备，在前台检查日历权限和 iCloud 同步后重试。'],
  CALENDAR_VERIFY:['写后重新扫描尚未确认目标结果，事务已保留，不能报告成功。','等待 iCloud 更新后再运行；会按相同标记恢复，勿手动重复导入 ICS。'],
  MANAGED_SERIES:['本工具标记对应多个日期或已变成全天事件，可能是循环系列，已停止自动写入。','在 Apple 日历核对该系列，先做完整日历备份；本脚本不推断系列删除范围。'],
  MANAGED_INVITATION:['本工具标记事件已有邀请者，自动修改可能影响他人，已停止。','在 Apple 日历核对邀请信息和事件归属。'],

  COOKIE_DOMAIN:['学校响应包含与当前认证域名不匹配的 Cookie，安全校验拒绝接收；它可能是学校配置问题，也可能是旧脚本解析兼容问题。','更新脚本以安全跳过无效 Cookie，同时保留域名验证。不要关闭域名校验或分享 Cookie 内容。'],
  COOKIE_FORMAT:['学校响应包含格式异常的 Cookie，无法安全解析。','保留最近阶段记录供适配；不要上传含 Cookie 值的网络请求日志。'],
  LOGIN_SCHEMA:['学校返回的登录页面没有符合预期的密码认证表单；可能是页面升级、额外验证页或接口返回异常。','先在 Safari 核对学校官方登录页是否正常；若仍失败，请保留错误代码，不要反复提交密码。'],
  LOGIN_SALT_MISSING:['登录表单缺少 pwdEncryptSalt（密码加密盐）；不能安全生成学校要求的加密密码。','在 Safari 检查学校官方登录页是否正常；如持续失败，请保留错误代码供适配。'],
  LOGIN_EXECUTION_MISSING:['学校登录表单缺少 execution 认证流水字段，无法可靠提交登录请求。','在 Safari 检查学校官方登录页；若持续失败，请记录错误代码供适配。'],
  LOGIN_FAILED:['学校没有确认登录成功；可能是密码不正确、验证码失败或登录页面变化，无法单凭此代码确定。','先在 Safari 验证学校账号是否能登录，再使用本程序。'],
  AUTH_REQUIRED:['学校登录 Cookie 已失效，而且尚未配置自动登录凭据。','点击「立即刷新」通过原生界面重新登录，学校确认认证成功后才会自动保存账号密码。'],
  AUTH_INTERACTIVE_REQUIRED:['Cookie 过期后自动登录时，学校要求图形验证码、滑块或二次认证。脚本不会绕过这些验证。','打开 Scripting 手动完成学校验证；成功后定时同步会继续。'],
  AUTO_LOGIN_REJECTED:['已尝试使用保存的 Keychain 凭据重新登录，但学校没有确认登录成功；可能是密码变更、账号异常或认证页面变化。','先在 Safari 验证账号，再从主菜单点击「立即刷新」并手动重新登录；不要频繁尝试。'],
  CREDENTIALS_INVALID:['本地保存的账号信息格式不正确，自动登录已停止。','点击「退出登录」，再通过「立即刷新」使用原生界面重新登录。'],
  CREDENTIALS_UNAVAILABLE:['Scripting 当前无法读取或写入本机 Keychain；可能是系统限制、权限或凭据数据损坏。','解锁 iPhone 并在 Scripting 前台重试；部分凭据操作可能不可用。'],
  LOGOUT_INCOMPLETE:['退出时未能完全清除本机 Cookie 或同步的脚本凭据；已阻止后台继续登录。','解锁 iPhone 并检查 iCloud 钥匙串，再打开 CourseSync 重试「退出登录」。课表数据不会删除。'],
  WEBVIEW_TIMEOUT:['Scripting 的本机输入界面超时。脚本将优先改用系统安全输入框；不能认定账号密码有误。','如果系统安全输入仍无法完成，请重新打开 Scripting 后再试。'],
  NETWORK_TIMEOUT:['一个学校网络请求等待超过 25 秒，没有得到完整响应。','检查 Wi-Fi、蜂窝网络或 VPN，稍后单次重试。'],
  NETWORK_CHAIN_TIMEOUT:['登录/数据请求涉及多次跳转，整组请求超过 75 秒。','检查当前网络是否能打开学校登录入口，并保留阶段日志。'],
  NETWORK_OFFLINE:['系统报告设备没有可用的网络连接。','检查设备联网后再试。'],
  NETWORK_DNS:['系统无法解析学校服务域名。','检查 DNS 或代理配置，尝试 Safari 打开学校登录地址。'],
  NETWORK_TLS:['学校连接遇到证书或 TLS 校验问题。','检查系统时间和 HTTPS 代理设置；不要关闭证书验证。'],
  NETWORK_LOST:['学校网络连接中途断开。','检查网络稳定性后重试。'],
  NETWORK:['网络请求失败，但系统没有返回可安全区分的具体原因。','尝试 Safari 打开学校登录入口，切换网络后单次重试。'],
  HTTP_429:['学校服务返回请求过于频繁（429）。','暂停手动刷新，等待学校解除限流后再尝试。'],
  TOO_LARGE:['学校返回的数据超过脚本安全处理上限，未继续解析或覆盖课表。','保留当前课表和错误代码，等待检查接口返回内容。'],
  CRYPTO:['学校密码加密所需参数无效，未提交登录密码。','检查认证页面是否发生变化，保留错误代码供适配。'],
  CALENDAR_READONLY:['当前绑定日历不可写入或与保存的日历不一致。','先检查原日历和 Scripting 的日历访问权限，再点「立即刷新」。'],
  CALENDAR_NOT_ICLOUD:['已创建日历，但无法确认它属于 iCloud。为了避免写入其他账户，本次没有绑定或导入课程和考试。','请在 Apple 日历确认账户来源，并检查 iCloud 日历是否启用。'],
  CALENDAR_NAME:['日历名称为空、过长或包含不支持的字符。','请输入 1～60 字符的自定义日历名称。'],
  DOMAIN_BLOCKED:['认证跳转到了程序安全名单之外的域名。程序为了保护账号主动阻止了连接。','不要绕过限制；需要人工核实学校新认证域名后才能更新白名单。'],
  REDIRECT:['学校登录跳转缺少目标地址、出现循环或达到上限。','检查学校登录是否正常；保留诊断报告供适配。'],
  CAPTCHA:['验证码结果不符合预期，或学校返回的验证码结构发生变化。','重新运行并亲自完成学校验证码；避免反复提交。'],
  CALENDAR_MISSING:['之前保存的日历 ID 与当前日历不匹配，程序无法安全写入。','从主菜单「立即刷新」进入，按提示新建专用 iCloud 日历。'],
  CALENDAR_PERMISSION:['iOS 阻止读取日历列表或日历访问接口失败。','在 iPhone 设置中将 Scripting 的「日历」权限改为「完全访问」；若开启了单脚本权限，也要允许本脚本访问日历。'],
  EXAM_CALENDAR_UNAVAILABLE:['旧考试日历当前不可写或不可见，暂时无法合并。','确认 Apple 日历仍能访问旧考试日历，再点击「立即刷新」。'],
  CALENDAR_CREATE_FAILED:['无法新建专用 iCloud 日历。','检查 iCloud 日历是否启用，并确认 Scripting 拥有日历「完全访问」权限后重试。'],
  CALENDAR_NOT_VISIBLE:['没有找到可写入的「课表」日历。','检查日历 App 中是否存在该日历及 Scripting 的完全访问权限。'],
  BUSY:['同步锁显示可能有另一项同步正在进行，也可能是上次异常退出留下的锁。','避免同时运行两个任务；异常退出留下的正常锁在 20 分钟后会自动过期。'],
  LOCK_LOST:['运行过程中同步锁失效，程序为防止重复写入主动停止。','检查是否存在多个并发任务；停止自动化后稍候重新同步。'],
  STATE_CORRUPT:['本地状态文件无法通过校验，不能安全恢复以前的同步进度。','不要清理状态目录或删除日历；先备份文件并检查。'],
  STATE_WRITE:['本地状态写入后校验失败，可能是存储空间或文件权限问题。','检查 iPhone 存储空间，保留旧状态文件，不要反复同步。'],
  BUDGET:['本次执行超过运行时间预算，程序停止以避免无限运行。','在前台再次运行，程序会尝试安全恢复未完成事务。'],
  SCHEMA:['教务系统返回的课程和考试或学期数据结构不符合预期，为避免覆盖已有课表已停止。','请保留诊断信息，等待更新解析规则。'],
  HTTP_404:['学校服务器返回 404，所请求的具体接口可能已修改或暂时不可访问。','验证学校登录和课表页面在 Safari 是否正常，检查对应接口。'],
  HTTP_500:['学校服务器返回 500，服务端暂时出现异常。','稍后重试；如果持续发生，联系学校技术支持。'],
  HTTP_502:['学校服务网关返回 502。','等学校服务恢复再同步。'],
  HTTP_503:['学校服务暂不可用（503）。','稍后再试。'],
  HTTP_504:['学校服务网关等待超时（504）。','稍后再试，检查学校网络状态。'],
  CALENDAR_REBIND_UNSAFE:['原日历仍有未完成的写入。','恢复原日历后，在 Scripting 内点「立即刷新」完成上次同步。'],
  CLEANUP_NO_BASELINE:['需要先有一份由 CourseSync 创建且已成功写入的课程和考试，才能安全辨认旧重复日程。','先在主菜单选择「立即刷新」完成首次同步；后续由同步流程自动核对旧课程和考试。'],
  CLEANUP_TX_PENDING:['当前存在尚未完成的日历写入事务，不能在此时删除旧课程和考试。','在前台选择「立即刷新」恢复未完成事务；期间不要手动删除课表日历。'],
  CLEANUP_REMOVE_FAILED:['Apple 日历未能删除某条旧课程和考试，覆盖操作中途停止；之前已删除的部分不会自动恢复。','先检查可用备份，稍后选择「立即刷新」重试；不要直接删除循环系列。'],
  CLEANUP_BACKUP_FAILED:['删除前无法保存旧日程备份，程序已拒绝执行。','检查 Scripting 本地存储空间和文件读写权限。'],
  ACCOUNT_CHANGED:['当前登录的教务账号与这份课表的绑定账号不一致。','返回主菜单，选择「退出当前登录」，再用原账号登录。'],
  CANCELLED:['用户取消了当前操作，没有继续提交。','需要时重新进入菜单即可。'],
  SCRIPT_TYPE:['脚本遇到无法处理的数据类型；属于程序异常，尚不能确定根因。','保留失败阶段和诊断信息，供修正代码。'],
  SCRIPT_REFERENCE:['脚本引用了不存在的变量或接口；属于程序兼容性问题。','保留诊断信息供修复，不必重复输入密码。'],
  LOCAL_ERROR:['发生未分类的 Scripting/JavaScript 异常，无法可靠判断具体原因。','保留诊断报告，检查最近步骤；不要反复登录。']
};
function diagnosticCode(error){
  if(error&&typeof error.code==='string'&&/^[A-Z][A-Z0-9_]*$/.test(error.code))return error.code;
  if(error&&error.name==='TypeError')return 'SCRIPT_TYPE';
  if(error&&error.name==='ReferenceError')return 'SCRIPT_REFERENCE';
  return 'LOCAL_ERROR';
}
function reasonFor(code){return (ERROR_GUIDE[code]||[ERRORS[code]||('出现未收录错误（'+code+'），尚不能确认根因。'),'保留诊断报告供修复。'])[0];}
function actionFor(code){return (ERROR_GUIDE[code]||[null,'检查失败阶段、网络与登录入口；保留诊断报告供修复。'])[1];}
function briefTime(iso){if(!iso)return '无';try{return localDateTime(iso).replace(' ',' ');}catch(_){return '无';}}
function errorMessage(error,state){
  const code=diagnosticCode(error),stage=state&&state.lastStage||'尚未记录阶段';
  // Report only a local source line, never exception messages or raw stacks.
  const match=typeof error?.stack==='string'?/\bindex\.(?:tsx|js):(\d{1,7})(?::(\d{1,5}))?/.exec(error.stack):null;
  const location=match?'\n代码位置：index '+match[1]+(match[2]?':'+match[2]:''):'';
  // Only allow fixed API names, never include the exception message itself.
  const apiNames=['actionSheet','presentNativeDashboard','loadFreeRooms','createNativeProgressView','pause','finish','setTitle','resume','show'];
  const rawMessage=typeof error?.message==='string'?error.message:'';
  const api=apiNames.find(name=>new RegExp('\\b'+name+'\\b').test(rawMessage));
  const clue=api?'\n关联接口：'+api:'';
  return '阶段：'+stage+'\n错误代码：'+code+location+clue+'\n原因：'+reasonFor(code)+'\n建议：'+actionFor(code)+'\n时间：'+briefTime(new Date().toISOString())+'（北京时间）';
}
function createProgress(state,store,interactive){
  let lastSaved=-Infinity;
  const stage=message=>{
    const now=Date.now(),at=new Date(now).toISOString();
    state.lastStage=message;state.lastStageAt=at;
    state.stageHistory=[...(state.stageHistory||[]),{at,stage:message}].slice(-30);
    // Persist diagnostic checkpoints less often than network trace messages.
    // Calendar journals, failures, and final results are saved independently.
    if(interactive&&(now<lastSaved||now-lastSaved>=5000)){
      lastSaved=now;
      try{store.write(state);}
      catch(error){
        if(['LOCK_LOST','SYNC_SUPERSEDED'].includes(error?.code))throw error;
        console.error('[CourseSync] progress checkpoint could not be saved');
      }
    }
    if(typeof console!=='undefined'&&typeof console.log==='function')console.log('[CourseSync] '+message);
  };
  stage.pause=()=>Promise.resolve();
  stage.resume=()=>{};
  stage.start=()=>Promise.resolve();
  stage.finish=()=>Promise.resolve();
  return stage;
}
// Recognize a previously bound calendar even if it has not yet been renamed.
// The legacy spelling is encoded solely to preserve migration compatibility.
const LEGACY_CALENDAR_TITLE='\u5357\u8d22\u8bfe\u8868';
function liveCalendar(c){return c&&c.allowsContentModifications&&!c.isSubscribed;}
async function visibleCalendars(){
  const remaining=backgroundDeadline-Date.now();
  if(remaining<=0)fail('BUDGET');
  let all;
  try{
    all=remaining===Infinity?await Calendar.forEvents():await bounded(Calendar.forEvents(),remaining,'BUDGET');
  }catch(error){if(error?.code==='BUDGET')throw error;fail('CALENDAR_PERMISSION');}
  assert(Array.isArray(all),'CALENDAR_PERMISSION');return all;
}
// Preserve the bound calendar identifier; do not create a replacement calendar.
async function alignBoundCalendarName(calendar,state,store){
  // Calendar names belong to their owners. Track changes, never rename them.
  if(state.calendarTitle!==calendar.title||state.calendarBindingPending){
    state.calendarTitle=calendar.title;
    delete state.calendarBindingPending;
    store.write(state);
  }
  return calendar;
}
function validCalendarName(value){
  const title=String(value||'').trim();
  assert(title.length>=1&&title.length<=60&&!/[\\/\r\n\x00-\x1f]/.test(title),'CALENDAR_NAME');
  return title;
}
// Create only in a CalDAV account; verify it is actually the user's iCloud
// account before proceeding. Scripting cannot specify an exact account ID.
async function createDedicatedCalendar(title){
  title=validCalendarName(title);
  let created;
  try{created=await Calendar.create({title,entityType:'event',sourceType:'calDAV'});}
  catch(_){fail('CALENDAR_CREATE_FAILED');}
  // Once creation has started, never retry under a second account on
  // uncertain save/read-back; that can silently produce duplicate calendars.
  try{await created.save();}catch(_){}
  let found;
  try{found=(await visibleCalendars()).find(c=>
    liveCalendar(c)&&created.identifier&&c.identifier===created.identifier&&
    String(c.title||'').trim()===title);
  }catch(_){}
  if(!found)fail('CALENDAR_CREATE_FAILED');
  const source=found.source||created.source;
  if(!source||String(source.title||'').trim().toLowerCase()!=='icloud'||
     !['calDAV','mobileMe'].includes(source.type))fail('CALENDAR_NOT_ICLOUD');
  return found;
}
async function requestCalendarName(state){
  let result;
  if(typeof hostAPI('Navigation')?.present==='function'){
    try{result=await presentNativeCalendarManager({});}catch(_){}
  }
  if(result!==undefined){
    if(result?.action!=='create')fail('CANCELLED');
    return validCalendarName(result.title);
  }
  const prompt=new Alert();prompt.title='新建 iCloud 日历';
  prompt.addTextField('日历名称','CourseSync');prompt.addAction('创建并绑定');prompt.addCancelAction('取消');
  if(await prompt.presentAlert()<0)fail('CANCELLED');
  return validCalendarName(prompt.textFieldValue(0));
}
async function pickCalendar(state,store,beforePrompt){
  let all=await visibleCalendars();
  let exact=all.find(c=>liveCalendar(c)&&c.identifier===state.calendarId);
  if(exact)return await alignBoundCalendarName(exact,state,store);
  // Background jobs never create calendars or silently change the binding.
  if(!config.runsInApp||String(args.shortcutParameter||'').startsWith('sync'))fail('CALENDAR_MISSING');
  if(!all.length&&typeof HostScript.requestAccess==='function'){
    try{await HostScript.requestAccess(['calendar']);}catch(_){}
    all=await visibleCalendars();
    exact=all.find(c=>liveCalendar(c)&&c.identifier===state.calendarId);
    if(exact)return await alignBoundCalendarName(exact,state,store);
  }
  if(!all.length)fail('CALENDAR_PERMISSION');
  await beforePrompt?.();
  const title=await requestCalendarName(state);
  store.check();
  const picked=await createDedicatedCalendar(title);
  // Older journals implicitly targeted the calendar bound at their creation.
  if(state.tx&&state.tx.calendarId==null)state.tx.calendarId=state.calendarId;
  state.calendarId=picked.identifier;state.calendarTitle=picked.title;
  delete state.calendarBindingPending;
  state.lastStage='日历已绑定';state.lastStageAt=new Date().toISOString();
  store.write(state);
  return picked;
}
function availableRecovery(code,state,store){
  if(code==='COOKIE_STORAGE')return {kind:'cookie',label:'清除异常 Cookie'};
  if(code==='LOCK_CORRUPT')return {kind:'lock',label:'检查并修复异常同步锁'};
  if(['BACKUP_FAILED','CALENDAR_VERIFY','LEGACY_VERIFY','LEGACY_CHANGED','CLEANUP_REMOVE_FAILED','STATE_CORRUPT','MARKER_CORRUPT'].includes(code)){
    const names=[state?.lastSyncBackupName,state?.lastArchivedCourseJournal,state?.lastLegacyBackupName,state?.lastLegacyReportName].filter(Boolean);
    if(names.some(n=>/^[^/\\]+$/.test(n)&&store.fm.fileExists(store.path(n))))
      return {kind:'backup',label:'导出恢复备份'};
  }
  return null;
}
async function clearBrokenCookies(state,store){
  if(Keychain.contains(schoolKey(KEY)))Keychain.remove(schoolKey(KEY));
  // A credential-based automatic login can be attempted on the next refresh.
  state.authPaused=false;state.authExpiryNotifiedAt=null;
  state.lastError=null;store.write(state);
  await notice('已清除异常会话','已清除本机保存的学校 Cookie。账号密码与课程和考试日历均已保留，下次刷新将重新认证。');
}
async function exportRecoveryBackups(state,store){
  const names=[state.lastSyncBackupName,state.lastArchivedCourseJournal,state.lastLegacyBackupName,state.lastLegacyReportName]
    .filter(n=>n&&/^[^/\\]+$/.test(n)&&store.fm.fileExists(store.path(n)));
  if(!names.length){await notice('没有可用备份','未发现可导出的同步备份；请保留当前课表日历。');return;}
  const files=[...new Set(names)].map(n=>({name:n,data:Data.fromFile(store.path(n))}));
  await hostAPI('DocumentPicker').exportFiles({files});
}
async function repairAbnormalLock(store){
  const path=store.path('run-lock.json');
  if(!store.fm.fileExists(path)){await notice('同步锁已恢复','当前已无运行锁，可尝试重新同步。');return;}
  const original=store.fm.readString(path);
  let entry=null;try{entry=JSON.parse(original);}catch(_){}
  // A valid, non-expired lock may still belong to an active task. Do not
  // offer arbitrary deletion of another process's valid ownership.
  if(entry&&typeof entry.token==='string'&&Number.isFinite(entry.at)&&Date.now()-entry.at<20*60000){
    await notice('同步仍受保护','同步锁仍处于有效期，不能直接清除。请等待运行完成；如任务已退出，锁会在超时后失效。');
    return;
  }
  if(!await confirm('确认修复异常同步锁',
    '请确认所有 Scripting 同步任务和快捷指令自动化均已停止。本操作只移除异常的锁文件，不删除账号凭据或日历中的课程和考试。'))return;
  if(!store.fm.fileExists(path)||store.fm.readString(path)!==original){
    await notice('暂未处理','同步锁在确认期间发生变化，未修改锁文件。');return;
  }
  store.fm.remove(path);
  await notice('同步锁已修复','异常同步锁已清除。请重新尝试同步。');
}
async function applyRecovery(kind,state,store){
  if(kind==='cookie')return clearBrokenCookies(state,store);
  if(kind==='backup')return exportRecoveryBackups(state,store);
  if(kind==='lock')return repairAbnormalLock(store);
}
async function showRunStatus(state,store){
  // No network access, iCloud probing, or calendar mutations on the overview.
  const a=new Alert();a.title='运行状态';a.message=statusText(state);
  a.addAction('环境自检');a.addCancelAction('关闭');
  if(await a.presentAlert()!==0)return null;
  return showEnvironmentCheck(state,store);
}
async function showFailureRecovery(error,state,store,{title='刷新失败',details=errorMessage(error,state)}={}){
  const code=diagnosticCode(error),recovery=availableRecovery(code,state,store);
  if(!recovery){await notice(code==='CANCELLED'?'已取消':title,details);return;}
  const a=new Alert();a.title=title;a.message=details;
  a.addAction(recovery.label);a.addCancelAction('关闭');
  if(await a.presentAlert()===0)return applyRecovery(recovery.kind,state,store);
}
// The overview is intentionally small. It describes recorded results, not a
// real-time guarantee that the school schedule or calendar has not changed.
function statusText(state){
  const status=state.tx?'需要恢复上次写入':
    state.lastError==='LOGOUT_INCOMPLETE'?'退出未完成':
    state.signedOut?'已退出登录':
    state.authPaused?'需要处理登录':
    state.runStatus==='failed'?'上次刷新失败':
    state.lastExamError&&state.runStatus==='partial'?'考试日程未完成':
    state.runStatus==='partial'||(state.termErrors||[]).length?'部分学期未完成':
    state.runStatus==='running'?'上次同步可能仍在运行':
    state.runStatus==='success'?'上次刷新成功':
    state.runStatus==='cancelled'?'上次操作已取消':'尚未完成首次同步';
  const hasIssue=!!state.tx||state.lastError==='LOGOUT_INCOMPLETE'||(!state.signedOut&&(!!state.authPaused||['failed','partial'].includes(state.runStatus)||(state.termErrors||[]).length>0));
  const calendar=!state.calendarId||state.calendarBindingPending?'未绑定日历':(state.calendarTitle||'已绑定（名称未记录）');
  const last=state.lastCheck?briefTime(state.lastCheck):'尚无成功核验记录';
  const recent=state.runStatus==='failed'&&state.lastError&&!state.syncResults?
    '\n最近问题：'+reasonFor(state.lastError):'';
  const noticeWarning=state.resultNoticeError||state.authNoticeError||state.reminderError?
    '\n通知：有发送异常（不影响已完成的课表同步）':'';
  const termErrors=Array.isArray(state.termErrors)?state.termErrors:[];
  const termDetails=termErrors.slice(0,3).map(({sid,code})=>{
    const term=state.availableSemesters?.find(t=>String(t.id)===sid);
    return '\n'+(term?.name||sid)+'：'+reasonFor(code);
  }).join('')+(termErrors.length>3?'\n另有 '+(termErrors.length-3)+' 个学期未完成':'');
  return '结果：'+status+
    '\n上次完成检查：'+last+'（北京时间）'+
    '\n课表日历：'+calendar+
    (state.lastError==='LOGOUT_INCOMPLETE'?'\n登录：退出未完成，请重试':state.signedOut?'\n登录：已退出，点击「立即刷新」重新登录':state.authPaused?'\n登录：需要手动处理':'')+
    (state.tx?'\n事务：等待安全恢复':'')+
    recent+(state.syncResults?'\n'+syncResultDetails(state):termDetails)+noticeWarning+
    (hasIssue?'\n建议：打开「环境自检」定位问题':'');
}
// A single authenticated GET checks the actual current school session without
// asking for course-table JSON, changing cookies, or submitting credentials.
// The result refers only to this request, not a promise of future validity.
async function probeSchoolSession(jar){
  const req=new Request(TABLE);
  req.method='GET';req.timeoutInterval=7;
  const cookie=jar?.header(TABLE)||'';
  req.headers={Accept:'text/html, */*;q=0.8',...(cookie?{Cookie:cookie}:{})};
  let redirected=null,html='';
  req.onRedirect=next=>{redirected=String(next?.url||'');return null;};
  try{html=await bounded(req.loadString(),8500,'NETWORK_TIMEOUT');}
  catch(e){
    if(!redirected)return {
      connection:{level:'待确认',detail:'当前请求失败（'+networkErrorCode(e)+'）；请检查网络'},
      auth:{level:'待确认',detail:'实时验证未完成；未提交账号密码'}
    };
  }
  const status=Number(req.response?.statusCode);
  if(redirected){
    let destination;
    try{destination=resolveURL(TABLE,redirected);}
    catch(_){return {
      connection:{level:'注意',detail:'学校入口返回异常跳转，已阻止继续跟随'},
      auth:{level:'待确认',detail:'无法确认当前会话，未跟随未知跳转'}
    };}
    const url=safeURL(destination);
    const login=url.host==='authserver.nufe.edu.cn'||
      url.path==='/student/login'||url.path==='/student/sso/login';
    return {
      connection:{level:'正常',detail:'学校入口已响应跳转'},
      auth:login?{level:'注意',detail:'当前 Cookie 未通过登录检查；学校要求重新认证'}:
        {level:'待确认',detail:'学校入口发生站内跳转，未继续验证'}
    };
  }
  if(status===401||status===403)return {
    connection:{level:'正常',detail:'学校服务器已响应（HTTP '+status+'）'},
    auth:{level:'注意',detail:'当前会话未通过认证检查（HTTP '+status+'）'}
  };
  if(status>=500)return {
    connection:{level:'注意',detail:'学校服务器响应异常（HTTP '+status+'）'},
    auth:{level:'待确认',detail:'服务器异常，本次无法验证登录'}
  };
  if(!(status>=200&&status<300))return {
    connection:{level:'待确认',detail:'学校服务器返回 HTTP '+(Number.isFinite(status)?status:'未知')},
    auth:{level:'待确认',detail:'当前登录状态无法确认'}
  };
  if(typeof html!=='string'||html.length>2*1024*1024)return {
    connection:{level:'正常',detail:'学校服务器已响应'},
    auth:{level:'待确认',detail:'返回内容无法安全核对身份'}
  };
  try{
    pagePerson(html);
    return {
      connection:{level:'正常',detail:'学校课表入口可访问'},
      auth:{level:'正常',detail:'刚刚使用本机 Cookie 验证成功；未获取课程和考试或提交密码'}
    };
  }catch(_){
    const login=/<form\b[^>]*\bid=["']pwdFromId["']|name=["'](?:password|username)["']/i.test(html);
    return {
      connection:{level:'正常',detail:'学校服务器已响应'},
      auth:login?{level:'注意',detail:'学校返回登录页，当前 Cookie 需要重新认证'}:
        {level:'待确认',detail:'返回页面未包含可验证的课表身份信息'}
    };
  }
}
// On-demand checks re-read live host APIs and attempt one read-only session
// request. They never acquire a sync lock, save cookies, or modify calendars.
async function inspectEnvironment(state,store){
  const checks=[],put=(name,level,detail)=>checks.push({name,level,detail});
  try{const fresh=store.read();validateState(fresh);put('本地状态','正常','状态文件可读取、结构有效');}
  catch(_){put('本地状态','注意','状态文件无法安全读取，请保留数据');}

  try{
    const all=await bounded(visibleCalendars(),6500,'CALENDAR_TIMEOUT');
    if(!state.calendarId)put('目标日历','注意','未绑定课表日历');
    else{
      const found=all.find(c=>c&&c.identifier===state.calendarId);
      if(!found)put('目标日历','注意','原日历当前不可见；勿直接新建替换');
      else if(!liveCalendar(found))put('目标日历','注意','原日历不可写入');
      else put('目标日历','正常','绑定的日历可见且可编辑');
    }
  }catch(_){put('目标日历','待确认','无法读取日历列表；检查完全访问权限');}

  let jar=null;
  if(state.signedOut){
    jar=new CookieJar();
    put('Cookie 存储','正常','已退出登录；自检不读取或发送先前的学校会话 Cookie');
  }else try{
    jar=readCookieJar();
    put('Cookie 存储','正常','本次读取及格式检查通过');
  }catch(_){put('Cookie 存储','注意','本机 Cookie 异常，未清理；无法携带原会话验证');}
  const session=await probeSchoolSession(jar);
  put('学校连接',session.connection.level,session.connection.detail);
  if(state.signedOut)put('登录会话',state.lastError==='LOGOUT_INCOMPLETE'?'注意':'正常',state.lastError==='LOGOUT_INCOMPLETE'?'退出凭据清除未完成，但本次没有发送原会话 Cookie':'已退出，本次没有发送原会话 Cookie');
  else if(!jar)put('登录会话','注意','Cookie 存储异常，未使用原会话验证');
  else if(state.authPaused&&session.auth.level==='正常')
    put('登录会话','注意','当前会话验证通过，但此前登录暂停记录尚未解除；请手动刷新确认');
  else put('登录会话',session.auth.level,session.auth.detail);
  try{
    const status=credentialStorageStatus();
    if(/不可读取|异常/.test(status))put('自动登录凭据','注意','钥匙串暂不可读取或格式异常');
    else if(status==='未保存账号密码')put('自动登录凭据','待确认','未保存；仍可前台手动登录');
    else put('自动登录凭据','正常','本机凭据读取正常');
  }catch(_){put('自动登录凭据','待确认','无法检查本机钥匙串');}

  try{
    const lock=store.path('run-lock.json');
    if(store.fm.fileExists(lock)){
      let parsed=null;
      try{parsed=JSON.parse(store.fm.readString(lock));}catch(_){}
      if(!parsed||typeof parsed.token!=='string'||!Number.isFinite(parsed.at))
        put('同步任务','注意','运行锁异常；自检不会清理');
      else if(Date.now()-parsed.at>=20*60000)
        put('同步任务','注意','存在过期运行锁；不会自动清理');
      else put('同步任务','待确认','检测到有效运行锁，可能仍有任务执行');
    }else if(state.tx)put('同步任务','注意','存在未完成事务；下次刷新尝试安全恢复');
    else if(state.runStatus==='running')put('同步任务','注意','未发现运行锁，但上次运行未记录完成');
    else put('同步任务','正常','无运行锁或待恢复事务');
  }catch(_){put('同步任务','待确认','无法读取锁文件');}

  try{
    const names=[state.tx?.backupName,state.lastSyncBackupName,state.lastArchivedCourseJournal,state.lastLegacyBackupName,state.lastLegacyReportName].filter(Boolean);
    if(names.some(n=>typeof n!=='string'||!/^[^/\\]+$/.test(n)||!store.fm.fileExists(store.path(n))))
      put('本地备份','注意','有备份引用不可读取；请保留现有文件');
    else if(names.length)put('本地备份','正常','已记录的备份文件存在（未进行恢复测试）');
    else put('本地备份','待确认','没有记录中的备份引用，不代表数据丢失');
  }catch(_){put('本地备份','待确认','无法检查备份引用');}

  return checks;
}
function environmentCheckText(checks,state){
  const icon={正常:'✓',注意:'!',待确认:'?'};
  const issues=checks.filter(c=>c.level==='注意').length,unknown=checks.filter(c=>c.level==='待确认').length;
  const title=issues?'有 '+issues+' 项需要处理':unknown?'有 '+unknown+' 项暂无法确认':'已完成全部基础检查';
  const lines=checks.map(c=>icon[c.level]+' '+c.name+'：'+c.detail);
  if(state.runStatus==='failed'&&state.lastError){
    lines.push('上次失败：'+state.lastError+' — '+reasonFor(state.lastError));
    lines.push('建议：'+actionFor(state.lastError));
  }
  return title+'（? 表示尚无法确认）\n\n'+lines.join('\n')+
    '\n\n只读检查；不会删除课程和考试、清理 Cookie 或修改日历。';
}
async function showEnvironmentCheck(state,store){
  const checks=await inspectEnvironment(state,store);
  const code=state.runStatus==='failed'?state.lastError:null;
  const recovery=availableRecovery(code,state,store);
  const report=environmentCheckText(checks,state);
  // Routine results need a single acknowledgment, not a secondary log menu.
  if(!recovery){await notice('环境自检',report);return null;}
  const prompt=new Alert();prompt.title='环境自检';prompt.message=report;
  prompt.addAction(recovery.label);prompt.addCancelAction('关闭');
  return await prompt.presentAlert()===0?recovery.kind:null;
}
// Verified first teaching-week Mondays from the original project's semesters.json.
// Keep this allow-list local: no additional server, tracking, or third-party endpoint.
// A guessed school reporting/start date must NEVER silently shift all class events.
const VERIFIED_TERM_ANCHORS=Object.freeze({
  '2024-2025-1':'2024-09-02',
  '2024-2025-2':'2025-02-24',
  '2025-2026-1':'2025-09-01',
  '2025-2026-2':'2026-02-23',
  '2026-2027-1':'2026-09-07'
});
function normalizeTermName(name){return String(name||'').replace(/[－—–]/g,'-').replace(/\s+/g,'').trim();}
function explicitTeachingMonday(detail){
  if(!detail||typeof detail!=='object')return null;
  // Only auto-accept fields that explicitly describe teaching week 1.
  const keys=['firstTeachingWeekMonday','firstTeachingWeekStartDate','teachingWeek1Monday','firstWeekMonday','firstWeekStartDate','week1StartDate','teachingStartDate'];
  for(const k of keys){
    if(!Object.prototype.hasOwnProperty.call(detail,k))continue;
    const v=detail[k];if(typeof v!=='string')continue;
    const m=/^(\d{4}-\d{2}-\d{2})(?:T|$)/.exec(v);if(!m)continue;
    if(/Monday$/.test(k)){try{return monday(m[1]);}catch(_){continue;}}
    const d=detailMonday({startDate:m[1]});if(d)return monday(d);
  }
  return null;
}
async function chooseAnchor(sid,name,http,state,store) {
  if(state.anchors[sid])return monday(state.anchors[sid]);
  let anchor=VERIFIED_TERM_ANCHORS[normalizeTermName(name)],source='upstream-semesters.json';
  if(!anchor){
    const detail=await http.json(termEndpoint(SEMESTER_ENDPOINT,sid));
    anchor=explicitTeachingMonday(detail);
    source='school-teaching-week';
    // NUFE's semester API uses its start date as the schedule baseline.
    if(!anchor){
      anchor=detailMonday(detail);
      source='school-semester-start';
    }
  }
  assert(anchor,'ANCHOR');
  anchor=monday(anchor);
  if(state.anchors[sid]!==anchor||state.anchorSources?.[sid]!==source){
    state.anchors[sid]=anchor;
    state.anchorSources={...(state.anchorSources||{}),[sid]:source};
    store.write(state);
  }
  return anchor;
}

// New and changed events keep recovery markers until the native IDs are indexed.
async function polishTermNotes(calendar,state,store,sid,budget,{checked=null}={}){
  const term=state.semesters[String(sid)];
  if(!term)return;
  const adapter=checked?.adapter||new CalendarAdapter(calendar,state.owner,store,budget,state);
  const rows=checked?.rows||(await adapter.scan(term.anchor,term.events)).filter(x=>x.rec.sid===String(sid));
  const byId=new Map();
  for(const item of rows){
    const matches=byId.get(item.rec.id)||[];
    matches.push(item);byId.set(item.rec.id,matches);
  }
  state.lastStage='核对学期 '+sid+' 的课程备注';
  let modified=0;
  for(const rec of term.events){
    budget();
    const items=byId.get(rec.id)||[];
    assert(items.length===1&&sameCalendarCourse(items[0].rec,rec),'CALENDAR_VERIFY');
    const ev=items[0].ev,title=rec.title;
    const retiredPin=hasRetiredCalendarPin(ev);
    if(!ev.notes&&ev.title===title&&!retiredPin)continue;
    assert(isStandaloneEvent(ev)&&!ev.attendees?.length,'MANAGED_SERIES');
    const nativeId=ev.identifier;
    if(!modified)adapter.verifiedWindows.clear();
    ev.title=title;ev.notes='';
    if(retiredPin)restoreCalendarRoom(ev,rec.location);
    await ev.save();budget();modified++;
    if(ev.identifier!==nativeId){
      adapter.byNative.delete(nativeId);
      adapter.byNative.set(ev.identifier,rec);
      term.index[rec.id]=ev.identifier;
      store.write(state);
    }
  }
  // EventKit may acknowledge a write without actually persisting it.
  // Re-read after changes to verify the cleared notes and indexed event IDs.
  if(modified){
    const after=(await adapter.scan(term.anchor,term.events,{refreshWindows:!!checked}))
      .filter(x=>x.rec.sid===String(sid));
    const done=new Map();
    for(const item of after){
      const matches=done.get(item.rec.id)||[];
      matches.push(item);done.set(item.rec.id,matches);
    }
    for(const rec of term.events){
      budget();
      const matches=done.get(rec.id)||[];
      assert(matches.length===1&&sameCalendarCourse(matches[0].rec,rec)&&
        matches[0].ev.title===rec.title&&
        !matches[0].ev.notes,'CALENDAR_VERIFY');
    }
  }
  if(term.notesFormat!==3){term.notesFormat=3;store.write(state);}
}
function matchesOldCourse(ev,rec,state,prior){
  if(!ev||isExamEvent(ev,state)||ev.isAllDay||!ev.startDate||!ev.endDate)return false;
  if(+ev.startDate!==Date.parse(rec.start)||+ev.endDate!==Date.parse(rec.end))return false;
  const location=legacyText(ev.location);
  // An unchanged slot can still have a verified former room from the journal.
  if(location!==legacyText(rec.location)&&
     !(prior?.start===rec.start&&prior.end===rec.end&&location===legacyText(prior.location)))return false;
  const before=legacyText(ev.title),after=legacyText(rec.title);
  if(before===after||before===legacyText(legacyCalendarTitle(rec)))return true;
  return (rec.teachers||[]).some(name=>[' - ',' — ','-','－','—'].some(sep=>before===after+sep+legacyText(name)));
}
// Remove only verified duplicates of lessons already saved and backed up.
// The same bounded calendar is scanned again after removal.
async function removeMatchedOldCourses(calendar,state,store,sid,budget,{previous=[],progress=()=>{}}={}){
  const term=state.semesters[String(sid)];
  if(!term||term.legacyMatchedCleanAt||!term.events?.length)return;
  const low=Math.min(...term.events.map(e=>Date.parse(e.start)))-DAY;
  const high=Math.max(...term.events.map(e=>Date.parse(e.end)))+DAY;
  assert(Number.isFinite(low)&&Number.isFinite(high)&&high-low<=366*DAY,'SCAN_RANGE');
  const rows=new Map();
  for(let at=low;at<high;at+=45*DAY){
    budget();progress('核对旧课程和考试：'+localDateTime(new Date(at).toISOString()).slice(0,10));
    for(const ev of await calendarRows(at,Math.min(at+45*DAY,high),calendar))rows.set(occurrenceKey(ev),ev);
  }
  const managed=storedEventIndex(state);
  const byStart=groupBy(term.events,rec=>Date.parse(rec.start));
  const priorById=new Map(previous.map(rec=>[rec.id,rec]));
  const duplicate=ev=>{
    if(ev.calendar?.identifier!==state.calendarId||managed.has(ev.identifier)||
       String(ev.notes||'').startsWith('[NUFE_LOCAL_V1 ')||ev.attendees?.length)return null;
    return byStart.get(+ev.startDate)?.find(rec=>matchesOldCourse(ev,rec,state,priorById.get(rec.id)));
  };
  const candidates=[...rows.values()].filter(duplicate);
  if(!candidates.length){term.legacyMatchedCleanAt=new Date().toISOString();store.write(state);return;}
  const stamp=new Date().toISOString(),base='重复旧课程清理前-'+stamp.replace(/[:.]/g,'-');
  writeVerified(store,base+'.ics',backupLegacyICS(candidates));
  writeVerified(store,base+'.json',JSON.stringify({calendarId:calendar.identifier,sid:String(sid),at:stamp,
    limitation:'Recurring series deletion may affect occurrences beyond the scanned range.',events:candidates.map(snapshotFields)},null,2));
  state.lastLegacyBackupName=base+'.ics';state.lastLegacyReportName=base+'.json';store.write(state);
  let count=0;
  for(const original of candidates){
    budget();
    const rowsNow=await calendarRows(+original.startDate-1000,+original.endDate+1000,calendar);
    const old=rowsNow.find(x=>occurrenceKey(x)===occurrenceKey(original));
    if(!old)continue;
    assert(snapshotSignature(old)===snapshotSignature(original),'LEGACY_CHANGED');
    const lesson=duplicate(old);
    assert(lesson,'LEGACY_CHANGED');
    const keeper=rowsNow.find(x=>x.identifier===term.index[lesson.id]&&+x.startDate===Date.parse(lesson.start));
    assert(keeper&&eventRecord(keeper,state.owner,managed),'CALENDAR_VERIFY');
    await old.remove();count++;
    progress('移除重复旧课程和考试：'+count+' / '+candidates.length);
  }
  const leftovers=new Map();
  for(let at=low;at<high;at+=45*DAY){
    budget();for(const ev of await calendarRows(at,Math.min(at+45*DAY,high),calendar))leftovers.set(occurrenceKey(ev),ev);
  }
  assert(![...leftovers.values()].some(duplicate),'LEGACY_VERIFY');
  term.legacyMatchedCleanAt=new Date().toISOString();
  state.lastLegacyCleanupCount=(state.lastLegacyCleanupCount||0)+count;
  store.write(state);
}
async function finishTx(state,store,adapter,budget) {
  const tx=state.tx;
  assert(tx.calendarId==null||tx.calendarId===adapter.calendar.identifier,'BACKUP_FAILED');
  if(!tx.backupName){
    const live=await adapter.scan(tx.anchor,[...tx.before,...tx.target]);
    const name='同步前快照-'+tx.id+'.json';
    writeVerified(store,name,JSON.stringify({version:1,calendarId:adapter.calendar.identifier,before:tx.before,target:tx.target,visible:live.map(x=>({record:x.rec,notes:x.ev.notes||''})),stamp:tx.stamp},null,2));
    tx.backupName=name;state.lastSyncBackupName=name;store.write(state);
  }
  assert(store.fm.fileExists(store.path(tx.backupName)),'BACKUP_FAILED');
  let backup;try{backup=JSON.parse(store.fm.readString(store.path(tx.backupName)));}catch(_){fail('BACKUP_FAILED');}
  assert(backup.calendarId===adapter.calendar.identifier&&JSON.stringify(backup.before)===JSON.stringify(tx.before)&&JSON.stringify(backup.target)===JSON.stringify(tx.target),'BACKUP_FAILED');
  adapter.hasMarkerWrites=false;
  state.lastStage='核验并更新学期 '+tx.sid+' 的日历事件';
  const index=await applyTransaction(tx,adapter,budget);
  const oldTerm=state.semesters[tx.sid];
  const sourceChanges=tx.changes.added+tx.changes.removed+tx.changes.changed;
  state.semesters[tx.sid]={events:tx.target,index,anchor:tx.anchor,name:tx.name,lastSuccess:new Date().toISOString(),skipped:tx.skipped,
    notesFormat:(sourceChanges||adapter.hasMarkerWrites)?1:(oldTerm?.notesFormat||1),
    legacyMatchedCleanAt:sourceChanges?null:(oldTerm?.legacyMatchedCleanAt||null)};
  state.tx=null;store.write(state);
  await polishTermNotes(adapter.calendar,state,store,tx.sid,budget);
  await removeMatchedOldCourses(adapter.calendar,state,store,tx.sid,budget,{previous:tx.before});
}
function selectTermIds(info,state,interactive){
  const available=[...new Set(info.semesters.map(s=>s.id))];
  assert(available.includes(info.current),'SCHEMA');
  if(interactive)return [info.current,...available.filter(sid=>sid!==info.current).sort((a,b)=>a-b)];
  const otherTerms=available.filter(sid=>sid!==info.current).sort((a,b)=>b-a);
  const next=otherTerms.indexOf(state.lastBackgroundHistoryTerm)+1;
  const retry=(state.retryTermIds||[]).map(Number).find(sid=>otherTerms.includes(sid));
  const rotation=otherTerms.slice(next).concat(otherTerms.slice(0,next)).filter(sid=>sid!==retry);
  return [info.current,...(retry===undefined?[]:[retry]),...rotation].slice(0,3);
}
async function verifyUnchangedTerm(adapter,sid,anchor,events){
  const expected=new Map(events.map(event=>[event.id,event]));
  const index=Object.create(null);
  const rows=(await adapter.scan(anchor,events,{reuseWindows:true})).filter(row=>row.rec.sid===String(sid));
  for(const {ev,rec} of rows){
    const target=expected.get(rec.id);
    if(!target||!sameCalendarCourse(rec,target)||ev.title!==target.title||adapter.byNative.get(ev.identifier)?.id!==rec.id||
       !isStandaloneEvent(ev)||ev.attendees?.length)
      return null;
    expected.delete(rec.id);
    index[rec.id]=ev.identifier;
  }
  return expected.size?null:{index,rows};
}
function stopsBothSyncs(code){
  return ['ACCOUNT_CHANGED','CALENDAR_PERMISSION','CALENDAR_READONLY','LOCK_LOST','SYNC_SUPERSEDED',
    'BUSY','CANCELLED','STATE_CORRUPT','STATE_WRITE','DOMAIN_BLOCKED'].includes(code);
}
async function syncCourses(info,http,state,store,calendar,interactive,stage,budget,setDeadline){
  state.availableSemesters=info.semesters;
  if(state.tx?.calendarId&&state.tx.calendarId!==calendar.identifier){
    const name='课程事务-'+uuid()+'.json';
    writeVerified(store,name,JSON.stringify(state.tx,null,2));
    state.lastArchivedCourseJournal=name;
    state.tx=null;
    store.write(state);
  }
  // Rebase a journal for this calendar on a fresh school response before writing.
  const interrupted=state.tx;
  const adapter=new CalendarAdapter(calendar,state.owner,store,budget,state);
  delete state.historySyncCheckpoint;
  state.retryTermIds=(Array.isArray(state.retryTermIds)?state.retryTermIds:[]).map(Number).filter(sid=>info.semesters.some(term=>term.id===sid)&&sid!==info.current);
  const retrySid=!interactive?state.retryTermIds[0]:undefined;
  const selected=selectTermIds(info,state,interactive);
  const pendingSid=Number(interrupted?.sid);
  let sids=selected;
  if(interrupted){
    const sid=Number(interrupted.sid);
    assert(info.semesters.some(t=>t.id===sid),'TX_TERM_UNAVAILABLE');
    // Recover the pending write before opening another calendar transaction.
    if(sid!==info.current){
      sids=[sid,...selected.filter(id=>id!==sid)];
      if(!interactive)sids=sids.slice(0,3);
    }
  }
  let coursesChecked=0;
  let rotationDeadline=null;
  for(const sid of sids) {
    const rotating=!interactive&&sid!==info.current&&sid!==pendingSid;
    // Optional terms get a short window with a fixed reserve for exams.
    // No exam request may use the course window or the shared request gate.
    if(rotating&&rotationDeadline===null){
      rotationDeadline=Math.min(http.deadline,Date.now()+BACKGROUND_ROTATION_MS);
      setDeadline(rotationDeadline);
    }
    if(rotating&&http.deadline-Date.now()<1500)break;
    try {
      budget();stage('读取学期 '+sid);const name=(info.semesters.find(s=>s.id===sid)||{}).name||String(sid);
      if(rotating&&sid!==retrySid)state.lastBackgroundHistoryTerm=sid;
      state.retryTermIds=state.retryTermIds.filter(id=>id!==sid);
      stage('请求学期 '+sid+' 课表数据');
      const raw=await http.json(termEndpoint(COURSE_DATA_ENDPOINT,sid)+'?'+form({semesterId:sid,hasExperiment:'true'}));
      const anchor=await chooseAnchor(sid,name,http,state,store);
      const normalized=expand(raw,sid,anchor);
      if(normalized.studentCode){const studentKey=schoolKey('CourseSync.Local.v1.student');if(Keychain.contains(studentKey))assert(Keychain.get(studentKey)===normalized.studentCode,'ACCOUNT_CHANGED');else Keychain.set(studentKey,normalized.studentCode);}
      let old=state.semesters[sid];
      if(interrupted&&interrupted.sid===String(sid)){const recovered=new Map([...interrupted.before,...interrupted.target].map(e=>[e.id,e]));old={...(old||{}),events:[...recovered.values()]};}
      // Recover local logical IDs from managed event notes when term index is absent.
      if(!old){const recovered=(await adapter.scan(anchor,normalized.events)).filter(x=>x.rec.sid===String(sid)).map(x=>x.rec);const by=new Map();for(const e of recovered)by.set(e.id,e);old={events:[...by.values()]};}
      assert(normalized.events.length||!old.events.length,'EMPTY_SOURCE');
      const p=plan(old.events,normalized.events,uuid);
      // A missing, duplicate or edited event still goes through the repair transaction.
      if(!state.tx&&old.notesFormat===3&&(old.legacyMatchedCleanAt||!old.events.length)&&
         old.anchor===anchor&&!p.added.length&&!p.removed.length&&!p.changed.length){
        stage('核验学期 '+sid+' 的日历事件');
        const checked=await verifyUnchangedTerm(adapter,sid,anchor,p.events);
        if(checked){
          state.semesters[sid]={...old,events:p.events,index:checked.index,name,skipped:normalized.skipped,lastSuccess:new Date().toISOString()};
          if(checked.rows.some(({ev})=>ev.notes||hasRetiredCalendarPin(ev)))
            await polishTermNotes(calendar,state,store,sid,budget,{checked:{adapter,rows:checked.rows}});
          coursesChecked++;
          continue;
        }
      }
      // Ambiguous moved lessons are represented as remove+add; no relationship is invented.
      // Persist the complete target BEFORE touching EventKit. Future resume uses these IDs.
      stage('写入学期 '+sid+' 的日历事件');
      state.tx={id:uuid(),calendarId:calendar.identifier,sid:String(sid),anchor,name,before:old.events,target:p.events,stamp:new Date().toISOString(),skipped:normalized.skipped,changes:{added:p.added.length,removed:p.removed.length,changed:p.changed.length}};
      store.write(state);await finishTx(state,store,adapter,budget);
      coursesChecked++;
    }catch(error){
      const code=diagnosticCode(error);
      if(stopsBothSyncs(code))throw error;
      if(rotating&&code==='BUDGET'){
        if(state.tx)state.termErrors.push({sid:String(sid),code});
        break;
      }
      if(rotating&&!state.retryTermIds.includes(sid))state.retryTermIds.push(sid);
      state.termErrors.push({sid:String(sid),code});
      if(state.tx||code==='BUDGET')break;
    }
  }
  return coursesChecked;
}
async function synchronize(state,store,calendar,interactive,progress=null,manualAuth=null) {
  // Reserve time for releasing the lock and returning the Shortcuts result.
  const deadline=interactive?Date.now()+15*60000:
    backgroundDeadline===Infinity?Date.now()+20000:backgroundDeadline;
  let workDeadline=deadline;
  const budget=()=>{store.check();if(Date.now()>=workDeadline)fail('BUDGET');};
  if(Object.hasOwn(state,'nufeBuildingPoints')){delete state.nufeBuildingPoints;store.write(state);}
  delete state.notice;
  // Explicit sign-out ignores any stale cookie, including partial Keychain failures.
  const jar=state.signedOut||manualAuth?.kind==='credentials'?new CookieJar():readCookieJar();
  const stage=progress||createProgress(state,store,interactive);
  const session=schoolSession(jar,budget,stage,interactive?Infinity:deadline);
  const page=await coursePage(session.http,interactive,stage,manualAuth);
  verifyBoundPerson(pagePerson(page),true);
  session.commitCookies();
  // Only a verified school session ends the signed-out state.
  if(state.signedOut){state.signedOut=false;state.authPaused=false;state.authExpiryNotifiedAt=null;state.lastError=null;store.write(state);}
  if(typeof calendar==='function'){
    stage('登录验证完成');
    calendar=await calendar();
  }
  assert(calendar?.identifier===state.calendarId&&liveCalendar(calendar),'CALENDAR_READONLY');

  // Both jobs start from the verified session. Each keeps its own response
  // cookies, and the request pacing follows the last request to the school.
  const courseHTTP=session.http.withPrivateCookies();
  const examHTTP=session.http.withPrivateCookies(deadline);
  const previousReadDeadline=calendarReadDeadline;
  const setCourseDeadline=limit=>{workDeadline=courseHTTP.deadline=calendarReadDeadline=limit;};
  let coursesChecked=0;
  state.termErrors=[];
  state.lastCourseError=null;
  state.lastExamError=null;
  try{
    setCourseDeadline(deadline-(interactive?FOREGROUND_EXAM_RESERVE_MS:BACKGROUND_EXAM_RESERVE_MS));
    try{
      budget();
      const info=pageInfo(page);
      coursesChecked=await syncCourses(info,courseHTTP,state,store,calendar,interactive,stage,budget,setCourseDeadline);
    }catch(error){
      const code=diagnosticCode(error);
      if(stopsBothSyncs(code))throw error;
      state.lastCourseError=code;
    }

    workDeadline=calendarReadDeadline=deadline;
    examHTTP.last=courseHTTP.last;
    try{
      budget();
      await syncExams(examHTTP,state,store,calendar,stage,Date.now(),budget);
    }catch(error){
      const code=diagnosticCode(error);
      if(['SYNC_SUPERSEDED','LOCK_LOST','BUSY','CANCELLED','STATE_CORRUPT','STATE_WRITE'].includes(code))throw error;
      state.lastExamError=code;
    }
  }finally{
    calendarReadDeadline=previousReadDeadline;
  }

  const courseErrors=state.lastCourseError||state.termErrors.length;
  state.syncResults={
    courses:courseErrors?(coursesChecked?'partial':'failed'):'success',
    exams:state.lastExamError?'failed':'success'
  };
  state.reviewPending=false;
  state.authPaused=false;state.authExpiryNotifiedAt=null;state.authNoticeError=null;
}
// GET-only login-page preflight: does not ask for a password or modify the calendar.
async function loginPreflight(state,store,progress){
  progress('登录自检：访问学校认证入口');
  const jar=readCookieJar();
  const http=new HTTP(jar,c=>Keychain.set(schoolKey(KEY),JSON.stringify(c)),()=>store.check(),progress);
  const r=await http.get(SSO);
  if(safeURL(r.url).host==='jwxt.nufe.edu.cn'){
    progress('登录自检：核对教务页面');
    authenticatedPerson(r);
    return '当前会话可直接访问课表，学校登录跳转和课表页面正常。';
  }
  progress('登录自检：检查表单字段');
  const f=await fieldsFrom(r.text,'pwdFromId');
  if(!f)fail('LOGIN_SCHEMA');
  if(!f.salt)fail('LOGIN_SALT_MISSING');
  if(!f.execution)fail('LOGIN_EXECUTION_MISSING');
  return '认证入口可访问，密码加密盐和认证字段均已找到。此检查未提交账号密码，也未写入课程和考试。';
}
// Credentials are automatically stored only after the school verifies login.
// Logging out deletes local session cookies and Scripting's saved credentials,
// without touching the iOS Passwords website entry or Apple Calendar.
async function signOut(state,store){
  // Saved credentials and the local authenticated session are separate.
  if(!await confirm('退出登录',
    '清除本机的教务会话和已保存的登录凭据（包括 iCloud 钥匙串）。日历事件会保留。'))return false;

  // Persist a fail-closed marker before touching the Keychain, so scheduled
  // refreshes cannot silently sign back in even if deletion partially fails.
  state.signedOut=true;state.authPaused=true;state.authExpiryNotifiedAt=null;
  delete state.historySyncCheckpoint;
  delete state.lastBackgroundHistoryTerm;
  delete state.retryTermIds;
  state.failures=0;state.lastError=null;
  state.runStatus='signed_out';state.credentialCloudStatus=null;
  store.write(state);
  try{
    Keychain.set(SCHOOL_RESELECT_KEY,activeSchoolId);
    if(Keychain.contains(schoolKey(KEY)))Keychain.remove(schoolKey(KEY));
    if(Keychain.contains(SCHOOL_CHOICE_KEY))Keychain.remove(SCHOOL_CHOICE_KEY);
    if(Keychain.contains(SCHOOL_KEY))Keychain.remove(SCHOOL_KEY);
    if(Keychain.contains('NUFE.Local.v1.cookies'))
      Keychain.remove('NUFE.Local.v1.cookies');
    removeSavedCredentials();
    if(Keychain.contains(schoolKey(KEY))||hasSavedCredentials()||
      Keychain.contains('NUFE.Local.v1.cookies')||CloudKeychain.contains(LEGACY_CLOUD_CRED_KEY))
      fail('CREDENTIALS_UNAVAILABLE');
  }catch(_){
    // Stay signed out and offer retry rather than declaring a false success.
    fail('LOGOUT_INCOMPLETE');
  }
  try{await notice('已退出登录','');}catch(_){}
  return true;
}
async function refreshFailure(code,state){
  const n=new Notification();n.identifier='nufe-local-refresh-result';n.title=code==='PARTIAL_SYNC'?'CourseSync · 部分完成':'CourseSync · 刷新失败';
  n.body=code==='PARTIAL_SYNC'||code==='SYNC_FAILED'
    ?syncResultDetails(state)||'部分同步未完成。'
    :('原因：'+reasonFor(code||'LOCAL_ERROR'));
  if(code==='BUDGET'&&state?.lastStage)n.body+='\n最后阶段：'+state.lastStage;
  n.sound=null;n.openURL=HostScript.createRunURLScheme(HostScript.name,{mode:'menu'});await n.schedule();
}
function examFailureText(code){
  return '考试日程未更新完成（'+code+'）。'+reasonFor(code);
}
function syncResultDetails(state){
  const errors=state?.termErrors||[];
  const lines=[];
  if(state?.syncResults){
    const labels={success:'已核验',partial:'部分完成',failed:'未完成'};
    lines.push('课程'+labels[state.syncResults.courses]+' · 考试'+labels[state.syncResults.exams]);
  }
  if(state?.lastCourseError)lines.push('课程（'+state.lastCourseError+'）：'+reasonFor(state.lastCourseError));
  lines.push(...errors.slice(0,2).map(({sid,code})=>{
    const term=state.availableSemesters?.find(item=>String(item.id)===sid);
    return (term?.name||'学期 '+sid)+'（'+code+'）：'+reasonFor(code);
  }));
  if(errors.length>2)lines.push('另有 '+(errors.length-2)+' 个学期未完成。');
  if(state?.lastExamError)lines.push(examFailureText(state.lastExamError));
  return lines.join('\n');
}
// Notification delivery is separate from the verified calendar result.
async function reportRefreshFailure(code,state,store){
  try{await refreshFailure(code,state);if(state)state.resultNoticeError=null;}
  catch(_){if(state)state.resultNoticeError='NOTIFICATION_FAILED';}
  // Do not turn an optional delivery/status-write failure into a sync failure.
  if(state&&store&&store.token){try{store.write(state);}catch(_){}}
}
// Authentication problems require one actionable notification, not a generic
// failure alert every day.
async function reportBackgroundFailure(code,state,store){
  try{
    if(state&&state.authPaused)await notifyAuthExpiredOnce(state,store);
    else await reportRefreshFailure(code,state,store);
  }catch(_){
    if(state&&store&&store.token){
      state.authNoticeError='NOTIFICATION_FAILED';
      try{store.write(state);}catch(__){}
    }
  }
}
// Foreground: offer a choice only when a competing task is detected.
// A scheduled run skips a held lock so it can exit within the Intent window.
async function acquireSyncSlot(store,interactive,{foregroundWait=120000,backgroundWait=0,poll=750}={}){
  try{store.acquire();return 'acquired';}catch(e){if(e.code!=='BUSY')throw e;}
  if(interactive){
    const choice=new Alert();choice.title='已有同步任务';
    choice.message='前一次同步仍持有任务锁。可等待完成，或请求前次任务安全退出；如果 iOS 已结束前次进程，程序只会在确认长期没有活动后接管。不会强制终止正在写入的日历操作。';
    choice.addAction('等待完成');
    choice.addDestructiveAction('取消前次任务并刷新');
    choice.addCancelAction('暂不刷新');
    const selected=await choice.presentSheet();
    if(selected<0)return 'dismissed';
    if(selected===1){
      const requested=store.requestCancelActive();
      if(!requested){
        try{store.acquire();return 'acquired';}catch(e){if(e.code!=='BUSY')throw e;}
      }
    }
  }
  const deadline=Date.now()+(interactive?foregroundWait:backgroundWait);
  while(Date.now()<deadline){
    if(interactive){
      // A stopped iOS run cannot acknowledge the cancel request. Only after
      // sufficient inactivity, and only for a matching explicit user request,
      // transfer ownership; the old token is invalidated before new work.
      if(store.recoverStalledCancellation()){
        try{store.acquire();return 'acquired';}catch(e){if(e.code!=='BUSY')throw e;}
      }
    }
    await new Promise(resolve=>Timer.schedule(poll,false,resolve));
    try{store.acquire();return 'acquired';}catch(e){if(e.code!=='BUSY')throw e;}
  }
  if(interactive&&store.recoverStalledCancellation()){
    try{store.acquire();return 'acquired';}catch(e){if(e.code!=='BUSY')throw e;}
  }
  return 'still-running';
}
function canOfferSignOut(state){
  if(state.lastError==='LOGOUT_INCOMPLETE')return true;
  // No separate logout entry until a session or script credentials exist.
  // After interrupted cleanup (or iCloud sync reappearance), keep retryable.
  try{return Keychain.contains(schoolKey(KEY))||hasSavedCredentials();}
  catch(_){return !state.signedOut;}
}
function offlineAgenda(state,now=Date.now()) {
  const today=localDateTime(new Date(now).toISOString()).slice(0,10);
  const rows=Object.values(state.semesters||{}).flatMap(s=>s.events||[])
    .filter(e=>Number.isFinite(Date.parse(e.start))&&Date.parse(e.end)>now)
    .sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
  const seen=new Set(),lines=[];
  for(const e of rows){
    const key=JSON.stringify([e.title,e.start,e.end,e.location]);
    if(seen.has(key))continue;seen.add(key);
    const date=localDateTime(e.start);
    lines.push((date.startsWith(today)?'今天'+date.slice(10):date)+'–'+localDateTime(e.end).slice(11)+' '+e.title+(e.location?' · '+e.location:''));
    if(lines.length===20)break;
  }
  return (state.lastCheck?'上次同步：'+localDateTime(state.lastCheck)+'\n\n':'')+
    (lines.length?lines.join('\n\n'):'本地暂无尚未结束的课程和考试，请刷新后查看。')+'\n\n显示最近20节课程和考试。';
}
const NUFE_FREE_ROOM_ENDPOINT='https://jwxt.nufe.edu.cn/student/ws/room-borrow/free-list';
const BUILDING_PRIORITY=Object.freeze({'德经楼':1,'德济楼':2,'德正楼':3,'德业楼':4,'博远楼':5});
const ROOM_CODE_PREFIX=Object.freeze({'博远楼':'JC','德经楼':'Z1-','德济楼':'Z2-','德正楼':'Z3-','德业楼':'Z4-'});
const FIRST_FLOOR_BUILDINGS=new Set(['德经楼','德济楼','德正楼','德业楼']);
function parseFreeRoom(room){
  if(!room||typeof room!=='object')return null;
  const building=room.building?.nameZh||room.buildingName;
  const prefix=ROOM_CODE_PREFIX[building];
  if(typeof prefix!=='string')return null;
  const firstOnly=FIRST_FLOOR_BUILDINGS.has(building);
  if(firstOnly&&Number(room.floor)!==1)return null;
  const name=String(room.nameZh||room.name||'').trim();
  if(name.includes('微'))return null;
  const code=(name.startsWith(building)?name.slice(building.length):name).trim();
  if(!code.startsWith(prefix))return null;
  const number=code.slice(prefix.length);
  if(!(firstOnly?/^1\d{2}$/:/^[1-9]\d{2}$/).test(number))return null;
  return {building,floor:Number(number[0]),code,id:room.id==null?null:String(room.id)};
}

function compareFreeRooms(a,b){
  return BUILDING_PRIORITY[a.building]-BUILDING_PRIORITY[b.building]
    ||a.floor-b.floor||a.code.localeCompare(b.code);
}

function groupFreeRooms(rooms){
  const ids=new Set(),codes=new Set();
  const buildings=[];
  for(const {building,floor,code,id} of rooms){
    // Room codes already include their building prefix.
    if(codes.has(code)||(id!==null&&ids.has(id)))continue;
    codes.add(code);
    if(id!==null)ids.add(id);

    let buildingGroup=buildings.at(-1);
    if(buildingGroup?.name!==building){
      buildingGroup={name:building,floors:[]};
      buildings.push(buildingGroup);
    }
    let floorGroup=buildingGroup.floors.at(-1);
    if(floorGroup?.floor!==floor){
      floorGroup={floor,roomCodes:[]};
      buildingGroup.floors.push(floorGroup);
    }
    floorGroup.roomCodes.push(code);
  }
  return buildings;
}

async function queryFreeRoomsForPeriod(http,date,units){
  const payload={
    campusId:2,buildingId:'',roomId:'',roomType:undefined,seatsForLessonGte:'',
    dateTimeSegmentCmd:{startDateTime:date,endDateTime:date,units:units}
  };
  const data=await http.json(NUFE_FREE_ROOM_ENDPOINT,{body:JSON.stringify(payload),json:true});
  assert(Array.isArray(data?.roomList),'SCHEMA');
  const rooms=data.roomList.map(parseFreeRoom).filter(Boolean).sort(compareFreeRooms);
  return groupFreeRooms(rooms);
}

const FREE_ROOM_PERIODS=[
  {period:'上午',units:['1','2','3','4','5']},
  {period:'下午',units:['6','7','8','9']},
  {period:'第10节',units:['10']},
  {period:'晚上',units:['11','12','13']}
];

function normalizeRoomPeriods(periods){
  if(!Array.isArray(periods)||!periods.length)return FREE_ROOM_PERIODS;
  const normalized=periods.map(item=>{
    const units=[...new Set((Array.isArray(item?.units)?item.units:[])
      .map(String).filter(u=>/^(?:[1-9]|1[0-3])$/.test(u)))];
    units.sort((a,b)=>Number(a)-Number(b));
    if(!units.length)return null;
    const period=String(item?.period||'').trim()||units.join(',');
    return {period,units};
  }).filter(Boolean);
  assert(normalized.length,'SCHEMA');
  return normalized;
}

async function queryDayRooms(http,date,onProgress=()=>{},periods=FREE_ROOM_PERIODS){
  const target=normalizeRoomPeriods(periods);
  const results=await Promise.allSettled(target.map(async ({period,units})=>{
    const buildings=await queryFreeRoomsForPeriod(http,date,units);
    return {period,units,buildings};
  }));
  const failure=results.find(result=>result.status==='rejected');
  if(failure)throw failure.reason;
  onProgress(1);
  return results.map(result=>result.value);
}

async function queryFreeRooms(http,onStage=()=>{},onProgress=()=>{},now,onAuthenticated=()=>{},periods=FREE_ROOM_PERIODS,requestedDate){
  if(requestedDate!==undefined){
    assert(typeof requestedDate==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(requestedDate),'ROOM_DATE');
    const parsed=new Date(requestedDate+'T00:00:00Z');
    assert(Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===requestedDate,'ROOM_DATE');
  }
  await coursePage(http,true,onStage);
  const roomHTTP=onAuthenticated()??http;
  onProgress(0.25);
  const date=requestedDate??localDateTime(new Date(now??Date.now()).toISOString()).slice(0,10);
  return {date,rooms:await queryDayRooms(roomHTTP,date,onProgress,periods)};
}

async function loadFreeRoomPage(isActive,onProgress,periods,requestedDate){
  const checkActive=()=>{if(!isActive())fail('CANCELLED');};
  try{
    checkActive();
    const session=schoolSession(readCookieJar(),checkActive);
    const results=await queryFreeRooms(session.http,checkActive,onProgress,undefined,()=>{
      session.commitCookies();
      return session.http.withPrivateCookies();
    },periods,requestedDate);
    return {kind:'ready',...results};
  }catch(error){
    const code=diagnosticCode(error);
    if(code==='CANCELLED')return {kind:'error',message:'查询已取消'};
    if(code==='ROOM_DATE')return {kind:'error',message:'查询日期无效，请重新选择。'};
    if(code==='ACCOUNT_CHANGED')
      return {kind:'error',message:'教务账号与课表绑定账号不一致。请退出后用原账号登录。'};
    if(['AUTH_REQUIRED','AUTH_INTERACTIVE_REQUIRED','LOGIN_FAILED','AUTO_LOGIN_REJECTED'].includes(code))
      return {kind:'error',message:'请在首页点「立即刷新」，完成教务验证。'};
    return {kind:'error',message:reasonFor(code)+'\n错误代码：'+code};
  }
}

async function run() {
  // Reopen the dashboard after an attempt has released its lock.
  while(await runAttempt()){}
  Script.complete();
}
async function runAttempt() {
  __COURSESYNC_BOOT_PHASE='初始化本地存储';
  migrateLegacyKeychainData();
  const configuredSchool=loadSelectedSchool();
  const savedReselectSchool=Keychain.contains(SCHOOL_RESELECT_KEY)?Keychain.get(SCHOOL_RESELECT_KEY):null;
  const reselectSchool=savedReselectSchool||(configuredSchool!==NUFE_SCHOOL.id?configuredSchool:null);
  activateSelectedSchool(NUFE_SCHOOL.id);
  let store=new Store();
  const parameter=String(args.shortcutParameter||'').trim();
  const scheduled=/^sync(?:$|\s)/.test(parameter),interactive=config.runsInApp&&!scheduled;
  let state,locked=false,progress=null,signOutRequested=false,manualAuth=null,calendarCancelled=false;
  let returnToDashboard=false;
  try {
    if(!interactive&&reselectSchool){
      if(config.runsWithSiri)Script.setShortcutOutput('请打开 CourseSync 登录南京财经大学账号。');
      return;
    }
    if(interactive){
      state=store.read();
      // A failure before synchronization must not reuse an earlier run's stage.
      state.lastStage='准备主菜单';
    }
    // Verified credentials give access to account and room actions even if
    // calendar setup failed. Ordinary first launch and completed logout log in first.
    const canSignOut=interactive&&canOfferSignOut(state);
    if(interactive&&(state.calendarId||state.calendarBindingPending||canSignOut)&&
       (!(reselectSchool||state.signedOut)||state.signedOut&&canSignOut)){
      const canFreeRooms=activeSchoolId==='nufe'&&!state.signedOut&&canSignOut;
      const statusMessage=state.lastError==='LOGOUT_INCOMPLETE'
        ?'退出登录未完成，请重试。'
        :state.signedOut
          ?'点击「立即刷新」重新登录。'
          :state.syncResults&&['partial','failed'].includes(state.runStatus)
            ?syncResultDetails(state)+(state.tx?'\n课程写入待恢复，请点「立即刷新」。':'')
          :state.tx
            ?'日历写入待恢复，请点「立即刷新」。'
          :state.runStatus==='failed'&&state.lastError
            ?reasonFor(state.lastError)
          :state.runStatus==='partial'
            ?syncResultDetails(state)
            :'';

      let selected=-1;
      const nav=hostAPI('Navigation');
      if(typeof nav?.present==='function'){
        state.lastStage='打开主菜单';
        selected=await presentNativeDashboard({
          state,canSignOut,statusMessage,
          loadFreeRooms:canFreeRooms?loadFreeRoomPage:undefined
        });
        returnToDashboard=selected===0;
      }
      if(selected==='dismiss')return;
      if(selected<0){
        const menu=new Alert();menu.title='CourseSync';
        const lastTime=Number.isFinite(Date.parse(state.lastCheck))?'上次刷新：'+localDateTime(state.lastCheck):'';
        menu.message=[!state.calendarId||state.calendarBindingPending?'未绑定日历':'',lastTime,statusMessage].filter(Boolean).join('\n');
        menu.addAction('立即刷新');
        if(canSignOut)menu.addDestructiveAction('退出登录');
        menu.addCancelAction('关闭');
        selected=await menu.presentSheet();
      }
      if(selected===null||selected===undefined||selected<0)return;
      signOutRequested=canSignOut&&selected===1;
    }
    if(state)state.lastStage='准备获取同步锁';
    const slot=await acquireSyncSlot(store,interactive);
    if(slot!=='acquired'){
      // Never record a second task as a failed synchronization.
      // The original task remains responsible for the calendar and state.
      if(interactive&&slot==='still-running')
        await notice('前次任务未退出','前次任务仍占用同步锁，请稍后再试。');
      if(!interactive&&config.runsWithSiri)
        Script.setShortcutOutput('前一任务仍在同步，本次未重复执行。');
      return returnToDashboard;
    }
    locked=true;state=store.read();
    state.lastStage='准备同步';
    if(!state.owner){state.owner=uuid();store.write(state);}
    // Attempt one safe password migration per invocation. Failures never block
    // existing local credentials or trigger repeated school login attempts.
    if(!state.signedOut&&Keychain.contains(schoolKey(CRED_KEY))){
      const previousStatus=state.credentialCloudStatus;
      try{
        const migrated=migrateSavedCredentials();
        state.credentialCloudStatus=migrated==='conflict'?'conflict':'synced';
      }catch(_){state.credentialCloudStatus='unavailable';}
      if(state.credentialCloudStatus!==previousStatus)store.write(state);
    }
    await clearLegacyReminders(state,store);
    if(signOutRequested)return !await signOut(state,store);
    if(interactive){
      if(reselectSchool&&!savedReselectSchool)Keychain.set(SCHOOL_RESELECT_KEY,reselectSchool);
      const hasCredentials=!state.signedOut&&(hasSavedCredentials()||Keychain.contains(schoolKey(KEY)));
      const selectedSchool=state.signedOut||reselectSchool?null:loadSelectedSchool(null,true);
      if(!selectedSchool){
        const previousSchool=activeSchoolId;
        manualAuth=await prepareManualRefresh(state,!!reselectSchool);
        if(!manualAuth)return returnToDashboard;
        if(previousSchool!==activeSchoolId){
          store.release();locked=false;state=null;
          store=new Store();
          if(await acquireSyncSlot(store,interactive)!=='acquired')fail('BUSY');
          locked=true;state=store.read();
          if(!state.owner){state.owner=uuid();store.write(state);}
        }
      }else if(!hasCredentials){
        try{
          const credentials=await credentialForm({title:schoolById(selectedSchool).name+'登录'});
          manualAuth={kind:'credentials',...credentials};
        }catch(error){
          if(error.code==='CANCELLED')return returnToDashboard;
          throw error;
        }
      }
    }
    if(!interactive){
      // Manual logout is intentional and must never cause background login or warning spam.
      if(state.signedOut){if(config.runsWithSiri)Script.setShortcutOutput('已退出登录，请在 Scripting 中手动刷新并重新登录。');return;}
      if(state.authPaused){await reportBackgroundFailure(state.lastError||'AUTH_REQUIRED',state,store);if(config.runsWithSiri)Script.setShortcutOutput('刷新失败：登录需要处理，旧课表保留。');return;}
      if(state.calendarBindingPending){if(config.runsWithSiri)Script.setShortcutOutput('请在 Scripting 中绑定日历。');return;}
      if(!state.calendarId)fail('CALENDAR_MISSING');
    }
    state.runStatus='running';state.runStartedAt=new Date().toISOString();state.runCompletedAt=null;
    state.syncResults=null;state.termErrors=[];state.lastCourseError=null;state.lastExamError=null;
    store.write(state);
    __COURSESYNC_BOOT_PHASE='同步运行';
    progress=createProgress(state,store,interactive);
    let calendar;
    if(!interactive){
      progress('检查目标日历');
      calendar=await pickCalendar(state,store);
    }
    await progress.start();
    progress('连接教务系统');
    await synchronize(state,store,interactive?async()=>{
      if(reselectSchool&&Keychain.get(SCHOOL_RESELECT_KEY)===reselectSchool)Keychain.remove(SCHOOL_RESELECT_KEY);
      progress('检查目标日历');
      try{
        calendar=await pickCalendar(state,store,progress.pause);
      }catch(error){
        calendarCancelled=error?.code==='CANCELLED';
        throw error;
      }
      progress.resume();
      return calendar;
    }:calendar,interactive,progress,manualAuth);
    const {courses,exams}=state.syncResults;
    const failed=courses==='failed'&&exams==='failed';
    const success=courses==='success'&&exams==='success';
    const at=state.runCompletedAt=new Date().toISOString();
    const code=state.lastCourseError||state.termErrors[0]?.code||state.lastExamError;
    state.runStatus=failed?'failed':success?'success':'partial';
    state.lastError=failed?code:null;
    state.failures=failed?(state.failures||0)+1:0;
    if(!failed)state.lastCheck=at;
    if(failed){
      state.lastAttempt=at;
      state.lastFailure={at,code,stage:'课程与考试同步'};
    }
    const audit={at,status:success?'checked':state.runStatus,courses,exams,...(failed?{code}:{})};
    state.audit=[...(state.audit||[]),audit].slice(-50);
    if(success)state.resultNoticeError=null;
    progress(success?'完成本次同步':failed?'本次同步失败':'本次同步部分完成');
    store.write(state);
    if(progress){try{await progress.finish(state.runStatus);}
      catch(_){console.error('[CourseSync] completion progress cleanup failed');}}
    state.lastStage='显示同步结果';
    const details=syncResultDetails(state);
    if(!success){
      if(interactive){
        try{await showFailureRecovery({code},state,store,{title:failed?'刷新失败':'部分同步完成',details});}
        catch(_){console.error('[CourseSync] sync result could not be displayed');}
      }else await reportRefreshFailure(failed?'SYNC_FAILED':'PARTIAL_SYNC',state,store);
    }
    if(config.runsWithSiri)Script.setShortcutOutput(success?'刷新成功':(failed?'刷新失败：':'部分完成：')+details);
    return returnToDashboard;
  }catch(e){
    const code=diagnosticCode(e);
    if(code==='SYNC_SUPERSEDED'){
      // The newer invocation will acquire the lock only after release().
      // In-progress transactions are already journaled for safe recovery.
      if(config.runsWithSiri)Script.setShortcutOutput('本次同步已按请求停止，后续任务可以继续。');
      return;
    }
    if(code==='CANCELLED'){
      if(state&&locked){
        state.runStatus='cancelled';
        state.runCompletedAt=new Date().toISOString();
        if(calendarCancelled){
          state.calendarBindingPending=true;
          state.lastError=null;
          state.authPaused=false;
          state.authExpiryNotifiedAt=null;
        }
        store.write(state);
      }
      return interactive&&(calendarCancelled||returnToDashboard);
    }
    if(state&&locked){
      const at=new Date().toISOString();state.runStatus='failed';state.runCompletedAt=at;
      if(!['BUSY','LOCK_LOST'].includes(code)){
        state.failures=(state.failures||0)+1;
        if(['AUTH_REQUIRED','AUTH_INTERACTIVE_REQUIRED','AUTO_LOGIN_REJECTED','CREDENTIALS_INVALID','CREDENTIALS_UNAVAILABLE','ACCOUNT_CHANGED','WEBVIEW_TIMEOUT','LOGIN_SCHEMA','LOGIN_SALT_MISSING','LOGIN_EXECUTION_MISSING','MFA_UNSUPPORTED'].includes(code))state.authPaused=true;
      }
      state.lastError=code;state.lastAttempt=at;state.lastFailure={at,code,stage:state.lastStage||'尚无阶段记录'};
      state.audit=[...(state.audit||[]),{at,status:'failed',code}].slice(-50);
      try{store.write(state);}catch(_){}
    }
    if(!interactive){
      try{await reportBackgroundFailure(code,state,store);}
      catch(_){console.error('[CourseSync] background failure notification failed');}
    }
    if(typeof console!=='undefined'&&typeof console.error==='function')console.error('[CourseSync] '+code+' · '+(state&&state.lastStage||'未知阶段'));
    if(interactive){
      if(progress){try{await progress.finish();}
        catch(_){console.error('[CourseSync] failure progress cleanup failed');}}
      try{await showFailureRecovery(e,state,store);}
      catch(recoveryError){await notice('恢复操作未完成','原始错误：'+code+'；恢复操作错误：'+diagnosticCode(recoveryError)+'。日历与账号数据未由此操作清理。');}
    }
    else if(config.runsWithSiri)Script.setShortcutOutput('刷新失败。'+errorMessage(e,state));
    return returnToDashboard;
  }finally{
    // Each release is independent: failures after a successful calendar write
    // must never prevent the required IntentValue exit.
    try{if(manualAuth?.password)manualAuth.password='';}
    catch(_){console.error('[CourseSync] credential cleanup failed');}
    try{if(progress)await progress.finish();}
    catch(_){console.error('[CourseSync] progress cleanup failed');}
    try{if(locked)store.release();}
    catch(_){console.error('[CourseSync] sync lock release failed');}
  }
}
// Node tests import the identical implementation; Scripting uses the async entry.
if(globalThis.__COURSESYNC_TEST__)module.exports={offlineAgenda,ScriptingAdapter:{FileManager,Keychain,CloudKeychain,Request,Alert,Calendar,CalendarEvent,Notification,WebView,config,args,Script,__mode},storedEventIndex,matchesOldCourse,polishTermNotes,removeMatchedOldCourses,selectTermIds,dedicatedWindows,snapshotSignature,createProgress,probeSchoolSession,inspectEnvironment,environmentCheckText,showEnvironmentCheck,reportRefreshFailure,clearLegacyReminders,reportBackgroundFailure,notifyAuthExpiredOnce,validateRecords,validateState,readCookieJar,credentialForm,input,validSliderResult,originalTitleFromCalendar,occurrenceKey,calendarRows,assertNonRecurring,writeVerified,finishTx,synchronize,safeURL,resolveURL,pageInfo,topId,hm,monday,detailMonday,explicitTeachingMonday,chooseAnchor,VERIFIED_TERM_ANCHORS,expand,same,plan,aesCBC,syncExams,CookieJar,HTTP,fieldsFrom,encryptPassword,bounded,applyTransaction,ics,eventRecord,notes,Store,acquireSyncSlot,CalendarAdapter,pickCalendar,availableRecovery,applyRecovery,showRunStatus,showFailureRecovery,statusText,errorMessage,diagnosticCode,reasonFor,actionFor,requestLabel,networkErrorCode,loginPreflight,legacyEventKey,legacyLocationCompatible,selectLegacyDuplicates,scanLegacyDuplicates,backupLegacyICS,hasSavedCredentials,readSavedCredentials,saveCredentials,removeSavedCredentials,migrateSavedCredentials,credentialStorageStatus,migrateLegacyKeychainData,LEGACY_DEVICE_KEYS,validateEndpointSettings,loadEndpointSettings,activateEndpointSettings,termEndpoint,prepareManualRefresh,ENDPOINT_DEFAULTS,NUFE_SCHOOL,schoolById,loadSelectedSchool,activateSelectedSchool,passwordLogin,coursePage,mfa,signOut,run,queryFreeRoomsForPeriod,queryFreeRooms,BUILDING_PRIORITY,NUFE_FREE_ROOM_ENDPOINT,queryDayRooms};
else await run();

// SPDX-License-Identifier: GPL-3.0-only. Full license available in LICENSE file.

  }catch(error){await __COURSESYNC_REPORT_STARTUP(error);}
}
export function launchCourseSync() {
  const launch = __NUFE_START();
  globalThis.__COURSESYNC_LAUNCH__ = launch;
  return launch;
}

const __bootScript = Scripting.Script ?? globalThis.Script;
if (!globalThis.__COURSESYNC_TEST__ && __bootScript?.env !== 'intent') {
  launchCourseSync();
}
