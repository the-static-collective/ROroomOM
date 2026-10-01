import { readFileSync, writeFileSync } from 'node:fs';

import {
  enterDoor,
  makeNavigationRequest,
  openNavigator,
} from './room.mjs';

const inputPath=process.argv[2];
const outputPath=process.argv[3];
const target=process.argv[4] ?? 'particular:listener';

if(!inputPath || !outputPath){
  throw new Error('Usage: node make-return-request.mjs enterable.json request.json [target]');
}

const packet=JSON.parse(readFileSync(inputPath,'utf8'));
const nav=openNavigator(packet);
if(!nav.ok) throw new Error(nav.explanation);

const room=enterDoor(nav,'COMPOSE',true,'room-encounter:round-trip');
if(!room.ok) throw new Error(room.explanation);

const request=makeNavigationRequest(room,target);
if(request.ok===false) throw new Error(request.explanation);

writeFileSync(outputPath,JSON.stringify(request,null,2)+'\n','utf8');
console.log(`Wrote Room navigation request for ${target}.`);
