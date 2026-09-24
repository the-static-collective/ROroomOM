'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const upstream=process.argv[2];if(!upstream)throw Error('Supply Lemon Slice 003 index.html path');
const html=fs.readFileSync(upstream,'utf8');const script=html.match(/<script>\s*('use strict';[\s\S]*?)<\/script>/)[1];
const els=new Map();const el=id=>{if(!els.has(id))els.set(id,{id,innerHTML:'',textContent:'',hidden:true,className:'',value:'',style:{},addEventListener(){},setAttribute(){},click(){}});return els.get(id)};
const document={getElementById:el,querySelectorAll:()=>[],addEventListener(){}};
const ctx={document,localStorage:{getItem:()=>null,setItem(){}},crypto:require('node:crypto').webcrypto,Date,Math,JSON,Set,Object,Error,Array,String,Number,RegExp,console,setTimeout(){return 1},clearTimeout(){},window:{}};
const instrumented=script.replace(/\}\)\(\);\s*$/,'Object.assign(window,{test:{emit,getEvents:()=>JSON.parse(JSON.stringify(events)),validate,getState}});})();');
new vm.Script(instrumented,{filename:'lemon-slice-003/index.html'}).runInNewContext(ctx);
const api=ctx.window.test,{book,cup}=ctx.window.lemonPressDebug.ids;
for(const [type,data] of [
 ['DISCOVER_DOOR',{}],['ENTER_ROOM',{}],
 ['MARK_QUALITY',{objectId:book,quality:'echoes'}],['MARK_QUALITY',{objectId:cup,quality:'echoes'}],
 ['INVENT_RELATION',{a:book,b:cup,quality:'echoes',title:'A cup hears a book',description:'The blue cup catches a syllable from the book.'}]
])if(!api.emit(type,data))throw Error('Upstream Lemon refused '+type);
const relation='rel:invented:'+api.getEvents().at(-1).id;
if(!api.emit('PLAY_INVENTION',{relationId:relation}))throw Error('Upstream Lemon refused performance');
const events=api.getEvents();api.validate(events);
const receipt={kind:'lemon-press.living-artifact.receipt',version:3,edition:'001-slice-003',exportedAt:'2026-09-24T00:00:00.000Z',objectIds:Object.values(ctx.window.lemonPressDebug.ids),events};
fs.writeFileSync(path.join(__dirname,'fixture-lemon-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log('Generated and upstream-validated '+events.length+' actual Lemon Slice 003 events.');
