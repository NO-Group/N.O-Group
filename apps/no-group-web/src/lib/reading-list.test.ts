import {afterEach,expect,it,vi} from 'vitest';
import {validateSavedLinks,saveLink,readSavedLinks,writeSavedLinks,exportReadingList,importReadingList} from './reading-list';
afterEach(()=>vi.unstubAllGlobals());
it('stores only user-selected URL references, not provider text',()=>{
 const links=saveLink([],'https://example.com/docs',1000);expect(links).toEqual([{url:'https://example.com/docs',label:'example.com',note:'',savedAt:1000}]);expect(saveLink(links,'https://example.com/docs')).toHaveLength(1);expect(saveLink(links,'javascript:alert(1)')).toEqual(links);
});
it('validates stored URLs, fields, dates, and duplicates',()=>{
 const valid={url:'https://example.com/',label:'Example',note:'Mine',savedAt:1000};expect(validateSavedLinks([valid,valid,null,{...valid,url:'javascript:alert(1)'},{...valid,url:'https://other.example',savedAt:1e30}])).toEqual([valid]);expect(validateSavedLinks({})).toEqual([]);
});
it('handles blocked or corrupted storage',()=>{
 vi.stubGlobal('localStorage',{getItem:()=>'{broken',setItem:()=>{throw Error();}});expect(readSavedLinks()).toEqual([]);expect(writeSavedLinks([])).toBe(false);
});
it('bounds saved links and label/note size',()=>{
 const links=validateSavedLinks(Array.from({length:110},(_,i)=>({url:`https://example.com/${i}`,label:'a'.repeat(200),note:'b'.repeat(1000),savedAt:1000})));expect(links).toHaveLength(100);expect(links[0]!.label).toHaveLength(120);expect(links[0]!.note).toHaveLength(500);
});
it('exports portable JSON with no provider response fields',()=>{
 const data=JSON.parse(exportReadingList(saveLink([],'https://example.com')));expect(data.format).toBe('no-group-reading-list');expect(data.version).toBe(1);expect(Object.keys(data.links[0]).sort()).toEqual(['label','note','savedAt','url']);
});

it('imports only the versioned format and merges without overwriting existing notes',()=>{
 const current=saveLink([],'https://example.com',1000);current[0]!.note='Keep my note';
 const incoming=[{...current[0],note:'Replacement'},...saveLink([],'https://new.example',1000),{url:'javascript:alert(1)',savedAt:1000}];
 const result=importReadingList(JSON.stringify({format:'no-group-reading-list',version:1,links:incoming}),current);expect(result.added).toBe(1);expect(result.skipped).toBe(2);expect(result.links[0]!.note).toBe('Keep my note');expect(()=>importReadingList('{}',current)).toThrow('not a supported');expect(()=>importReadingList('broken',current)).toThrow('valid');
});
