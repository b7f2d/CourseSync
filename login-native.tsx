// Native iOS credential entry, app dashboard, and calendar manager for Scripting.
// No HTML, embedded URLs, requests, clipboard reads, telemetry or password persistence.
// Passwords remain in memory only until caller authenticates or discards them.
import {
  Navigation, NavigationStack, List, Section, Text,
  TextField, SecureField, Button, Image, Picker, useState,
  VStack, HStack, Spacer, ProgressView, modifiers, useRef,
} from 'scripting';

function LoginView({ title }: { title: string }) {
  const dismiss = Navigation.useDismiss();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const account = username.trim();
  const valid = account.length > 0 && account.length <= 100 &&
    password.length > 0 && password.length <= 512;

  return <NavigationStack>
    <List
      navigationTitle={title}
      navigationBarTitleDisplayMode="inline"
      toolbar={{
        cancellationAction: <Button title="取消" action={() => dismiss(null)} />
      }}
    >
      <Section>
        <TextField
          title="学号"
          prompt="请输入学号"
          value={username}
          onChanged={setUsername}
          textContentType="username"
          textInputAutocapitalization="never"
        />
        <SecureField
          title="密码"
          prompt="请输入密码"
          value={password}
          onChanged={setPassword}
          textContentType="password"
        />
      </Section>
      <Section>
        <Button
          title="确认"
          disabled={!valid}
          action={() => {
            if (!valid) return;
            dismiss({ username: account, password });
          }}
        />
        <Button
          title="选择其他学校"
          action={() => {
            dismiss({ changeSchool: true });
          }}
        />
      </Section>
    </List>
  </NavigationStack>;
}

export async function presentNativeCredentialForm(title = 'CourseSync 登录') {
  const result = await Navigation.present({
    element: <LoginView title={title} />,
    modalPresentationStyle: 'pageSheet',
  });
  if (!result || typeof result !== 'object') return null;
  if (result.changeSchool === true) return { changeSchool: true };
  const username = typeof result.username === 'string' ? result.username.trim() : '';
  const password = typeof result.password === 'string' ? result.password : '';
  if (!username || username.length > 100 || !password || password.length > 512) return null;
  return { username, password };
}


// All short interactive challenges use an iOS-native text entry sheet.
// OTPs use oneTimeCode so iOS can offer the system SMS/Password code suggestion.
// Image-based CAPTCHA is rendered inside this sheet; no image ever leaves device.
type NativeInputKind = 'sms' | 'totp' | 'captcha' | 'text' | 'secure';
type NativeInputOptions = {
  title: string;
  label: string;
  kind?: NativeInputKind;
  image?: any;
};
function NativeInputView({title,label,kind='text',image}:NativeInputOptions) {
  const dismiss=Navigation.useDismiss();
  const [value,setValue]=useState('');
  const secret=kind==='secure';
  const otp=kind==='sms'||kind==='totp';
  const response=secret?value:value.trim();
  const maxLength=kind==='captcha'?32:otp?48:secret?512:120;
  const valid=response.length>0&&response.length<=maxLength;

  return <NavigationStack>
    <List navigationTitle={title} navigationBarTitleDisplayMode="inline"
      toolbar={{
        cancellationAction:<Button title="取消" action={()=>dismiss(null)}/>
      }}>
      <Section header={<Text>{label}</Text>}>
        {image?<Image image={image} resizable={true} scaleToFit={true}
          frame={{width:280,height:155}} />:null}
        {secret?
          <SecureField title={label} prompt="请输入" value={value}
            onChanged={setValue} />:
          <TextField title={label}
            prompt={otp?'请输入或填充验证码':'请输入'}
            value={value} onChanged={setValue}
            autofocus={!image}
            textContentType={otp?'oneTimeCode':undefined}
            keyboardType={otp?'numberPad':'default'}
            textInputAutocapitalization="never"
            autocorrectionDisabled={true}/>}
      </Section>
      <Section>
        <Button title="确认" disabled={!valid}
          action={()=>{if(valid)dismiss(response);}}/>
      </Section>
    </List>
  </NavigationStack>;
}

export async function presentNativeTextForm(options:NativeInputOptions) {
  const result=await Navigation.present({
    element:<NativeInputView {...options}/>,
    modalPresentationStyle:'pageSheet'
  });
  if(typeof result!=='string')return null;
  const isSecure=options.kind==='secure';
  const code=isSecure?result:result.trim();
  const max=options.kind==='captcha'?32:
    options.kind==='sms'||options.kind==='totp'?48:isSecure?512:120;
  return code&&code.length<=max?code:null;
}


// Native two-step flow. School selection is a whitelist, not a URL editor.
export type NativeSchoolChoice = {id:string;name:string};
type RefreshFormOutcome=
  | {kind:'credentials';schoolId:string;username:string;password:string}
  | {kind:'reuse';schoolId:string};

function RefreshSetupView({schools,initialSchoolId,allowReuse}:{
  schools:NativeSchoolChoice[];initialSchoolId:string;allowReuse:boolean;
}){
  const dismiss=Navigation.useDismiss();
  const [step,setStep]=useState<'school'|'account'>('school');
  const [schoolId,setSchoolId]=useState('unselected');
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const validSchool=schools.some(s=>s.id===schoolId);
  const account=username.trim();
  const validAccount=account.length>0&&account.length<=100&&
    password.length>0&&password.length<=512;
  const back=()=>step==='school'?dismiss(null):setStep('school');
  return <NavigationStack>
    {step==='school'?
      <List navigationTitle="选择学校" navigationBarTitleDisplayMode="inline"
        toolbar={{cancellationAction:<Button title="取消" action={back}/>}}>
        <Section>
          <Picker title="学校" pickerStyle="menu"
            value={schoolId} onChanged={setSchoolId}>
            <Text key="unselected" tag="unselected">请选择</Text>
            {schools.map(s=><Text key={s.id} tag={s.id}>{s.name}</Text>)}
          </Picker>
        </Section>
        <Section>
          <Button title="下一步：账号密码" disabled={!validSchool}
            action={()=>{if(validSchool)setStep('account');}}/>
        </Section>
      </List>:
      <List navigationTitle="账号密码" navigationBarTitleDisplayMode="inline"
        toolbar={{cancellationAction:<Button title="上一步" action={back}/>}}>
        <Section>
          <TextField title="学号" prompt="请输入学号" value={username}
            onChanged={setUsername} textContentType="username"
            textInputAutocapitalization="never"/>
          <SecureField title="密码" prompt="请输入密码" value={password}
            onChanged={setPassword} textContentType="password"/>
        </Section>
        <Section>
          <Button title="开始刷新" disabled={!validAccount}
            action={()=>{if(validAccount&&validSchool)dismiss({
              kind:'credentials',schoolId,username:account,password
            });}}/>
          {allowReuse&&schoolId===initialSchoolId?<Button title="使用现有登录信息继续"
            disabled={!validSchool}
            action={()=>{if(validSchool)dismiss({kind:'reuse',schoolId});}}/>:null}
        </Section>
      </List>}
  </NavigationStack>;
}

export async function presentNativeRefreshForm(schools:NativeSchoolChoice[],
  initialSchoolId:string,allowReuse=false):Promise<RefreshFormOutcome|null>{
  const result=await Navigation.present({
    element:<RefreshSetupView schools={schools} initialSchoolId={initialSchoolId}
      allowReuse={allowReuse}/>,
    modalPresentationStyle:'pageSheet'
  });
  if(!result||!['credentials','reuse'].includes(result.kind))return null;
  if(!schools.some(s=>s.id===result.schoolId))return null;
  if(result.kind==='reuse')return allowReuse&&result.schoolId===initialSchoolId?{kind:'reuse',schoolId:result.schoolId}:null;
  const username=typeof result.username==='string'?result.username.trim():'';
  const password=typeof result.password==='string'?result.password:'';
  if(!username||username.length>100||!password||password.length>512)return null;
  return {kind:'credentials',schoolId:result.schoolId,username,password};
}

type FreeRoomResult =
  | {kind: 'ready'; date: string; rooms: {period: string; room: string}[]}
  | {kind: 'error'; message: string};
type FreeRoomPage = FreeRoomResult | {kind: 'loading'};

function FreeRoomView({page, retry}: {page: FreeRoomPage; retry: () => void}) {
  return <List navigationTitle="空闲教室" navigationBarTitleDisplayMode="inline">
    {page.kind === 'loading' ? (
      <Section>
        <ProgressView progressViewStyle="circular" label={<Text>正在查询</Text>} />
      </Section>
    ) : page.kind === 'error' ? (
      <Section>
        <Text foregroundStyle="secondaryLabel">{page.message}</Text>
        <Button title="重试" action={retry} />
      </Section>
    ) : (
      <Section header={<Text>今天 {page.date}</Text>}>
        {page.rooms.map(({period, room}) => (
          <HStack key={period} alignment="center" spacing={12}>
            <Text foregroundStyle="secondaryLabel">{period}</Text>
            <Spacer />
            <Text>{room}</Text>
          </HStack>
        ))}
      </Section>
    )}
  </List>;
}

export type DashboardOptions = {
  state: any;
  schoolName: string;
  canSignOut: boolean;
  statusMessage: string;
  hasCalendar?: boolean;
  loadFreeRooms?: (isActive: () => boolean) => Promise<FreeRoomResult>;
};

function DashboardView({ state, schoolName, canSignOut, statusMessage, hasCalendar = true, loadFreeRooms }: DashboardOptions) {
  const dismiss = Navigation.useDismiss();
  const [freeRoomPage, setFreeRoomPage] = useState<FreeRoomPage | null>(null);
  const roomQuery = useRef({visible: false, pending: false});
  const openFreeRooms = async () => {
    if (!loadFreeRooms) return;
    const query = roomQuery.current;
    query.visible = true;
    setFreeRoomPage({kind: 'loading'});
    if (query.pending) return;
    query.pending = true;
    try {
      const result = await loadFreeRooms(() => query.visible);
      if (query.visible) setFreeRoomPage(result);
    } finally {
      query.pending = false;
    }
  };
  const isSignedOut = !!state?.signedOut;
  const isFailed = state?.runStatus === 'failed';
  const isSuccess = state?.runStatus === 'success';
  const statusColor = isSignedOut ? '#F59E0B' : isFailed ? '#EF4444' : '#10B981';
  const statusBadge = isSignedOut ? '未登录' : isFailed ? '异常' : isSuccess ? '已同步' : '';
  const calTitle = state?.calendarTitle || (state?.calendarId ? '专用课程和考试日历' : '未绑定');
  const examCalTitle = state?.examCalendarTitle || (state?.examCalendarId && state.examCalendarId !== state?.calendarId ? '考试日历' : '');
  const boundCalendarsLabel = examCalTitle ? `${calTitle} / ${examCalTitle}` : calTitle;
  const formatLastCheck = (iso?: string) => {
    if (!iso) return '暂无同步记录';
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return String(iso).replace('T', ' ').slice(0, 16);
    return new Date(ms + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
  };
  const lastTime = formatLastCheck(state?.lastCheck);

  const statusDetail = statusMessage && !String(statusMessage).startsWith('上次刷新：') ? statusMessage : '';

  return (
    <NavigationStack>
      <List
        navigationTitle="CourseSync"
        navigationBarTitleDisplayMode="large"
        navigationDestination={{
          isPresented: freeRoomPage !== null,
          onChanged: visible => {
            if (!visible) {
              roomQuery.current.visible = false;
              setFreeRoomPage(null);
            }
          },
          content: freeRoomPage ? <FreeRoomView page={freeRoomPage} retry={openFreeRooms} /> : <Text />,
        }}
        toolbar={{
          cancellationAction: <Button title="完成" action={() => dismiss(-1)} />
        }}
      >
        <Section>
          <VStack alignment="leading" spacing={12} padding={{ top: 6, bottom: 6 }}>
            <HStack alignment="center" spacing={12}>
              <VStack
                alignment="center"
                frame={{ width: 44, height: 44 }}
                modifiers={modifiers().background({
                  style: { light: '#2563EB', dark: '#1D4ED8' },
                  shape: { type: 'rect', cornerRadius: 10 }
                })}
              >
                <Image systemName="calendar" font={20} foregroundStyle="#FFFFFF" />
              </VStack>
              <HStack spacing={6} alignment="center">
                <Text font="headline" fontWeight="bold">{schoolName}</Text>
                {statusBadge ? (
                  <Text font="caption2" fontWeight="semibold" foregroundStyle={statusColor}>
                    {statusBadge}
                  </Text>
                ) : null}
              </HStack>
            </HStack>

            <VStack
              alignment="leading"
              spacing={6}
              padding={12}
              modifiers={modifiers().background({
                style: { light: '#F1F5F9', dark: '#1E293B' },
                shape: { type: 'rect', cornerRadius: 10 }
              })}
            >
              <HStack alignment="center">
                <Text font="caption1" foregroundStyle="secondaryLabel">日历</Text>
                <Spacer />
                <Text font="subheadline" fontWeight="medium">{boundCalendarsLabel}</Text>
              </HStack>
              <HStack alignment="center">
                <Text font="caption1" foregroundStyle="secondaryLabel">上次刷新</Text>
                <Spacer />
                <Text font="caption1" foregroundStyle="secondaryLabel">{lastTime}</Text>
              </HStack>
              {statusDetail ? (
                <Text font="caption1" foregroundStyle="secondaryLabel">
                  {statusDetail}
                </Text>
              ) : null}
            </VStack>
          </VStack>
        </Section>

        <Section>
          <Button
            title="立即刷新"
            action={() => dismiss(0)}
          />
          {hasCalendar ? (
            <Button
              title="管理日程"
              action={() => dismiss({ schedule: true })}
            />
          ) : null}
          {loadFreeRooms ? (
            <Button
              title="查询空闲教室"
              action={openFreeRooms}
            />
          ) : null}
          {canSignOut ? (
            <Button
              title="退出当前登录"
              role="destructive"
              action={() => dismiss(1)}
            />
          ) : null}
        </Section>
      </List>
    </NavigationStack>
  );
}

export async function presentNativeDashboard(options: DashboardOptions): Promise<any> {
  let presented = true;
  const loadFreeRooms = options.loadFreeRooms;
  try {
    const result = await Navigation.present({
      element: <DashboardView {...options} loadFreeRooms={loadFreeRooms
        ? isActive => loadFreeRooms(() => presented && isActive())
        : undefined} />,
      modalPresentationStyle: 'pageSheet'
    });
    if (result === null || result === undefined || result === -1) return 'dismiss';
    return result;
  } finally {
    presented = false;
  }
}

// Native Calendar Manager: displays existing calendars with colors, source, and allows adding new calendars.
export type ManagedCalendarItem = {
  identifier: string;
  title: string;
  color?: string;
  sourceTitle?: string;
  allowsContentModifications?: boolean;
};

export type CalendarManageOptions = {
  calendars: ManagedCalendarItem[];
  currentCalendarId: string | null;
};

export type CalendarManageResult =
  | { action: 'select'; calendarId: string; calendarTitle: string }
  | { action: 'create'; title: string }
  | null;

const CALENDAR_PALETTE = [
  '#007AFF', // Blue
  '#34C759', // Green
  '#FF9500', // Orange
  '#FF3B30', // Red
  '#AF52DE', // Purple
  '#5856D6', // Indigo
  '#FF2D55', // Pink
  '#5AC8FA', // Teal
  '#A2845E', // Brown
];

function CalendarManageView({ calendars, currentCalendarId }: CalendarManageOptions) {
  const dismiss = Navigation.useDismiss();
  const [newTitle, setNewTitle] = useState('');
  const trimmed = newTitle.trim();
  const validTitle = trimmed.length >= 1 && trimmed.length <= 60 && !/[\\/\r\n\x00-\x1f]/.test(trimmed);

  const icloudCalendars = calendars.filter(c => (c.sourceTitle || '').toLowerCase().includes('icloud'));
  const otherCalendars = calendars.filter(c => !(c.sourceTitle || '').toLowerCase().includes('icloud'));

  const renderCalendarRow = (cal: ManagedCalendarItem, index: number) => {
    const isSelected = cal.identifier === currentCalendarId;
    const isReadOnly = cal.allowsContentModifications === false;
    const color = cal.color || CALENDAR_PALETTE[index % CALENDAR_PALETTE.length];
    return (
      <HStack key={cal.identifier} alignment="center" spacing={12} padding={{ top: 4, bottom: 4 }}>
        <VStack
          frame={{ width: 14, height: 14 }}
          modifiers={modifiers().background({
            style: color,
            shape: { type: 'circle' }
          })}
        />
        <VStack alignment="leading" spacing={2}>
          <Text font="body" fontWeight={isSelected ? 'bold' : 'regular'}>
            {cal.title}
          </Text>
          <Text font="caption2" foregroundStyle="secondaryLabel">
            {cal.sourceTitle || '日历'} {isReadOnly ? '· 只读' : ''}
          </Text>
        </VStack>
        <Spacer />
        {isSelected ? (
          <Text font="caption1" fontWeight="semibold" foregroundStyle="#007AFF">当前同步日历</Text>
        ) : (
          <Button
            title="设为同步日历"
            disabled={isReadOnly}
            action={() => {
              if (isReadOnly) return;
              dismiss({ action: 'select', calendarId: cal.identifier, calendarTitle: cal.title });
            }}
          />
        )}
      </HStack>
    );
  };

  return (
    <NavigationStack>
      <List
        navigationTitle="管理日历"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          cancellationAction: <Button title="取消" action={() => dismiss(null)} />
        }}
      >
        <Section header={<Text>添加新日历</Text>}>
          <TextField
            title="日历名称"
            prompt="例如：课程和考试"
            value={newTitle}
            onChanged={setNewTitle}
          />
          <Button
            title="创建并绑定新 iCloud 日历"
            disabled={!validTitle}
            action={() => {
              if (!validTitle) return;
              dismiss({ action: 'create', title: trimmed });
            }}
          />
        </Section>

        {icloudCalendars.length > 0 ? (
          <Section header={<Text>iCloud 日历</Text>}>
            {icloudCalendars.map((c, idx) => renderCalendarRow(c, idx))}
          </Section>
        ) : null}

        {otherCalendars.length > 0 ? (
          <Section header={<Text>其他日历账户</Text>}>
            {otherCalendars.map((c, idx) => renderCalendarRow(c, idx + icloudCalendars.length))}
          </Section>
        ) : null}

        {calendars.length === 0 ? (
          <Section>
            <Text font="subheadline" foregroundStyle="secondaryLabel">
              未检测到可用日历，请在上方创建新日历或在 iOS 设置中允许 Scripting 访问系统日历。
            </Text>
          </Section>
        ) : null}
      </List>
    </NavigationStack>
  );
}

export async function presentNativeCalendarManager(options: CalendarManageOptions): Promise<CalendarManageResult> {
  const result = await Navigation.present({
    element: <CalendarManageView {...options} />,
    modalPresentationStyle: 'pageSheet'
  });
  if (!result || typeof result !== 'object') return null;
  return result as CalendarManageResult;
}

