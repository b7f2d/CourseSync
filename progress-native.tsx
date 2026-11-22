// One native progress sheet. No WebKit, fabricated percentage,
// timer polling, sensitive stage details or repeated re-presentation.
import {
  Image, Navigation, NavigationStack, ProgressView, Spacer, VStack, useState,
} from 'scripting';

type ProgressSession={
  closed:boolean;
  hidden:boolean;
  suppressed:boolean;
  shown:boolean;
  revision:number;
  progress:number;
  setProgress:((v:number) => void)|null;
  dismiss:(() => void)|null;
};

export function NativeProgressCard({value}:{value:number}) {
  return <VStack alignment="center" spacing={24} padding={{top:20,bottom:20}}>
    <Image systemName="calendar" font={42} foregroundStyle="systemBlue" />
    <ProgressView
      value={value}
      total={1}
      progressViewStyle="linear"
      tint="systemBlue"
      frame={{maxWidth:300}}
      scaleEffect={{x:1,y:1.8}}
    />
  </VStack>;
}

function ProgressScreen({session,title}:{session:ProgressSession,title:string}) {
  const dismiss=Navigation.useDismiss();
  const [value,setValue]=useState(session.progress);
  session.setProgress=setValue;
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
      <NativeProgressCard value={value} />
      <Spacer/>
    </VStack>
  </NavigationStack>;
}

export function createNativeProgressView(title='正在同步课程和考试'){
  let presented:Promise<unknown>=Promise.resolve();
  const session:ProgressSession={
    closed:false,hidden:false,suppressed:false,shown:false,
    revision:0,progress:0.08,setProgress:null,dismiss:null,
  };
  const closeVisible=()=>{
    const dismiss=session.dismiss;
    session.dismiss=null;
    session.setProgress=null;
    if(dismiss)try{dismiss();}catch(_){}
  };
  return {
    update(v:number){
      if(session.closed)return;
      const clamped=Math.max(session.progress,Math.min(1,Number(v)||0));
      if(clamped<=session.progress)return;
      session.progress=clamped;
      if(session.setProgress)try{session.setProgress(clamped);}catch(_){}
    },
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
      session.progress=1;
      if(session.setProgress)try{session.setProgress(1);}catch(_){}
      session.closed=true;
      session.revision++;
      session.shown=false;
      closeVisible();
    },
  };
}
