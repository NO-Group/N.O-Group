export async function onRequest(context: {next:()=>Promise<Response>}) {
  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set('Strict-Transport-Security','max-age=31536000');
  headers.set('X-Content-Type-Options','nosniff'); headers.set('Referrer-Policy','no-referrer');
  headers.set('X-Frame-Options','DENY'); headers.set('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'");
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
