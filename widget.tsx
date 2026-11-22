// @ts-nocheck
// CourseSync Home Screen widget. This entry is independent of index.tsx:
// renders only the already synchronized local timetable snapshot.
import { FileManager, Widget, Text, VStack, HStack, GeometryReader, Script, modifiers } from 'scripting';
import { loadBestWidgetState, buildWidgetModel, selectTodayCourse, widgetReloadDate } from './widget-data';

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

function CourseCard({course,width,height,compact,stackTimes}){
  const done=course.status==='done',current=course.status==='current';
  const fg=done?COLORS.finished:current?COLORS.white:COLORS.dark;
  const bg=done?COLORS.doneBg:current?COLORS.activeBg:COLORS.nextBg;
  const detail=current?COLORS.activeDetail:done?COLORS.muted:COLORS.faint;
  const examPrefix='（考试）';
  const exam=course.title.startsWith(examPrefix);
  const title=exam?course.title.slice(examPrefix.length):course.title;
  const start=(exam?'考 ':'')+course.startLabel;
  const time=compact?start:start+(stackTimes?'\n':'–')+course.endLabel;
  const chars=Array.from(title).length;
  const availableWidth=Math.max(1,width-(compact?6:8));
  const availableHeight=Math.max(1,height-(compact?20:stackTimes?34:25));
  const titleFont=Math.max(5,Math.min(compact?10:11,
    Math.floor(Math.sqrt(availableWidth*availableHeight/Math.max(1,chars)*0.8))));
  const cardStyle=modifiers().padding(compact?3:4)
    .frame({width,height,alignment:'topLeading'})
    .background({style:bg,shape:{type:'rect',cornerRadius:6}});
  return <VStack alignment="leading" spacing={2} modifiers={cardStyle}>
    <Text font={titleFont} fontWeight="semibold" fixedSize={{horizontal:false,vertical:true}}
      multilineTextAlignment="leading" foregroundStyle={fg}>{title}</Text>
    <Text font={8} foregroundStyle={detail} lineLimit={stackTimes?2:1}
      minScaleFactor={0.8}>{time}</Text>
    {!compact&&course.location?<Text font={9} lineLimit={1}
      foregroundStyle={detail}>{course.location}</Text>:null}
  </VStack>;
}

function DayColumn({day,layout,compact}){
  const {columnWidth,gap,contentHeight,stackTimes}=layout;
  const courses=day.courses;
  const cardHeight=courses.length?Math.max(1,Math.floor((contentHeight-gap*courses.length)/courses.length)):0;
  const headingStyle=modifiers().frame({width:columnWidth,height:28})
    .background({style:day.today?COLORS.nextBg:COLORS.canvas,shape:{type:'rect',cornerRadius:6}});
  return <VStack alignment="center" spacing={gap} frame={{width:columnWidth,alignment:'top'}}>
    <VStack spacing={1} modifiers={headingStyle}>
      <Text font={11} fontWeight="bold" foregroundStyle={day.today?COLORS.blue:COLORS.dark}>{day.label}</Text>
      <Text font={9} foregroundStyle={COLORS.faint}>{day.dateLabel}</Text>
    </VStack>
    {courses.length?courses.map(course=>
      <CourseCard key={course.id} course={course} width={columnWidth} height={cardHeight}
        compact={compact} stackTimes={stackTimes}/>)
      :<Text font={10} foregroundStyle={COLORS.muted}>—</Text>}
  </VStack>;
}

// Share the available height among each day's courses.
function weeklyLayout(width,height,compact){
  const inset=compact?9:12,gap=compact?3:4;
  const columnWidth=Math.max(1,Math.floor((width-2*inset-6*gap)/7));
  const stackTimes=!compact&&columnWidth<58;
  const contentHeight=Math.max(0,height-2*inset-28-gap);
  return {inset,gap,columnWidth,contentHeight,stackTimes};
}

function WeeklyPanel({model,family}){
  const compact=family==='systemMedium';
  return <GeometryReader>
    {proxy=>{
      const layout=weeklyLayout(proxy.size.width,proxy.size.height,compact);
      return <VStack spacing={0} widgetBackground={COLORS.canvas}
        background={{style:COLORS.canvas}}
        frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'topLeading'}}>
        <VStack padding={layout.inset}
          frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'top'}}>
          <HStack alignment="top" spacing={layout.gap}>
            {model.days.map(day=><DayColumn key={day.label} day={day} layout={layout} compact={compact}/>)}
          </HStack>
        </VStack>
      </VStack>;
    }}
  </GeometryReader>;
}

function SmallPanel({model,accessory}){
  const today=model.days[model.today];
  const {course:chosen,remaining}=selectTodayCourse(today);
  const active=chosen?.status==='current',done=chosen?.status==='done';
  const bg=active?COLORS.activeBg:done?COLORS.doneBg:COLORS.nextBg;
  const fg=active?COLORS.white:done?COLORS.finished:COLORS.dark;
  const detail=active?COLORS.activeDetail:done?COLORS.muted:COLORS.faint;
  return <GeometryReader>
    {proxy=>{
      const width=proxy.size.width,height=proxy.size.height;
      const inset=accessory?2:height<155?9:12,gap=2;
      const cardWidth=Math.max(0,width-2*inset);
      const dayWidth=Math.max(1,Math.floor((cardWidth-6*gap)/7));
      const cardStyle=modifiers().padding(accessory?2:6)
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
            <Text font={accessory?10:13} fontWeight="semibold" lineLimit={accessory?1:2}
              foregroundStyle={fg}>{chosen.title}</Text>
            <Text font={10} lineLimit={1} minScaleFactor={0.85}
              foregroundStyle={detail}>{chosen.startLabel}–{chosen.endLabel}</Text>
            {!accessory&&chosen.location?<Text font={10} lineLimit={1}
              foregroundStyle={detail}>{chosen.location}</Text>:null}
          </VStack>:<Text font={11} foregroundStyle={COLORS.faint}>今天没有课程和考试</Text>}
          {!accessory&&remaining>0?<Text font={9} foregroundStyle={COLORS.faint}>今天还有 {remaining} 项</Text>:null}
        </VStack>
      </VStack>;
    }}
  </GeometryReader>;
}

function EmptyPanel({kind='empty',code=''}) {
  const failure=kind==='invalid';
  const label=failure?'暂时无法显示日程':'暂无同步记录';
  const guidance=code==='OPEN_MAIN_ONCE'?'打开一次 CourseSync 即可显示日程。':
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
if(snapshot.kind!=='ready'){
  Widget.present(<EmptyPanel kind={snapshot.kind} code={snapshot.code}/>,
    {policy:'after',date:new Date(Date.now()+2*60*60*1000)});
}else{
  const model=buildWidgetModel(snapshot.state,Date.now());
  const family=Widget.family;
  const accessory=String(family).startsWith('accessory');
  Widget.present(family==='systemSmall'||accessory
    ?<SmallPanel model={model} accessory={accessory}/>
    :<WeeklyPanel model={model} family={family}/>,
    {policy:'after',date:widgetReloadDate(model)});
}

// Required by the Scripting widget lifecycle after presenting the view.
Script.exit();
