import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {migratedDatabase} = await import(pathToFileURL(process.cwd()+'/supabase/tests/pglite.ts'));
const sql=await readFile(process.argv[2], 'utf8');
const db=await migratedDatabase();
try {
 await db.exec(sql);
 const query=async q => (await db.query(q)).rows[0].n;
 const n=await query("select count(*)::int n from public.memberships");
 assert.equal(n,311);
 assert.equal(await query("select count(*)::int n from public.import_rows where status='promoted'"),311);
 assert.equal(await query("select count(*)::int n from public.memberships where review_status='needs_review'"),311);
 assert.equal(await query("select count(*)::int n from public.import_batches"),10);
 assert.equal(await query("select count(*)::int n from public.supplier_contacts c join public.source_documents d on d.id=c.source_document_id where d.url like '%/fhcajuaq/%' and c.kind='phone' and c.status='disputed'"),7);
 await db.exec(sql);
 assert.equal(await query("select count(*)::int n from public.memberships"),311);
 assert.equal(await query("select count(*)::int n from public.import_rows"),311);
 console.log('Import, unverified status and repeat-import checks passed for 311 rows across 10 sources.');
} finally {await db.close();}
