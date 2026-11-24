// @ts-nocheck
// CourseSync Home Screen widget. This entry is independent of index.tsx:
// renders only the already synchronized local timetable snapshot.
import { FileManager, Widget, Text, VStack, HStack, GeometryReader, Script, modifiers } from 'scripting';
import { loadBestWidgetState, buildWidgetModel, selectTodayCourse, selectVisibleCourses, widgetReloadDate } from './widget-data';

// Scripting resolves DynamicShapeStyle against the current system appearance.
const COLORS={
  canvas:{light:'#FFFFFF',dark:'#000000'},
  dark:{light:'#203451',dark:'#F3F4F6'},
  blue:{light:'#2C69D1',dark:'#7DB4FF'},
  muted:{light:'#59677A',dark:'#AEB8C8'},
  faint:{light:'#536780',dark:'#BBC6D7'},
  finished:{light:'#536175',dark:'#A7B2C3'},
  doneBg:{light:'#E5E7EB',dark:'#343D4C'},
  nextBg:{light:'#EBF4FF',dark:'#243449'},
  activeBg:{light:'#185FC2',dark:'#215DB5'},
  activeDetail:{light:'#F0F7FF',dark:'#E7F2FF'},
  white:'#FFFFFF'
};

// Explicit breaks allow narrow cards to wrap room numbers as well as Chinese text.
function wrapLocation(value,width,fontSize=8){
  const maxWidth=Math.max(fontSize,width);
  let result='',lineWidth=0;
  for(const character of String(value||'')){
    if(character==='\n'){result+='\n';lineWidth=0;continue;}
    const charWidth=/[\u0000-\u007f]/.test(character)?fontSize*0.65:fontSize;
    if(lineWidth&&lineWidth+charWidth>maxWidth){result+='\n';lineWidth=0;}
    result+=character;
    lineWidth+=charWidth;
  }
  return result;
}

function CourseCard({course,layout,height}){
  const {columnWidth:width,cardPadding,minimumCardHeight,stackTimes}=layout;
  const done=course.status==='done',current=course.status==='current';
  const fg=done?COLORS.finished:current?COLORS.white:COLORS.dark;
  const bg=done?COLORS.doneBg:current?COLORS.activeBg:COLORS.nextBg;
  const detail=current?COLORS.activeDetail:done?COLORS.muted:COLORS.faint;
  const examPrefix='（考试）';
  const exam=course.title.startsWith(examPrefix);
  const title=exam?course.title.slice(examPrefix.length):course.title;
  const start=(exam?'考 ':'')+course.startLabel;
  const time=start+(stackTimes?'\n':'–')+course.endLabel;
  const availableWidth=width-2*cardPadding;
  const extra=height-minimumCardHeight;
  const titleFont=extra>=12?10:9;
  const titleLines=Math.min(1+Math.min(2,Math.floor(extra/12)),
    wrapLocation(title,availableWidth,titleFont).split('\n').length);
  const wrappedLocation=wrapLocation(course.location,availableWidth);
  const expandedLocation=extra>=36&&wrappedLocation.includes('\n');
  const roomCode=course.location.match(/(?:[A-Z]+\d-)?[A-Z]*\d{2,4}(?:-\d{1,2})?(?=室?$)/i)?.[0];
  const location=roomCode&&wrappedLocation.includes('\n')&&!expandedLocation?roomCode:wrappedLocation;
  const locationLines=expandedLocation?2:1;
  const cardHeight=minimumCardHeight+(titleLines-1)*12+(locationLines-1)*10-(location?0:10);
  const cardStyle=modifiers().padding(cardPadding)
    .frame({width,height:cardHeight,alignment:'topLeading'})
    .background({style:bg,shape:{type:'rect',cornerRadius:6}});
  return <VStack alignment="leading" spacing={1} modifiers={cardStyle}>
    <Text font={titleFont} fontWeight="semibold" lineLimit={titleLines}
      multilineTextAlignment="leading" foregroundStyle={fg}>{title}</Text>
    <Text font={8} foregroundStyle={detail} lineLimit={stackTimes?2:1}
      multilineTextAlignment="leading" minScaleFactor={0.8}>{time}</Text>
    {location?<Text font={8} lineLimit={locationLines}
      multilineTextAlignment="leading" foregroundStyle={detail}>{location}</Text>:null}
  </VStack>;
}

function fitWeekDay(layout,count){
  const {contentHeight,gap,minimumCardHeight}=layout;
  const capacity=Math.floor((contentHeight+gap)/(minimumCardHeight+gap));
  const footer=count>capacity?10+gap:0;
  const limit=Math.min(count,Math.max(0,Math.floor((contentHeight-footer+gap)/(minimumCardHeight+gap))));
  const height=limit?Math.min(minimumCardHeight+42,Math.floor((contentHeight-footer-gap*(limit-1))/limit)):0;
  return {limit,height};
}

function DayColumn({day,layout}){
  const {columnWidth,gap}=layout;
  const {limit,height}=fitWeekDay(layout,day.courses.length);
  const {courses,hidden}=selectVisibleCourses(day,limit);
  const headingStyle=modifiers().frame({width:columnWidth,height:28})
    .background({style:day.today?COLORS.nextBg:COLORS.canvas,shape:{type:'rect',cornerRadius:6}});
  return <VStack alignment="center" spacing={gap} frame={{width:columnWidth,alignment:'top'}}>
    <VStack spacing={1} modifiers={headingStyle}>
      <Text font={11} fontWeight="bold" foregroundStyle={day.today?COLORS.blue:COLORS.dark}>{day.label}</Text>
      <Text font={9} foregroundStyle={COLORS.faint}>{day.dateLabel}</Text>
    </VStack>
    {courses.map(course=><CourseCard key={course.id} course={course} layout={layout} height={height}/>)}
    {hidden>0?<Text font={8} foregroundStyle={COLORS.faint} frame={{height:10}}>+{hidden}</Text>:null}
    {day.courses.length===0?<Text font={10} foregroundStyle={COLORS.muted}>—</Text>:null}
  </VStack>;
}

// Share the available height among each day's courses.
function weeklyLayout(width,height,compact){
  const inset=compact?9:12,gap=compact?3:4;
  const cardPadding=compact?2:3;
  const columnWidth=Math.max(1,Math.floor((width-2*inset-6*gap)/7));
  const stackTimes=columnWidth<57;
  const minimumCardHeight=(stackTimes?41:31)+2*cardPadding;
  const contentHeight=Math.max(0,height-2*inset-28-gap);
  return {inset,gap,cardPadding,columnWidth,contentHeight,minimumCardHeight,stackTimes};
}

function WeeklyPanel({model,family}){
  const compact=family==='systemMedium';
  return <GeometryReader>
    {proxy=>{
      const layout=weeklyLayout(proxy.size.width,proxy.size.height,compact);
      return <VStack spacing={0} widgetBackground={COLORS.canvas}
        background={{style:COLORS.canvas}}
        frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'topLeading'}}>
        <VStack padding={layout.inset} spacing={layout.gap}
          frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'top'}}>
          <HStack alignment="top" spacing={layout.gap}>
            {model.days.map(day=><DayColumn key={day.label} day={day} layout={layout}/>)}
          </HStack>
          {model.empty?<Text font={11} foregroundStyle={COLORS.faint}>本周暂无课程和考试</Text>:null}
        </VStack>
      </VStack>;
    }}
  </GeometryReader>;
}

function SmallPanel({model}){
  const today=model.days[model.today];
  const {course:chosen,remaining}=selectTodayCourse(today);
  const active=chosen?.status==='current',done=chosen?.status==='done';
  const bg=active?COLORS.activeBg:done?COLORS.doneBg:COLORS.nextBg;
  const fg=active?COLORS.white:done?COLORS.finished:COLORS.dark;
  const detail=active?COLORS.activeDetail:done?COLORS.muted:COLORS.faint;
  return <GeometryReader>
    {proxy=>{
      const width=proxy.size.width,height=proxy.size.height;
      const inset=height<155?9:12,gap=2;
      const cardWidth=Math.max(0,width-2*inset);
      const dayWidth=Math.max(1,Math.floor((cardWidth-6*gap)/7));
      const cardStyle=modifiers().padding(6)
        .frame({width:cardWidth,alignment:'topLeading'})
        .background({style:bg,shape:{type:'rect',cornerRadius:8}});
      return <VStack spacing={0} widgetBackground={COLORS.canvas}
        background={{style:COLORS.canvas}}
        frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'topLeading'}}>
        <VStack alignment="leading" spacing={4} padding={inset}
          frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'topLeading'}}>
          <HStack spacing={gap}>
            {model.days.map(day=><VStack key={day.label} spacing={1}
              frame={{width:dayWidth}}
              background={day.today?{style:COLORS.nextBg,shape:{type:'rect',cornerRadius:4}}:undefined}>
              <Text font={10} fontWeight={day.today?'bold':'regular'}
                foregroundStyle={day.today?COLORS.blue:COLORS.dark}>{day.label.slice(1)}</Text>
              <Text font={9} foregroundStyle={COLORS.faint}>{day.courses.length||'–'}</Text>
            </VStack>)}
          </HStack>
          {chosen?<VStack alignment="leading" spacing={2} modifiers={cardStyle}>
            <Text font={13} fontWeight="semibold" lineLimit={2}
              foregroundStyle={fg}>{chosen.title}</Text>
            <Text font={10} lineLimit={1} minScaleFactor={0.85}
              foregroundStyle={detail}>{chosen.startLabel}–{chosen.endLabel}</Text>
            {chosen.location?<Text font={10} lineLimit={1}
              foregroundStyle={detail}>{chosen.location}</Text>:null}
          </VStack>:<Text font={11} foregroundStyle={COLORS.faint}>今天没有课程和考试</Text>}
          {remaining>0?<Text font={9} foregroundStyle={COLORS.faint}>今天还有 {remaining} 项</Text>:null}
        </VStack>
      </VStack>;
    }}
  </GeometryReader>;
}

function AccessoryPanel({model,family}){
  const course=model?selectTodayCourse(model.days[model.today]).course:null;
  const empty=model?'今日无安排':'课表待同步';
  if(family==='accessoryInline')
    return <Text>{course?course.startLabel+' '+course.title:empty}</Text>;
  const status=course?.status==='current'?'进行中':course?.status==='done'?'已结束':'下一项';
  if(family==='accessoryCircular')
    return <VStack spacing={1}>
      <Text font={12} fontWeight="semibold">{course?.startLabel||(model?'无安排':'待同步')}</Text>
      {course?<Text font={9}>{status}</Text>:null}
    </VStack>;
  return <VStack alignment="leading" spacing={2}>
    <Text font={12} fontWeight="semibold" lineLimit={1}>{course?.title||empty}</Text>
    {course?<Text font={10} lineLimit={1}>{course.startLabel}–{course.endLabel} · {status}</Text>:null}
    {course?.location?<Text font={10} lineLimit={1}>{course.location}</Text>:null}
  </VStack>;
}

function EmptyPanel({kind='empty',code=''}) {
  const failure=kind==='invalid';
  const label=code==='CACHE_EXPIRED'?'小组件日程待刷新':failure?'暂时无法显示日程':'暂无同步记录';
  const guidance=code==='CACHE_EXPIRED'?'打开 CourseSync 并刷新课表。':
    code==='OPEN_MAIN_ONCE'?'打开一次 CourseSync 即可显示日程。':
    failure?'打开 CourseSync 刷新后再查看。':'打开 CourseSync 完成首次同步。';
  return <VStack spacing={0}
    widgetBackground={COLORS.canvas}
    background={{style:COLORS.canvas}}
    frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'center'}}>
    <VStack alignment="center" spacing={8} padding={16}
      frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'center'}}>
    <Text font={16} fontWeight="bold" foregroundStyle={COLORS.dark}>CourseSync</Text>
    <Text font={12} fontWeight="medium" foregroundStyle={COLORS.faint}>{label}</Text>
    <Text font={11} foregroundStyle={COLORS.faint} lineLimit={3} multilineTextAlignment="center">{guidance}</Text>
    {failure?<Text font={10} foregroundStyle={COLORS.muted}>诊断：{code||'UNKNOWN'}</Text>:null}
    </VStack>
  </VStack>;
}

const snapshot=loadBestWidgetState(FileManager,typeof Storage!=='undefined'?Storage:null);
const family=Widget.family;
const accessory=String(family).startsWith('accessory');
if(snapshot.kind!=='ready'){
  Widget.present(accessory?<AccessoryPanel family={family}/>:<EmptyPanel kind={snapshot.kind} code={snapshot.code}/>,
    {policy:'after',date:new Date(Date.now()+2*60*60*1000)});
}else{
  const model=buildWidgetModel(snapshot.state,Date.now());
  const stale=model.empty&&model.outdated;
  Widget.present(accessory?<AccessoryPanel model={stale?null:model} family={family}/>:
    stale?<EmptyPanel code="CACHE_EXPIRED"/>:
      family==='systemSmall'?<SmallPanel model={model}/>:<WeeklyPanel model={model} family={family}/>,
    {policy:'after',date:widgetReloadDate(model)});
}

// Required by the Scripting widget lifecycle after presenting the view.
Script.exit();
