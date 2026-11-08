import { handleSearch } from '../../platform/search-handler';
import type { Context } from '../../platform/contracts';
export const onRequest = (context: Context) => handleSearch(context);
