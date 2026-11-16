import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {migratedDatabase}=await import(pathToFileURL(process.cwd()+'/supabase/tests/pglite.ts'));
const sql=await readFile(process.argv[2],'utf8');
const db=await migratedDatabase();
try {
 await db.query("insert into public.source_documents(url) values ($1)",['https://www.jerusalem.muni.il/media/zlsj0sog/existing.xlsx']);
 await assert.rejects(db.exec(sql),/Source or registry already exists/);
 await db.exec('rollback');
 let result=await db.query('select count(*)::int n from public.import_batches');
 assert.equal(result.rows[0].n,0);
 result=await db.query('select count(*)::int n from public.suppliers');
 assert.equal(result.rows[0].n,0);
 console.log('A pre-existing source aborts and rolls back the entire import.');
} finally {await db.close();}
