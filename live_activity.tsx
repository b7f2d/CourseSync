import { HStack, Image, LiveActivity, LiveActivityUI, LiveActivityUIExpandedCenter, Text } from 'scripting';

const labels = {
  sync: { compact: '同步中', detail: '正在同步课程和考试' },
  complete: { compact: '已完成', detail: '课程和考试已同步' },
  partial: { compact: '部分完成', detail: '部分同步完成' },
  finish: { compact: '未完成', detail: '同步未完成' },
};

type State = { phase: keyof typeof labels };

function CalendarIcon({ phase }: State) {
  return <Image systemName={phase === 'complete' ? 'checkmark.circle.fill' : 'calendar'} foregroundStyle="systemBlue" />;
}

function Status({ phase }: State) {
  return <HStack spacing={8} padding={12}>
    <CalendarIcon phase={phase} />
    <Text>{(labels[phase] ?? labels.sync).detail}</Text>
  </HStack>;
}

export const CourseRefreshActivity = LiveActivity?.register?.<State>('CourseSyncRefresh', state =>
  <LiveActivityUI
    content={<Status {...state} />}
    compactLeading={<CalendarIcon {...state} />}
    compactTrailing={<Text font="caption2">{(labels[state.phase] ?? labels.sync).compact}</Text>}
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
  return await activity.start({ phase: 'sync' }, { staleDate: Date.now() + 30000 }) ? activity : null;
}
