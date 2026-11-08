import { expect,it } from 'vitest';
import { parseResults, plainText, thumbnailLink } from './search-results';
it('decodes snippets without injecting provider HTML',()=>{
 expect(plainText('<strong>Cloud</strong> &amp; storage &ndash; &#x1F30D;')).toBe('Cloud & storage – 🌍');
 expect(plainText('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe('<script>alert(1)</script>');
});
it('retains validated rich web metadata',()=>{
 const r=parseResults({web:{results:[{title:'<b>Cloud</b>',url:'https://example.com/',description:'One &amp; two',profile:{name:'Example'},age:'2 days ago',thumbnail:{src:'https://imgs.search.brave.com/signed/example.jpg'},extra_snippets:['<em>More</em> detail'],cluster:[{title:'<b>Docs</b>',url:'https://example.com/docs'},{title:'Other',url:'https://other.example/'},{title:'Unsafe',url:'javascript:alert(1)'}]}]}})[0]!;
 expect(r.title).toBe('Cloud');expect(r.description).toBe('One & two');expect(r.siteName).toBe('Example');expect(r.snippets).toEqual(['More detail']);expect(r.sitelinks).toEqual([{title:'Docs',url:'https://example.com/docs'}]);expect(r.image).toContain('https://imgs.search.brave.com/');
});
it('rejects deceptive credential links and non-Brave thumbnail hosts',()=>{
 expect(parseResults({web:{results:[{title:'bad',url:'https://trusted.com@evil.example/',description:'x'}]}})).toEqual([]);
 for(const value of ['http://imgs.search.brave.com/x','https://imgs.search.brave.com.evil.example/x','https://127.0.0.1/x','https://imgs.search.brave.com:8443/x'])expect(thumbnailLink(value)).toBeUndefined();
});
