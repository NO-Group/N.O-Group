export interface SearchOptions { page: number; freshness: ''|'pd'|'pw'|'pm'|'py'; country: 'ALL'|'NG'|'US'|'GB'; safeSearch: 'off'|'moderate'|'strict' }
export const defaultSearchOptions: SearchOptions = {page:0,freshness:'',country:'ALL',safeSearch:'moderate'};
export function readSearchOptions(body: Record<string,unknown>): SearchOptions {
  const options = {...defaultSearchOptions};
  if (body.page !== undefined) { if (!Number.isInteger(body.page) || Number(body.page)<0 || Number(body.page)>9) throw Error('Page must be between 0 and 9.'); options.page=Number(body.page); }
  if (body.freshness !== undefined) { if (!['','pd','pw','pm','py'].includes(String(body.freshness)) || typeof body.freshness!=='string') throw Error('Invalid freshness filter.'); options.freshness=body.freshness as SearchOptions['freshness']; }
  if (body.country !== undefined) { if (!['ALL','NG','US','GB'].includes(String(body.country)) || typeof body.country!=='string') throw Error('Invalid country filter.'); options.country=body.country as SearchOptions['country']; }
  if (body.safeSearch !== undefined) { if (!['off','moderate','strict'].includes(String(body.safeSearch)) || typeof body.safeSearch!=='string') throw Error('Invalid SafeSearch setting.'); options.safeSearch=body.safeSearch as SearchOptions['safeSearch']; }
  return options;
}
export function optionsFromURL(url: URL): SearchOptions {
  try { return readSearchOptions({page:Number(url.searchParams.get('page')||0),freshness:url.searchParams.get('freshness')||'',country:url.searchParams.get('country')||'ALL',safeSearch:url.searchParams.get('safeSearch')||'moderate'}); }
  catch { return {...defaultSearchOptions}; }
}
export function writeSearchURL(url: URL, q: string, options: SearchOptions) {
  url.searchParams.set('q',q);
  for(const name of ['page','freshness','country','safeSearch'] as const) {
    if(options[name]===defaultSearchOptions[name]) url.searchParams.delete(name);else url.searchParams.set(name,String(options[name]));
  }
}
