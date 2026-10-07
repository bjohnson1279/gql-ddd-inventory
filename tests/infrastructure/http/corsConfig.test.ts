import { getCorsAllowedOrigins } from '../../../src/infrastructure/http/corsConfig';

describe('getCorsAllowedOrigins', () => {
  const defaultNonProdOrigins = ['http://localhost:3000', 'http://localhost:4000'];

  describe('production environment', () => {
    it('should throw fatal error if ALLOWED_ORIGINS is not set in production', () => {
      const env = { NODE_ENV: 'production', ALLOWED_ORIGINS: '' };
      expect(() => getCorsAllowedOrigins(env)).toThrow(
        'FATAL ERROR: ALLOWED_ORIGINS must be set to specific origins in production to prevent overly permissive CORS.'
      );
    });

    it('should throw fatal error if ALLOWED_ORIGINS is set to wildcard * in production', () => {
      const env = { NODE_ENV: 'production', ALLOWED_ORIGINS: '*' };
      expect(() => getCorsAllowedOrigins(env)).toThrow(
        'FATAL ERROR: ALLOWED_ORIGINS must be set to specific origins in production to prevent overly permissive CORS.'
      );
    });

    it('should parse valid origins in production', () => {
      const env = {
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: 'https://example.com, https://app.example.com',
      };
      const result = getCorsAllowedOrigins(env);
      expect(result).toEqual(['https://example.com', 'https://app.example.com']);
    });
  });

  describe('non-production environment', () => {
    it('should fall back to default localhost origins if ALLOWED_ORIGINS is unset', () => {
      const env = { NODE_ENV: 'development' };
      const result = getCorsAllowedOrigins(env);
      expect(result).toEqual(defaultNonProdOrigins);
    });

    it('should fall back to default localhost origins if ALLOWED_ORIGINS is wildcard *', () => {
      const env = { NODE_ENV: 'development', ALLOWED_ORIGINS: '*' };
      const result = getCorsAllowedOrigins(env);
      expect(result).toEqual(defaultNonProdOrigins);
      expect(result).not.toContain('*');
    });

    it('should parse specific origins in non-production when provided', () => {
      const env = {
        NODE_ENV: 'development',
        ALLOWED_ORIGINS: 'http://localhost:8080, http://127.0.0.1:8080',
      };
      const result = getCorsAllowedOrigins(env);
      expect(result).toEqual(['http://localhost:8080', 'http://127.0.0.1:8080']);
    });

    it('should throw an error if a malformed origin is provided', () => {
      const env = {
        NODE_ENV: 'development',
        ALLOWED_ORIGINS: 'invalid-origin-url',
      };
      expect(() => getCorsAllowedOrigins(env)).toThrow('Invalid origin in ALLOWED_ORIGINS: invalid-origin-url');
    });
  });
});
