import { validateOutboundUrl } from '../../src/utils/urlValidator';

describe('validateOutboundUrl', () => {
  it('should allow valid http and https URLs', () => {
    expect(validateOutboundUrl('http://example.com')).toBe('http://example.com');
    expect(validateOutboundUrl('https://example.com')).toBe('https://example.com');
    expect(validateOutboundUrl('https://1.1.1.1')).toBe('https://1.1.1.1');
    expect(validateOutboundUrl('https://[2001:4860:4860::8888]')).toBe('https://[2001:4860:4860::8888]');
  });

  it('should throw Error for invalid protocols', () => {
    expect(() => validateOutboundUrl('ftp://example.com')).toThrow('Invalid protocol');
    expect(() => validateOutboundUrl('file:///etc/passwd')).toThrow('Invalid protocol');
    expect(() => validateOutboundUrl('gopher://example.com')).toThrow('Invalid protocol');
  });

  it('should throw Error for malformed URLs', () => {
    expect(() => validateOutboundUrl('not-a-url')).toThrow();
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
    ];

    blockedUrls.forEach((url) => {
      it(`should block internal/reserved URL: ${url}`, () => {
        expect(() => validateOutboundUrl(url)).toThrow('Internal or reserved IP address blocked to prevent SSRF');
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
      it(`should allow external URL: ${url}`, () => {
        expect(validateOutboundUrl(url)).toBe(url);
      });
    });
  });
});
