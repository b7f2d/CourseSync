// Native-input and safe-challenge regression guards. No account secrets are read.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const index=fs.readFileSync(__dirname+'/../index.tsx','utf8');
const native=fs.readFileSync(__dirname+'/../login-native.tsx','utf8');
const schedule=fs.readFileSync(__dirname+'/../schedule-native.tsx','utf8');
const progress=fs.readFileSync(__dirname+'/../progress-native.tsx','utf8');
const start=index.indexOf('async function credentialForm(');
const end=index.indexOf('function validSliderResult(',start);
if(start<0||end<start)throw Error('Native credential form not found');
const credential=index.slice(start,end);

test('credential form is native-only; fallback also uses iOS secure Dialog',()=>{
 assert.match(credential,/presentNativeCredentialForm\(title\)/);
 assert.match(credential,/if\(!config\.runsInApp\)fail\('AUTH_INTERACTIVE_REQUIRED'\)/);
 assert.match(credential,/HostDialog\.confirm\(\{/);
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

test('first step uses a native dropdown for whitelisted schools, then native credentials',()=>{
 assert.match(native,/export async function presentNativeRefreshForm/);
 assert.match(native,/function RefreshSetupView/);
 assert.match(native,/useState<'school'\|'account'>\('school'\)/);
 assert.match(native,/navigationTitle="选择学校"/);
 assert.match(native,/<Picker title="学校" pickerStyle="menu"/);
 assert.match(native,/<Text key="unselected" tag="unselected">请选择<\/Text>/);
 assert.match(native,/value=\{schoolId\} onChanged=\{setSchoolId\}/);
 assert.match(native,/schools\.map\(s=><Text key=\{s\.id\} tag=\{s\.id\}>\{s\.name\}<\/Text>\)/);
 assert.match(native,/title="下一步：账号密码"/);
 assert.match(native,/navigationTitle="账号密码"/);
 assert.match(native,/title="开始刷新"/);
 assert.match(native,/title="使用现有登录信息继续"/);
 assert.match(native,/textContentType="username"/);
 assert.match(native,/textContentType="password"/);
 assert.doesNotMatch(native,/教务接口|默认接口|统一认证根地址|SSO 登录入口|课表页面|学期详情|课表数据|WebView|fetch\(|Clipboard|console\.log/);
 assert.match(index,/const SCHOOL_WHITELIST=Object\.freeze/);
 assert.match(index,/id:'nufe',name:'南京财经大学'/);
 assert.match(index,/function prepareManualRefresh\(state\)/);
 assert.match(index,/presentNativeRefreshForm\(/);
 assert.match(index,/schoolById\(response\.schoolId\)/);
 assert.match(index,/activateSelectedSchool\(school\.id\)/);
 assert.doesNotMatch(index,/menu\.addAction\('教务接口'\)/);
 assert.match(index,/if\(interactive&&action===0\)/);
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
 assert.match(progress,/progressViewStyle="linear"/);
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
 const start=index.indexOf('if(interactive&&action===0){');
 const end=index.indexOf('if(!interactive){',start);
 const routine=index.slice(start,end);
 assert.match(routine,/const hasCredentials=!state\.signedOut&&hasSavedCredentials\(\)/);
 assert.match(routine,/const selectedSchool=loadSelectedSchool\(null,true\)/);
 assert.match(routine,/if\(!selectedSchool\)\{/);
 assert.match(routine,/manualAuth=await prepareManualRefresh\(state\)/);
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
 assert.match(native,/navigationDestination=\{\{/);
 assert.match(native,/<FreeRoomView page=\{freeRoomPage\}/);
 assert.match(index,/canFreeRooms=activeSchoolId==='nufe'&&!state\.signedOut&&canSignOut/);
});

test('native dashboard presents an app-like interface with rich background and card styling',()=>{
 assert.match(native,/export async function presentNativeDashboard/);
 assert.match(native,/function DashboardView/);
 assert.match(native,/navigationTitle="CourseSync"/);
 assert.match(native,/title="立即刷新"/);
 assert.match(native,/title="管理日程"/);
 assert.match(native,/title="查询空闲教室"/);
 assert.match(native,/title="退出当前登录"/);
 assert.doesNotMatch(native,/运行状态与自检|切换学校|[🎓🏫🔐📅🏛🗓🔄🚪]/u);
 assert.match(index,/presentNativeDashboard\(\{/);
 assert.match(progress,/正在同步课程和考试/);
});

test('native calendar schedule view presents a real calendar with year, month, 1-30/31 days, and click-to-edit',()=>{
 assert.match(schedule,/export function presentNativeCalendarSchedule/);
 assert.match(schedule,/function CalendarScheduleView/);
 assert.match(schedule,/navigationTitle="日程管理"/);
 assert.match(schedule,/title="添加课程"/);
 assert.match(schedule,/title="添加考试"/);
 assert.match(schedule,/<Section header=\{<Text>本月日程<\/Text>\}>/);
 assert.match(schedule,/Array\.from\(\{ length: totalDays \}, \(_, idx\) => idx \+ 1\)/);
 assert.match(schedule,/shape:\s*\{\s*type:\s*'circle'\s*\}/);
 assert.match(index,/presentNativeCalendarSchedule\(\{/);
 assert.doesNotMatch(schedule,/font=\{\d+\}/);
 assert.match(schedule,/Picker[\s\S]*?title="年份"/);
 assert.match(schedule,/Picker[\s\S]*?title="月份"/);
 assert.doesNotMatch(schedule,/\[教务同步\]|只读|[◀▶✎]/u);
 assert.match(schedule,/>编辑</);
 assert.match(schedule,/monospacedDigit=\{true\}/);
 assert.match(schedule,/frame=\{\{\s*height:\s*6\s*\}\}/);
 assert.match(schedule,/maxWidth:\s*'infinity',\s*minHeight:\s*40,\s*maxHeight:\s*40/);
});



