// One native, indeterminate progress sheet with rich app-styled backdrop. No WebKit, fabricated percentage,
// timer polling, sensitive stage details or repeated re-presentation.
import {
  Button, Navigation, NavigationStack, ProgressView, Spacer, Text, VStack,
  HStack, modifiers,
} from 'scripting';

type ProgressSession={
  closed:boolean;
  hidden:boolean;
  suppressed:boolean;
  shown:boolean;
  revision:number;
  dismiss:(() => void)|null;
};

function ProgressScreen({session,title='正在刷新课表',subtitle='同步完成后自动收起'}:{session:ProgressSession,title?:string,subtitle?:string}) {
  const dismiss=Navigation.useDismiss();
  // The script's synchronization still owns the task. Closing this view
  // hides status only; it never cancels a calendar transaction.
  session.dismiss=()=>dismiss();
  if(session.closed||session.hidden) {
    // Dismiss a sheet even if a login handoff happened before it mounted.
    Promise.resolve().then(()=>{
      if(session.closed||session.hidden)try{dismiss();}catch(_){}
    });
  }
  return <NavigationStack>
    <VStack
      navigationTitle={title}
      navigationBarTitleDisplayMode="inline"
      frame={{maxWidth:'infinity',maxHeight:'infinity'}}
      padding={24}
      spacing={16}
      modifiers={modifiers().background({
        style:{light:'#F8FAFC',dark:'#0B0F19'}
      })}
    >
      <Spacer/>
      <VStack
        alignment="center"
        spacing={14}
        padding={24}
        frame={{maxWidth:320}}
        modifiers={modifiers().background({
          style:{light:'#FFFFFF',dark:'#1E293B'},
          shape:{type:'rect',cornerRadius:20}
        })}
      >
        <VStack
          alignment="center"
          frame={{width:54,height:54}}
          modifiers={modifiers().background({
            style:{light:'#EFF6FF',dark:'#1E3A8A'},
            shape:{type:'circle'}
          })}
        >
          <ProgressView progressViewStyle="circular"/>
        </VStack>
        <Text font="headline" fontWeight="bold">{title}</Text>
        <Text foregroundStyle="secondaryLabel" font="subheadline" multilineTextAlignment="center">
          {subtitle}
        </Text>
        <HStack spacing={4} alignment="center">
          <Text font={12}>🔒</Text>
          <Text font="caption2" foregroundStyle="secondaryLabel">
            本地沙盒同步中 · 凭据受系统钥匙串保护
          </Text>
        </HStack>
      </VStack>
      <Spacer/>
      <Button title="收起" action={()=>{
        session.suppressed=true;
        dismiss();
      }}/>
    </VStack>
  </NavigationStack>;
}

export function createNativeProgressView(title='正在刷新课表',subtitle='同步完成后自动收起'){
  let presented:Promise<unknown>=Promise.resolve();
  const session:ProgressSession={
    closed:false,hidden:false,suppressed:false,shown:false,
    revision:0,dismiss:null,
  };
  const closeVisible=()=>{
    const dismiss=session.dismiss;
    session.dismiss=null;
    if(dismiss)try{dismiss();}catch(_){}
  };
  return {
    show(){
      if(session.closed||session.hidden||session.suppressed||session.shown)return;
      const revision=++session.revision;
      session.shown=true;
      try {
        presented=Promise.resolve(Navigation.present({
          element:<ProgressScreen session={session} title={title} subtitle={subtitle}/>,
          modalPresentationStyle:'pageSheet',
        })).then(()=>{
          if(session.revision!==revision)return;
          session.shown=false;
          session.dismiss=null;
          session.suppressed=true; // A dismissed sheet must stay dismissed.
        },()=>{
          if(session.revision!==revision)return;
          session.shown=false;
          session.dismiss=null;
          session.suppressed=true;
        });
      }catch(_){
        if(session.revision===revision){
          session.shown=false;
          session.suppressed=true;
        }
      }
    },
    pause(){
      if(session.closed||session.hidden)return Promise.resolve();
      session.hidden=true;
      session.revision++;
      session.shown=false;
      closeVisible();
      // Native presentation dismissal is asynchronous. Wait briefly for the
      // actual sheet to leave before presenting verification input.
      // Never let a hung host UI block the school login indefinitely.
      return Promise.race([
        presented.then(()=>{},()=>{}),
        new Promise<void>(resolve=>setTimeout(resolve,800)),
      ]);
    },
    resume(){
      if(session.closed||!session.hidden)return;
      session.hidden=false;
      this.show();
    },
    finish(){
      session.closed=true;
      session.revision++;
      session.shown=false;
      closeVisible();
      return presented.then(()=>{},()=>{});
    }
  };
}
