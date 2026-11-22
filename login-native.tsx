// Native iOS credential entry, app dashboard, and calendar manager for Scripting.
// No HTML, embedded URLs, requests, clipboard reads, telemetry or password persistence.
// Passwords remain in memory only until caller authenticates or discards them.
import {
  GeometryReader, Navigation, NavigationStack, List, ScrollView, Section, Text,
  TextField, SecureField, Button, Image, useState,
  VStack, HStack, Spacer, modifiers, useRef,
} from 'scripting';
import { NativeProgressContent } from './progress-native';

function LoginView({title, confirmTitle, allowReuse}: {title:string;confirmTitle:string;allowReuse:boolean}) {
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
          title={confirmTitle}
          disabled={!valid}
          action={() => {
            if (!valid) return;
            dismiss({ username: account, password });
          }}
        />
        {allowReuse ? <Button title="使用现有登录信息继续" action={() => dismiss({reuse:true})} /> : null}
      </Section>
    </List>
  </NavigationStack>;
}

function presentLoginView(title:string,confirmTitle:string,allowReuse=false){
  return Navigation.present({
    element:<LoginView title={title} confirmTitle={confirmTitle} allowReuse={allowReuse}/>,
    modalPresentationStyle:'pageSheet',
  });
}

function readNativeCredentials(result: any){
  const username=typeof result?.username==='string'?result.username.trim():'';
  const password=typeof result?.password==='string'?result.password:'';
  if(!username||username.length>100||!password||password.length>512)return null;
  return {username,password};
}

export async function presentNativeCredentialForm(title='CourseSync 登录'){
  return readNativeCredentials(await presentLoginView(title,'确认'));
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


type RefreshFormOutcome=
  | {kind:'credentials';schoolId:string;username:string;password:string}
  | {kind:'reuse';schoolId:string};

export async function presentNativeRefreshForm(schoolId:string,allowReuse=false):Promise<RefreshFormOutcome|null>{
  const result=await presentLoginView('登录账号','开始刷新',allowReuse);
  if(result?.reuse===true)return allowReuse?{kind:'reuse',schoolId}:null;
  const credentials=readNativeCredentials(result);
  return credentials?{kind:'credentials',schoolId,...credentials}:null;
}

type FreeRoomResult =
  | {kind: 'ready'; date: string; rooms: {period: string; room: string}[]}
  | {kind: 'error'; message: string};
type FreeRoomPage = FreeRoomResult | {kind: 'loading'; progress: number};

function FreeRoomView({page, retry}: {page: FreeRoomPage; retry: () => void}) {
  if (page.kind === 'loading') {
    return <NativeProgressContent title="正在查询空闲教室" value={page.progress} />;
  }
  return <GeometryReader navigationTitle="空闲教室" navigationBarTitleDisplayMode="inline">
    {proxy=>(
      <ScrollView>
        <VStack
          modifiers={modifiers().padding(24).frame({
            maxWidth:'infinity',minHeight:proxy.size.height,alignment:'center',
          })}
        >
          {page.kind === 'error' ? (
            <VStack alignment="center" spacing={14}>
              <Text font="body" foregroundStyle="secondaryLabel" multilineTextAlignment="center">{page.message}</Text>
              <Button title="重试" systemImage="arrow.clockwise" action={retry} />
            </VStack>
          ) : (
            <VStack alignment="center" spacing={20}>
              <Text font="headline">今天 · {page.date}</Text>
              {page.rooms.map(({period, room}) => (
                <VStack key={period} alignment="center" spacing={4}>
                  <Text font="subheadline" foregroundStyle="secondaryLabel">{period}</Text>
                  <Text font="title2" fontWeight="semibold" multilineTextAlignment="center">{room}</Text>
                </VStack>
              ))}
            </VStack>
          )}
        </VStack>
      </ScrollView>
    )}
  </GeometryReader>;
}

export type DashboardOptions = {
  state: any;
  schoolName: string;
  canSignOut: boolean;
  statusMessage: string;
  loadFreeRooms?: (isActive: () => boolean, updateProgress: (value: number) => void) => Promise<FreeRoomResult>;
};

function DashboardAction({title, systemImage, action, role}: {
  title: string;
  systemImage: string;
  action: () => void;
  role?: 'destructive';
}) {
  return <Button
    action={action}
    role={role}
    listRowInsets={{top:14,bottom:14,leading:16,trailing:16}}
  >
    <HStack alignment="center" spacing={10}>
      <Image
        systemName={systemImage}
        font="body"
        frame={{width:24,alignment:'center'}}
      />
      <Text>{title}</Text>
      <Spacer />
    </HStack>
  </Button>;
}

function DashboardView({ state, schoolName, canSignOut, statusMessage, loadFreeRooms }: DashboardOptions) {
  const dismiss = Navigation.useDismiss();
  const [freeRoomPage, setFreeRoomPage] = useState<FreeRoomPage | null>(null);
  const roomQuery = useRef({visible: false, pending: false, progress: 0.08, revision: 0});
  const openFreeRooms = async () => {
    if (!loadFreeRooms) return;
    const query = roomQuery.current;
    if (!query.visible || !query.pending) query.progress = 0.08;
    query.visible = true;
    setFreeRoomPage({kind: 'loading', progress: query.progress});
    if (query.pending) return;
    query.pending = true;
    const revision=query.revision;
    const isActive=()=>query.visible&&query.revision===revision;
    try {
      const result = await loadFreeRooms(isActive, progress => {
        if (!isActive()) return;
        query.progress = progress;
        setFreeRoomPage({kind: 'loading', progress});
      });
      if (isActive()) setFreeRoomPage(result);
    } catch (_) {
      if (isActive()) setFreeRoomPage({kind: 'error', message: '查询失败，请稍后重试。'});
    } finally {
      query.pending = false;
      if (query.visible && query.revision !== revision) void openFreeRooms();
    }
  };
  const isSignedOut = !!state?.signedOut;
  const isFailed = state?.runStatus === 'failed';
  const isSuccess = state?.runStatus === 'success';
  const isPartial = state?.runStatus === 'partial';
  const statusColor = isSignedOut || isPartial ? 'systemOrange' : isFailed ? 'systemRed' : 'systemGreen';
  const statusBadge = isSignedOut ? '未登录' : isFailed ? '刷新失败' : isPartial ? '部分完成' : isSuccess ? '已同步' : state?.calendarBindingPending && canSignOut ? '已登录' : '';
  const calTitle = state?.calendarBindingPending || !state?.calendarId
    ? '未绑定日历' : (state.calendarTitle || '专用课程和考试日历');
  const formatLastCheck = (iso?: string) => {
    if (!iso) return '暂无同步记录';
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return String(iso).replace('T', ' ').slice(0, 16);
    return new Date(ms + 8 * 3600000).toISOString().slice(0, 16).replace('T', ' ');
  };
  const lastTime = formatLastCheck(state?.lastCheck);

  const statusDetail = statusMessage && !String(statusMessage).startsWith('上次刷新：') ? statusMessage : '';

  return (
    <NavigationStack presentationDetents={['medium', 'large']} presentationDragIndicator="visible">
      <List
        navigationTitle="CourseSync"
        navigationBarTitleDisplayMode="inline"
        listStyle="insetGroup"
        navigationDestination={{
          isPresented: freeRoomPage !== null,
          onChanged: visible => {
            if (!visible) {
              roomQuery.current.visible = false;
              roomQuery.current.revision++;
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
          <VStack alignment="leading" spacing={10} padding={{ top: 6, bottom: 6 }}>
            <HStack alignment="center" spacing={10}>
              <VStack
                alignment="center"
                frame={{ width: 38, height: 38 }}
                modifiers={modifiers().background({
                  style: { light: '#2563EB', dark: '#1D4ED8' },
                  shape: { type: 'rect', cornerRadius: 10 }
                })}
              >
                <Image systemName="calendar" font={18} foregroundStyle="#FFFFFF" />
              </VStack>
              <Text font="title2" fontWeight="bold">{schoolName}</Text>
              <Spacer />
              {statusBadge ? (
                <Text font="footnote" fontWeight="semibold" foregroundStyle={statusColor}>
                  {statusBadge}
                </Text>
              ) : null}
            </HStack>

            <VStack alignment="leading" spacing={6}>
              <HStack alignment="center" spacing={10}>
                <Text font="subheadline" foregroundStyle="secondaryLabel">日历</Text>
                <Spacer />
                <Text font="subheadline" fontWeight="medium" multilineTextAlignment="trailing">{calTitle}</Text>
              </HStack>
              <HStack alignment="center" spacing={10}>
                <Text font="subheadline" foregroundStyle="secondaryLabel">上次刷新</Text>
                <Spacer />
                <Text font="subheadline" fontWeight="medium">{lastTime}</Text>
              </HStack>
              {statusDetail ? (
                <Text font="subheadline" foregroundStyle="secondaryLabel">
                  {statusDetail}
                </Text>
              ) : null}
            </VStack>
          </VStack>
        </Section>

        <Section>
          {/* The native circle variants give all three symbols the same visible outline. */}
          <DashboardAction
            title="立即刷新"
            systemImage="arrow.clockwise.circle"
            action={() => dismiss(0)}
          />
          {loadFreeRooms ? (
            <DashboardAction
              title="查询空闲教室"
              systemImage="magnifyingglass.circle"
              action={openFreeRooms}
            />
          ) : null}
          {canSignOut ? (
            <DashboardAction
              title="退出当前登录"
              systemImage="arrow.right.circle"
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
        ? (isActive, updateProgress) => loadFreeRooms(() => presented && isActive(), progress => {
          if (presented) updateProgress(progress);
        })
        : undefined} />,
      modalPresentationStyle: 'pageSheet'
    });
    if (result === null || result === undefined || result === -1) return 'dismiss';
    return result;
  } finally {
    presented = false;
  }
}

type CalendarManageOptions = Record<string, never>;
type CalendarManageResult = { action: 'create'; title: string } | null;

function CalendarManageView(_options: CalendarManageOptions) {
  const dismiss = Navigation.useDismiss();
  const [newTitle, setNewTitle] = useState('');
  const title = newTitle.trim();
  const validTitle = title.length >= 1 && title.length <= 60 && !/[\\/\r\n\x00-\x1f]/.test(title);

  return (
    <NavigationStack>
      <List
        navigationTitle="新建 iCloud 日历"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          cancellationAction: <Button title="取消" action={() => dismiss(null)} />
        }}
      >
        <Section>
          <TextField
            title="日历名称"
            prompt="日历名称"
            value={newTitle}
            onChanged={setNewTitle}
          />
          <Button
            title="创建并绑定"
            disabled={!validTitle}
            action={() => {
              if (validTitle) dismiss({ action: 'create', title });
            }}
          />
        </Section>
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
