import { randomBytes } from 'node:crypto';

process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.DATABASE_URL = 'postgresql://x:y@localhost:5432/db';
process.env.DATABASE_URL_APP = 'postgresql://x:y@localhost:5432/db';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(32);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(32);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CryptoService } = require('./crypto.service') as typeof import('./crypto.service');

describe('CryptoService', () => {
  const c = new CryptoService();
  it('round-trips and uses a fresh IV each time', () => {
    const a = c.encrypt('0551234567');
    const b = c.encrypt('0551234567');
    expect(a).not.toEqual(b);
    expect(c.decrypt(a)).toBe('0551234567');
  });
  it('detects tampering', () => {
    const parts = c.encrypt('secret').split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    expect(() => c.decrypt(parts.join('.'))).toThrow();
  });
  it('hashes tokens deterministically', () => {
    expect(CryptoService.sha256('x')).toHaveLength(64);
    expect(CryptoService.token()).not.toEqual(CryptoService.token());
  });
});
