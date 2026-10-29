// Run after applying migrations. Immutable baseline objects are reused on every reset.
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
const url=process.env.SUPABASE_URL, key=process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!key) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.');
const client=createClient(url,key,{auth:{persistSession:false}});
for(const grant of [1,2,3]) {
 for(const requirement of ['proposal','budget','eligibility']) {
  const bytes=await readFile(new URL(`../supabase/fixtures/${requirement}.pdf`,import.meta.url));
  const {error}=await client.storage.from('evidence').upload(`baseline/${grant}/${requirement}.pdf`,bytes,{contentType:'application/pdf',upsert:false});
  if(error && !/already exists|duplicate/i.test(error.message)) throw error;
 }
}
console.log('Baseline evidence ready: 9 private sample files.');
