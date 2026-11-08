import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode}) => {
  const env = loadEnv(mode,process.cwd(),'');
  for(const name of ['VITE_ALLSPORTS_API_KEY','VITE_OPENWEATHERMAP_API_KEY'])if(env[name]||process.env[name])throw Error(`Remove ${name}; use server-only runtime secrets.`);
  if (env.VITE_BRAVE_SEARCH_API_KEY || process.env.VITE_BRAVE_SEARCH_API_KEY) throw Error('Remove VITE_BRAVE_SEARCH_API_KEY. Configure the server-only BRAVE_SEARCH_API_KEY instead; VITE_ secrets are public.');
  return { plugins:[react()], server:{host:'0.0.0.0',allowedHosts:['.e2b.app'],proxy:{'/api':'http://127.0.0.1:8788'}},build:{outDir:'dist'} };
});
