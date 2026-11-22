// One native progress sheet. No WebKit, fabricated percentage,
// timer polling, sensitive stage details or repeated re-presentation.
import {
  GeometryReader, Image, Navigation, NavigationStack, VStack, useState,
} from 'scripting';

type ProgressSession={
  closed:boolean;
  hidden:boolean;
  suppressed:boolean;
  shown:boolean;
  revision:number;
  title:string;
  setTitle:((v:string) => void)|null;
  dismiss:(() => void)|null;
};

export function NativeProgressContent({title}:{title:string}) {
  return <GeometryReader navigationTitle={title} navigationBarTitleDisplayMode="inline">
    {proxy=>{
      const {width,height}=proxy.size;
      const iconWidth=Math.max(0,Math.min(220,width-48,height-48));
      return <VStack alignment="center" spacing={0} frame={{width,height,alignment:'center'}}>
        <Image
          systemName="calendar"
          resizable={true}
          scaleToFit={true}
          foregroundStyle="systemBlue"
          frame={{width:iconWidth,height:iconWidth}}
        />

      </VStack>;
    }}
  </GeometryReader>;
}

function ProgressScreen({session}:{session:ProgressSession}) {
  const dismiss=Navigation.useDismiss();
  const [title,setTitle]=useState(session.title);
  session.setTitle=setTitle;
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
    <NativeProgressContent title={title} />
  </NavigationStack>;
}

export function createNativeProgressView(title='正在同步课程和考试'){
  let presented:Promise<unknown>=Promise.resolve();
  const session:ProgressSession={
    closed:false,hidden:false,suppressed:false,shown:false,
    revision:0,title,setTitle:null,dismiss:null,
  };
  const closeVisible=()=>{
    const dismiss=session.dismiss;
    session.dismiss=null;
    session.setTitle=null;
    if(dismiss)try{dismiss();}catch(_){}
  };
  return {
    setTitle(value:string){
      session.title=value;
      if(session.setTitle)session.setTitle(value);
    },
    show(){
      if(session.closed||session.hidden||session.suppressed||session.shown)return;
      const revision=++session.revision;
      session.shown=true;
      try {
        presented=Promise.resolve(Navigation.present({
          element:<ProgressScreen session={session}/>,
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
