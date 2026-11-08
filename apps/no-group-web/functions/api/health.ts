import { json } from '../../platform/contracts';
import type { Context } from '../../platform/contracts';
export async function onRequest({env}: Context) {
  try {
    if (!env.BRAVE_SEARCH_API_KEY || !env.QUOTA_HASH_KEY || env.QUOTA_HASH_KEY.length < 32 || !env.SEARCH_DB) throw Error();
    await env.SEARCH_DB.prepare('SELECT COUNT(*) AS count FROM provider_cooldown').first();
    return json({status:'ok'},200);
  } catch { return json({status:'not-ready'},503); }
}
