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
  // CourseSync is the actual Scripting script identity and stable archive name.
  assert.equal(data.name,'CourseSync');
  assert.match(data.color,/^#[0-9a-fA-F]{6}$/);
  assert.equal(data.icon,'calendar');
});

test('script identity is independent of the selected school',()=>{
  assert.doesNotMatch(read('script.json'),/南京财经大学|苏州科技大学|南财/);
  assert.match(read('docs/release-notes.md'),/首次登录可选择南京财经大学或苏州科技大学/);
});

test('README distinguishes public CourseSync name from legacy installation identity',()=>{
  const readme=read('README.md');
  assert.match(readme,/^# CourseSync$/m);
  assert.match(readme,/Scripting 脚本标识/);
  assert.match(readme,/CourseSync/);
});

test('README lists the two supported schools and USTS device verification status',()=>{
  assert.match(read('README.md'),/支持南京财经大学和苏州科技大学/);
  assert.match(read('README.md'),/仍待实机验证/);
  assert.match(read('README.md'),/选择南京财经大学或苏州科技大学，再点击「登录账号」/);
});

test('README remains text-only without image markup or references',()=>{
  const readme=read('README.md');
  assert.equal(readme.includes('<img'),false);
  assert.equal(readme.includes('<picture'),false);
  assert.equal(readme.includes('<svg'),false);
  assert.equal(readme.includes('docs/images/'),false);
  assert.equal(readme.includes('!['),false);
  assert.match(readme,/日常刷新无需重复选择，退出登录会清除已选学校/);
  assert.match(readme,/退出登录即完全重置/);
});

test('release and README describe the same stable installation path',()=>{
  const url='https://github.com/b7f2d/CourseSync/releases/download/stable/CourseSync.zip';
  assert.ok(read('README.md').includes(url));
  assert.ok(read('docs/engineering.md').includes(url));
  assert.match(read('docs/release-notes.md'),/CourseSync\.zip/);
  assert.match(read('scripts/package.sh'),/index\.tsx intent\.tsx widget\.tsx widget-data\.ts login-native\.tsx progress-native\.tsx live_activity\.tsx schedule-native\.tsx script\.json/);
});

test('error guidance does not direct users to removed menu actions',()=>{
  const source=read('index.tsx');
  const start=source.indexOf('const ERROR_GUIDE={');
  const end=source.indexOf('function diagnosticCode(',start);
  assert.ok(start>=0&&end>start);
  const guide=source.slice(start,end);
  assert.doesNotMatch(guide,/登录页面自检（无需密码）|重试「覆盖旧课程」|从菜单执行历史课程清理|选择「重新绑定课表日历」/);
  assert.doesNotMatch(guide,/账号与日历设置/);
  assert.match(guide,/点击「立即刷新」/);
});

test('only the Release archive is distributed',()=>{
  assert.equal(fs.existsSync(path.join(root,'CourseSync.zip')),false,
    'stale root ZIP should not be tracked or distributed');
  assert.match(read('.gitignore'),/^\/CourseSync\.zip$/m);
  const workflow=read('.github/workflows/release.yml');
  assert.match(workflow,/gh release upload "\$release_tag" "\$archive" --clobber/);
  assert.doesNotMatch(workflow,/build\.py|unsigned\.ipa/);
  assert.match(workflow,/git\/refs\/tags\/\$release_tag/);
  assert.match(workflow,/-f sha="\$GITHUB_SHA" -F force=true/);
  assert.match(workflow,/test "\$stable_sha" = "\$GITHUB_SHA"/);
  assert.match(workflow,/test "\$GITHUB_REF" = "refs\/heads\/main"/);
});

test('widget distribution includes the native entry and safe cache model',()=>{
  const entry=read('widget.tsx');
  assert.match(entry,/Widget\.present\(/);
  assert.match(entry,/buildWidgetModel\(/);
  assert.doesNotMatch(entry,/Keychain|CalendarEvent|fetch\(/);
  assert.match(read('widget-data.ts'),/appGroupDocumentsDirectory/);
  assert.match(read('scripts/package.sh'),/"schedule-native\.tsx"/);
  assert.match(read('index.tsx'),/import \{ presentNativeCredentialForm, presentNativeTextForm, presentNativeRefreshForm, presentNativeConfirmation \} from '\.\/login-native'/);
});
