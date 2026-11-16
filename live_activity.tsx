import * as Scripting from 'scripting';

const { HStack, Image, Text, LiveActivityUI, LiveActivityUIExpandedCenter } = Scripting;

const phases = {
  connect: '连接教务系统',
  verify: '请在 Scripting 完成验证',
  sync: '正在同步课程与考试',
  complete: '课程与考试已同步',
  finish: '请检查本次同步结果',
};

type RefreshState = { phase: keyof typeof phases };

function CalendarIcon({complete=false}:{complete?:boolean}) {
  return <Image systemName={complete?"checkmark.circle.fill":"calendar"} foregroundStyle="systemBlue"/>;
}

function RefreshStatus({phase}:RefreshState) {
  return <HStack spacing={12} padding={12}>
    <CalendarIcon complete={phase==='complete'}/>
    <Text font="headline">{phases[phase]}</Text>
  </HStack>;
}

export const CourseRefreshActivity = Scripting.LiveActivity?.register<RefreshState>(
  'CourseSyncRefresh',
  state => <LiveActivityUI
    content={<RefreshStatus {...state}/>}
    compactLeading={<CalendarIcon complete={state.phase==='complete'}/>}
    compactTrailing={<Text font="caption2">{state.phase==='complete'?'刷新成功':state.phase==='verify'?'验证':'刷新'}</Text>}
    minimal={<CalendarIcon complete={state.phase==='complete'}/>}
  >
    <LiveActivityUIExpandedCenter>
      <RefreshStatus {...state}/>
    </LiveActivityUIExpandedCenter>
  </LiveActivityUI>,
);
