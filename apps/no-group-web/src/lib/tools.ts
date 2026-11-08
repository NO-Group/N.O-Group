export function formatJSON(value: string): string { return JSON.stringify(JSON.parse(value), null, 2); }
export function encodeBase64(value: string): string {
  return btoa(Array.from(new TextEncoder().encode(value), byte => String.fromCharCode(byte)).join(''));
}
export function decodeBase64(value: string): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(value.trim()), char => char.charCodeAt(0)));
}
