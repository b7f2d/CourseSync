// Native alert hosted over the current screen. No fabricated percentage or polling.
import {
  Button, Navigation, Text, VStack, useState,
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

function ProgressScreen({session}:{session:ProgressSession}) {
  const dismiss=Navigation.useDismiss();
  const [title,setTitle]=useState(session.title);
  const [visible,setVisible]=useState(true);
  session.setTitle=setTitle;
  // The alert is only a status display. Hiding it never cancels a transaction.
  session.dismiss=()=>{setVisible(false);dismiss();};
  if(session.closed||session.hidden) {
    Promise.resolve().then(()=>{
      if(session.closed||session.hidden)try{setVisible(false);dismiss();}catch(_){}
    });
  }
  return <VStack frame={{maxWidth:'infinity',maxHeight:'infinity'}} background="clear" ignoresSafeArea
    alert={{
      title,
      isPresented:visible,
      onChanged:isPresented=>{
        setVisible(isPresented);
        if(!isPresented){
          if(!session.closed&&!session.hidden)session.suppressed=true;
          try{dismiss();}catch(_){}
        }
      },
      message:<Text>请稍候</Text>,
      actions:<Button title="隐藏" role="cancel" action={()=>{
        session.suppressed=true;setVisible(false);dismiss();
      }}/>
    }} />;
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
          modalPresentationStyle:'overFullScreen',
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
