const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(__dirname+'/../ios/host.js','utf8');
test('saved native events retain their handle for subsequent saves',async()=>{
 const calls=[]; const context={__native:(op,v)=>{if(op==='saveEvent'){calls.push(v);return {identifier:'id',handle:'handle'};}return null;}};
 vm.createContext(context);
 const Event=vm.runInContext(source+'\nNativeEvent',context);
 const e=new Event({calendar:{identifier:'cal'},startDate:0,endDate:1000});
 await e.save();await e.save();assert.equal(calls[1].handle,'handle');
});
test('native response headers are normalized',async()=>{
 const context={__native:()=>null,__asyncNative:(op,v,cb)=>cb({status:200,headers:{'Content-Type':'text/html'},text:'ok'},null)};
 vm.createContext(context);const api=vm.runInContext(source+'\nScripting',context);
 const r=await api.fetch('https://example.invalid');assert.equal(r.headers.get('content-type'),'text/html');
});
