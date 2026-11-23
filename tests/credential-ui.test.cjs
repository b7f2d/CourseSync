// Native-input and safe-challenge regression guards. No account secrets are read.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const index=fs.readFileSync(__dirname+'/../index.tsx','utf8');
const native=fs.readFileSync(__dirname+'/../login-native.tsx','utf8');
const progress=fs.readFileSync(__dirname+'/../progress-native.tsx','utf8');
const start=index.indexOf('async function credentialForm(');
const end=index.indexOf('function validSliderResult(',start);
if(start<0||end<start)throw Error('Native credential form not found');
const credential=index.slice(start,end);

test('credential form is native-only; fallback also uses iOS secure Dialog',()=>{
 assert.match(credential,/presentNativeCredentialForm\(title\)/);
 assert.match(credential,/if\(!config\.runsInApp\)fail\('AUTH_INTERACTIVE_REQUIRED'\)/);
 assert.match(credential,/await confirm\(/);
 assert.match(credential,/return await fallbackCredentialForm\(\{title\}\)/);
 assert.doesNotMatch(credential,/new WebView|loadHTML|autocomplete=|addScriptMessageHandler|nufeCredentials/);
});

test('native iOS credential sheet has both autofill fields and no WebView',()=>{
 assert.match(native,/<TextField[\s\S]*?textContentType="username"/);
 assert.match(native,/<SecureField[\s\S]*?textContentType="password"/);
 assert.match(native,/onChanged=\{setUsername\}/);
 assert.match(native,/onChanged=\{setPassword\}/);
 assert.match(native,/Navigation\.present\(\{/);
 assert.match(native,/dismiss\(\{ username: account, password \}\)/);
 assert.match(native,/action=\{\(\) => dismiss\(null\)\}/);
 assert.doesNotMatch(native,/WebView|loadURL|fetch\(|Clipboard|console\.log/);
});

test('first setup opens the native credential form directly',()=>{
 assert.match(native,/export async function presentNativeRefreshForm/);
 assert.match(native,/presentLoginView\('登录账号','开始刷新',allowReuse\)/);
 assert.doesNotMatch(native,/选择学校|选择其他学校|下一步：账号密码/);
 assert.match(native,/title="使用现有登录信息继续"/);
 assert.match(native,/textContentType="username"/);
 assert.match(native,/textContentType="password"/);
 assert.doesNotMatch(native,/教务接口|默认接口|统一认证根地址|SSO 登录入口|课表页面|学期详情|课表数据|WebView|fetch\(|Clipboard|console\.log/);
 assert.match(index,/id:'nufe',name:'南京财经大学'/);
 assert.match(index,/function prepareManualRefresh\(state,forceCredentials=false\)/);
 assert.match(index,/presentNativeRefreshForm\(NUFE_SCHOOL\.id,allowReuse\)/);
 assert.match(index,/response\.schoolId===NUFE_SCHOOL\.id/);
 assert.doesNotMatch(index,/menu\.addAction\('教务接口'\)/);
 assert.match(index,/if\(signOutRequested\)\{await signOut\(state,store\);return;\}\s*if\(interactive\)/);
 assert.match(index,/if\(!manualAuth\)return;/);
});

test('native OTP and CAPTCHA keep secrets in memory and use system keyboards',()=>{
 assert.match(native,/export async function presentNativeTextForm/);
 assert.match(native,/kind==='sms'\|\|kind==='totp'/);
 assert.match(native,/textContentType=\{otp\?'oneTimeCode':undefined\}/);
 assert.match(native,/keyboardType=\{otp\?'numberPad':'default'\}/);
 assert.match(native,/<Image image=\{image\} resizable=\{true\} scaleToFit=\{true\}/);
 assert.match(native,/if\(typeof result!=='string'\)return null/);
 assert.doesNotMatch(native,/SMS\.read|Message\.read|Clipboard|console\.log/);
});

test('MFA and image captcha route to native input without changing school requests',()=>{
 assert.match(index,/presentNativeTextForm\(\{/);
 assert.match(index,/kind:type==='3'\?'sms':'totp'/);
 assert.match(index,/\{kind:'captcha',image:rendered\}/);
 assert.match(index,/rendered=UI\.fromData\(image\.text\)/);
 assert.match(index,/return await legacyInput\(title,label,secure\)/);
});

test('only school slider verification retains ephemeral, isolated WebKit',()=>{
 const uses=[...index.matchAll(/new WebView\(\)/g)];
 assert.equal(uses.length,1);
 const slider=index.slice(index.indexOf('async function humanSlider('),index.indexOf('function reauthValue(',index.indexOf('async function humanSlider(')));
 assert.match(slider,/addScriptMessageHandler\('nufeSlider'/);
 assert.match(slider,/validSliderResult\(payload\)/);
 assert.match(slider,/messageHandlers\.nufeSlider\.postMessage/);
 assert.match(slider,/finally\{/);
 assert.match(slider,/w\.inner\.dispose\(\)/);
 assert.doesNotMatch(slider,/evaluateJavaScript\('window\.result'\)/);
 assert.match(slider,/connect-src 'none'; form-action 'none'/);
});

test('native progress replaces the HTML view with one stable system sheet',()=>{
 assert.doesNotMatch(progress,/<ProgressView|progressViewStyle/);
 assert.match(progress,/Navigation\.present\(\{/);
 assert.match(progress,/session\.suppressed=true/);
 assert.match(progress,/session\.revision\+\+/);
 assert.match(progress,/pause\(\)/);
 assert.match(progress,/resume\(\)/);
 assert.match(progress,/finish\(\)/);
 assert.doesNotMatch(progress,/WebView|loadHTML|evaluateJavaScript|fetch\(|Clipboard|password|Cookie|setInterval/);
 const create=index.slice(index.indexOf('function createProgress('),index.indexOf('// Recognize a previously bound calendar'));
 assert.match(create,/createNativeProgressView\(\)/);
 assert.doesNotMatch(create,/WebView|loadHTML|evaluateJavaScript/);
});

test('routine refresh and re-login keep using the selected school',()=>{
 const start=index.indexOf('if(signOutRequested)');
 const end=index.indexOf('if(!interactive){',start);
 const routine=index.slice(start,end);
 assert.match(routine,/const hasCredentials=!state\.signedOut&&\(hasSavedCredentials\(\)\|\|Keychain\.contains\(schoolKey\(KEY\)\)\)/);
 assert.match(routine,/const selectedSchool=state\.signedOut\|\|reselectSchool\?null:loadSelectedSchool\(null,true\)/);
 assert.match(routine,/if\(!selectedSchool\)\{/);
 assert.match(routine,/manualAuth=await prepareManualRefresh\(state,!!reselectSchool\)/);
 assert.match(routine,/else if\(!hasCredentials\)\{\s*try\{\s*const credentials=await credentialForm/);
 assert.doesNotMatch(index,/menu\.addAction\('切换学校'\)/);
});
test('expired foreground cookie automatically retries saved credentials',()=>{
 const start=index.indexOf('async function coursePage(');
 const end=index.indexOf('// Immutable generation files',start);
 const login=index.slice(start,end);
 assert.match(login,/manualAuth\?\.kind==='credentials'\?manualAuth:readSavedCredentials\(\)/);
 assert.match(login,/passwordLogin\(http,r,account\.username,account\.password,interactive,onStage\)/);
 assert.match(login,/if\(!interactive\)fail\('AUTH_REQUIRED'\)/);
 assert.match(login,/if\(shouldSave\)saveCredentials\(account\.username,account\.password\)/);
 assert.match(login,/\['LOGIN_FAILED','AUTO_LOGIN_REJECTED'\]/);
 assert.match(login,/const fresh=await http\.get\(SSO\)/);
});

test('native secure input preserves exact secret without trimming and supports up to 512 chars',()=>{
 assert.match(native,/const response=secret\?value:value\.trim\(\)/);
 assert.match(native,/const maxLength=kind==='captcha'\?32:otp\?48:secret\?512:120/);
 assert.match(native,/const code=isSecure\?result:result\.trim\(\)/);
 assert.match(native,/isSecure\?512:120/);
});

test('NUFE provides free classroom query button in dashboard only, not in unauthenticated login/setup views',()=>{
 assert.match(native,/title="查询空闲教室"/);
 const loginSection=native.slice(0,native.indexOf('type FreeRoomResult'));
 assert.doesNotMatch(loginSection,/查询空闲教室|freeRooms/);
 assert.match(index,/const NUFE_FREE_ROOM_ENDPOINT=/);
 assert.match(index,/const BUILDING_PRIORITY=Object\.freeze\(\{'博远楼':1,'博观楼':2,'博文楼':3\}\)/);
 assert.match(index,/queryFreeRoomsForPeriod/);
 assert.match(index,/queryFreeRoomsToday/);
 assert.match(index,/loadFreeRooms:canFreeRooms\?loadFreeRoomPage:undefined/);
 assert.doesNotMatch(native,/navigationDestination=\{\{/);
 assert.match(native,/roomQuery\.current\.revision\+\+/);
 assert.match(native,/<FreeRoomView page=\{freeRoomPage\}/);
 assert.match(native,/page\.kind === 'loading'[\s\S]*正在查询空闲教室/);
 const freeRoom=native.slice(native.indexOf('function FreeRoomView'),native.indexOf('export type DashboardOptions'));
 assert.match(freeRoom,/page\.rooms\.map/);
 assert.match(native,/function GlassPopup[\s\S]*<ScrollView[\s\S]*\{children\}/);
 assert.match(progress,/<NativeProgressContent title=\{title\}/);
 assert.match(progress,/<GeometryReader>[\s\S]*frame=\{\{width,height,alignment:'center'\}\}/);
 assert.match(progress,/const iconWidth=Math\.max\(0,Math\.min\(120,width-80,height-110\)\)/);
 assert.match(index,/canFreeRooms=activeSchoolId==='nufe'&&!state\.signedOut&&canSignOut/);
});

test('native dashboard presents an app-like interface with rich background and card styling',()=>{
 assert.match(native,/export async function presentNativeDashboard/);
 assert.match(native,/function DashboardView/);
 assert.match(native,/<Text font="title2" fontWeight="bold">CourseSync<\/Text>/);
 assert.match(native,/glassEffect=\{\{type:'rect',cornerRadius:20\}\}/);
 assert.match(native,/title="立即刷新"/);
 assert.doesNotMatch(native,/管理日程/);
 assert.match(native,/title="查询空闲教室"/);
 assert.match(native,/title="退出当前登录"/);
 assert.doesNotMatch(native,/运行状态与自检|切换学校|[🎓🏫🔐📅🏛🗓🔄🚪]/u);
 assert.match(index,/presentNativeDashboard\(\{/);
 assert.match(progress,/正在同步课程和考试/);
});

test('system dashboard preserves actions, classroom results, retry, and logout',async()=>{
 const vm=require('node:vm');
 const source=native.slice(native.indexOf('function systemDialog()'),native.indexOf('\ntype CalendarManageOptions'))
   .replace('(globalThis as any).Dialog','globalThis.Dialog')
   .replace('export async function','async function')
   .replace('options: DashboardOptions','options')
   .replace(': Promise<any>','')
   .replace('let result: FreeRoomResult','let result');
 const calls=[], selections=[1,0,0,2], rooms=[{kind:'error',message:'查询失败'},{kind:'ready',date:'2026-11-23',rooms:[{period:'第一节',room:'博远楼 101'}]}];
 const sandbox={Dialog:{actionSheet:async opts=>{calls.push(opts);return selections.shift();}},
   createNativeProgressView:()=>({show(){},pause:async()=>{},finish(){}})};
 const show=vm.runInNewContext(source+'\npresentNativeDashboard',sandbox);
 const result=await show({state:{runStatus:'success',calendarId:'1',calendarTitle:'CourseSync'},schoolName:'南京财经大学',canSignOut:true,statusMessage:'',loadFreeRooms:async()=>rooms.shift()});
 assert.equal(result,1);
 assert.match(calls[0].message,/南京财经大学[\s\S]*已同步[\s\S]*CourseSync/);
 assert.deepEqual(Array.from(calls[0].actions,action=>action.label),['立即刷新','查询空闲教室','退出当前登录']);
 assert.match(calls[1].message,/查询失败/);
 assert.match(calls[2].message,/第一节：博远楼 101/);
});

test('calendar naming uses native prompt, validates entries and retains retry value',async()=>{
 const vm=require('node:vm');
 const source=native.slice(native.indexOf('export async function presentNativeCalendarManager('),native.indexOf('\n// Common foreground prompts'))
   .replace('export async function','async function')
   .replace('_options: CalendarManageOptions','_options')
   .replace(': Promise<CalendarManageResult>','');
 const prompts=[],alerts=[],values=['bad/name',' My Calendar '];
 const run=vm.runInNewContext(source+'\npresentNativeCalendarManager',{systemDialog:()=>({
   prompt:async opts=>{prompts.push(opts);return values.shift();},alert:async opts=>alerts.push(opts)
 })});
 const result=await run({});
 assert.equal(result.action,'create');assert.equal(result.title,'My Calendar');
 assert.equal(prompts[0].defaultValue,'CourseSync');assert.equal(prompts[1].defaultValue,'bad/name');
 assert.equal(alerts.length,1);
});

test('missing or broken actionSheet falls back to native confirmation choices',async()=>{
 const vm=require('node:vm');
 const source=native.slice(native.indexOf('function systemDialog()'),native.indexOf('\nexport async function presentNativeDashboard('))
   .replace('(globalThis as any).Dialog','globalThis.Dialog');
 for (const broken of [false,true]) {
   const seen=[], answers=[false,false,true];
   const dialog={confirm:async options=>{seen.push(options);return answers.shift();}};
   if(broken)dialog.actionSheet=async()=>{throw new TypeError('actionSheet unavailable');};
   const choose=vm.runInNewContext(source+'\nchooseNativeAction',{Dialog:dialog});
   const selected=await choose({title:'CourseSync',message:'已同步',actions:[
     {label:'立即刷新'},{label:'查询空闲教室'},{label:'退出当前登录',destructive:true}
   ]});
   assert.equal(selected,2);
   assert.deepEqual(seen.map(x=>x.confirmLabel),['立即刷新','查询空闲教室','退出当前登录']);
   assert.equal(seen[2].cancelLabel,'取消');
 }
});
