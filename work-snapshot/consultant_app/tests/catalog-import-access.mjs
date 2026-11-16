import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {migratedDatabase,as}=await import(pathToFileURL(process.cwd()+'/supabase/tests/pglite.ts'));
const {ACCESS_FIXTURE,USERS}=await import(pathToFileURL(process.cwd()+'/supabase/tests/access-fixture.ts'));
const db=await migratedDatabase();
try {
 await db.exec(ACCESS_FIXTURE);
 await db.exec(await readFile(process.argv[2],'utf8'));
 for(const [role,user,expected] of [['admin',USERS.admin,311],['viewer',USERS.viewer,0],['pending',USERS.pending,0]]) {
   let n=await as(db,user,async()=> (await db.query("select count(*)::int n from public.memberships")).rows[0].n);
   assert.equal(n,expected); console.log(`${role}: ${n} imported memberships visible`);
 }
 let suppliers=await as(db,USERS.viewer,async()=> (await db.query("select count(*)::int n from public.suppliers")).rows[0].n);
 console.log(`viewer supplier rows visible: ${suppliers}; catalog must not present rows whose source membership is hidden`);
} finally {await db.close();}
