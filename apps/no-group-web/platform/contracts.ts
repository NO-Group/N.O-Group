export interface Env {
  BRAVE_SEARCH_API_KEY?: string;
  ALLSPORTS_API_KEY?: string;
  OPENWEATHERMAP_API_KEY?: string;
  WEATHER_DAILY_LIMIT?: string;
  SPORTS_DAILY_LIMIT?: string;
  SEARCH_DB?: D1Database;
  QUOTA_HASH_KEY?: string;
  SEARCH_DAILY_LIMIT?: string;
  SEARCH_IP_DAILY_LIMIT?: string;
  SEARCH_IP_MINUTE_LIMIT?: string;
  SEARCH_RESULT_CACHE?: string;
  CRAWLER_SERVICE_URL?: string;
  CRAWLER_SERVICE_TOKEN?: string;
  CRAWLER_ALLOWED_HOSTS?: string;
}
export interface Context { request: Request; env: Env }
export function json(data: unknown, status = 200, extra: Record<string,string> = {}) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra } });
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return request.headers.get('sec-fetch-site') !== 'cross-site' && (!origin || origin === new URL(request.url).origin);
}
export async function bodyJSON(request: Request): Promise<Record<string,unknown>> {
  if (!request.headers.get('content-type')?.startsWith('application/json')) throw Error('JSON content type required.');
  if (Number(request.headers.get('content-length')) > 4096) throw Error('Request too large.');
  const reader = request.body?.getReader(); if (!reader) throw Error('Request body required.');
  let size = 0; const chunks: Uint8Array[] = [];
  try { while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 4096) { await reader.cancel(); throw Error('Request too large.'); } chunks.push(value); } }
  finally { reader.releaseLock(); }
  const all = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { all.set(chunk,offset); offset += chunk.length; }
  const data: unknown = JSON.parse(new TextDecoder().decode(all));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw Error('Expected a JSON object.');
  return data as Record<string,unknown>;
}

/** Bound decoded upstream bytes even when content-length is absent or false. */
export async function boundedJSON(response:Response,maxBytes=4*1024*1024):Promise<unknown>{
  if(Number(response.headers.get('content-length'))>maxBytes) {await response.body?.cancel();throw Error('Provider response too large');}
  const reader=response.body?.getReader();if(!reader)throw Error('Empty provider response');
  let size=0;const chunks:Uint8Array[]=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();throw Error('Provider response too large');}chunks.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}
