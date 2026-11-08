import { expect, it } from 'vitest';
import { validateURL, publicAddress } from './crawler';
it('only accepts credential-free HTTPS on standard ports', () => {
  expect(validateURL('https://example.com/a#b').href).toBe('https://example.com/a');
  for (const url of ['http://example.com','file:///etc/passwd','https://user:pass@example.com','https://example.com:8080']) expect(() => validateURL(url)).toThrow();
});
it('rejects local, private, mapped, link-local, and reserved addresses', () => {
  for (const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.1.1','172.16.0.1','0.0.0.0','::1','fc00::1','fe80::1','::ffff:127.0.0.1','224.0.0.1','192.0.2.1']) expect(publicAddress(ip), ip).toBe(false);
  expect(publicAddress('8.8.8.8')).toBe(true);
});
