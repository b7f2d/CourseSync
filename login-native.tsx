// Native iOS credential entry, app dashboard, and calendar manager for Scripting.
// No HTML, embedded URLs, requests, clipboard reads, telemetry or password persistence.
// Passwords remain in memory only until caller authenticates or discards them.
import {
  Navigation, NavigationStack, List, Section, Text,
  TextField, SecureField, Button, Image, Picker, useState,
  VStack, HStack, Spacer, modifiers,
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
        <VStack alignment="center" spacing={8} frame={{maxWidth:'infinity'}} padding={{top:12,bottom:12}}>
          <VStack
            alignment="center"
            frame={{width:52,height:52}}
            modifiers={modifiers().background({
              style:{light:'#2563EB',dark:'#1D4ED8'},
              shape:{type:'rect',cornerRadius:12}
            })}
          >
            <Text font={28}>🎓</Text>
          </VStack>
          <Text font="headline" fontWeight="bold">CourseSync 账号认证</Text>
          <Text font="caption1" foregroundStyle="secondaryLabel">安全凭据直连学校系统 · 仅保存在本地钥匙串</Text>
        </VStack>
      </Section>
      <Section header={<Text>账号登录</Text>}>
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
      <Section footer={<Text>可尝试使用 iOS「密码」中的已保存网站凭据。此页面不会访问外部网站，也不会自动保存密码。</Text>}>
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
        {title.includes('南京财经大学') ? (
          <Button
            title="查询空闲教室"
            action={() => {
              dismiss({ kind: 'freeRooms', username: account, password });
            }}
          />
        ) : null}
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
  if (result.kind === 'freeRooms') return { kind: 'freeRooms', username: result.username || '', password: result.password || '' };
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
  const maxLength=kind==='captcha'?32:otp?48:secret?512:120;\n  const valid=response.length>0&&response.length<=maxLength;

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
  | {kind:'reuse';schoolId:string}
  | {kind:'freeRooms';schoolId:string;username?:string;password?:string};

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
          <VStack alignment="center" spacing={8} frame={{maxWidth:'infinity'}} padding={{top:12,bottom:12}}>
            <VStack
              alignment="center"
              frame={{width:52,height:52}}
              modifiers={modifiers().background({
                style:{light:'#2563EB',dark:'#1D4ED8'},
                shape:{type:'rect',cornerRadius:12}
              })}
            >
              <Text font={28}>🏫</Text>
            </VStack>
            <Text font="headline" fontWeight="bold">选择就读高校</Text>
            <Text font="caption1" foregroundStyle="secondaryLabel">CourseSync 将针对学校教务系统定制同步管道</Text>
          </VStack>
        </Section>
        <Section header={<Text>请选择你的学校</Text>}
          footer={<Text>点开下拉菜单，选择南京财经大学或苏州科技大学。</Text>}>
          <Picker title="学校" pickerStyle="menu"
            value={schoolId} onChanged={setSchoolId}>
            <Text key="unselected" tag="unselected">请选择</Text>
            {schools.map(s=><Text key={s.id} tag={s.id}>{s.name}</Text>)}
          </Picker>
        </Section>
        <Section>
          <Button title="下一步：账号密码" disabled={!validSchool}
            action={()=>{if(validSchool)setStep('account');}}/>
          {validSchool&&schoolId==='nufe'?<Button title="查询空闲教室"
            action={()=>{dismiss({kind:'freeRooms',schoolId});}}/>:null}
        </Section>
      </List>:
      <List navigationTitle="账号密码" navigationBarTitleDisplayMode="inline"
        toolbar={{cancellationAction:<Button title="上一步" action={back}/>}}>
        <Section>
          <VStack alignment="center" spacing={8} frame={{maxWidth:'infinity'}} padding={{top:12,bottom:12}}>
            <VStack
              alignment="center"
              frame={{width:52,height:52}}
              modifiers={modifiers().background({
                style:{light:'#2563EB',dark:'#1D4ED8'},
                shape:{type:'rect',cornerRadius:12}
              })}
            >
              <Text font={28}>🔐</Text>
            </VStack>
            <Text font="headline" fontWeight="bold">教务系统认证</Text>
            <Text font="caption1" foregroundStyle="secondaryLabel">支持系统钥匙串与自动填充 · 密码不离机</Text>
          </VStack>
        </Section>
        <Section header={<Text>账号登录</Text>}>
          <TextField title="学号" prompt="请输入学号" value={username}
            onChanged={setUsername} textContentType="username"
            textInputAutocapitalization="never"/>
          <SecureField title="密码" prompt="请输入密码" value={password}
            onChanged={setPassword} textContentType="password"/>
        </Section>
        <Section footer={<Text>仅在学校要求重新认证时提交登录信息，验证成功后才会保存；支持 iOS「密码」自动填充。</Text>}>
          <Button title="开始刷新" disabled={!validAccount}
            action={()=>{if(validAccount&&validSchool)dismiss({
              kind:'credentials',schoolId,username:account,password
            });}}/>
          {allowReuse&&schoolId===initialSchoolId?<Button title="使用现有登录信息继续"
            disabled={!validSchool}
            action={()=>{if(validSchool)dismiss({kind:'reuse',schoolId});}}/>:null}
          {validSchool&&schoolId==='nufe'?<Button title="查询空闲教室"
            action={()=>{dismiss({kind:'freeRooms',schoolId,username:account,password});}}/>:null}
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
  if(!result||!['credentials','reuse','freeRooms'].includes(result.kind))return null;
  if(!schools.some(s=>s.id===result.schoolId))return null;
  if(result.kind==='freeRooms')return {kind:'freeRooms',schoolId:result.schoolId,username:result.username||'',password:result.password||''};
  if(result.kind==='reuse')return allowReuse&&result.schoolId===initialSchoolId?{kind:'reuse',schoolId:result.schoolId}:null;
  const username=typeof result.username==='string'?result.username.trim():'';
  const password=typeof result.password==='string'?result.password:'';
  if(!username||username.length>100||!password||password.length>512)return null;
  return {kind:'credentials',schoolId:result.schoolId,username,password};
}

// Native App Dashboard presenting a modern, styled iOS app interface for CourseSync.
export type DashboardOptions = {
  state: any;
  schoolName: string;
  canFreeRooms: boolean;
  canSignOut: boolean;
  statusMessage: string;
};

function DashboardView({ state, schoolName, canFreeRooms, canSignOut, statusMessage }: DashboardOptions) {
  const dismiss = Navigation.useDismiss();
  const isSignedOut = !!state?.signedOut;\n  const isFailed = state?.runStatus === 'failed';
  const isSuccess = state?.runStatus === 'success';
  const statusColor = isSignedOut ? '#F59E0B' : isFailed ? '#EF4444' : isSuccess ? '#10B981' : '#3B82F6';
  const statusBadge = isSignedOut ? '未登录' : isFailed ? '异常' : isSuccess ? '已同步' : '就绪';
  const calTitle = state?.calendarTitle || (state?.calendarId ? '专用课表日历' : '未绑定');
  const lastTime = state?.lastCheck ? String(state.lastCheck).replace('T', ' ').slice(0, 16) : '暂无同步记录';

  return (
    <NavigationStack>
      <List
        navigationTitle="CourseSync"
        navigationBarTitleDisplayMode="large"
        toolbar={{
          cancellationAction: <Button title="完成" action={() => dismiss(-1)} />
        }}
      >
        <Section>
          <VStack alignment="leading" spacing={12} padding={{ top: 8, bottom: 8 }}>
            <HStack alignment="center" spacing={12}>
              <VStack
                alignment="center"
                frame={{ width: 48, height: 48 }}
                modifiers={modifiers().background({
                  style: { light: '#2563EB', dark: '#1D4ED8' },
                  shape: { type: 'rect', cornerRadius: 12 }
                })}
              >
                <Text font={26}>📅</Text>
              </VStack>
              <VStack alignment="leading" spacing={3}>
                <HStack spacing={6} alignment="center">
                  <Text font="headline" fontWeight="bold">CourseSync</Text>
                  <Text font="caption2" fontWeight="semibold" foregroundStyle={statusColor}>
                    ● {statusBadge}
                  </Text>
                </HStack>
                <Text font="caption1" foregroundStyle="secondaryLabel">高校课表本地同步引擎</Text>
              </VStack>
            </HStack>

            <VStack
              alignment="leading"
              spacing={8}
              padding={12}
              modifiers={modifiers().background({
                style: { light: '#F1F5F9', dark: '#1E293B' },
                shape: { type: 'rect', cornerRadius: 12 }
              })}
            >
              <HStack alignment="center">
                <Text font="subheadline" fontWeight="semibold">🏛 {schoolName}</Text>
                <Spacer />
                <Text font="caption1" foregroundStyle="secondaryLabel">🗓 {calTitle}</Text>
              </HStack>
              <Text font="caption1" foregroundStyle="secondaryLabel">
                {statusMessage}
              </Text>
              <Text font="caption2" foregroundStyle="tertiaryLabel">
                上次刷新：{lastTime}
              </Text>
            </VStack>
          </VStack>
        </Section>

        <Section header={<Text>课表同步与日历管理</Text>}>
          <Button
            title="🔄 立即刷新课表"
            action={() => dismiss(0)}
          />
          <Button
            title="📅 管理日历（切换/新建课表日历）"
            action={() => dismiss({ manageCalendar: true })}
          />
          {canFreeRooms ? (
            <Button
              title="🏫 查询空闲教室"
              action={() => dismiss(2)}
            />
          ) : null}
          <Button
            title="📊 运行状态与自检"
            action={() => dismiss(1)}
          />
        </Section>

        <Section header={<Text>高校与账号</Text>} footer={<Text>数据直接与高校教务系统通信并写入本地系统日历，无任何外部服务器中转。</Text>}>
          <Button
            title="🔄 切换学校"
            action={() => dismiss({ changeSchool: true })}
          />
          {canSignOut ? (
            <Button
              title="🚪 退出当前登录"
              action={() => dismiss(canFreeRooms ? 3 : 2)}
            />
          ) : null}
        </Section>
      </List>
    </NavigationStack>
  );
}

export async function presentNativeDashboard(options: DashboardOptions): Promise<any> {
  const result = await Navigation.present({
    element: <DashboardView {...options} />,
    modalPresentationStyle: 'pageSheet'
  });
  if (result === null || result === undefined) return -1;
  return result;
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
            {cal.sourceTitle || '日历'} {cal.allowsContentModifications === false ? '· 只读' : ''}
          </Text>
        </VStack>
        <Spacer />
        {isSelected ? (
          <HStack spacing={4} alignment="center">
            <Text font="caption1" fontWeight="semibold" foregroundStyle="#007AFF">当前课表</Text>
            <Text font="body" fontWeight="bold" foregroundStyle="#007AFF">✓</Text>
          </HStack>
        ) : (
          <Button
            title="设为课表"
            action={() => dismiss({ action: 'select', calendarId: cal.identifier, calendarTitle: cal.title })}
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
          cancellationAction: <Button title="完成" action={() => dismiss(null)} />
        }}
      >
        <Section header={<Text>添加新日历</Text>} footer={<Text>将在你的 iCloud 账户下创建独立的课表日历，避免与日常私人活动混淆。</Text>}>
          <TextField
            title="日历名称"
            prompt="例如：南财课表、大学课表"
            value={newTitle}
            onChanged={setNewTitle}
          />
          <Button
            title="＋ 创建并绑定新 iCloud 日历"
            disabled={!validTitle}
            action={() => {
              if (!validTitle) return;
              dismiss({ action: 'create', title: trimmed });
            }}
          />
        </Section>

        {icloudCalendars.length > 0 ? (
          <Section header={<Text>iCloud 日历</Text>} footer={<Text>点击「设为课表」可将 CourseSync 的同步目标切换至该日历。</Text>}>
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
