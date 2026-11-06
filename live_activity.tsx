import * as Scripting from 'scripting';

const { HStack, VStack, Image, Text, LiveActivityUI, LiveActivityUIExpandedCenter } = Scripting;

const phases = {
  connect: '连接教务系统',
  verify: '请在 Scripting 完成验证',
  sync: '同步课表与日历',
  finish: '可在 CourseSync 查看运行状态',
};

type RefreshState = { phase: keyof typeof phases };

function CalendarIcon() {
  return <Image systemName="calendar" foregroundStyle="systemBlue"/>;
}

function RefreshStatus({phase}:RefreshState) {
  return <HStack spacing={12} padding={12}>
    <CalendarIcon/>
    <VStack alignment="leading" spacing={3}>
      <Text font="headline">{phase==='finish'?'课表刷新已结束':'正在刷新课表'}</Text>
      <Text font="subheadline" foregroundStyle="secondaryLabel">{phases[phase]}</Text>
    </VStack>
  </HStack>;
}

export const CourseRefreshActivity = Scripting.LiveActivity?.register<RefreshState>(
  'CourseSyncRefresh',
  state => <LiveActivityUI
    content={<RefreshStatus {...state}/>}
    compactLeading={<CalendarIcon/>}
    compactTrailing={<Text font="caption2">{state.phase==='verify'?'验证':'刷新'}</Text>}
    minimal={<CalendarIcon/>}
  >
    <LiveActivityUIExpandedCenter>
      <RefreshStatus {...state}/>
    </LiveActivityUIExpandedCenter>
  </LiveActivityUI>,
);
