import { validateOutboundUrl } from '../../src/utils/urlValidator';

describe('validateOutboundUrl', () => {
  it('should allow valid http and https URLs', async () => {
    await expect(validateOutboundUrl('http://example.com')).resolves.toBe('http://example.com');
    await expect(validateOutboundUrl('https://example.com')).resolves.toBe('https://example.com');
    await expect(validateOutboundUrl('https://1.1.1.1')).resolves.toBe('https://1.1.1.1');
    await expect(validateOutboundUrl('https://[2001:4860:4860::8888]')).resolves.toBe('https://[2001:4860:4860::8888]');
  });

  it('should throw Error for invalid protocols', async () => {
    await expect(validateOutboundUrl('ftp://example.com')).rejects.toThrow('Invalid protocol');
    await expect(validateOutboundUrl('file:///etc/passwd')).rejects.toThrow('Invalid protocol');
    await expect(validateOutboundUrl('gopher://example.com')).rejects.toThrow('Invalid protocol');
  });

  it('should throw Error for malformed URLs', async () => {
    await expect(validateOutboundUrl('not-a-url')).rejects.toThrow();
  });

  describe('Runtime type bypasses', () => {
    it('should throw Error when given non-string or invalid runtime types', async () => {
      // Bypassing TS compiler checks using `as any` to simulate runtime vulnerabilities
      await expect(validateOutboundUrl(null as any)).rejects.toThrow();
      await expect(validateOutboundUrl(undefined as any)).rejects.toThrow();
      await expect(validateOutboundUrl(12345 as any)).rejects.toThrow();
      await expect(validateOutboundUrl({} as any)).rejects.toThrow();
      await expect(validateOutboundUrl([] as any)).rejects.toThrow();
      await expect(validateOutboundUrl('' as any)).rejects.toThrow();
    });
  });

  describe('SSRF Protection (Blocked IPs/Hostnames)', () => {
    const blockedUrls = [
      'http://localhost',
      'https://localhost',
      'http://0.0.0.0',
      'http://127.0.0.1',
      'http://127.10.0.1',
      'http://169.254.169.254',
      'http://10.0.0.1',
      'http://192.168.1.1',
      'http://172.16.0.1',
      'http://172.20.0.1',
      'http://172.31.255.255',
      'http://[::1]',
      'http://[::]',
      'http://[::ffff:192.168.1.1]',
      'http://[fe80::1]',
      'http://[fc00::1]',
      'http://[fd00::1]',
      // FQDN trailing dots bypass
      'http://localhost.',
      'http://127.0.0.1.',
      'http://169.254.169.254.',
    ];

    blockedUrls.forEach((url) => {
      it(`should block internal/reserved URL: ${url}`, async () => {
        await expect(validateOutboundUrl(url)).rejects.toThrow('Internal or reserved IP address blocked to prevent SSRF');
      });
    });
  });

  describe('Allowed external IPs', () => {
    const allowedUrls = [
      'http://172.15.0.1', // Outside the 172.16-31 range
      'http://172.32.0.1', // Outside the 172.16-31 range
      'http://8.8.8.8',
      'http://[2606:4700:4700::1111]',
    ];

    allowedUrls.forEach((url) => {
      it(`should allow external URL: ${url}`, async () => {
        await expect(validateOutboundUrl(url)).resolves.toBe(url);
      });
    });
  });
});
