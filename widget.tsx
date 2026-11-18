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
  muted:{light:'#9BA3AF',dark:'#AEB8C8'},
  faint:{light:'#727E91',dark:'#BBC6D7'},
  finished:{light:'#929AA7',dark:'#A7B2C3'},
  doneBg:{light:'#E5E7EB',dark:'#343D4C'},
  nextBg:{light:'#EBF4FF',dark:'#243449'},
  activeBg:{light:'#238BFF',dark:'#2467C6'},
  activeDetail:{light:'#F0F7FF',dark:'#E7F2FF'},
  white:'#FFFFFF'
};

// Narrow neighbor columns need explicit CJK line breaks. SwiftUI otherwise
// gives the long detail stack priority and truncates the title to one line.
function formatSideTitle(title){
  const value=String(title||'');
  const chars=Array.from(value);
  if(chars.length<=4||!/[㐀-鿿]/.test(value))return value;
  const lines=Math.ceil(chars.length/4);
  const chunks=[];
  for(let i=0;i<lines;i++){
    const count=Math.ceil((chars.length)/ (lines-i));
    chunks.push(chars.splice(0,count).join(''));
  }
  return chunks.join('\n');
}

function CourseCard({course,compact=false,width,density='normal'}){
  // Larger single today card; compact side-by-side today cards.
  const smallText=density==='pair',largeText=density==='single';
  const isSide=density==='side';
  // Enlarge readable text without overflowing narrow two-card layouts.
  const titleSize=smallText?(compact?10:11):largeText?(compact?15:17):(compact?13:15);
  const detailSize=smallText?(compact?9:10):largeText?(compact?12:13):(compact?11:12);
  const cardPadding=isSide?4:smallText?5:compact?7:8;
  const sideFont=compact?12:13,sideDetailFont=compact?9:10;
  const detailsColor=course.status==='current'?COLORS.activeDetail:
    course.status==='done'?COLORS.muted:COLORS.faint;
  const done=course.status==='done',current=course.status==='current';
  const fg=done?COLORS.finished:current?COLORS.white:COLORS.dark;
  const bg=done?COLORS.doneBg:current?COLORS.activeBg:COLORS.nextBg;
  // Modifier order matters: paint the rounded background AFTER sizing the
  // card. Previously the visible background used its intrinsic text width
  // and sat to the left inside an otherwise centered, fixed-width frame.
  const cardStyle=modifiers()
    .padding(cardPadding)
    .frame(width?{width,alignment:'topLeading'}:{maxWidth:'infinity',alignment:'topLeading'})
    .background({style:bg,shape:{type:'rect',cornerRadius:9}});
  return <VStack key={course.id} alignment="leading" spacing={smallText?2:3}
      modifiers={cardStyle}>
    <Text font={isSide?sideFont:titleSize} fontWeight={current?'bold':'semibold'}
      lineLimit={smallText?4:5} minScaleFactor={isSide?0.85:1}
      fixedSize={{horizontal:false,vertical:true}}
      multilineTextAlignment="leading" foregroundStyle={fg}>
      {isSide?formatSideTitle(course.title):course.title}
    </Text>
    <Text font={isSide?sideDetailFont:detailSize} foregroundStyle={detailsColor}
      lineLimit={isSide?1:2} minScaleFactor={isSide?0.72:1}>
      {course.startLabel+'–'+course.endLabel}
    </Text>
    {course.location?<Text font={isSide?sideDetailFont:detailSize}
      foregroundStyle={detailsColor}
      lineLimit={isSide?2:3} fixedSize={{horizontal:false,vertical:true}}
      multilineTextAlignment="leading">{isSide?String(course.location).replace(/\s+/, '\n'):course.location}</Text>:null}
  </VStack>;
}

function DayColumn({day,width,compact=false,maxRows=1,emphasize=false}){
  const window=selectVisibleCourses(day,maxRows);
  const dayColor=day.today?COLORS.blue:COLORS.dark;
  return <VStack key={String(day.index)} alignment="center" spacing={compact?4:5}
    frame={{width,alignment:'top'}}>
    <VStack spacing={1} frame={{width}} padding={{top:1,bottom:2}}>
      <Text font={compact?16:18} fontWeight="bold" foregroundStyle={dayColor}>
        {day.label}
      </Text>
      <Text font={compact?10:11} foregroundStyle={day.today?COLORS.blue:COLORS.faint}
        lineLimit={1}>{day.weekday} {day.dateLabel}</Text>
    </VStack>
    {window.courses.length?window.courses.map(c=>
      <HStack key={c.id} alignment="top" spacing={0}
        frame={{width,alignment:'center'}}>
        <Spacer minLength={0}/>
        <CourseCard course={c} compact={compact} width={width-8}
          density={emphasize?'single':'side'}/>
        <Spacer minLength={0}/>
      </HStack>):
      <Text font={12} foregroundStyle={COLORS.muted}>无课</Text>}
    {window.hiddenAfter>0?
      <Text font={compact?10:11} foregroundStyle={COLORS.faint}>
        +{window.hiddenAfter}节课
      </Text>:null}
  </VStack>;
}

// The left side holds exactly the current (or next) class. The right side
// stacks later upcoming classes; completed lessons are intentionally omitted.
function TodayPairColumn({day,width,compact=false,gap=5,showAll=false}){
  const columns=selectTodayColumns(day,showAll?3:1);
  const cardWidth=Math.max(25,Math.floor((width-gap)/2));
  return <VStack alignment="center" spacing={compact?4:5}
      frame={{width,alignment:'top'}}>
    <VStack spacing={1} frame={{width}} padding={{top:1,bottom:2}}>
      <Text font={compact?16:18} fontWeight="bold" foregroundStyle={COLORS.blue}>
        {day.label}
      </Text>
      <Text font={compact?10:11} foregroundStyle={COLORS.blue}
        lineLimit={1}>{day.weekday} {day.dateLabel}</Text>
    </VStack>
    <HStack alignment="top" spacing={gap} frame={{width,alignment:'topLeading'}}>
      <VStack frame={{width:cardWidth,alignment:'topLeading'}}>
        {columns.focus?<CourseCard course={columns.focus} compact={compact}
          width={cardWidth} density="pair"/>:null}
      </VStack>
      <VStack alignment="center" spacing={compact?4:6}
          frame={{width:cardWidth,alignment:'top'}}>
        {columns.future.map(c=>
          <CourseCard key={c.id} course={c} compact={compact}
            width={cardWidth} density="pair"/>)}
        {columns.hiddenAfter>0?<Text font={compact?10:11}
          foregroundStyle={COLORS.faint}>+{columns.hiddenAfter}节课</Text>:null}
      </VStack>
    </HStack>
  </VStack>;
}

// GeometryReader measures the actual widget CONTENT rect, rather than the
// screen's width. A conservative inset prevents clipping at rounded corners.
// No footer or stretchy Spacer can push the title outside the visible area.
function RollingPanel({model,family}){
  const medium=family==='systemMedium';
  return <GeometryReader>
    {proxy=>{
      const width=proxy.size.width,height=proxy.size.height;\n      const safeInset=medium?9:12,gap=medium?4:6;\n      const days=model.days.slice(0,3);\n      const today=days.find(d=>d.today);\n      const todayFocus=selectTodayPair(today);\n      const expanded=todayFocus.courses.length>1;\n      const usableWidth=Math.max(96,width-2*safeInset-2*gap);\n      const sideShare=expanded?0.24:medium?0.30:0.265;\n      const sideWidth=Math.floor(usableWidth*sideShare);\n      const todayWidth=usableWidth-sideWidth*2;\n      const maxRows=medium?1:height>=370?3:height>=290?2:1;\n      const showAllToday=!medium&&height>=290;\n      return <VStack spacing={0}\n        widgetBackground={COLORS.canvas}\n        background={{style:COLORS.canvas}}\n        frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'topLeading'}}>\n        <VStack alignment=\"leading\" spacing={0} padding={safeInset}\n          frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'topLeading'}}>\n          <HStack alignment=\"top\" spacing={gap}\n            frame={{maxWidth:'infinity',alignment:'leading'}}>\n          {days.map(day=>day.today&&expanded\n            ?<TodayPairColumn key=\"today-pair\" day={day}\n              width={todayWidth} compact={medium} gap={gap}\n              showAll={showAllToday}/>\n            :<DayColumn key={String(day.index)}\n              day={day.today?{...day,courses:todayFocus.courses}:day}\n              width={day.today?todayWidth:sideWidth}\n              compact={medium} maxRows={maxRows}\n              emphasize={day.today&&!expanded}/> )}\n          </HStack>\n        </VStack>\n      </VStack>;\n    }}\n  </GeometryReader>;\n}\n\nfunction SmallPanel({model}){\n  const today=model.days.find(d=>d.today);\n  const classes=today?.courses||[];\n  const current=classes.find(x=>x.status==='current');\n  const next=classes.find(x=>x.status==='upcoming');\n  const chosen=current||next||classes[classes.length-1];\n  const remaining=chosen?classes.filter(x=>x.status==='upcoming'&&x!==chosen).length:0;\n  const done=chosen?.status==='done',active=chosen?.status==='current';\n  const bg=done?COLORS.doneBg:active?COLORS.activeBg:COLORS.nextBg;\n  const fg=done?COLORS.finished:active?COLORS.white:COLORS.dark;\n  const detail=active?COLORS.activeDetail:done?COLORS.muted:COLORS.faint;\n  return <GeometryReader>\n    {proxy=>{\n      const width=proxy.size.width,height=proxy.size.height;\n      const inset=12,cardWidth=Math.max(80,width-2*inset);\n      const tight=height<160;\n      const cardStyle=modifiers().padding(tight?7:9)\n        .frame({width:cardWidth,alignment:'topLeading'})\n        .background({style:bg,shape:{type:'rect',cornerRadius:10}});\n      return <VStack spacing={0}\n        widgetBackground={COLORS.canvas}\n        background={{style:COLORS.canvas}}\n        frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'topLeading'}}>\n        <VStack alignment=\"leading\" spacing={tight?5:7} padding={inset}\n          frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'topLeading'}}>\n        <Text font={tight?17:19} fontWeight=\"bold\" foregroundStyle={COLORS.dark}>今天</Text>\n        {chosen?<VStack alignment=\"leading\" spacing={tight?3:4} modifiers={cardStyle}>\n          <Text font={tight?12:13} fontWeight=\"semibold\" lineLimit={2}\n            minScaleFactor={0.85} multilineTextAlignment=\"leading\"\n            foregroundStyle={fg}>{chosen.title}</Text>\n          <Text font={tight?10:11} lineLimit={1} minScaleFactor={0.85}\n            foregroundStyle={detail}>{chosen.startLabel}–{chosen.endLabel}</Text>\n          {chosen.location?<Text font={tight?10:11} lineLimit={1}\n            minScaleFactor={0.85} foregroundStyle={detail}>{chosen.location}</Text>:null}\n        </VStack>:\n        <Text font={14} foregroundStyle={COLORS.faint}>今天没有课程</Text>}\n        {remaining>0?<Text font={10} foregroundStyle={COLORS.faint}>\n          +{remaining}节课\n        </Text>:null}\n        </VStack>\n      </VStack>;\n    }}\n  </GeometryReader>;\n}\n\nfunction EmptyPanel({kind='empty',code=''}) {\n  const failure=kind==='invalid';\n  const label=failure?'缓存读取失败':'尚无课表缓存';\n  const guidance=code==='OPEN_MAIN_ONCE'?'请打开一次 CourseSync，自动建立组件缓存':\n    failure?'请反馈下方代码以便定位；课表和登录信息未被修改':\n    '打开 CourseSync 完成首次课表同步';\n  return <VStack spacing={0}\n    widgetBackground={COLORS.canvas}\n    background={{style:COLORS.canvas}}\n    frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'center'}}>\n    <VStack alignment=\"leading\" spacing={9} padding={22}\n      frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'center'}}>\n    <Text font={16} fontWeight=\"bold\" foregroundStyle={COLORS.dark}>CourseSync</Text>\n    <Text font={12} fontWeight=\"medium\" foregroundStyle={COLORS.faint}>{label}</Text>\n    <Text font={11} foregroundStyle={COLORS.faint} lineLimit={3}>{guidance}</Text>\n    {failure?<Text font={10} foregroundStyle={COLORS.muted}>诊断：{code||'UNKNOWN'}</Text>:null}\n    </VStack>\n  </VStack>;\n}\n\nconst snapshot=loadBestWidgetState(FileManager,typeof Storage!=='undefined'?Storage:null);\nif(snapshot.kind!=='ready'){\n  Widget.present(<EmptyPanel kind={snapshot.kind} code={snapshot.code}/>,\n    {policy:'after',date:new Date(Date.now()+2*60*60*1000)});\n}else{\n  const model=buildWidgetModel(snapshot.state,Date.now());\n  const family=Widget.family;\n  Widget.present(family==='systemSmall'||String(family).startsWith('accessory')\n    ?<SmallPanel model={model}/>\n    :<RollingPanel model={model} family={family}/>,\n    {policy:'after',date:widgetReloadDate(model)});\n}\n\nScript.exit();\n