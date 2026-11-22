import { HStack, Image, LiveActivity, LiveActivityUI, LiveActivityUIExpandedCenter, Text } from 'scripting';

const labels = {
  connect: '连接教务系统',
  courses: '同步课程',
  exams: '同步考试',
  complete: '课程和考试已同步',
  partial: '部分同步完成',
  finish: '同步未完成',
};

type State = { phase: keyof typeof labels };

function CalendarIcon({ phase }: State) {
  return <Image systemName={phase === 'complete' ? 'checkmark.circle.fill' : 'calendar'} foregroundStyle="systemBlue" />;
}

function Status({ phase }: State) {
  return <HStack spacing={8} padding={12}>
    <CalendarIcon phase={phase} />
    <Text>{labels[phase]}</Text>
  </HStack>;
}

export const CourseRefreshActivity = LiveActivity?.register?.<State>('CourseSyncRefresh', state =>
  <LiveActivityUI
    content={<Status {...state} />}
    compactLeading={<CalendarIcon {...state} />}
    compactTrailing={<Text font="caption2">{state.phase === 'exams' ? '考试' : '课程'}</Text>}
    minimal={<CalendarIcon {...state} />}
  >
    <LiveActivityUIExpandedCenter>
      <Status {...state} />
    </LiveActivityUIExpandedCenter>
  </LiveActivityUI>,
);

export async function startCourseRefreshActivity(isRunning: () => boolean) {
  if (!CourseRefreshActivity || !await LiveActivity.areActivitiesEnabled() || !isRunning()) return null;
  const activity = CourseRefreshActivity();
  return await activity.start({ phase: 'connect' }, { staleDate: Date.now() + 30000 }) ? activity : null;
}
