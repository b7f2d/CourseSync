// Native iOS credential entry, app dashboard, and calendar manager for Scripting.
// No HTML, embedded URLs, requests, clipboard reads, telemetry or password persistence.
// Passwords remain in memory only until caller authenticates or discards them.
import {
  Dialog, Navigation, NavigationStack, List, Section, Text, Picker,
  TextField, SecureField, Button, Image, ProgressView, VStack, HStack, DisclosureGroup, useState, useEffect,
} from 'scripting';

function LoginView({title, confirmTitle, allowReuse}: {title:string;confirmTitle:string;allowReuse:boolean}) {
  const dismiss = Navigation.useDismiss();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const account = username.trim();
  const valid = account.length > 0 && account.length <= 100 &&
    password.length > 0 && password.length <= 512;

  return <NavigationStack presentationDetents={['medium','large']} presentationDragIndicator="visible">
    <List navigationTitle={title} navigationBarTitleDisplayMode="inline" listStyle="insetGroup">
      <Section>
        <TextField title="学号" value={username} onChanged={setUsername}
          textContentType="username" textInputAutocapitalization="never" autocorrectionDisabled={true} />
        <SecureField title="密码" value={password} onChanged={setPassword}
          textContentType="password" />
      </Section>
      <Section>
        <Button title={confirmTitle} disabled={!valid} action={() => {
          if (valid) dismiss({ username: account, password });
        }} />
        {allowReuse ? <Button title="使用已保存的登录信息" action={() => dismiss({reuse:true})} /> : null}
      </Section>
      <Section><Button title="取消" action={() => dismiss(null)} /></Section>
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

  return <NavigationStack presentationDetents={['medium','large']} presentationDragIndicator="visible">
    <List navigationTitle={title} navigationBarTitleDisplayMode="inline" listStyle="insetGroup">
      <Section>
        {image?<HStack frame={{maxWidth:'infinity',alignment:'center'}}>
          <Image image={image} resizable={true} scaleToFit={true} frame={{maxWidth:280,height:155}} />
        </HStack>:null}
        {secret?
          <SecureField title={label} value={value} onChanged={setValue} />:
          <TextField title={label} value={value}
            onChanged={setValue} autofocus={!image} textContentType={otp?'oneTimeCode':undefined}
            keyboardType={otp?'numberPad':'default'} textInputAutocapitalization="never"
            autocorrectionDisabled={true}/>}
      </Section>
      <Section><Button title="确认" disabled={!valid} action={()=>{if(valid)dismiss(response);}}/></Section>
      <Section><Button title="取消" action={()=>dismiss(null)}/></Section>
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

export async function presentNativeRefreshForm(schoolId:string,allowReuse=false,title='登录账号'):Promise<RefreshFormOutcome|null>{
  const result=await presentLoginView(title,'开始刷新',allowReuse);
  if(result?.reuse===true)return allowReuse?{kind:'reuse',schoolId}:null;
  const credentials=readNativeCredentials(result);
  return credentials?{kind:'credentials',schoolId,...credentials}:null;
}

type RoomPeriodSpec = {period: string; units: string[]};
type RoomBuilding = {name: string; floors: {floor: number; roomCodes: string[]}[]};
type FreeRoomResult =
  | {kind: 'ready'; date: string; rooms: {period: string; units: string[]; buildings: RoomBuilding[]}[]}
  | {kind: 'error'; message: string};
type ReadyRooms = Extract<FreeRoomResult, {kind:'ready'}>;
export type DashboardOptions = {
  state: any;
  canSignOut: boolean;
  statusMessage: string;
  loadFreeRooms?: (isActive: () => boolean, updateProgress: (value: number) => void, periods?: RoomPeriodSpec[]) => Promise<FreeRoomResult>;
};
type RoomLoader = NonNullable<DashboardOptions['loadFreeRooms']>;

// Some Scripting releases do not expose Dialog.actionSheet. Use the native
// confirm dialog in that case, keeping every option available without a page.
function systemDialog() {
  return (typeof Dialog !== 'undefined' && Dialog) || (globalThis as any).Dialog;
}
async function chooseNativeAction(options) {
  const dialog = systemDialog();
  if (typeof dialog?.actionSheet === 'function') {
    try { return await dialog.actionSheet(options); } catch (_) { /* try native confirms */ }
  }
  const actions = options.actions || [];
  if (!actions.length) return null;
  // Older hosts have no action sheet. A single native prompt exposes all
  // choices and a cancel button, without trapping users in sequential dialogs.
  if (actions.length > 1 && typeof dialog?.prompt === 'function') {
    const choices = actions.map((action,index)=>(index+1)+'．'+action.label).join('\n');
    let warning = '';
    while (true) {
      const value=await dialog.prompt({title:options.title,
        message:[options.message,choices,warning].filter(Boolean).join('\n\n'),
        placeholder:'输入选项序号',keyboardType:'numberPad',
        cancelLabel:options.cancelLabel || '取消',confirmLabel:'确定'});
      if (value == null) return null;
      const input=String(value).trim();
      if (/^[1-9]\d*$/.test(input)) {
        const index=Number(input)-1;
        if (Number.isSafeInteger(index)&&index<actions.length) return index;
      }
      warning='请输入有效的选项序号。';
    }
  }
  if (typeof dialog?.confirm !== 'function') throw new Error('NATIVE_DIALOG_UNAVAILABLE');
  for (let index = 0; index < actions.length; index++) {
    const selected = await dialog.confirm({title:options.title,message:options.message || '',
      confirmLabel:actions[index].label,
      cancelLabel:index === actions.length - 1 ? (options.cancelLabel || '取消') : '更多选项'});
    if (selected) return index;
  }
  return null;
}

const ROOM_CAMPUS='仙林校区';
const NO_FULL_PERIOD_ROOMS='无整段空闲教室';

// NUFE Academic Affairs timetable effective 2025-09-01.
// https://jwc.nufe.edu.cn/info/1085/7873.htm
const ROOM_LESSON_TIMES = {
  '1': ['08:20','09:00'],
  '2': ['09:05','09:45'],
  '3': ['10:00','10:40'],
  '4': ['10:45','11:25'],
  '5': ['11:35','12:15'],
  '6': ['13:30','14:10'],
  '7': ['14:15','14:55'],
  '8': ['15:10','15:50'],
  '9': ['15:55','16:35'],
  '10': ['16:45','17:25'],
  '11': ['18:30','19:10'],
  '12': ['19:20','20:00'],
  '13': ['20:10','20:50'],
};
const ROOM_LESSON_UNITS = ['1','2','3','4','5','6','7','8','9','10','11','12','13'];

function parseClockMinutes(clock) {
  const [h, m] = String(clock).split(':').map(Number);
  return h * 60 + m;
}
function defaultRoomUnits(baseMs = Date.now()) {
  const d = new Date(baseMs + 8 * 3600000);
  const nowMin = d.getUTCHours() * 60 + d.getUTCMinutes();
  const found = nowMin < 20 * 60 + 50
    ? ROOM_LESSON_UNITS.find(u => parseClockMinutes(ROOM_LESSON_TIMES[u][1]) > nowMin)
    : null;
  const startUnit = found ? Number(found) : 1;
  return { startUnit, endUnit: Math.min(13, startUnit + 3) };
}
function roomSelectionForUnits(startUnit, endUnit) {
  const from = Number(startUnit), to = Number(endUnit);
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || from > 13 || to < 1 || to > 13) {
    return { label: '请选择有效节次', periods: null };
  }
  if (to < from) {
    return { label: '结束节次早于开始节次', periods: null };
  }
  const units = [];
  for (let u = from; u <= to; u++) units.push(String(u));
  return { label: roomPeriodTitle(units), periods: [{ period: units.join(','), units }] };
}

function roomPeriodTitle(units: string[]) {
  const first=units[0],last=units[units.length-1];
  const time=`${ROOM_LESSON_TIMES[first][0]}–${ROOM_LESSON_TIMES[last][1]}`;
  const consecutive=units.every((unit,index)=>Number(unit)===Number(first)+index);
  const lessons=units.length===1?first:consecutive?`${first}—${last}`:units.join('、');
  return `第${lessons}节 · ${time}`;
}

function roomLessonLabel(unit: string) {
  const [start,end]=ROOM_LESSON_TIMES[unit];
  return `第${unit}节  ${start}–${end}`;
}

function formatRoomResults(date, rooms: ReadyRooms['rooms']) {
  const periods=rooms.map(({units,buildings})=>{
    const lines=buildings.flatMap(({name,floors})=>[
      name,...floors.map(({floor,roomCodes})=>floor+'楼  '+roomCodes.join('  '))
    ]);
    return [roomPeriodTitle(units),...(lines.length?lines:[NO_FULL_PERIOD_ROOMS])].join('\n');
  });
  return [date+' · '+ROOM_CAMPUS,...periods].join('\n\n');
}

async function readRoomResults(loadRooms:RoomLoader,isActive=()=>true,updateProgress=(_value:number)=>{},selection=null) {
  try{
    return Array.isArray(selection)
      ? await loadRooms(isActive,updateProgress,selection)
      : await loadRooms(isActive,updateProgress);
  }
  catch(_){return {kind:'error',message:'查询失败，请稍后重试。'} as const;}
}

function RoomResultsView({loadRooms,isOpen,onClose}: {loadRooms:RoomLoader;isOpen:()=>boolean;onClose:()=>void}) {
  const dismiss=Navigation.useDismiss();
  const [initialUnits]=useState(()=>defaultRoomUnits());
  const [startUnit,setStartUnit]=useState(initialUnits.startUnit);
  const [endUnit,setEndUnit]=useState(initialUnits.endUnit);
  const [selectedPeriods,setSelectedPeriods]=useState<RoomPeriodSpec[]|null>(null);
  const [result,setResult]=useState<FreeRoomResult|null>(null);
  const [attempt,setAttempt]=useState(0);
  const [connected,setConnected]=useState(false);
  useEffect(()=>{
    if(!selectedPeriods)return;
    let active=true;
    const isActive=()=>active&&isOpen();
    void readRoomResults(loadRooms,isActive,value=>{
      if(isActive()&&value>=0.25)setConnected(true);
    },selectedPeriods).then(next=>{if(isActive())setResult(next);});
    return ()=>{active=false;};
  },[attempt,selectedPeriods]);
  const close=()=>{onClose();dismiss();};
  const toolbar={cancellationAction:<Button title={result?'返回':'取消'} action={close}/>};
  const selection=roomSelectionForUnits(startUnit,endUnit);
  const onStartChanged=(next:number)=>{
    const n=Number(next);
    setStartUnit(n);
    if(n>endUnit)setEndUnit(n);
  };
  const onEndChanged=(next:number)=>{
    const n=Number(next);
    setEndUnit(n);
    if(n<startUnit)setStartUnit(n);
  };
  const startQuery=(periods:RoomPeriodSpec[])=>{
    setResult(null);setConnected(false);setSelectedPeriods(periods);setAttempt(attempt+1);
  };
  const resetPicker=()=>{setSelectedPeriods(null);setResult(null);setConnected(false);};
  return <NavigationStack presentationDetents={['large']} presentationDragIndicator="visible">
    {!selectedPeriods?<List navigationTitle="空闲教室" navigationBarTitleDisplayMode="inline" listStyle="insetGroup"
      toolbar={toolbar}>
      <VStack alignment="leading" spacing={4} padding={{top:2,bottom:2}}>
        <Text font="subheadline" fontWeight="semibold">开始节次</Text>
        <Picker title="开始节次" pickerStyle="wheel" value={startUnit} onChanged={onStartChanged}
          frame={{maxWidth:'infinity',height:145}}>
          {ROOM_LESSON_UNITS.map(unit=><Text key={unit} tag={Number(unit)}>{roomLessonLabel(unit)}</Text>)}
        </Picker>
      </VStack>
      <VStack alignment="leading" spacing={4} padding={{top:2,bottom:2}}>
        <Text font="subheadline" fontWeight="semibold">结束节次</Text>
        <Picker title="结束节次" pickerStyle="wheel" value={endUnit} onChanged={onEndChanged}
          frame={{maxWidth:'infinity',height:145}}>
          {ROOM_LESSON_UNITS.map(unit=><Text key={unit} tag={Number(unit)}>{roomLessonLabel(unit)}</Text>)}
        </Picker>
      </VStack>
      <VStack alignment="leading" spacing={8} padding={{top:4,bottom:4}}>
        <Text font="headline" monospacedDigit={true} foregroundStyle={selection.periods?'primary':'red'}>
          {selection.label}
        </Text>
        <Button title="查询" buttonStyle="borderedProminent" disabled={!selection.periods}
          action={()=>{if(selection.periods)startQuery(selection.periods);}}/>
      </VStack>
    </List>:!result?<VStack navigationTitle="空闲教室" navigationBarTitleDisplayMode="inline"
      toolbar={toolbar} spacing={12} padding={24}
      frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'center'}}>
      <ProgressView progressViewStyle="circular" scaleEffect={1.4}/>
      <Text font="body" fontWeight="medium" multilineTextAlignment="center">
        {connected?'查询中…':'连接教务系统…'}
      </Text>
    </VStack>:result.kind==='error'?<VStack navigationTitle="空闲教室"
      navigationBarTitleDisplayMode="inline" toolbar={toolbar} spacing={14} padding={24}
      frame={{maxWidth:'infinity',maxHeight:'infinity',alignment:'center'}}>
      <Image systemName="exclamationmark.circle" font="largeTitle" foregroundStyle="secondary"/>
      <Text font="subheadline" foregroundStyle="secondary" multilineTextAlignment="center">{result.message}</Text>
      <Button title="重试" buttonStyle="borderedProminent" action={()=>{
        setResult(null);setConnected(false);setAttempt(attempt+1);
      }}/>
      <Button title="更改时段" action={resetPicker}/>
    </VStack>:<List navigationTitle="空闲教室" navigationBarTitleDisplayMode="inline" listStyle="insetGroup"
      toolbar={toolbar}>
      <Section header={<Text>{result.date} · {ROOM_CAMPUS}</Text>}>
        {result.rooms.map(({period,units,buildings})=>
          <VStack key={period} alignment="leading" spacing={8} padding={{top:2,bottom:2}}>
            {units.length>1?<DisclosureGroup title={roomPeriodTitle(units)}>
              <VStack alignment="leading" spacing={4}>
                {units.map(unit=><Text key={unit} font="subheadline">{roomLessonLabel(unit)}</Text>)}
              </VStack>
            </DisclosureGroup>:<Text font="headline">{roomPeriodTitle(units)}</Text>}
            {buildings.length>0&&<Text font="footnote" foregroundStyle="secondary">
              {buildings.reduce((count,building)=>count+building.floors.reduce((sum,floor)=>sum+floor.roomCodes.length,0),0)} 间整段空闲
            </Text>}
            {buildings.length?buildings.map(({name,floors})=>
              <HStack key={name} alignment="top" spacing={12}>
                <Text font="subheadline" fontWeight="semibold" foregroundStyle="accentColor" fixedSize>{name}</Text>
                <VStack alignment="leading" spacing={4}>
                  {floors.map(({floor,roomCodes})=>
                    <HStack key={floor} alignment="firstTextBaseline" spacing={8}>
                      <Text font="subheadline" foregroundStyle="secondary" monospacedDigit={true} fixedSize>{floor}楼</Text>
                      <Text font="subheadline" monospacedDigit={true} multilineTextAlignment="leading"
                        fixedSize={{horizontal:false,vertical:true}}>{roomCodes.join('  ')}</Text>
                    </HStack>)}
                </VStack>
              </HStack>):
              <Text font="subheadline" foregroundStyle="secondary">{NO_FULL_PERIOD_ROOMS}</Text>}
          </VStack>)}
      </Section>
      <Button title="更改时段" action={resetPicker}/>
    </List>}
  </NavigationStack>;
}

async function presentRoomQuery(loadRooms:RoomLoader) {
  if(typeof Navigation?.present==='function'&&typeof useEffect==='function'&&ProgressView){
    let open=true,started=false;
    const trackedLoad:RoomLoader=(isActive,updateProgress,periods)=>{
      started=true;
      return Array.isArray(periods)
        ? loadRooms(isActive,updateProgress,periods)
        : loadRooms(isActive,updateProgress);
    };
    try{
      await Navigation.present({element:<RoomResultsView loadRooms={trackedLoad} isOpen={()=>open} onClose={()=>{open=false;}}/>,
        modalPresentationStyle:'pageSheet'});
      return;
    }catch(_){
      // A failed presentation may already have started a request. Do not
      // automatically issue a second request while the original is unwinding.
      open=false;
      if(started){
        await chooseNativeAction({title:'空闲教室',message:'查询界面未能正常显示，请返回后重新查询。',
          actions:[{label:'返回'}],cancelButton:false});
        return;
      }
    }finally{open=false;}
  }
  while(true){
    const result=await readRoomResults(loadRooms);
    if(result.kind==='ready'){
      await chooseNativeAction({title:'空闲教室',message:formatRoomResults(result.date,result.rooms),
        actions:[{label:'返回'}],cancelButton:false});
      return;
    }
    const selected=await chooseNativeAction({title:'空闲教室',message:result.message,
      actions:[{label:'重试'}],cancelButton:true,cancelLabel:'返回'});
    if(selected!==0)return;
  }
}

export async function presentNativeDashboard(options: DashboardOptions): Promise<any> {
  const {state, canSignOut, statusMessage, loadFreeRooms} = options;
  const outcomes={failed:'上次刷新失败',partial:'上次刷新部分完成',
    cancelled:'上次刷新已取消',running:'上次刷新尚未确认完成'};
  const stateLabel=state?.signedOut?'未登录':outcomes[state?.runStatus]||'';
  const calendar = state?.calendarBindingPending || !state?.calendarId ? '未绑定日历' :
    '日历：'+(state.calendarTitle || '课表');
  const ms = Date.parse(state?.lastCheck || '');
  const lastTime=Number.isFinite(ms)?'上次刷新：'+new Date(ms+8*3600000).toISOString().slice(0,16).replace('T',' '):'';
  const title = 'CourseSync';
  const message = [calendar,lastTime,stateLabel,statusMessage].filter(Boolean).join('\n');
  while (true) {
    const actions = [{label:'立即刷新'}, ...(loadFreeRooms ? [{label:'查询空闲教室'}] : []),
      ...(canSignOut ? [{label:'退出当前登录',destructive:true}] : [])];
    const selection = await chooseNativeAction({title,message,actions,cancelButton:true,cancelLabel:'取消'});
    if (selection == null || selection < 0) return 'dismiss';
    if (selection === 0) return 0;
    if (loadFreeRooms && selection === 1) {
      await presentRoomQuery(loadFreeRooms);
      continue;
    }
    if (canSignOut && selection === (loadFreeRooms ? 2 : 1)) return 1;
    return 'dismiss';
  }
}

type CalendarManageOptions = Record<string, never>;
type CalendarManageResult = { action: 'create'; title: string } | null;

export async function presentNativeCalendarManager(_options: CalendarManageOptions): Promise<CalendarManageResult> {
  let initial = 'CourseSync';
  while (true) {
    const result = await systemDialog().prompt({title:'新建 iCloud 日历',placeholder:'日历名称',
      defaultValue:initial,cancelLabel:'取消',confirmLabel:'创建并绑定'});
    if (result == null) return null;
    const title = result.trim();
    if (title.length >= 1 && title.length <= 60 && !/[\\/\r\n\x00-\x1f]/.test(title))
      return {action:'create',title};
    initial = result;
    await systemDialog().alert({title:'日历名称无效',message:'请输入 1 至 60 个字符，且不要包含斜杠或换行。',buttonLabel:'好'});
  }
}

// Common foreground prompts use the same native glass surface as the forms.
type GlassDialogOptions = {
  title: string; message?: string;
  actions: {label: string; destructive?: boolean}[];
  cancel?: boolean; cancelLabel?: string;
  field?: {placeholder: string; value: string; secure: boolean};
};
export async function presentNativeDialog(options: GlassDialogOptions): Promise<{index:number;value:string}|null> {
  if (options.field) {
    const value = await systemDialog().prompt({title:options.title,message:options.message,
      placeholder:options.field.placeholder,defaultValue:options.field.value,
      obscureText:options.field.secure,cancelLabel:options.cancelLabel || '取消',
      confirmLabel:options.actions[0]?.label || '确认'});
    return value === null ? null : {index:0,value};
  }
  if (options.cancel && options.actions.length === 1) {
    const ok = await systemDialog().confirm({title:options.title,message:options.message || '',
      cancelLabel:options.cancelLabel || '取消',confirmLabel:options.actions[0]?.label || '确认'});
    return ok ? {index:0,value:''} : null;
  }
  if (options.actions.length === 1 && !options.cancel) {
    await systemDialog().alert({title:options.title,message:options.message || '',buttonLabel:options.actions[0]?.label || '好'});
    return {index:0,value:''};
  }
  const index = await chooseNativeAction({title:options.title,message:options.message,
    actions:options.actions,cancelButton:options.cancel});
  return index == null || index < 0 ? null : {index,value:''};
}
