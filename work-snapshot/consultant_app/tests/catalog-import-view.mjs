import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {migratedDatabase}=await import(pathToFileURL(process.cwd()+'/supabase/tests/pglite.ts'));
const {buildCatalog}=await import(pathToFileURL(process.cwd()+'/web/src/catalog-model.ts'));
const sql=await readFile(process.argv[2],'utf8');
const db=await migratedDatabase();
try {
 await db.exec(sql);
 const pairs={suppliers:'suppliers',names:'supplier_names',memberships:'memberships',versions:'registry_versions',registries:'registries',fields:'registry_fields',categories:'categories',units:'org_units',contacts:'supplier_contacts',documents:'source_documents'};
 const data={}; for(const [key,table] of Object.entries(pairs)) data[key]=(await db.query(`select * from public.${table}`)).rows;
 const result=buildCatalog(data);
 assert.equal(result.length,311);
 assert.equal(result.filter(x=>x.memberships.length===1&&x.memberships[0].source&&x.verified===false).length,311);
 assert.equal(result.filter(x=>x.memberships[0].registry==='מאגר יועצים אגף תכנון - 2024' && x.memberships[0].field).length,158);
 console.log('Catalog model renders 311 unverified source-linked suppliers, including 158 planning entries with source fields.');
} finally {await db.close();}
