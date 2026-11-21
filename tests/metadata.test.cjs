// Public-facing metadata and documentation invariants; no Scripting host required.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('Scripting metadata keeps the intended display identity',()=>{
  const data=JSON.parse(read('script.json'));
  assert.equal(data.name,'CourseSync');
  assert.equal(Object.hasOwn(data,'version'),false);
  assert.match(data.description,/CourseSync/);
  assert.equal(data.localizedNames.en,'CourseSync');
  assert.equal(data.localizedNames.zh,'CourseSync');
  assert.match(data.color,/^#[0-9a-fA-F]{6}$/);
  assert.equal(data.icon,'calendar');
});

test('script identity is independent of the selected school',()=>{
  assert.doesNotMatch(read('script.json'),/南京财经大学|苏州科技大学|南财/);
});

test('README distinguishes public CourseSync name from legacy installation identity',()=>{
  const readme=read('README.md');
  assert.match(readme,/^# CourseSync$/m);
  assert.match(readme,/Scripting 脚本标识/);
  assert.match(readme,/CourseSync/);
});

test('README describes NUFE as the only currently open school',()=>{
  assert.match(read('README.md'),/当前仅开放\*\*南京财经大学\*\*/);
  assert.doesNotMatch(read('README.md'),/苏州科技大学/);
  assert.match(read('README.md'),/账号登录/);
});

test('README remains text-only without image markup or references',()=>{
  const readme=read('README.md');
  assert.equal(readme.includes('<img'),false);
  assert.equal(readme.includes('<picture'),false);
  assert.equal(readme.includes('<svg'),false);
  assert.equal(readme.includes('docs/images/'),false);
  assert.equal(readme.includes('!['),false);
  assert.match(readme,/再次打开 CourseSync 时直接进入登录页/);
});

test('README points to the main branch for remote import',()=>{
  const url='https://github.com/b7f2d/CourseSync/tree/main';
  assert.ok(read('README.md').includes(url));
});

test('error guidance does not direct users to removed menu actions',()=>{
  const source=read('index.tsx');
  const start=source.indexOf('const ERROR_GUIDE={');
  const end=source.indexOf('function diagnosticCode(',start);
  assert.ok(start>=0&&end>start);
  const guide=source.slice(start,end);
  assert.doesNotMatch(guide,/登录页面自检（无需密码）|重试「覆盖旧课程」|从菜单执行历史课程清理|选择「重新绑定课表日历」|运行状态/);
  assert.doesNotMatch(guide,/账号与日历设置/);
  assert.match(guide,/主菜单「立即刷新」/);
});

test('CI validates the remote script without packaging or publishing',()=>{
  assert.equal(fs.existsSync(path.join(root,'.github/workflows/release.yml')),false);
  assert.equal(fs.existsSync(path.join(root,'scripts/package.sh')),false);
  assert.equal(fs.existsSync(path.join(root,'scripts/package.cjs')),false);
  assert.equal(Object.hasOwn(JSON.parse(read('package.json')).scripts,'package'),false);
  assert.match(read('.github/workflows/validate.yml'),/node --test tests\/\*\.test\.cjs/);
});

test('widget distribution includes the native entry and safe cache model',()=>{
  const entry=read('widget.tsx');
  assert.match(entry,/Widget\.present\(/);
  assert.match(entry,/buildWidgetModel\(/);
  assert.doesNotMatch(entry,/Keychain|CalendarEvent|fetch\(/);
  assert.match(read('widget-data.ts'),/appGroupDocumentsDirectory/);
  const index=read('index.tsx');
  assert.doesNotMatch(index,/^import .*from ['"]\\.\\/(?:login-native|progress-native|live_activity)['"]/m);
  assert.match(index,/await import\\('\\.\\/login-native'\\)/);
  assert.match(index,/await import\\('\\.\\/progress-native'\\)/);
  assert.match(read('intent.tsx'),/import ["']\\.\\/index["']/);
  assert.match(read('intent-probe.tsx'),/CourseSync intent ok/);
});
