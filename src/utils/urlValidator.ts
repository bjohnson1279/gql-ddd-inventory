import { promises as dns } from 'dns';

export async function validateOutboundUrl(urlString: string): Promise<string> {
  const url = new URL(urlString);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Invalid protocol');
  }
  let hostname = url.hostname;
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1);
  }
  if (hostname.endsWith('.')) {
    hostname = hostname.slice(0, -1);
  }

  const checkIsBlocked = (ipOrHostname: string) => {
    return ipOrHostname === 'localhost' ||
      ipOrHostname === '0.0.0.0' ||
      ipOrHostname === '::1' ||
      ipOrHostname === '::' ||
      ipOrHostname.startsWith('127.') ||
      ipOrHostname.startsWith('169.254.') ||
      ipOrHostname.startsWith('10.') ||
      ipOrHostname.startsWith('192.168.') ||
      ipOrHostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./) ||
      ipOrHostname.toLowerCase().startsWith('::ffff:') ||
      ipOrHostname.toLowerCase().startsWith('fe80:') ||
      ipOrHostname.toLowerCase().startsWith('fd') ||
      ipOrHostname.toLowerCase().startsWith('fc');
  };

  if (checkIsBlocked(hostname)) {
    throw new Error('Internal or reserved IP address blocked to prevent SSRF');
  }

  try {
    const { address } = await dns.lookup(hostname);
    if (checkIsBlocked(address)) {
      throw new Error('Internal or reserved IP address blocked to prevent SSRF');
    }
  } catch (err: any) {
    if (err.message === 'Internal or reserved IP address blocked to prevent SSRF') {
      throw err;
    }
    // DNS resolution failed, could be an invalid domain.
    throw new Error('Failed to resolve hostname');
  }

  return urlString;
}
