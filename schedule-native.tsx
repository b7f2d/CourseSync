import {
  Button, DatePicker, List, Navigation, NavigationStack, Section,
  Text, TextField, VStack, HStack, Spacer, Picker, modifiers, useState,
} from 'scripting';

export type ScheduleKind = 'course' | 'exam';
export type ScheduleFields = {title: string; start: number; end: number; location: string};
export type ScheduleRow = {
  id: string;
  kind: ScheduleKind;
  title: string;
  start: number;
  end: number;
  time: string;
  location: string;
  sid?: string;
  isManual?: boolean;
};

export type CalendarScheduleResult =
  | { action: 'changeMonth'; year: number; month: number }
  | { action: 'edit'; id: string }
  | { action: 'add'; kind: ScheduleKind; start: number; day: number }
  | null;

function ScheduleEditor({kind, initial}: {kind: ScheduleKind; initial?: ScheduleFields}) {
  const dismiss = Navigation.useDismiss();
  const startDefault = Math.ceil(Date.now() / 900000) * 900000;
  const [title, setTitle] = useState(initial?.title ?? '');
  const [start, setStart] = useState<number>(initial?.start ?? startDefault);
  const [end, setEnd] = useState<number>(initial?.end ?? (initial?.start ? initial.start + 3600000 : startDefault + 3600000));
  const [location, setLocation] = useState(initial?.location ?? '');
  const typeName = kind === 'course' ? '课程' : '考试';
  const valid = Boolean(title.trim()) && title.trim().length <= 120 &&
    location.trim().length <= 200 && end > start;

  const toMs = (val: any): number => {
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number' && Number.isFinite(val)) return val;
    const parsed = Date.parse(val);
    return Number.isFinite(parsed) ? parsed : Date.now();
  };

  return <NavigationStack>
    <List navigationTitle={(initial ? '编辑' : '添加') + typeName}
      navigationBarTitleDisplayMode="inline">
      <Section header={<Text>必填信息</Text>}
        footer={end <= start ? <Text>结束时间须晚于开始时间。</Text> : undefined}>
        <TextField title="标题" prompt={"请输入" + typeName + "名称"} value={title} onChanged={setTitle}/>
        <DatePicker title="开始时间" value={new Date(start)} datePickerStyle="compact"
          onChanged={(next: any) => {
            const nextMs = toMs(next);
            setEnd(end + nextMs - start);
            setStart(nextMs);
          }}/>
        <DatePicker title="结束时间" value={new Date(end)} datePickerStyle="compact"
          onChanged={(next: any) => setEnd(toMs(next))}/>
      </Section>
      <Section header={<Text>地点（选填）</Text>}>
        <TextField title="地点" prompt="例如：博远楼 201" value={location} onChanged={setLocation}/>
      </Section>
      <Section>
        <Button title="保存" disabled={!valid}
          action={() => {if (valid) dismiss({action: 'save', title: title.trim(), start, end, location: location.trim()});}}/>
      </Section>
      {initial ? <Section>
        <Button title={"删除此" + typeName} role="destructive" action={() => dismiss({action: 'delete'})}/>
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

function CalendarScheduleView({
  year: initialYear,
  month: initialMonth,
  selectedDay: initialSelectedDay,
  rows: initialRows,
}: {
  year?: number;
  month?: number;
  selectedDay?: number;
  rows?: ScheduleRow[];
}) {
  const dismiss = Navigation.useDismiss();
  const now = new Date();
  const currentY = (Number.isFinite(initialYear) && (initialYear as number) >= 2000) ? (initialYear as number) : now.getFullYear();
  const currentM = (Number.isFinite(initialMonth) && (initialMonth as number) >= 1 && (initialMonth as number) <= 12) ? (initialMonth as number) : (now.getMonth() + 1);

  const [year, setYear] = useState<number>(currentY);
  const [month, setMonth] = useState<number>(currentM); // 1-12

  const totalDays = new Date(year, month, 0).getDate() || 30;
  const initialD = (Number.isFinite(initialSelectedDay) && (initialSelectedDay as number) >= 1) ? (initialSelectedDay as number) : now.getDate();
  const [selectedDay, setSelectedDay] = useState<number>(Math.min(initialD, totalDays));

  const safeSelectedDay = Math.min(Math.max(selectedDay, 1), totalDays);
  const rows: ScheduleRow[] = (Array.isArray(initialRows) ? initialRows : [])
    .filter(r => r && r.isManual !== false);

  const prevMonth = () => {
    let nextY = year;
    let nextM = month - 1;
    if (nextM < 1) {
      nextY -= 1;
      nextM = 12;
    }
    setYear(nextY);
    setMonth(nextM);
    setSelectedDay(1);
  };

  const nextMonth = () => {
    let nextY = year;
    let nextM = month + 1;
    if (nextM > 12) {
      nextY += 1;
      nextM = 1;
    }
    setYear(nextY);
    setMonth(nextM);
    setSelectedDay(1);
  };

  const eventsByDay = new Map<number, ScheduleRow[]>();
  for (const r of rows) {
    if (!r || !Number.isFinite(r.start)) continue;
    const d = new Date(r.start);
    if (d.getFullYear() === year && (d.getMonth() + 1) === month) {
      const dayNum = d.getDate();
      const list = eventsByDay.get(dayNum);
      if (list) list.push(r);
      else eventsByDay.set(dayNum, [r]);
    }
  }

  const getEventsForDay = (dayNum: number) => {
    return eventsByDay.get(dayNum) || [];
  };

  const selectedDayEvents = getEventsForDay(safeSelectedDay);
  const isCurrentMonth = now.getFullYear() === year && (now.getMonth() + 1) === month;
  const todayNum = isCurrentMonth ? now.getDate() : -1;

  // Monday-first calendar: 一 二 三 四 五 六 日
  const firstDayDate = new Date(year, month - 1, 1, 12, 0, 0);
  const firstDayWeekday = (firstDayDate.getDay() + 6) % 7; // 0 for Monday, ..., 6 for Sunday
  const weeks: (number | null)[][] = [];
  let currentWeek: (number | null)[] = [];
  for (let i = 0; i < firstDayWeekday; i++) {
    currentWeek.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    currentWeek.push(d);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
  const fullWeekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const selectedWeekday = fullWeekdays[new Date(year, month - 1, safeSelectedDay, 12, 0, 0).getDay() % 7] || '周一';

  const yearOptions: number[] = [];
  const baseYear = now.getFullYear();
  for (let y = baseYear - 3; y <= baseYear + 5; y++) {
    yearOptions.push(y);
  }
  if (!yearOptions.includes(year)) {
    yearOptions.push(year);
    yearOptions.sort((a, b) => a - b);
  }
  const monthOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  return (
    <NavigationStack>
      <List
        navigationTitle="日程管理"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          cancellationAction: <Button title="完成" action={() => dismiss(null)} />
        }}
      >
        <Section header={<Text>选择年月</Text>}>
          <HStack alignment="center" spacing={8} padding={{ top: 2, bottom: 2 }}>
            <Button title="上个月" buttonStyle="borderless" action={prevMonth} />
            <Spacer />
            <Text font="headline" fontWeight="bold">
              {year} 年 {month} 月
            </Text>
            <Spacer />
            <Button title="下个月" buttonStyle="borderless" action={nextMonth} />
          </HStack>
          <HStack alignment="center" spacing={12}>
            <Picker
              title="年份"
              pickerStyle="menu"
              value={String(year)}
              onChanged={(val: string) => {
                const y = Number(val);
                if (Number.isFinite(y) && y !== year) {
                  setYear(y);
                  setSelectedDay(1);
                }
              }}
            >
              {yearOptions.map(y => (
                <Text key={String(y)} tag={String(y)}>{y} 年</Text>
              ))}
            </Picker>
            <Spacer />
            <Picker
              title="月份"
              pickerStyle="menu"
              value={String(month)}
              onChanged={(val: string) => {
                const m = Number(val);
                if (Number.isFinite(m) && m >= 1 && m <= 12 && m !== month) {
                  setMonth(m);
                  setSelectedDay(1);
                }
              }}
            >
              {monthOptions.map(m => (
                <Text key={String(m)} tag={String(m)}>{m} 月</Text>
              ))}
            </Picker>
          </HStack>
        </Section>

        <Section header={<Text>月历视图</Text>}>
          <VStack spacing={4} padding={{ top: 6, bottom: 6 }} frame={{ maxWidth: 'infinity' }}>
            <HStack alignment="center" spacing={4} padding={{ bottom: 6 }} frame={{ maxWidth: 'infinity' }}>
              {weekdays.map((w, i) => (
                <VStack
                  key={w}
                  frame={{ maxWidth: 'infinity' }}
                  alignment="center"
                >
                  <VStack frame={{ height: 20 }} alignment="center">
                    <Text
                      font="caption1"
                      fontWeight="bold"
                      foregroundStyle={i >= 5 ? 'secondaryLabel' : 'label'}
                    >
                      {w}
                    </Text>
                  </VStack>
                </VStack>
              ))}
            </HStack>

            {weeks.map((week, wIdx) => (
              <HStack
                key={'week-' + wIdx}
                alignment="center"
                spacing={4}
                padding={{ top: 2, bottom: 2 }}
                frame={{ maxWidth: 'infinity' }}
              >
                {week.map((d, dIdx) => {
                  if (d === null) {
                    return (
                      <VStack
                        key={'empty-' + dIdx}
                        frame={{ maxWidth: 'infinity' }}
                        alignment="center"
                      >
                        <Button buttonStyle="plain" disabled={true} action={() => {}}>
                          <VStack
                            alignment="center"
                            spacing={2}
                            modifiers={modifiers().frame({ maxWidth: 'infinity', minHeight: 40, maxHeight: 40 })}
                          >
                            <VStack frame={{ height: 22 }} alignment="center">
                              <Text font="subheadline" foregroundStyle="clear">
                                0
                              </Text>
                            </VStack>
                            <HStack spacing={2} alignment="center" frame={{ height: 6 }}>
                              <VStack frame={{ width: 4, height: 4 }} />
                            </HStack>
                          </VStack>
                        </Button>
                      </VStack>
                    );
                  }
                  const isSelected = d === safeSelectedDay;
                  const isToday = d === todayNum;
                  const dayEvs = getEventsForDay(d);
                  const hasCourse = dayEvs.some(e => e.kind === 'course');
                  const hasExam = dayEvs.some(e => e.kind === 'exam');

                  return (
                    <VStack
                      key={'day-' + d}
                      frame={{ maxWidth: 'infinity' }}
                      alignment="center"
                    >
                      <Button
                        buttonStyle="plain"
                        action={() => setSelectedDay(d)}
                      >
                        <VStack
                          alignment="center"
                          spacing={2}
                          modifiers={
                            isSelected
                              ? modifiers()
                                  .frame({ maxWidth: 'infinity', minHeight: 40, maxHeight: 40 })
                                  .background({
                                    style: { light: '#2563EB', dark: '#1D4ED8' },
                                    shape: { type: 'rect', cornerRadius: 8 }
                                  })
                              : isToday
                              ? modifiers()
                                  .frame({ maxWidth: 'infinity', minHeight: 40, maxHeight: 40 })
                                  .background({
                                    style: { light: '#EFF6FF', dark: '#1E293B' },
                                    shape: { type: 'rect', cornerRadius: 8 }
                                  })
                              : modifiers().frame({ maxWidth: 'infinity', minHeight: 40, maxHeight: 40 })
                          }
                        >
                          <VStack frame={{ height: 22 }} alignment="center">
                            <Text
                              font="subheadline"
                              fontWeight={isSelected || isToday ? 'bold' : 'regular'}
                              monospacedDigit={true}
                              foregroundStyle={
                                isSelected ? '#FFFFFF' : isToday ? '#2563EB' : 'label'
                              }
                            >
                              {d}
                            </Text>
                          </VStack>
                          <HStack spacing={2} alignment="center" frame={{ height: 6 }}>
                            {hasCourse ? (
                              <VStack
                                frame={{ width: 4, height: 4 }}
                                modifiers={modifiers().background({
                                  style: isSelected ? '#FFFFFF' : '#3B82F6',
                                  shape: { type: 'circle' }
                                })}
                              />
                            ) : null}
                            {hasExam ? (
                              <VStack
                                frame={{ width: 4, height: 4 }}
                                modifiers={modifiers().background({
                                  style: isSelected ? '#FFFFFF' : '#F97316',
                                  shape: { type: 'circle' }
                                })}
                              />
                            ) : null}
                            {!hasCourse && !hasExam ? (
                              <VStack frame={{ width: 4, height: 4 }} />
                            ) : null}
                          </HStack>
                        </VStack>
                      </Button>
                    </VStack>
                  );
                })}
              </HStack>
            ))}
          </VStack>
        </Section>

        <Section
          header={<Text>{month} 月 {safeSelectedDay} 日 ({selectedWeekday}) 日程明细</Text>}
          footer={<Text>点击日程可编辑或删除。</Text>}
        >
          {selectedDayEvents.length > 0 ? (
            selectedDayEvents.map(ev => {
              const isCourse = ev.kind === 'course';
              const dotColor = isCourse ? '#3B82F6' : '#F97316';
              const tagLabel = isCourse ? '课程' : '考试';

              return (
                <Button
                  key={ev.id}
                  buttonStyle="plain"
                  action={() => dismiss({ action: 'edit', id: ev.id })}
                >
                  <HStack alignment="center" spacing={10} padding={{ top: 4, bottom: 4 }}>
                    <VStack
                      frame={{ width: 10, height: 10 }}
                      modifiers={modifiers().background({
                        style: dotColor,
                        shape: { type: 'circle' }
                      })}
                    />
                    <VStack alignment="leading" spacing={2}>
                      <HStack spacing={6} alignment="center">
                        <Text font="headline">{ev.title}</Text>
                        <Text font="caption2" foregroundStyle={dotColor}>
                          {tagLabel}
                        </Text>
                      </HStack>
                      <Text font="caption1" foregroundStyle="secondaryLabel">
                        {ev.time} {ev.location ? '· ' + ev.location : ''}
                      </Text>
                    </VStack>
                    <Spacer />
                    <Text font="subheadline" foregroundStyle="secondaryLabel">
                      编辑
                    </Text>
                  </HStack>
                </Button>
              );
            })
          ) : (
            <Text font="subheadline" foregroundStyle="secondaryLabel">
              该日暂无手动添加的课程或考试。
            </Text>
          )}

          <HStack alignment="center" spacing={12} padding={{ top: 6 }}>
            <Button
              title="添加课程"
              buttonStyle="borderless"
              action={() => {
                const startTime = new Date(year, month - 1, safeSelectedDay, 8, 0).getTime();
                dismiss({ action: 'add', kind: 'course', start: startTime, day: safeSelectedDay });
              }}
            />
            <Spacer />
            <Button
              title="添加考试"
              buttonStyle="borderless"
              action={() => {
                const startTime = new Date(year, month - 1, safeSelectedDay, 9, 0).getTime();
                dismiss({ action: 'add', kind: 'exam', start: startTime, day: safeSelectedDay });
              }}
            />
          </HStack>
        </Section>

        <Section header={<Text>{month} 月全部日程列表（1 至 {totalDays} 号）</Text>}>
          {eventsByDay.size === 0 ? (
            <Text font="subheadline" foregroundStyle="secondaryLabel">
              本月暂无手动添加的日程。
            </Text>
          ) : Array.from({ length: totalDays }, (_, idx) => idx + 1).map(dayNum => {
            const dayEvs = getEventsForDay(dayNum);
            const wd = fullWeekdays[new Date(year, month - 1, dayNum).getDay() % 7] || '周一';
            if (dayEvs.length === 0) return null;

            return (
              <VStack key={'row-' + dayNum} alignment="leading" spacing={6} padding={{ top: 6, bottom: 6 }}>
                <Text font="caption1" fontWeight="bold" foregroundStyle="secondaryLabel">
                  {month}月{dayNum}日 {wd}
                </Text>
                {dayEvs.map(ev => {
                  const isCourse = ev.kind === 'course';
                  const dotColor = isCourse ? '#3B82F6' : '#F97316';
                  const tagLabel = isCourse ? '课程' : '考试';

                  return (
                    <Button
                      key={'ev-' + ev.id}
                      buttonStyle="plain"
                      action={() => dismiss({ action: 'edit', id: ev.id })}
                    >
                      <HStack alignment="center" spacing={8}>
                        <VStack
                          frame={{ width: 8, height: 8 }}
                          modifiers={modifiers().background({
                            style: dotColor,
                            shape: { type: 'circle' }
                          })}
                        />
                        <Text font="subheadline" fontWeight="medium">{ev.title}</Text>
                        <Text font="caption2" foregroundStyle={dotColor}>
                          {tagLabel}
                        </Text>
                        <Text font="caption2" foregroundStyle="secondaryLabel">{ev.time}</Text>
                        <Spacer />
                        <Text font="caption1" foregroundStyle="secondaryLabel">编辑</Text>
                      </HStack>
                    </Button>
                  );
                })}
              </VStack>
            );
          })}
        </Section>
      </List>
    </NavigationStack>
  );
}

export function presentNativeCalendarSchedule(options?: {
  year?: number;
  month?: number;
  selectedDay?: number;
  rows?: ScheduleRow[];
  courses?: any[];
  exams?: any[];
}) {
  const now = new Date();
  const year = Number.isFinite(options?.year) ? (options?.year as number) : now.getFullYear();
  const month = Number.isFinite(options?.month) ? (options?.month as number) : (now.getMonth() + 1);
  const selectedDay = Number.isFinite(options?.selectedDay) ? (options?.selectedDay as number) : now.getDate();

  let rows: ScheduleRow[] = Array.isArray(options?.rows) ? [...options.rows] : [];
  if (!rows.length) {
    if (Array.isArray(options?.courses)) {
      for (const c of options.courses) {
        if (!c) continue;
        const start = typeof c.start === 'string' ? Date.parse(c.start) : Number(c.start);
        const end = typeof c.end === 'string' ? Date.parse(c.end) : Number(c.end);
        if (Number.isFinite(start)) {
          rows.push({
            id: c.id || ('course-' + Math.random().toString(36).slice(2)),
            kind: 'course',
            title: c.title || '未命名课程',
            start,
            end: Number.isFinite(end) ? end : start + 3600000,
            time: (c.start && c.end && typeof c.start === 'string' && typeof c.end === 'string')
              ? (c.start.slice(11, 16) + ' - ' + c.end.slice(11, 16)) : '',
            location: c.location || '',
            isManual: false,
          });
        }
      }
    }
    if (Array.isArray(options?.exams)) {
      for (const e of options.exams) {
        if (!e) continue;
        const start = typeof e.start === 'string' ? Date.parse(e.start) : Number(e.start);
        const end = typeof e.end === 'string' ? Date.parse(e.end) : Number(e.end);
        if (Number.isFinite(start)) {
          rows.push({
            id: e.id || ('exam-' + Math.random().toString(36).slice(2)),
            kind: 'exam',
            title: e.title || '未命名考试',
            start,
            end: Number.isFinite(end) ? end : start + 7200000,
            time: (e.start && e.end && typeof e.start === 'string' && typeof e.end === 'string')
              ? (e.start.slice(11, 16) + ' - ' + e.end.slice(11, 16)) : '',
            location: e.location || '',
            isManual: false,
          });
        }
      }
    }
  }

  return Navigation.present({
    element: <CalendarScheduleView year={year} month={month} selectedDay={selectedDay} rows={rows} />,
    modalPresentationStyle: 'pageSheet',
  });
}

export function presentScheduleList(year: number, rows: ScheduleRow[]) {
  const currentMonth = new Date().getMonth() + 1;
  const currentDay = new Date().getDate();
  return presentNativeCalendarSchedule({
    year,
    month: currentMonth,
    selectedDay: currentDay,
    rows,
  });
}
