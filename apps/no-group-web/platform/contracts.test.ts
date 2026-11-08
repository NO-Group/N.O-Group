import {expect,it,vi} from 'vitest';
import {boundedJSON} from './contracts';
it('accepts bounded provider JSON',async()=>{expect(await boundedJSON(Response.json({ok:true}),32)).toEqual({ok:true});});
it('rejects advertised oversize responses before reading',async()=>{const cancel=vi.fn();const response=new Response(new ReadableStream({cancel}),{headers:{'content-length':'9999'}});await expect(boundedJSON(response,32)).rejects.toThrow('too large');expect(cancel).toHaveBeenCalled();});
it('cancels an oversized stream even without content-length',async()=>{const cancel=vi.fn();const response=new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(33));},cancel}));await expect(boundedJSON(response,32)).rejects.toThrow('too large');expect(cancel).toHaveBeenCalled();});
it('rejects empty or malformed upstream payloads',async()=>{await expect(boundedJSON(new Response(null))).rejects.toThrow('Empty');await expect(boundedJSON(new Response('broken'))).rejects.toThrow();});
