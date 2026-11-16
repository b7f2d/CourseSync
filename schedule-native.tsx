import {
  Button, DatePicker, List, Navigation, NavigationStack, Section,
  Text, TextField, VStack, useState,
} from 'scripting';

type ScheduleKind = 'course' | 'exam';
type ScheduleFields = {title: string; start: number; end: number; location: string};
type ScheduleRow = {id: string; kind: ScheduleKind; title: string; time: string; location: string};

function ScheduleEditor({kind, initial}: {kind: ScheduleKind; initial?: ScheduleFields}) {
  const dismiss = Navigation.useDismiss();
  const startDefault = Math.ceil(Date.now() / 900000) * 900000;
  const [title, setTitle] = useState(initial?.title ?? '');
  const [start, setStart] = useState(initial?.start ?? startDefault);
  const [end, setEnd] = useState(initial?.end ?? startDefault + 3600000);
  const [location, setLocation] = useState(initial?.location ?? '');
  const typeName = kind === 'course' ? '课程' : '考试';
  const valid = Boolean(title.trim()) && title.trim().length <= 120 &&
    location.trim().length <= 200 && end > start;

  return <NavigationStack>
    <List navigationTitle={(initial ? '编辑' : '添加') + typeName}
      navigationBarTitleDisplayMode="inline">
      <Section header={<Text>必填</Text>}
        footer={end <= start ? <Text>结束时间须晚于开始时间。</Text> : undefined}>
        <TextField title="标题" prompt="填写标题" value={title} onChanged={setTitle}/>
        <DatePicker title="开始时间" value={start} datePickerStyle="compact"
          onChanged={next => {setEnd(end + next - start); setStart(next);}}/>
        <DatePicker title="结束时间" value={end} datePickerStyle="compact" onChanged={setEnd}/>
      </Section>
      <Section header={<Text>选填</Text>}>
        <TextField title="地点" prompt="地点" value={location} onChanged={setLocation}/>
      </Section>
      <Section>
        <Button title="保存" disabled={!valid}
          action={() => {if (valid) dismiss({action: 'save', title, start, end, location});}}/>
      </Section>
      {initial ? <Section>
        <Button title="删除日程" role="destructive" action={() => dismiss({action: 'delete'})}/>
      </Section> : null}
      <Section><Button title="取消" action={() => dismiss(null)}/></Section>
    </List>
  </NavigationStack>;
}

export function presentScheduleEditor(kind: ScheduleKind, initial?: ScheduleFields) {
  return Navigation.present({
    element: <ScheduleEditor kind={kind} initial={initial}/>,
    modalPresentationStyle: 'pageSheet',
  });
}

function ScheduleList({year, rows}: {year: number; rows: ScheduleRow[]}) {
  const dismiss = Navigation.useDismiss();
  return <NavigationStack>
    <List navigationTitle="管理日程" navigationBarTitleDisplayMode="inline">
      <Section>
        <Button title={year + ' 年'} systemImage="calendar" action={() => dismiss({action: 'year'})}/>
      </Section>
      {!rows.length ? <Section><Text>这一年暂无手动添加的日程。</Text></Section> : null}
      {(['course', 'exam'] as const).map(kind => {
        const entries = rows.filter(row => row.kind === kind);
        return entries.length ? <Section key={kind} header={<Text>{kind === 'course' ? '课程' : '考试'}</Text>}>
          {entries.map(row => <Button key={row.id} action={() => dismiss({action: 'edit', id: row.id})}>
            <VStack alignment="leading" spacing={4}>
              <Text>{row.title}</Text>
              <Text font="subheadline" foregroundStyle="secondaryLabel">
                {row.time}{row.location ? ' · ' + row.location : ''}
              </Text>
            </VStack>
          </Button>)}
        </Section> : null;
      })}
      <Section><Button title="完成" action={() => dismiss(null)}/></Section>
    </List>
  </NavigationStack>;
}

export function presentScheduleList(year: number, rows: ScheduleRow[]) {
  return Navigation.present({
    element: <ScheduleList year={year} rows={rows}/>,
    modalPresentationStyle: 'pageSheet',
  });
}
