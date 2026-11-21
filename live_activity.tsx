import * as Scripting from 'scripting';

const { HStack, Image, Text, LiveActivityUI, LiveActivityUIExpandedCenter } = Scripting;

const phases = {
  connect: '连接教务系统',
  verify: '请在 Scripting 完成验证',
  sync: '正在同步课程和考试',
  complete: '课程和考试已同步',
  finish: '刷新未完成',
};

type RefreshState = { phase: keyof typeof phases };

const compactLabels: Record<RefreshState['phase'], string> = {
  connect: '刷新',
  verify: '验证',
  sync: '刷新',
  complete: '刷新成功',
  finish: '未完成',
};

function CalendarIcon({complete=false}:{complete?:boolean}) {
  return <Image systemName={complete?"checkmark.circle.fill":"calendar"} foregroundStyle="systemBlue"/>;
}

function RefreshStatus({phase}:RefreshState) {
  return <HStack spacing={12} padding={12}>
    <CalendarIcon complete={phase==='complete'}/>
    <Text font="headline">{phases[phase]}</Text>
  </HStack>;
}

export const COURSE_REFRESH_ACTIVITY_NAME = 'CourseSyncRefresh';

export const CourseRefreshActivity = Scripting.LiveActivity?.register?.<RefreshState>(
  COURSE_REFRESH_ACTIVITY_NAME,
  state => <LiveActivityUI
    content={<RefreshStatus {...state}/>}
    compactLeading={<CalendarIcon complete={state.phase==='complete'}/>}
    compactTrailing={<Text font="caption2">{compactLabels[state.phase]}</Text>}
    minimal={<CalendarIcon complete={state.phase==='complete'}/>}
  >
    <LiveActivityUIExpandedCenter>
      <RefreshStatus {...state}/>
    </LiveActivityUIExpandedCenter>
  </LiveActivityUI>,
);
