import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

test("the actual guest-room inline import/interaction module parses",()=>{
 const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
 const match=html.match(/<script type="module">([\s\S]*?)<\/script>/);
 assert.ok(match,"Expected one standalone inline room module");
 const run=spawnSync(process.execPath,["--input-type=module","--check"],{input:match[1],encoding:"utf8"});
 assert.equal(run.status,0,run.stderr);
 assert.match(match[1],/openLocalRoom\(await file.text\(\)\)/);
 assert.match(html,/data-act="RETURN"/);
});
