// Native iOS credential entry, app dashboard, and calendar manager for Scripting.
// No HTML, embedded URLs, requests, clipboard reads, telemetry or password persistence.
// Passwords remain in memory only until caller authenticates or discards them.
import {
  Dialog, GeometryReader, Navigation, NavigationStack, ScrollView, Text,
  TextField, SecureField, Button, Image, useState,
  VStack, HStack, Spacer, useRef,
} from 'scripting';
import { createNativeProgressView } from './progress-native';

// The system sheet hosts a compact, centered glass dialog. Its contents remain
// scrollable when the keyboard, a small screen, or larger text reduces space.
function GlassPopup({children}: {children:any}) {
  return <NavigationStack presentationDetents={['large']} presentationDragIndicator="hidden" presentationBackground="clear">
    <GeometryReader>{proxy => <VStack alignment="center" frame={{width:proxy.size.width,height:proxy.size.height,alignment:'center'}}>
      <ScrollView frame={{width:Math.min(380,Math.max(0,proxy.size.width-40)),maxHeight:Math.max(120,proxy.size.height-40)}}
        glassEffect={{type:'rect',cornerRadius:24}}>
        {children}
      </ScrollView>
    </VStack>}</GeometryReader>
  </NavigationStack>;
}

function LoginView({title, confirmTitle, allowReuse}: {title:string;confirmTitle:string;allowReuse:boolean}) {
  const dismiss = Navigation.useDismiss();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const account = username.trim();
  const valid = account.length > 0 && account.length <= 100 &&
    password.length > 0 && password.length <= 512;

  return <GlassPopup>
    <VStack alignment="leading" spacing={14} padding={20}>
        <Text font="title2" fontWeight="bold">{title}</Text>
        <VStack alignment="leading" spacing={14} padding={16} glassEffect={{type:'rect',cornerRadius:20}}>
          <TextField title="学号" prompt="请输入学号" value={username} onChanged={setUsername}
            textContentType="username" textInputAutocapitalization="never" />
          <SecureField title="密码" prompt="请输入密码" value={password} onChanged={setPassword}
            textContentType="password" />
        </VStack>
        <Button buttonStyle="glass" title={confirmTitle} disabled={!valid} action={() => {
          if (valid) dismiss({ username: account, password });
        }} />
        {allowReuse ? <Button buttonStyle="glass" title="使用现有登录信息继续" action={() => dismiss({reuse:true})} /> : null}
        <Button buttonStyle="glass" title="取消" action={() => dismiss(null)} />
    </VStack>
  </GlassPopup>;
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

  return <GlassPopup>
    <VStack alignment="leading" spacing={14} padding={20}>
        <Text font="title2" fontWeight="bold">{title}</Text>
        <VStack alignment="leading" spacing={12} padding={16} glassEffect={{type:'rect',cornerRadius:20}}>
          <Text>{label}</Text>
          {image?<Image image={image} resizable={true} scaleToFit={true} frame={{maxWidth:280,height:155}} />:null}
          {secret?
            <SecureField title={label} prompt="请输入" value={value} onChanged={setValue} />:
            <TextField title={label} prompt={otp?'请输入或填充验证码':'请输入'} value={value}
              onChanged={setValue} autofocus={!image} textContentType={otp?'oneTimeCode':undefined}
              keyboardType={otp?'numberPad':'default'} textInputAutocapitalization="never"
              autocorrectionDisabled={true}/>}
        </VStack>
        <Button buttonStyle="glass" title="确认" disabled={!valid} action={()=>{if(valid)dismiss(response);}}/>
        <Button buttonStyle="glass" title="取消" action={()=>dismiss(null)}/>
    </VStack>
  </GlassPopup>;
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
type FreeRoomPage = FreeRoomResult | {kind: 'loading'};

function FreeRoomView({page, retry}: {page: FreeRoomPage; retry: () => void}) {
  if (page.kind === 'loading') return <VStack spacing={12} padding={20}>
    <Image systemName="calendar" font={48} foregroundStyle="systemBlue" />
    <Text font="headline">正在查询空闲教室</Text>
  </VStack>;
  return <VStack alignment="center" spacing={16} padding={16}>
    {page.kind === 'error' ? <VStack spacing={12}>
      <Text foregroundStyle="secondaryLabel" multilineTextAlignment="center">{page.message}</Text>
      <Button buttonStyle="glass" title="重试" systemImage="arrow.clockwise" action={retry} />
    </VStack> : <VStack alignment="center" spacing={16}>
      <Text font="headline">今天 · {page.date}</Text>
      {page.rooms.map(({period, room}) => <VStack key={period} spacing={4}>
        <Text font="subheadline" foregroundStyle="secondaryLabel">{period}</Text>
        <Text font="title2" fontWeight="semibold" multilineTextAlignment="center">{room}</Text>
      </VStack>)}
    </VStack>}
  </VStack>;
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
    buttonStyle="glass"
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
  const roomQuery = useRef({visible: false, pending: false, revision: 0});
  const openFreeRooms = async () => {
    if (!loadFreeRooms) return;
    const query = roomQuery.current;
    query.visible = true;
    setFreeRoomPage({kind: 'loading'});
    if (query.pending) return;
    query.pending = true;
    const revision=query.revision;
    const isActive=()=>query.visible&&query.revision===revision;
    try {
      const result = await loadFreeRooms(isActive, () => {});
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

  const closeRooms = () => {
    roomQuery.current.visible = false;
    roomQuery.current.revision++;
    setFreeRoomPage(null);
  };
  return (
    <GlassPopup>
      {freeRoomPage ? (
        <VStack spacing={8} padding={16} glassEffect={{type:'rect',cornerRadius:20}}>
          <HStack><Text font="headline">空闲教室</Text><Spacer />
            <Button buttonStyle="glass" title="返回" action={closeRooms} /></HStack>
          <FreeRoomView page={freeRoomPage} retry={openFreeRooms} />
        </VStack>
      ) : (
        <VStack alignment="leading" spacing={14} padding={20}>
            <HStack><Text font="title2" fontWeight="bold">CourseSync</Text><Spacer />
              <Button buttonStyle="glass" title="完成" action={() => dismiss(-1)} /></HStack>
            <VStack alignment="leading" spacing={10} padding={16} glassEffect={{type:'rect',cornerRadius:20}}>
              <HStack><Image systemName="calendar" foregroundStyle="systemBlue" />
                <Text font="headline">{schoolName}</Text><Spacer />
                {statusBadge ? <Text font="footnote" foregroundStyle={statusColor}>{statusBadge}</Text> : null}</HStack>
              <HStack><Text foregroundStyle="secondaryLabel">日历</Text><Spacer /><Text multilineTextAlignment="trailing">{calTitle}</Text></HStack>
              <HStack><Text foregroundStyle="secondaryLabel">上次刷新</Text><Spacer /><Text>{lastTime}</Text></HStack>
              {statusDetail ? <Text font="subheadline" foregroundStyle="secondaryLabel">{statusDetail}</Text> : null}
            </VStack>
            <VStack alignment="leading" spacing={12} padding={16} glassEffect={{type:'rect',cornerRadius:20}}>
              <DashboardAction title="立即刷新" systemImage="arrow.clockwise.circle" action={() => dismiss(0)} />
              {loadFreeRooms ? <DashboardAction title="查询空闲教室" systemImage="magnifyingglass.circle" action={openFreeRooms} /> : null}
              {canSignOut ? <DashboardAction title="退出当前登录" systemImage="arrow.right.circle" role="destructive" action={() => dismiss(1)} /> : null}
            </VStack>
        </VStack>
      )}
    </GlassPopup>
  );
}

export async function presentNativeDashboard(options: DashboardOptions): Promise<any> {
  const {state, schoolName, canSignOut, statusMessage, loadFreeRooms} = options;
  const stateLabel = state?.signedOut ? '未登录' : state?.runStatus === 'failed' ? '刷新失败' :
    state?.runStatus === 'partial' ? '部分完成' : state?.runStatus === 'success' ? '已同步' :
    state?.calendarBindingPending && canSignOut ? '已登录' : '';
  const calendar = state?.calendarBindingPending || !state?.calendarId ? '未绑定日历' :
    (state.calendarTitle || '专用课程和考试日历');
  const ms = Date.parse(state?.lastCheck || '');
  const lastTime = !state?.lastCheck ? '暂无同步记录' : Number.isFinite(ms) ?
    new Date(ms + 8 * 3600000).toISOString().slice(0,16).replace('T',' ') :
    String(state.lastCheck).replace('T',' ').slice(0,16);
  const detail = statusMessage && !String(statusMessage).startsWith('上次刷新：') ? statusMessage : '';
  const message = [schoolName, stateLabel, '日历：'+calendar, '上次刷新：'+lastTime, detail].filter(Boolean).join('\n');
  while (true) {
    const actions = [{label:'立即刷新'}, ...(loadFreeRooms ? [{label:'查询空闲教室'}] : []),
      ...(canSignOut ? [{label:'退出当前登录',destructive:true}] : [])];
    const selection = await Dialog.actionSheet({title:'CourseSync',message,actions,cancelButton:false});
    if (selection == null || selection < 0) return 'dismiss';
    if (selection === 0) return 0;
    if (loadFreeRooms && selection === 1) {
      let retry = true;
      while (retry) {
        retry = false;
        const progress = createNativeProgressView('正在查询空闲教室');
        progress.show();
        let result: FreeRoomResult;
        try { result = await loadFreeRooms(() => true, () => {}); }
        catch (_) { result = {kind:'error',message:'查询失败，请稍后重试。'}; }
        finally { await progress.pause(); progress.finish(); }
        const roomText = result.kind === 'error' ? result.message :
          ['今天 · '+result.date, ...result.rooms.map(({period,room}) => period+'：'+room)].join('\n');
        const roomActions = result.kind === 'error' ? [{label:'重试'}, {label:'返回'}] : [{label:'返回'}];
        const selected = await Dialog.actionSheet({title:'空闲教室',message:roomText,actions:roomActions,cancelButton:false});
        if (result.kind === 'error' && selected === 0) retry = true;
      }
      continue;
    }
    if (canSignOut && selection === (loadFreeRooms ? 2 : 1)) return 1;
    return 'dismiss';
  }
}

type CalendarManageOptions = Record<string, never>;
type CalendarManageResult = { action: 'create'; title: string } | null;

function CalendarManageView(_options: CalendarManageOptions) {
  const dismiss = Navigation.useDismiss();
  const [newTitle, setNewTitle] = useState('CourseSync');
  const title = newTitle.trim();
  const validTitle = title.length >= 1 && title.length <= 60 && !/[\\/\r\n\x00-\x1f]/.test(title);

  return (
    <GlassPopup>
      <VStack alignment="leading" spacing={14} padding={20}>
          <Text font="title2" fontWeight="bold">新建 iCloud 日历</Text>
          <VStack padding={16} glassEffect={{type:'rect',cornerRadius:20}}>
            <TextField title="日历名称" prompt="日历名称" value={newTitle} onChanged={setNewTitle} />
          </VStack>
          <Button buttonStyle="glass" title="创建并绑定" disabled={!validTitle} action={() => {
            if (validTitle) dismiss({ action: 'create', title });
          }} />
          <Button buttonStyle="glass" title="取消" action={() => dismiss(null)} />
      </VStack>
    </GlassPopup>
  );
}

export async function presentNativeCalendarManager(_options: CalendarManageOptions): Promise<CalendarManageResult> {
  let initial = 'CourseSync';
  while (true) {
    const result = await Dialog.prompt({title:'新建 iCloud 日历',placeholder:'日历名称',
      defaultValue:initial,cancelLabel:'取消',confirmLabel:'创建并绑定'});
    if (result == null) return null;
    const title = result.trim();
    if (title.length >= 1 && title.length <= 60 && !/[\\/\r\n\x00-\x1f]/.test(title))
      return {action:'create',title};
    initial = result;
    await Dialog.alert({title:'日历名称无效',message:'请输入 1 至 60 个字符，且不要包含斜杠或换行。',buttonLabel:'好'});
  }
}

// Common foreground prompts use the same native glass surface as the forms.
type GlassDialogOptions = {
  title: string; message?: string;
  actions: {label: string; destructive?: boolean}[];
  cancel?: boolean; cancelLabel?: string;
  field?: {placeholder: string; value: string; secure: boolean};
};
function GlassDialog({options}: {options: GlassDialogOptions}) {
  const dismiss = Navigation.useDismiss();
  const [value, setValue] = useState(options.field?.value || '');
  return <GlassPopup>
    <VStack alignment="leading" spacing={14} padding={20}>
        <VStack alignment="leading" spacing={12} padding={18} glassEffect={{type:'rect',cornerRadius:20}}>
          <Text font="headline">{options.title}</Text>
          {options.message ? <Text font="body">{options.message}</Text> : null}
          {options.field ? (options.field.secure ?
            <SecureField title={options.field.placeholder} prompt={options.field.placeholder} value={value} onChanged={setValue} /> :
            <TextField title={options.field.placeholder} prompt={options.field.placeholder} value={value} onChanged={setValue} />) : null}
        </VStack>
        {options.actions.map((action, index) => <Button key={index} buttonStyle="glass"
          title={action.label} role={action.destructive ? 'destructive' : undefined}
          action={() => dismiss({index, value})} />)}
        {options.cancel ? <Button buttonStyle="glass" title={options.cancelLabel || '取消'} action={() => dismiss(null)} /> : null}
    </VStack>
  </GlassPopup>;
}
export async function presentNativeDialog(options: GlassDialogOptions): Promise<{index:number;value:string}|null> {
  if (options.field) {
    const value = await Dialog.prompt({title:options.title,message:options.message,
      placeholder:options.field.placeholder,defaultValue:options.field.value,
      obscureText:options.field.secure,cancelLabel:options.cancelLabel || '取消',
      confirmLabel:options.actions[0]?.label || '确认'});
    return value === null ? null : {index:0,value};
  }
  if (options.cancel && options.actions.length === 1) {
    const ok = await Dialog.confirm({title:options.title,message:options.message || '',
      cancelLabel:options.cancelLabel || '取消',confirmLabel:options.actions[0].label});
    return ok ? {index:0,value:''} : null;
  }
  if (options.actions.length === 1 && !options.cancel) {
    await Dialog.alert({title:options.title,message:options.message || '',buttonLabel:options.actions[0].label});
    return {index:0,value:''};
  }
  const index = await Dialog.actionSheet({title:options.title,message:options.message,
    actions:options.actions,cancelButton:options.cancel});
  return index == null || index < 0 ? null : {index,value:''};
}
