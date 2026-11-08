import { readdir,readFile } from 'node:fs/promises';
import { join } from 'node:path';
async function check(directory) {
  for(const file of await readdir(directory,{withFileTypes:true})) {
    const path=join(directory,file.name); if(file.isDirectory()) { await check(path); continue; }
    if(!/\.(js|html|css|json)$/.test(path)) continue;
    const text=await readFile(path,'utf8');
    for(const marker of ['X-Subscription-Token','api.search.brave.com','api.openweathermap.org','apiv2.allsportsapi.com','VITE_BRAVE_SEARCH_API_KEY']) if(text.includes(marker)) throw Error(`Private search configuration found in public artifact: ${path}`);
    if(/(?<![a-zA-Z0-9_-])BSA[a-zA-Z0-9_-]{20,60}(?![a-zA-Z0-9_-])/.test(text)) throw Error(`Possible provider credential in ${path}`);
    for(const key of ['BRAVE_SEARCH_API_KEY','ALLSPORTS_API_KEY','OPENWEATHERMAP_API_KEY','QUOTA_HASH_KEY','CRAWLER_SERVICE_TOKEN']) if(process.env[key] && text.includes(process.env[key])) throw Error(`Secret leaked into ${path}`);
  }
}
await check('dist');console.log('Public artifact secret-boundary checks passed.');
