// SPDX-License-Identifier: GPL-3.0-only
const native = (operation, value = {}) => {
  const result = __native(operation, value);
  if (result && result.error) throw Object.assign(new Error(result.error), {code: result.error});
  return result;
};
const asyncNative = (operation, value = {}) => new Promise((resolve, reject) =>
  __asyncNative(operation, value, (result, error) =>
    error ? reject(Object.assign(new Error(error), {code: error})) : resolve(result)));
const console = {log() {}, error() {}};
const timers = new Set();
function timer(callback, ms, repeat) {
  const token = {};
  timers.add(token);
  const fire = () => {
    if (!timers.has(token)) return;
    if (!repeat) timers.delete(token);
    try { callback(); } finally {
      if (repeat && timers.has(token)) __delay(ms, fire);
    }
  };
  __delay(ms, fire);
  return token;
}
const setTimeout = (fn, ms) => timer(fn, ms, false);
const setInterval = (fn, ms) => timer(fn, ms, true);
const clearTimeout = token => timers.delete(token);
const clearInterval = clearTimeout;
globalThis.crypto = {getRandomValues(array) {
  array.set(native('random', {count: array.length}));
  return array;
}};
const dialog = {
  alert: options => asyncNative('dialog', {...options, actions:[{label:options.buttonLabel || '好'}]}),
  actionSheet: options => asyncNative('dialog', options),
  async confirm(options) {
    return (await asyncNative('dialog', {...options, cancelButton:true, actions:[{label:options.confirmLabel || '确认'}]})) === 0;
  },
  async prompt(options) {
    const values = await asyncNative('fields', {...options, fields:[{label:options.placeholder, value:options.defaultValue, secure:options.obscureText}]});
    return values ? values[0] : null;
  }
};
const wrapCalendar = data => ({...data, async save() {
  Object.assign(this, await asyncNative('newCalendar', {title:this.title}));
}});
class NativeEvent {
  constructor(data = {}) {
    Object.assign(this, data);
    for (const key of ['startDate','endDate','occurrenceDate']) if (this[key] != null) this[key] = new Date(this[key]);
  }
  async save() {
    const saved = native('saveEvent', {
      handle:this.handle, calendar:this.calendar.identifier, title:this.title, location:this.location,
      notes:this.notes, isAllDay:this.isAllDay, timeZone:this.timeZone,
      start:+this.startDate, end:+this.endDate
    });
    this.identifier = saved.identifier;
    this.handle = saved.handle;
  }
  async remove() {native('removeEvent', {handle:this.handle});}
  static async getAll(from, to, calendars) {
    return native('events', {start:+from, end:+to, calendars:calendars.map(c=>c.identifier)}).map(e=>new NativeEvent(e));
  }
}
class NativeWebView {
  addScriptMessageHandler(name, handler) {this.handler = handler;}
  async loadHTML(html) {this.html = html; return true;}
  async present(options) {await new Promise(resolve=>__slider(this.html, options.navigationTitle, this.handler, resolve));}
  dismiss() {}
  dispose() {this.html = null; this.handler = null;}
}
const asData = base64 => ({base64, getBytes:()=>native('bytes',{base64})});
const Scripting = {
  Script:{name:'CourseSync', env:'index', exit:message=>__finish(message || ''), createRunURLScheme:()=>'', requestAccess:()=>asyncNative('access')},
  FileManager:{
    appGroupDocumentsDirectory:native('root'),
    existsSync:path=>native('exists',{path}),
    createDirectorySync:(path,recursive)=>native('mkdir',{path,recursive}),
    readDirectorySync:path=>native('list',{path}),
    readAsStringSync:path=>native('read',{path}),
    writeAsStringSync:(path,value)=>native('write',{path,value}),
    removeSync:path=>native('unlink',{path}),
    renameSync:(path,to)=>native('move',{path,to})
  },
  Keychain:{
    contains:(key,options)=>native('keyRead',{key,...options})!==null,
    get:(key,options)=>native('keyRead',{key,...options}),
    set:(key,value,options)=>native('keyWrite',{key,value,...options}),
    remove:(key,options)=>native('keyDelete',{key,...options})
  },
  UUID:{string:()=>native('uuid')},
  Navigation:{present:true},
  Dialog:dialog,
  WebViewController:NativeWebView,
  Data:{fromBase64String:asData, fromFile:path=>asData(native('base64',{path}))},
  UIImage:{fromData:data=>data.base64},
  QuickLook:{previewImage:image=>asyncNative('dialog',{title:'图形验证码',image,actions:[{label:'继续'}]})},
  DocumentPicker:{exportFiles:({files})=>asyncNative('export',{files:files.map(f=>({name:f.name,base64:f.data.base64}))})},
  Calendar:{
    forEvents:async ()=>(await asyncNative('calendars')).map(wrapCalendar),
    presentChooser:async () => {
      const rows=(await Scripting.Calendar.forEvents()).filter(c=>c.allowsContentModifications&&!c.isSubscribed);
      const i=await dialog.actionSheet({title:'选择专用日历',actions:rows.map(c=>({label:c.title+' · '+c.source.title})),cancelButton:true});
      return Number.isInteger(i) && rows[i] ? [rows[i]] : [];
    },
    create:async ({title})=>wrapCalendar({title})
  },
  CalendarEvent:NativeEvent,
  Notification:{
    schedule:options=>asyncNative('notify',{...options,when:options.triggerDate ? +options.triggerDate : null}),
    getAllPendingsOfCurrentScript:async ()=>(await asyncNative('pending')).map(n=>({...n, trigger:n.when ? {date:new Date(n.when)} : null})),
    removePendings:ids=>native('removePending',{ids})
  },
  async fetch(url, options = {}) {
    const result=await asyncNative('request',{url,method:options.method || 'GET',headers:options.headers,body:options.body,timeout:options.timeout ?? 15});
    const headers=new Map(Object.entries(result.headers || {}).map(([name, value]) => [name.toLowerCase(), value]));
    if (result.status >= 300 && result.status < 400 && result.redirect)
      await options.handleRedirect?.({url:result.redirect});
    return {status:result.status,headers,mimeType:result.mimeType,data:async()=>asData(result.base64),text:async()=>result.text};
  }
};
async function presentNativeCredentialForm(title) {
  const values=await asyncNative('fields',{title,message:'凭据仅提交给南京财经大学教务系统。',fields:[
    {label:'学号',kind:'username'}, {label:'密码',kind:'password',secure:true}
  ]});
  return values ? {username:values[0].trim(),password:values[1]} : null;
}
async function presentNativeTextForm({title,label,kind,image}) {
  const values=await asyncNative('fields',{title,image,fields:[{label,kind,secure:kind==='secure'}]});
  return values ? values[0] : null;
}
async function presentNativeRefreshForm(schools, selected, allowReuse) {
  const i=await dialog.actionSheet({title:'请选择你的学校',cancelButton:true,actions:schools.map(s=>({label:s.name}))});
  if(i == null) return null;
  const schoolId=schools[i].id;
  if(allowReuse && schoolId===selected && await dialog.confirm({title:'使用现有登录信息',confirmLabel:'继续',cancelLabel:'重新输入'}))
    return {kind:'reuse',schoolId};
  const credentials=await presentNativeCredentialForm('学校账号密码');
  return credentials && {...credentials,kind:'credentials',schoolId};
}
function createNativeProgressView() {return null;}
const CourseRefreshActivity = null;
