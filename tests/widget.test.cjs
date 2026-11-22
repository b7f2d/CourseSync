// Regression tests for the native Scripting weekly timetable data projection.
const {test}=require('node:test');
const a=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/../widget-data.ts','utf8');
const core=vm.runInNewContext(
  source.replace(/export function /g,'function ')+
  '\n({loadWidgetState,readWidgetMirror,loadBestWidgetState,selectVisibleCourses,selectTodayCourse,buildWidgetModel,widgetReloadDate})',
  {Date,Math,Number,String,Object,Array,RegExp,Error}
);
const date=(s)=>Date.parse(s);
const ev=(id,title,start,end,location='JB101')=>({
  id,title,start,end,location,week:9,sid:'161',su:3,eu:5,teachers:[]
});
const make=(events)=>({version:1,lastCheck:'2026-11-02T05:00:00Z',
  semesters:{'161':{events}}});

test('the shared-file fallback includes exams alongside courses',()=>{
  const state=make([ev('course','当天课程','2026-11-03T02:00:00Z','2026-11-03T03:00:00Z')]);
  state.exams=[ev('exam','（考试）统计学','2026-11-03T05:00:00Z','2026-11-03T06:00:00Z')];
  const result=core.loadBestWidgetState({
    appGroupDocumentsDirectory:'/group',existsSync:()=>true,
    readDirectorySync:()=>['state-0000000001.json'],readAsStringSync:()=>JSON.stringify(state),
  },null);
  const model=core.buildWidgetModel(result.state,date('2026-11-03T04:00:00Z'));
  a.deepEqual(Array.from(model.days[1].courses,event=>event.title),['当天课程','（考试）统计学']);
});

test('weekly timetable correctly fades only ended classes',()=>{
  const now=date('2026-11-03T06:10:00Z'); // Tuesday 14:10 Beijing
  const state=make([
    ev('a','已上课程','2026-11-03T02:00:00Z','2026-11-03T04:15:00Z'),
    ev('b','正在上课','2026-11-03T05:30:00Z','2026-11-03T06:55:00Z'),
    ev('c','稍后上课','2026-11-03T07:10:00Z','2026-11-03T08:35:00Z')
  ]);
  const m=core.buildWidgetModel(state,now),tue=m.days[1];
  a.equal(m.days.length,7);
  a.equal(tue.today,true);
  a.deepEqual(Array.from(tue.courses,c=>c.status),['done','current','upcoming']);
  a.deepEqual(Array.from(tue.courses,c=>c.startLabel),['10:00','13:30','15:10']);
  a.equal(m.nextAt,date('2026-11-03T06:55:00Z'));
});

test('ongoing class remains colored until its actual END, not the next start',()=>{
  const e=ev('x','两节课','2026-11-03T05:30:00Z','2026-11-03T06:55:00Z');
  a.equal(core.buildWidgetModel(make([e]),date('2026-11-03T06:54:59Z')).days[1].courses[0].status,'current');
  a.equal(core.buildWidgetModel(make([e]),date('2026-11-03T06:55:00Z')).days[1].courses[0].status,'done');
});

test('week calendar uses school Beijing time regardless of iPhone timezone',()=>{
  const mon=date('2026-11-01T16:30:00Z'); // Monday Nov 2, 00:30 Beijing
  const m=core.buildWidgetModel(make([ev('z','周一课程','2026-11-02T01:00:00Z','2026-11-02T02:00:00Z')]),mon);
  a.equal(new Date(m.start).toISOString(),'2026-11-01T16:00:00.000Z');
  a.equal(m.days[0].number,2);
  a.equal(m.days[0].courses[0].title,'周一课程');
});

test('weekly timetable includes weekend classes',()=>{
  const m=core.buildWidgetModel(make([
    ev('s','周六课','2026-11-07T01:00:00Z','2026-11-07T02:00:00Z'),
    ev('u','周日课','2026-11-08T05:00:00Z','2026-11-08T06:00:00Z')
  ]),date('2026-11-07T00:00:00Z'));
  a.equal(m.days.length,7);
  a.equal(m.days[5].courses[0].title,'周六课');
  a.equal(m.days[6].courses[0].title,'周日课');
});

test('events outside the current week are excluded, and malformed records are ignored',()=>{
  const m=core.buildWidgetModel(make([
    ev('old','上周','2026-10-27T01:00:00Z','2026-10-27T02:00:00Z'),
    ev('next','下周','2026-11-10T01:00:00Z','2026-11-10T02:00:00Z'),
    ev('bad','无效','x','y'),
    ev('ok','本周','2026-11-05T01:00:00Z','2026-11-05T02:00:00Z')
  ]),date('2026-11-04T00:00:00Z'));
  a.equal(m.courses.length,1);
  a.equal(m.days[3].courses[0].title,'本周');
});

test('widget asks for a refresh at the next class boundary without polling every minute',()=>{
  const m=core.buildWidgetModel(make([ev('a','上课','2026-11-03T02:00:00Z','2026-11-03T04:00:00Z')]),
    date('2026-11-03T01:00:00Z'));
  a.equal(core.widgetReloadDate(m).getTime(),date('2026-11-03T02:00:01Z'));
});

test('reads only latest verified generation of App Group cache without fallback to older data',()=>{
  const dir='/group/CourseSync/CourseSync-v2';
  const files={
    appGroupDocumentsDirectory:'/group',
    existsSync:p=>p===dir,
    readDirectorySync:()=>['state-0000000002.json','state-0000000001.json','run-lock.json'],
    // Widget extension may not expose metadata queries; the reader must not require them.
    readAsStringSync:path=>path.endsWith('0000000002.json')?'{broken':JSON.stringify(make([]))
  };
  const broken=core.loadWidgetState(files);
  a.equal(broken.kind,'invalid');
  a.equal(broken.code,'CACHE_JSON');
  files.readAsStringSync=()=>JSON.stringify(make([]));
  a.equal(core.loadWidgetState(files).kind,'ready');
});

test('widget reads the same shared directory and state file as the sync engine without statSync',()=>{
 const target='/shared/CourseSync/CourseSync-v2';
 const expected=target+'/state-0000000372.json',seen=[];
 const f={
   appGroupDocumentsDirectory:'/shared',
   existsSync:p=>{seen.push('exists:'+p);return p===target;},
   readDirectorySync:p=>{seen.push('list:'+p);return [expected,'run-lock.json'];},
   readAsStringSync:p=>{seen.push('read:'+p);return JSON.stringify(make([
     ev('course','正常课程','2026-11-03T02:00:00Z','2026-11-03T04:15:00Z')
   ]));}
 };
 const result=core.loadWidgetState(f);
 a.equal(result.kind,'ready');
 a.equal(result.state.semesters['161'].events[0].title,'正常课程');
 a.deepEqual(seen,['exists:'+target,'list:'+target,'read:'+expected]);
});
test('widget diagnoses each cache failure stage without exposing any file contents',()=>{
 const dir='/shared/CourseSync/CourseSync-v2';
 const base={
   appGroupDocumentsDirectory:'/shared',
   existsSync:()=>true,
   readDirectorySync:()=>['state-0000000009.json'],
   readAsStringSync:()=>JSON.stringify(make([]))
 };
 a.equal(core.loadWidgetState({...base,appGroupDocumentsDirectory:undefined}).code,'GROUP_PATH');
 a.equal(core.loadWidgetState({...base,existsSync:()=>{throw Error('private path');}}).code,'CACHE_ACCESS');
 a.equal(core.loadWidgetState({...base,readDirectorySync:()=>{throw Error('private path');}}).code,'CACHE_LIST');
 a.equal(core.loadWidgetState({...base,readAsStringSync:()=>{throw Error('sensitive contents');}}).code,'CACHE_READ');
 a.equal(core.loadWidgetState({...base,readAsStringSync:()=>'{private contents'}).code,'CACHE_JSON');
 a.equal(core.loadWidgetState({...base,readAsStringSync:()=>JSON.stringify({version:2,semesters:{}})}).code,'CACHE_SCHEMA');
 a.equal(core.loadWidgetState({...base,readAsStringSync:()=> 'x'.repeat(4*1024*1024+1)}).code,'CACHE_SIZE');
 a.equal(core.loadWidgetState({...base,readDirectorySync:()=>[]}).code,'NO_STATE');
 const out=core.loadWidgetState({...base,existsSync:()=>false});
 a.equal(out.kind,'empty');a.equal(out.code,'NO_CACHE_DIR');
 const ui=fs.readFileSync(__dirname+'/../widget.tsx','utf8').replace(/\r\n/g,'\n');
 a.match(ui,/诊断：\{code\|\|'UNKNOWN'\}/);
});
test('private widget Storage mirror works even when FileManager has no App Group path',()=>{
 const mirror={version:1,lastCheck:'2026-11-02T18:00:00Z',events:[
   ev('a','今天上课','2026-11-03T05:30:00Z','2026-11-03T06:55:00Z')
 ]};
 const files={appGroupDocumentsDirectory:undefined};
 const storage={get:(key,opts)=>{a.equal(key,'CourseSync.Widget.Courses.v1');a.equal(opts,undefined);return mirror;}};
 const result=core.loadBestWidgetState(files,storage);
 a.equal(result.kind,'ready');
 a.equal(result.state.semesters.widget.events[0].title,'今天上课');
 const model=core.buildWidgetModel(result.state,date('2026-11-03T06:10:00Z'));
 a.equal(model.days[1].courses[0].status,'current');
});
test('missing private mirror explains opening the main project once',()=>{
 const result=core.loadBestWidgetState({appGroupDocumentsDirectory:undefined},{get:()=>null});
 a.equal(result.kind,'empty');a.equal(result.code,'OPEN_MAIN_ONCE');
});
test('broken Storage mirror never discloses data and can fall back to verified files',()=>{
 const valid={version:1,lastCheck:'2026-11-02T18:00:00Z',events:[]};
 a.equal(core.readWidgetMirror({get:()=>({events:[{password:'SECRET'}],version:1,lastCheck:valid.lastCheck})}).code,'STORAGE_SCHEMA');
 a.equal(core.readWidgetMirror({get:()=>{throw Error('SECRET');}}).code,'STORAGE_READ');
 const dir='/group/CourseSync/CourseSync-v2';
 const files={
   appGroupDocumentsDirectory:'/group',existsSync:path=>path===dir,
   readDirectorySync:()=>['state-0000000001.json'],
   readAsStringSync:()=>JSON.stringify(make([
     ev('a','回退课程','2026-11-03T05:30:00Z','2026-11-03T06:55:00Z')
   ]))
 };
 const fallback=core.loadBestWidgetState(files,{get:()=>null});
 a.equal(fallback.kind,'ready');
 a.equal(fallback.state.semesters['161'].events[0].title,'回退课程');
});
test('the full week stays visible from Monday through Sunday, including empty days',()=>{
 const state=make([
   ev('mon','周一课程','2026-11-02T01:00:00Z','2026-11-02T02:00:00Z'),
   ev('fri','周五课程','2026-11-06T01:00:00Z','2026-11-06T02:00:00Z'),
   ev('sun','周日课程','2026-11-08T01:00:00Z','2026-11-08T02:00:00Z')
 ]);
 const expected=['周一','周二','周三','周四','周五','周六','周日'];
 for(const [today,at] of [[0,'2026-11-02T05:00:00Z'],[2,'2026-11-04T05:00:00Z'],[6,'2026-11-08T05:00:00Z']]){
   const model=core.buildWidgetModel(state,date(at));
   a.deepEqual(Array.from(model.days,d=>d.label),expected);
   a.deepEqual(Array.from(model.days,d=>d.courses.length),[1,0,0,0,1,0,1]);
   a.equal(model.today,today);
   a.deepEqual(Array.from(model.days.filter(d=>d.today),d=>d.label),[expected[today]]);
 }
 a.deepEqual(Array.from(core.buildWidgetModel(make([]),date('2026-11-03T00:00:00Z')).days,d=>d.label),expected);
});

test('Sunday midnight in Beijing rolls over to the next week and excludes the previous Sunday',()=>{
 const state=make([
   ev('sun','周日课程','2026-11-08T01:00:00Z','2026-11-08T02:00:00Z'),
   ev('mon','周一课程','2026-11-08T16:00:00Z','2026-11-08T17:00:00Z')
 ]);
 const sunday=core.buildWidgetModel(state,date('2026-11-08T15:59:59Z'));
 a.deepEqual(Array.from(sunday.courses,c=>c.title),['周日课程']);
 a.equal(sunday.nextAt,date('2026-11-08T16:00:00Z'));
 const monday=core.buildWidgetModel(state,date('2026-11-08T16:00:00Z'));
 a.deepEqual(Array.from(monday.courses,c=>c.title),['周一课程']);
 a.equal(monday.days[0].dateLabel,'11/9');
 a.equal(monday.days[0].courses[0].status,'current');
});

test('a school week crosses the new year with accurate date labels',()=>{
 const model=core.buildWidgetModel(make([
   ev('old','周四课','2026-12-31T01:00:00Z','2026-12-31T02:00:00Z'),
   ev('new','周六课','2027-01-02T01:00:00Z','2027-01-02T02:00:00Z')
 ]),date('2027-01-01T00:00:00Z'));
 a.deepEqual(Array.from(model.days,d=>d.dateLabel),['12/28','12/29','12/30','12/31','1/1','1/2','1/3']);
 a.equal(model.days[3].courses[0].title,'周四课');
 a.equal(model.days[5].courses[0].title,'周六课');
});
test('overflow keeps courses chronological and shows today’s active course',()=>{
 const courses=['早课','第二节','第三节','第四节'].map((title,i)=>({
   title,status:i<2?'done':i===2?'current':'upcoming'
 }));
 const today={today:true,courses};
 const otherDay={today:false,courses};
 const titles=result=>Array.from(result.courses,course=>course.title);
 a.deepEqual(titles(core.selectVisibleCourses(otherDay,2)),['早课','第二节']);
 a.deepEqual(titles(core.selectVisibleCourses(today,1)),['第三节']);
 const two=core.selectVisibleCourses(today,2);
 a.deepEqual(titles(two),['第二节','第三节']);
 a.equal(two.hidden,2);
 const all=core.selectVisibleCourses(today,5);
 a.equal(all.courses.length,4);
 a.equal(all.hidden,0);
 a.equal(core.selectVisibleCourses({courses:[]},1).hidden,0);
});
test('widget has an adaptive canvas and simple plus-N remaining classes',()=>{
 const ui=fs.readFileSync(__dirname+'/../widget.tsx','utf8').replace(/\r\n/g,'\n');
 a.equal((ui.match(/widgetBackground=\{COLORS\.canvas\}/g)||[]).length,3);
 a.doesNotMatch(ui,/\+\{hidden\} 项/);
 a.doesNotMatch(ui,/自动定位|window\.position|#F7F9FD|#141E2C|#E8F0FF/);
});
test('teacher names appear from new mirror or older semester cache',()=>{
 const base=make([ev('a','新课','2026-11-03T05:30:00Z','2026-11-03T06:55:00Z')]);
 base.semesters['161'].events[0].teachers=['张老师','李老师'];
 let m=core.buildWidgetModel(base,date('2026-11-03T06:10:00Z'));
 a.equal(m.days[1].courses[0].teacher,'张老师、李老师');
 const cached={version:1,lastCheck:'2026-11-03T06:00:00Z',events:[{
   id:'t',title:'统计学',location:'A101',teacher:'高老师',
   start:'2026-11-03T05:30:00Z',end:'2026-11-03T06:55:00Z'
 }]};
 const read=core.loadBestWidgetState({appGroupDocumentsDirectory:undefined},{get:()=>cached});
 a.equal(read.kind,'ready');
 m=core.buildWidgetModel(read.state,date('2026-11-03T06:10:00Z'));
 a.equal(m.days[1].courses[0].teacher,'高老师');
 const legacy={...cached,events:[Object.fromEntries(Object.entries(cached.events[0]).filter(([k])=>k!=='teacher'))]};
 a.equal(core.readWidgetMirror({get:()=>legacy}).kind,'ready');
});
test('renderer measures actual widget geometry and omits overflow-prone footer',()=>{
 const ui=fs.readFileSync(__dirname+'/../widget.tsx','utf8').replace(/\r\n/g,'\n');
 a.match(ui,/GeometryReader/);
 a.match(ui,/proxy\.size\.width/);
 a.match(ui,/proxy\.size\.height/);
 a.match(ui,/const courses=day\.courses/);
 a.doesNotMatch(ui,/course\.teacher/);
 a.doesNotMatch(ui,/Widget\.displaySize/);
 a.doesNotMatch(ui,/下课后变灰 · 上课中高亮/);
});
test('production widget maps actual synced courses without invented timetable',()=>{
  const now=date('2026-11-03T02:45:00Z'); // Tuesday 10:45 Beijing
  const state=make([
    ev('mon1','周一原课程','2026-11-02T00:30:00Z','2026-11-02T02:05:00Z'),
    ev('tue1','第一节真实课程','2026-11-03T00:30:00Z','2026-11-03T02:05:00Z'),
    ev('tue2','第二节真实课程','2026-11-03T02:20:00Z','2026-11-03T03:55:00Z'),
    ev('tue3','第三节真实课程','2026-11-03T06:00:00Z','2026-11-03T07:35:00Z'),
    ev('tue4','第四节真实课程','2026-11-03T07:50:00Z','2026-11-03T09:25:00Z'),
    ev('wed1','周三原课程','2026-11-04T00:30:00Z','2026-11-04T02:05:00Z')
  ]);
  const model=core.buildWidgetModel(state,now);
  a.deepEqual(Array.from(model.days,d=>d.label),['周一','周二','周三','周四','周五','周六','周日']);
  a.deepEqual(Array.from(model.days,d=>d.courses.length),[1,4,1,0,0,0,0]);
  a.equal(model.days[0].courses[0].title,'周一原课程');
  a.equal(model.days[2].courses[0].title,'周三原课程');
  a.deepEqual(Array.from(model.days[1].courses,c=>c.status),
    ['done','current','upcoming','upcoming']);
  a.equal(model.at,now);
  a.equal(model.previewTerm,undefined);
  const focus=core.selectTodayCourse(model.days[1]);
  a.equal(focus.course.title,'第二节真实课程');
  a.equal(focus.remaining,2);
  const ui=fs.readFileSync(__dirname+'/../widget.tsx','utf8').replace(/\r\n/g,'\n');
  a.ok(ui.includes('buildWidgetModel(snapshot.state,Date.now())'));
  a.ok(!ui.includes('SHOW_SAMPLE_COURSES'));
  a.ok(!ui.includes('buildSamplePreview'));
});

test('the small widget follows the current, next and last appointment',()=>{
 const courses=[{title:'第一节',status:'current'},{title:'第二节',status:'upcoming'}];
 const select=()=>core.selectTodayCourse({courses});
 a.equal(select().course.title,'第一节');
 a.equal(select().remaining,1);
 courses[0].status='done';
 a.equal(select().course.title,'第二节');
 courses[1].status='current';
 a.equal(select().remaining,0);
 courses[1].status='done';
 a.equal(select().course.title,'第二节');
 a.equal(core.selectTodayCourse({courses:[]}).course,undefined);
 a.equal(core.selectTodayCourse({courses:[]}).remaining,0);
});
test('production widget always ignores old preview payloads',()=>{
  const now=date('2026-11-03T06:10:00Z');
  const live=make([ev('real','当期课程','2026-11-03T05:30:00Z','2026-11-03T06:55:00Z')]);
  const original=core.buildWidgetModel(live,now);
  a.equal(original.days[1].courses[0].title,'当期课程');
  a.equal(original.days[1].courses[0].status,'current');
  a.equal(original.at,now);
  live.preview={term:'2024-2025-2',events:[
    ev('past','历史学期','2025-03-03T05:30:00Z','2025-03-03T06:55:00Z')
  ]};
  const withPreview=core.buildWidgetModel(live,now);
  a.deepEqual(Array.from(withPreview.days[1].courses,x=>x.title),['当期课程']);
  a.equal(withPreview.previewTerm,undefined);
  a.equal(core.buildWidgetModel({preview:live.preview,semesters:{live:{events:[]}}},now)
    .days[1].courses.length,0);
});

test('private mirror reads real events and ignores legacy preview fields',()=>{
  const obj={version:1,lastCheck:'2026-11-02T07:00:00Z',
    events:[ev('real','真实课表','2026-11-03T05:30:00Z','2026-11-03T06:55:00Z')],
    preview:{term:'2024-2025-2',events:[{invalid:'legacy-data'}]}
  };
  const result=core.readWidgetMirror({get:()=>obj});
  a.equal(result.kind,'ready');
  a.equal(result.state.semesters.widget.events[0].title,'真实课表');
  a.equal(Object.hasOwn(result.state,'preview'),false);
});

test('classroom labels wrap long room numbers without losing characters',()=>{
 const ui=fs.readFileSync(__dirname+'/../widget.tsx','utf8');
 const wrap=vm.runInNewContext(ui.slice(ui.indexOf('function wrapLocation('),ui.indexOf('function CourseCard('))+'\nwrapLocation');
 for(const room of ['德业楼 Z4-110','博远楼 JC204','德经楼 Z1S204']){
   const wrapped=wrap(room,32);
   a.equal(wrapped.replace(/\n/g,''),room);
   a.ok(wrapped.includes('\n'));
   for(const line of wrapped.split('\n')){
     const width=Array.from(line).reduce((sum,c)=>sum+(/[\u0000-\u007f]/.test(c)?5.2:8),0);
     a.ok(width<=32.001);
   }
 }
 a.equal(wrap('',32),'');
});

test('weekly cards include the end time in medium and large layouts',()=>{
 const ui=fs.readFileSync(__dirname+'/../widget.tsx','utf8');
 const card=ui.slice(ui.indexOf('function CourseCard('),ui.indexOf('function DayColumn('));
 a.match(card,/const time=start\+\(\(compact\|\|stackTimes\)\?'\\n':'–'\)\+course\.endLabel/);
 a.match(card,/fixedSize=\{\{horizontal:false,vertical:true\}\}[\s\S]*?\{time\}/);
 a.doesNotMatch(card,/compact\?start:start/);
});
test('medium and large widgets draw the same seven days with status colors and chronological overflow',()=>{
 const ui=fs.readFileSync(__dirname+'/../widget.tsx','utf8');
 const panel=ui.slice(ui.indexOf('function WeeklyPanel('),ui.indexOf('function SmallPanel('));
 a.match(panel,/model\.days\.map\(day=><DayColumn/);
 a.match(ui,/day\.label/);
 a.match(ui,/day\.dateLabel/);
 a.doesNotMatch(ui,/\+\{hidden\} 项/);
 a.match(ui,/current\?COLORS.white:COLORS.dark/);
 a.match(ui,/\.padding\(compact\?3:4\)[\s\S]*?\.frame\(\{width,alignment:'topLeading'\}\)[\s\S]*?\.background/);
 a.match(ui,/course\.location\?<Text font=\{8\} fixedSize=\{\{horizontal:false,vertical:true\}\}/);
 a.match(ui,/exam\?'考 ':'/);
 a.doesNotMatch(ui,/近日课表|自动更新|昨天|明天/);
});

test('README documents weekday coverage in every home-screen size',()=>{
 const readme=fs.readFileSync(__dirname+'/../README.md','utf8');
 a.match(readme,/中尺寸.*周一到周日/);
 a.match(readme,/大尺寸.*七列周课表/);
 a.match(readme,/小尺寸.*周一到周日/);
 a.doesNotMatch(readme,/昨天、今天、明天|三日布局|!\[/);
});
test('missing cache is an honest empty state; widget never writes, authenticates or reads Keychain',()=>{
  const result=core.loadWidgetState({appGroupDocumentsDirectory:'/group',existsSync:()=>false});
  a.equal(result.kind,'empty');
  a.doesNotMatch(source,/\bKeychain\b|\.writeAsString|\.removeSync|\bfetch\(/);
  const widget=fs.readFileSync(__dirname+'/../widget.tsx','utf8');
  a.match(widget,/Widget\.present\(/);
  a.doesNotMatch(widget,/\bKeychain\b|\bCalendarEvent\b|fetch\(/);
});

test('systemSmall uses measured width and height without wasting space on spacers',()=>{
 const ui=fs.readFileSync(__dirname+'/../widget.tsx','utf8').replace(/\r\n/g,'\n');
 const section=ui.slice(ui.indexOf('function SmallPanel('),ui.indexOf('function EmptyPanel('));
 a.match(section,/proxy\.size\.width,height=proxy\.size\.height/);
 a.match(section,/cardWidth=Math\.max\(0,width-2\*inset\)/);
 a.match(section,/\.frame\(\{width:cardWidth,alignment:'topLeading'\}\)/);
 a.doesNotMatch(section,/<Spacer/);
 a.match(section,/lineLimit=\{accessory\?1:2\}/);
 a.match(section,/今天还有 \{remaining\} 项/);
 a.match(section,/chosen\.location\?/);
 a.match(section,/model\.days\.map\(day=><VStack/);
 a.match(section,/day\.courses\.length/);
 a.doesNotMatch(section,/chosen\.teacher/);
});
test('all course text and card surfaces adapt to dark mode',()=>{
 const ui=fs.readFileSync(__dirname+'/../widget.tsx','utf8').replace(/\r\n/g,'\n');
 for(const key of ['canvas','dark','blue','muted','faint','finished','doneBg','nextBg','activeBg','activeDetail']){
   a.match(ui,new RegExp(key+':\\{light:'));
 }
 a.match(ui,/canvas:\{light:'#FFFFFF',dark:'#000000'\}/);
 a.equal((ui.match(/widgetBackground=\{COLORS\.canvas\}/g)||[]).length,3);
 a.doesNotMatch(ui,/widgetBackground=\{\{light:'#FFFFFF',dark:'#FFFFFF'\}\}/);
});

test('dark mode has a pure black canvas with full-bleed root background for all families',()=>{
 const ui=fs.readFileSync(__dirname+'/../widget.tsx','utf8').replace(/\r\n/g,'\n');
 a.match(ui,/canvas:\{light:'#FFFFFF',dark:'#000000'\}/);
 a.equal((ui.match(/widgetBackground=\{COLORS\.canvas\}/g)||[]).length,3);
 a.equal((ui.match(/background=\{\{style:COLORS\.canvas\}\}/g)||[]).length,3);
 for(const [start,end] of [
  ['function WeeklyPanel(', 'function SmallPanel('],
  ['function SmallPanel(', 'function EmptyPanel('],
  ['function EmptyPanel(', 'const snapshot=']
 ]){
  const section=ui.slice(ui.indexOf(start),ui.indexOf(end));
  const root=section.indexOf('widgetBackground={COLORS.canvas}');
  const inner=section.indexOf('padding={',root);
  a.ok(root>=0&&inner>root,'full widget background must wrap padded content');
  a.match(section,/frame=\{\{maxWidth:'infinity',maxHeight:'infinity'/);
 }
});

test('all widget sizes hide teacher names without stripping teacher data from the model',()=>{
 const ui=fs.readFileSync(__dirname+'/../widget.tsx','utf8').replace(/\r\n/g,'\n');
 a.doesNotMatch(ui,/\{course\.teacher\}|\{chosen\.teacher\}|course\.teacher\s*&&|chosen\.teacher\s*&&/);
 a.match(ui,/course\.location/);
 a.match(ui,/course\.startLabel/);
 const model=core.buildWidgetModel(make([ev('a','课程','2026-11-04T00:20:00Z','2026-11-04T03:25:00Z')]),date('2026-11-04T01:00:00Z'));
 a.equal(model.days[2].courses[0].title,'课程');
});

test('weekly columns use all available height and retain every course',()=>{
 const ui=fs.readFileSync(__dirname+'/../widget.tsx','utf8');
 const layout=vm.runInNewContext(ui.slice(ui.indexOf('function weeklyLayout('),ui.indexOf('function WeeklyPanel('))+'\nweeklyLayout');
 for(const [width,height,compact] of [[275,140,true],[320,155,true],[330,330,false],[540,370,false]]){
   const result=layout(width,height,compact);
   const usedWidth=result.columnWidth*7+result.gap*6+result.inset*2;
   a.ok(usedWidth<=width&&width-usedWidth<7);
   a.equal(result.contentHeight,height-2*result.inset-28-result.gap);
 }
 const card=ui.slice(ui.indexOf('function CourseCard('),ui.indexOf('function DayColumn('));
 const day=ui.slice(ui.indexOf('function DayColumn('),ui.indexOf('function weeklyLayout('));
 a.doesNotMatch(card,/frame\(\{width,height,/);
 a.match(card,/fixedSize=\{\{horizontal:false,vertical:true\}\}/);
 a.doesNotMatch(card,/lineLimit=\{compact\?2:3\}/);
 a.match(day,/courses\.map\(course=>/);
 a.doesNotMatch(day,/selectVisibleCourses|\+\{hidden\}/);
});
test('active and finished card text is legible in both appearances',()=>{
 const ui=fs.readFileSync(__dirname+'/../widget.tsx','utf8');
 const start=ui.indexOf('const COLORS='),end=ui.indexOf('\n};',start);
 const colors=vm.runInNewContext(ui.slice(start,end+3)+'\nCOLORS');
 const luminance=hex=>{
   const linear=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255)
     .map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
   return linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722;
 };
 for(const scheme of ['light','dark']){
   for(const [fg,bg] of [
     [colors.white,colors.activeBg[scheme]], [colors.activeDetail[scheme],colors.activeBg[scheme]],
     [colors.finished[scheme],colors.doneBg[scheme]], [colors.muted[scheme],colors.doneBg[scheme]],
   ]){
     const [aLum,bLum]=[luminance(fg),luminance(bg)];
     a.ok((Math.max(aLum,bLum)+0.05)/(Math.min(aLum,bLum)+0.05)>=4.5,scheme+' '+fg+' on '+bg);
   }
 }
});
