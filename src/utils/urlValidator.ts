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

  const segments = hostname.split('.');
  const isPureInteger = /^\d+$/.test(hostname);
  const allNumeric = segments.every(s => /^(0x)?[0-9a-f]+$/i.test(s) || /^\d+$/.test(s));
  const hasBypassEncoding = segments.some(s => /^0\d+/.test(s) || /^0x/i.test(s));

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
    hostname.toLowerCase().startsWith('fc') ||
    isPureInteger ||
    (allNumeric && hasBypassEncoding)
  ) {
    throw new Error('Internal or reserved IP address blocked to prevent SSRF');
  }
  return urlString;
}
