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

// Measure all fields instead of assigning each an arbitrary one-line limit.
function measureCourseCard(course,width,padding,titleFont,detailFont,stackTimes){
  const availableWidth=Math.max(1,width-2*padding-1);
  const title=wrapLocation(course.title.replace(/^（考试）/,'考 '),availableWidth,titleFont);
  const location=wrapLocation(course.location,availableWidth,detailFont);
  const time=stackTimes?course.startLabel+'\n'+course.endLabel:course.startLabel+'–'+course.endLabel;
  const lines=value=>value?value.split('\n').length:0;
  const titleLines=lines(title),locationLines=lines(location),timeLines=stackTimes?2:1;
  const height=2*padding+titleLines*Math.ceil(titleFont*1.3)+
    (timeLines+locationLines)*Math.ceil(detailFont*1.3)+(location?2:1)+2;
  return {title,location,time,titleLines,locationLines,timeLines,titleFont,detailFont,height};
}
function CourseCard({course,layout,card}){
  const {columnWidth:width,cardPadding}=layout;
  const done=course.status==='done',current=course.status==='current';
  const fg=done?COLORS.finished:current?COLORS.white:COLORS.dark;
  const bg=done?COLORS.doneBg:current?COLORS.activeBg:COLORS.nextBg;
  const detail=current?COLORS.activeDetail:done?COLORS.muted:COLORS.faint;
  const {title,location,time,titleLines,locationLines,timeLines,titleFont,detailFont,height:cardHeight}=card;
  const cardStyle=modifiers().padding(cardPadding)
    .frame({width,height:cardHeight,alignment:'topLeading'})
    .background({style:bg,shape:{type:'rect',cornerRadius:6}});
  return <VStack alignment="leading" spacing={1} modifiers={cardStyle}>
    <Text font={titleFont} fontWeight="semibold" lineLimit={titleLines}
      minScaleFactor={0.9} multilineTextAlignment="leading" foregroundStyle={fg}>{title}</Text>
    <Text font={detailFont} foregroundStyle={detail} lineLimit={timeLines}
      multilineTextAlignment="leading" minScaleFactor={0.8}>{time}</Text>
    {location?<Text font={detailFont} lineLimit={locationLines} minScaleFactor={0.9}
      multilineTextAlignment="leading" foregroundStyle={detail}>{location}</Text>:null}
  </VStack>;
}
// Reserve overflow space and fit whole cards, prioritizing today's active/next course.
function fitWeekDay(layout,day){
  const {contentHeight,gap,columnWidth,cardPadding,stackTimes}=layout;
  const count=day.courses.length;
  const sizes=layout.compact?[[9,8],[8,7]]:[[11,9],[10,8],[9,8],[8,7]];
  for(let limit=Math.min(count,Math.floor((contentHeight+gap)/(25+gap)));limit>0;limit--){
    const {courses,hidden}=selectVisibleCourses(day,limit);
    const footer=hidden?12+gap:0;
    for(const [titleFont,detailFont] of sizes){
      const cards=courses.map(course=>measureCourseCard(course,columnWidth,cardPadding,titleFont,detailFont,stackTimes));
      const height=cards.reduce((sum,card)=>sum+card.height,0)+gap*(limit-1)+footer;
      if(height<=contentHeight)return {courses,cards,hidden,height};
    }
  }
  return {courses:[],cards:[],hidden:count,height:count?12:0};
}

function DayColumn({day,layout}){
  const {columnWidth,gap}=layout;
  const {courses,cards,hidden}=fitWeekDay(layout,day);
  const headingStyle=modifiers().frame({width:columnWidth,height:28})
    .background({style:day.today?COLORS.nextBg:COLORS.canvas,shape:{type:'rect',cornerRadius:6}});
  return <VStack alignment="center" spacing={gap} frame={{width:columnWidth,alignment:'top'}}>
    <VStack spacing={1} modifiers={headingStyle}>
      <Text font={11} fontWeight="bold" foregroundStyle={day.today?COLORS.blue:COLORS.dark}>{day.label}</Text>
      <Text font={9} foregroundStyle={COLORS.faint}>{day.dateLabel}</Text>
    </VStack>
    {courses.map((course,index)=><CourseCard key={course.id} course={course} layout={layout} card={cards[index]}/>)}
    {hidden>0?<Text font={9} foregroundStyle={COLORS.faint} frame={{height:12}}>+{hidden}</Text>:null}
    {day.courses.length===0?<Text font={10} foregroundStyle={COLORS.muted}>—</Text>:null}
  </VStack>;
}

// Share the available height among each day's courses.
function weeklyLayout(width,height,compact){
  const inset=compact?5:9,gap=compact?2:3;
  const cardPadding=compact?1:2;
  const columnWidth=Math.max(1,Math.floor((width-2*inset-6*gap)/7));
  const stackTimes=columnWidth-2*cardPadding<76;
  const contentHeight=Math.max(0,height-2*inset-28-gap);
  return {inset,gap,cardPadding,columnWidth,contentHeight,stackTimes,compact};
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
      const cardBudget=Math.max(0,height-2*inset-30-(remaining>0?16:0));
      const card=chosen?[13,12,11,10].map(font=>measureCourseCard(
        chosen,cardWidth,6,font,Math.min(10,font-1),false
      )).find(item=>item.height<=cardBudget):null;
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
          {chosen&&card?<VStack alignment="leading" spacing={1} modifiers={cardStyle}>
            <Text font={card.titleFont} fontWeight="semibold" lineLimit={card.titleLines}
              minScaleFactor={0.9} foregroundStyle={fg}>{card.title}</Text>
            <Text font={card.detailFont} lineLimit={card.timeLines} minScaleFactor={0.85}
              foregroundStyle={detail}>{card.time}</Text>
            {card.location?<Text font={card.detailFont} lineLimit={card.locationLines}
              minScaleFactor={0.9} foregroundStyle={detail}>{card.location}</Text>:null}
          </VStack>:<Text font={11} foregroundStyle={COLORS.faint}>{chosen?'日程过长，请查看日历':'今天没有课程和考试'}</Text>}
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
