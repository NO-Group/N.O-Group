import { json, sameOrigin } from './contracts';
import { thumbnailLink } from '../src/lib/search-results';
export async function handleThumbnail(request:Request, providerFetch:typeof fetch=fetch) {
  if(request.method!=='GET')return json({error:'Method not allowed'},405,{Allow:'GET'});
  if(!sameOrigin(request))return json({error:'Cross-site requests are not allowed'},403);
  const url=thumbnailLink(new URL(request.url).searchParams.get('url'));
  if(!url)return json({error:'Only Brave-hosted HTTPS thumbnails are supported'},400);
  try {
    const response=await providerFetch(url,{redirect:'error',signal:AbortSignal.timeout(5000),headers:{Accept:'image/avif,image/webp,image/png,image/jpeg,image/gif'}});
    const type=response.headers.get('content-type')?.split(';')[0] || '';
    if(!response.ok || !['image/avif','image/webp','image/png','image/jpeg','image/gif'].includes(type))return json({error:'Preview unavailable'},502);
    const reader=response.body?.getReader();if(!reader)return json({error:'Preview unavailable'},502);
    const chunks:Uint8Array[]=[];let size=0;
    try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024){await reader.cancel();return json({error:'Preview too large'},413);}chunks.push(value);}}finally{reader.releaseLock();}
    const data=new Uint8Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
    return new Response(data,{headers:{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }catch{return json({error:'Preview unavailable'},502);}
}
