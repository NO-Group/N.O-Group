import { DatabaseSync } from 'node:sqlite';
import { readFileSync, mkdirSync, readdirSync } from 'node:fs';
export function localDB(path = ':memory:'): D1Database {
  if (path !== ':memory:') mkdirSync('.data',{recursive:true});
  const db = new DatabaseSync(path); for (const name of readdirSync(new URL('../migrations/',import.meta.url)).filter(name=>name.endsWith('.sql')).sort()) db.exec(readFileSync(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
  function prepare(sql: string, params: (string|number|null)[] = []): unknown {
    return {
      bind: (...values: (string|number|null)[]) => prepare(sql,values),
      first: async () => db.prepare(sql).get(...params) || null,
      run: async () => { const result = db.prepare(sql).run(...params); return {success:true,meta:{changes:Number(result.changes)}}; },
    };
  }
  return { prepare } as unknown as D1Database;
}
