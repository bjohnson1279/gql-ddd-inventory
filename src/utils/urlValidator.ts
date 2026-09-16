export function validateOutboundUrl(urlString: string): string {
  const url = new URL(urlString);
  const protocol = url.protocol;
  if (protocol !== 'http:' && protocol !== 'https:') {
    throw new Error('Invalid protocol');
  }
  let hostname = url.hostname;
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }
  if (hostname.endsWith('.')) {
    hostname = hostname.slice(0, -1);
  }

  // Block advanced SSRF bypasses: hex, octal, integer IPs
  if (/^\d+$/.test(hostname)) {
    throw new Error('Internal or reserved IP address blocked to prevent SSRF');
  }
  const segments = hostname.split('.');
  if (segments.length > 0 && segments.length <= 4) {
    const isAllNumeric = segments.every(s => /^(0x[0-9a-fA-F]+|0[0-7]*|[1-9][0-9]*)$/i.test(s));
    const hasSpecialEncoding = segments.some(s => /^0x[0-9a-fA-F]+$/i.test(s) || (s.startsWith('0') && s.length > 1));
    if (isAllNumeric && hasSpecialEncoding) {
      throw new Error('Internal or reserved IP address blocked to prevent SSRF');
    }
  }

  if (
    hostname === 'localhost' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '::' ||
    hostname.startsWith('127.') ||
    hostname.startsWith('169.254.') ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
    hostname.toLowerCase().startsWith('::ffff:') ||
    hostname.toLowerCase().startsWith('fe80:') ||
    hostname.toLowerCase().startsWith('fd') ||
    hostname.toLowerCase().startsWith('fc')
  ) {
    throw new Error('Internal or reserved IP address blocked to prevent SSRF');
  }
  return urlString;
}
