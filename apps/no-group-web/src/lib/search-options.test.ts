import {expect,it} from 'vitest';
import {defaultSearchOptions,readSearchOptions,optionsFromURL,writeSearchURL} from './search-options';
it('validates all provider options and rejects invalid types',()=>{
 expect(readSearchOptions({})).toEqual(defaultSearchOptions);
 for(const body of [{page:-1},{page:10},{page:1.5},{country:'ZZ'},{country:['NG']},{freshness:'tomorrow'},{safeSearch:'unsafe'}])expect(()=>readSearchOptions(body)).toThrow();
});
it('round trips options through shareable URLs',()=>{
 const options={page:2,freshness:'pw' as const,country:'NG' as const,safeSearch:'strict' as const};const url=new URL('https://no-group.org/');writeSearchURL(url,'cloud & sync',options);expect(optionsFromURL(url)).toEqual(options);expect(url.searchParams.get('q')).toBe('cloud & sync');
 writeSearchURL(url,'new',defaultSearchOptions);expect(url.searchParams.has('page')).toBe(false);expect(url.searchParams.has('country')).toBe(false);
});
