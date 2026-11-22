// @ts-nocheck
// CourseSync Home Screen widget. This entry is independent of index.tsx:
// renders only the already synchronized local timetable snapshot.
import { FileManager, Widget, Text, VStack, HStack, Spacer, GeometryReader, Script, modifiers } from 'scripting';
import { loadBestWidgetState, buildWidgetModel, selectVisibleCourses, selectTodayPair, selectTodayColumns, widgetReloadDate } from './widget-data';

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

// Narrow neighbor columns need explicit CJK line breaks. SwiftUI otherwise
// gives the long detail stack priority and truncates the title to one line.
function formatSideTitle(title,maxChars=4){
  const value=String(title||'');
  const chars=Array.from(value);
  if(chars.length<=maxChars||!/[㐀-鿿]/.test(value))return value;
  const lines=Math.ceil(chars.length/maxChars);
  const chunks=[];
  for(let i=0;i<lines;i++){
    const count=Math.ceil((chars.length)/ (lines-i));
    chunks.push(chars.splice(0,count).join(''));
  }
  return chunks.join('\n');
}

function CourseCard({course,compact=false,width,density='normal',tight=false}){
  // Larger single today card; compact side-by-side today cards.
  const smallText=density==='pair',largeText=density==='single';
  const isSide=density==='side';
  // Enlarge readable text without overflowing narrow two-card layouts.
  const titleSize=smallText?(compact?10:11):largeText?(compact?15:17):(compact?13:15);
  const detailSize=smallText?(compact?9:10):largeText?(compact?12:13):(compact?11:12);
  const cardPadding=isSide?4:smallText?5:compact?7:8;
  const sideFont=compact?12:13,sideDetailFont=compact?9:10;
  const sideTitleWidth=Math.max(3,Math.floor((width-cardPadding*2)/sideFont));
  const detailsColor=course.status==='current'?COLORS.activeDetail:
    course.status==='done'?COLORS.muted:COLORS.faint;
  const done=course.status==='done',current=course.status==='current';
  const fg=done?COLORS.finished:current?COLORS.white:COLORS.dark;
  const bg=done?COLORS.doneBg:current?COLORS.activeBg:COLORS.nextBg;
  // Modifier order matters: paint the rounded background AFTER sizing the
  // card so the background fills the fixed-width frame.
  const cardStyle=modifiers()
    .padding(cardPadding)
    .frame(width?{width,alignment:'topLeading'}:{maxWidth:'infinity',alignment:'topLeading'})
    .background({style:bg,shape:{type:'rect',cornerRadius:9}});
  return <VStack key={course.id} alignment="leading" spacing={smallText?2:3}
      modifiers={cardStyle}>
    <Text font={isSide?sideFont:titleSize} fontWeight={current?'bold':'semibold'}
      lineLimit={tight?3:smallText?4:5} minScaleFactor={isSide?0.85:1}
      fixedSize={{horizontal:false,vertical:true}}
      multilineTextAlignment="leading" foregroundStyle={fg}>
      {isSide?formatSideTitle(course.title,sideTitleWidth):course.title}
    </Text>
    <Text font={isSide?sideDetailFont:detailSize} foregroundStyle={detailsColor}
      lineLimit={isSide?1:2} minScaleFactor={isSide?0.72:1}>
      {course.startLabel+'–'+course.endLabel}
    </Text>
    {course.location?<Text font={isSide?sideDetailFont:detailSize}
      foregroundStyle={detailsColor}
      lineLimit={tight?1:isSide?2:3} fixedSize={{horizontal:false,vertical:true}}
      multilineTextAlignment="leading">{isSide&&!tight?String(course.location).replace(/\s+/, '\n'):course.location}</Text>:null}
  </VStack>;
}

function DayHeading({day,compact,width}){
  const dayColor=day.today?COLORS.blue:COLORS.dark;
  return <VStack spacing={2} frame={{width}} padding={{top:1,bottom:3}}>
    <Text font={compact?16:18} fontWeight="bold" foregroundStyle={dayColor}>{day.label}</Text>
    <Text font={compact?10:11} foregroundStyle={COLORS.faint}
      lineLimit={1} minScaleFactor={0.85}>{day.weekday} {day.dateLabel}</Text>
  </VStack>;
}

function DayColumn({day,width,compact=false,maxRows=1,emphasize=false,tight=false}){
  const window=selectVisibleCourses(day,maxRows);
  return <VStack key={String(day.index)} alignment="center" spacing={compact?4:7}
    frame={{width,alignment:'top'}}>
    <DayHeading day={day} compact={compact} width={width}/>
    {window.courses.length?window.courses.map(c=>
      <HStack key={c.id} alignment="top" spacing={0}
        frame={{width,alignment:'center'}}>
        <Spacer minLength={0}/>
        <CourseCard course={c} compact={compact} width={width-8}
          tight={tight||window.courses.length>1}
          density={emphasize?'single':'side'}/>
        <Spacer minLength={0}/>
      </HStack>):
      <Text font={12} foregroundStyle={COLORS.muted}>无安排</Text>}
    {window.hiddenAfter>0?
      <Text font={compact?10:11} foregroundStyle={COLORS.faint}>
        +{window.hiddenAfter} 项
      </Text>:null}
  </VStack>;
}

// The left side holds exactly the current (or next) class. The right side
// stacks later upcoming classes; completed lessons are intentionally omitted.
function TodayPairColumn({day,width,compact=false,gap=5,maxFuture=1,tight=false}){
  const columns=selectTodayColumns(day,maxFuture);
  const cardWidth=Math.max(25,Math.floor((width-gap)/2));
  return <VStack alignment="center" spacing={compact?4:5}
      frame={{width,alignment:'top'}}>
    <DayHeading day={day} compact={compact} width={width}/>
    <HStack alignment="top" spacing={gap} frame={{width,alignment:'topLeading'}}>
      <VStack frame={{width:cardWidth,alignment:'topLeading'}}>
        {columns.focus?<CourseCard course={columns.focus} compact={compact}
          width={cardWidth} density="pair" tight={tight}/>:null}
      </VStack>
      <VStack alignment="center" spacing={compact?4:6}
          frame={{width:cardWidth,alignment:'top'}}>
        {columns.future.map(c=>
          <CourseCard key={c.id} course={c} compact={compact}
            width={cardWidth} density="pair" tight={tight||columns.future.length>1}/>)}
        {columns.hiddenAfter>0?<Text font={compact?10:11}
          foregroundStyle={COLORS.faint}>+{columns.hiddenAfter} 项</Text>:null}
      </VStack>
    </HStack>
  </VStack>;
}

// GeometryReader measures the actual widget CONTENT rect, rather than the
// screen's width. A conservative inset prevents clipping at rounded corners.
function rollingLayout(width,height,medium,todayCount){
  const safeInset=medium?9:12,gap=medium?4:6;
  const usableWidth=Math.max(0,width-2*safeInset-2*gap);
  const sideShare=todayCount===0?1/3:todayCount>1?0.24:medium?0.30:0.265;
  const sideWidth=Math.floor(usableWidth*sideShare);
  const todayWidth=usableWidth-sideWidth*2;
  const maxRows=medium?1:height>=340?3:height>=245?2:1;
  return {safeInset,gap,sideWidth,todayWidth,maxRows,tight:height<155};
}

function RollingPanel({model,family}){
  const medium=family==='systemMedium';
  return <GeometryReader>
    {proxy=>{
      const width=proxy.size.width,height=proxy.size.height;
      // Exactly three day groups; headings and cards share the same center.
      const days=model.days.slice(0,3);
      const today=days.find(d=>d.today);
      const todayFocus=selectTodayPair(today);
      const expanded=todayFocus.courses.length>1;
      const {safeInset,gap,sideWidth,todayWidth,maxRows,tight}=rollingLayout(width,height,medium,todayFocus.courses.length);
      // Paint the full measured widget rectangle first; only the inner
      // layout receives insets. This prevents an exposed host-color strip.
      return <VStack spacing={0}
        widgetBackground={COLORS.canvas}
        background={{style:COLORS.canvas}}
        frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'topLeading'}}>
        <VStack alignment="leading" spacing={0} padding={safeInset}
          frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'topLeading'}}>
          <HStack alignment="top" spacing={gap}
            frame={{maxWidth:'infinity',alignment:'leading'}}>
          {days.map(day=>day.today&&expanded
            ?<TodayPairColumn key="today-pair" day={day}
              width={todayWidth} compact={medium} gap={gap}
              maxFuture={maxRows} tight={tight}/>
            :<DayColumn key={String(day.index)}
              day={day.today?{...day,courses:todayFocus.courses}:day}
              width={day.today?todayWidth:sideWidth}
              compact={medium} maxRows={maxRows} tight={tight}
              emphasize={day.today&&!expanded}/> )}
          </HStack>
        </VStack>
      </VStack>;
    }}
  </GeometryReader>;
}

// systemSmall has much less vertical space than medium widgets. Avoid a
// centered intrinsic-width card or Spacer stacks that steal its available room.
function SmallPanel({model}){
  const today=model.days.find(d=>d.today);
  const {focus:chosen,hiddenAfter:remaining}=selectTodayColumns(today,0);
  const done=chosen?.status==='done',active=chosen?.status==='current';
  const bg=done?COLORS.doneBg:active?COLORS.activeBg:COLORS.nextBg;
  const fg=done?COLORS.finished:active?COLORS.white:COLORS.dark;
  const detail=active?COLORS.activeDetail:done?COLORS.muted:COLORS.faint;
  return <GeometryReader>
    {proxy=>{
      const width=proxy.size.width,height=proxy.size.height;
      const inset=height<155?10:12,cardWidth=Math.max(0,width-2*inset);
      const tight=height<160;
      // Card background is applied after its explicit frame, like medium cards.
      const cardStyle=modifiers().padding(tight?7:9)
        .frame({width:cardWidth,alignment:'topLeading'})
        .background({style:bg,shape:{type:'rect',cornerRadius:10}});
      return <VStack spacing={0}
        widgetBackground={COLORS.canvas}
        background={{style:COLORS.canvas}}
        frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'topLeading'}}>
        <VStack alignment="leading" spacing={tight?5:7} padding={inset}
          frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'topLeading'}}>
        <HStack alignment="center" spacing={8}>
          <Text font={tight?17:19} fontWeight="bold" foregroundStyle={COLORS.dark}>今天</Text>
          <Text font={tight?10:11} foregroundStyle={COLORS.faint} lineLimit={1}>{today?.dateLabel}</Text>
        </HStack>
        {chosen?<VStack alignment="leading" spacing={tight?3:4} modifiers={cardStyle}>
          <Text font={tight?15:17} fontWeight="semibold" lineLimit={2}
            minScaleFactor={0.85} multilineTextAlignment="leading"
            foregroundStyle={fg}>{chosen.title}</Text>
          <Text font={tight?11:12} lineLimit={1} minScaleFactor={0.85}
            foregroundStyle={detail}>{chosen.startLabel}–{chosen.endLabel}</Text>
          {chosen.location?<Text font={tight?10:11} lineLimit={tight?1:2}
            minScaleFactor={0.85} foregroundStyle={detail}>{chosen.location}</Text>:null}
        </VStack>:
        <Text font={14} foregroundStyle={COLORS.faint}>今天没有课程和考试</Text>}
        {remaining>0?<Text font={10} foregroundStyle={COLORS.faint}>
          +{remaining} 项
        </Text>:null}
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
  Widget.present(family==='systemSmall'||String(family).startsWith('accessory')
    ?<SmallPanel model={model}/>
    :<RollingPanel model={model} family={family}/>,
    {policy:'after',date:widgetReloadDate(model)});
}

// Required by the Scripting widget lifecycle after presenting the view.
Script.exit();
