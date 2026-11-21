// One native, indeterminate progress sheet. No WebKit, fabricated percentage,
// timer polling, sensitive stage details or repeated re-presentation.
import {
  Image, Navigation, NavigationStack, ProgressView, Spacer, VStack, modifiers,
} from 'scripting';

type ProgressSession={
  closed:boolean;
  hidden:boolean;
  suppressed:boolean;
  shown:boolean;
  revision:number;
  dismiss:(() => void)|null;
};

function ProgressScreen({session,title}:{session:ProgressSession,title:string}) {
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
    >
      <Spacer/>
      <VStack
        alignment="center"
        spacing={18}
        padding={28}
        modifiers={modifiers().background({
          style: { light: '#F1F5F9', dark: '#1E293B' },
          shape: { type: 'rect', cornerRadius: 20 }
        })}
      >
        <VStack
          alignment="center"
          frame={{ width: 52, height: 52 }}
          modifiers={modifiers().background({
            style: { light: '#2563EB', dark: '#1D4ED8' },
            shape: { type: 'rect', cornerRadius: 14 }
          })}
        >
          <Image systemName="calendar" font={24} foregroundStyle="#FFFFFF" />
        </VStack>
        <ProgressView progressViewStyle="linear" tint="#2563EB" frame={{ width: 180 }} />
      </VStack>
      <Spacer/>
    </VStack>
  </NavigationStack>;
}

export function createNativeProgressView(title='正在同步课程和考试'){
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
          element:<ProgressScreen session={session} title={title}/>,
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
      this.show(); // Only once, after manual school verification.
    },
    finish(){
      if(session.closed)return;
      session.closed=true;
      session.revision++;
      session.shown=false;
      closeVisible();
    },
  };
}
