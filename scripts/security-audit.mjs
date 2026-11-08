// Scan the release tree and actual local/runtime secret values, never print them.
import {execFileSync} from 'node:child_process';
import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative,dirname,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const names=['BRAVE_SEARCH_API_KEY','ALLSPORTS_API_KEY','OPENWEATHERMAP_API_KEY','QUOTA_HASH_KEY','CRAWLER_SERVICE_TOKEN'];
let local={};try{local=parseEnv(await readFile(resolve(root,'apps/no-group-web/.env.local'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw Error('Cannot read private local configuration.');}
const secrets=[...new Set(names.flatMap(name=>[process.env[name],local[name]]).filter(value=>value && value.length>=12))];
const files=new Set(execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean));
async function artifacts(path){for(const entry of await readdir(resolve(root,path),{withFileTypes:true})){const file=`${path}/${entry.name}`;if(entry.isDirectory())await artifacts(file);else files.add(file);}}
for(const directory of ['apps/no-group-web/dist','apps/no-group-web/.pages-functions'])await artifacts(directory);
let count=0;const problems=[];
for(const path of files){
 if((/^\.env(?:\.|$)/.test(basename(path)) && basename(path)!=='.env.example') || /^\.dev\.vars(?:\.|$)/.test(basename(path)) || /\.(?:key|pem|p12|pfx)$/i.test(path))problems.push(`${path}: private configuration must not be tracked`);
 let bytes;try{bytes=await readFile(resolve(root,path));}catch(error){if(error.code==='ENOENT')continue;throw error;}count++;
 if(secrets.some(secret=>bytes.includes(Buffer.from(secret))))problems.push(`${path}: configured secret detected`);
 const text=bytes.toString('utf8');
 if(/-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/.test(text) || /(?<![a-zA-Z0-9_-])BSA[a-zA-Z0-9_-]{20,60}(?![a-zA-Z0-9_-])/.test(text))problems.push(`${path}: possible embedded credential`);
}
if(problems.length){console.error('Security audit failed:\n'+problems.join('\n'));process.exitCode=1;}else console.log(`Security audit passed: ${count} source/release files; no configured secrets or private key files found. Local secrets were read only for comparison, never exported.`);
