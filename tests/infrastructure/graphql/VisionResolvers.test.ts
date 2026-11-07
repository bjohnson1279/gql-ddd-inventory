import { visionResolvers } from '../../../src/infrastructure/graphql/visionResolvers';
import { InspectionStatus } from '../../../src/domain/vision/VisionEntities';

describe('visionResolvers', () => {
  const validContext = {
    auth: {
      tenantId: 'tenant-123'
    }
  };

  it('should process a valid external dock image successfully for an authenticated tenant', () => {
    const result = visionResolvers.Mutation.processDockImage(
      null,
      {
        imageUrl: 'https://images.example.com/dock-scan.jpg',
        dockStationId: 'dock-station-1'
      },
      validContext
    );

    expect(result).toBeDefined();
    expect(result.tenantId).toBe('tenant-123');
    expect(result.dockStationId).toBe('dock-station-1');
    expect(result.imageUrl).toBe('https://images.example.com/dock-scan.jpg');
    expect(result.status).toBe(InspectionStatus.PASSED);
  });

  it('should support tenantId provided directly on context', () => {
    const result = visionResolvers.Mutation.processDockImage(
      null,
      {
        imageUrl: 'https://images.example.com/dock-scan.jpg',
        dockStationId: 'dock-station-2'
      },
      { tenantId: 'tenant-456' }
    );

    expect(result).toBeDefined();
    expect(result.tenantId).toBe('tenant-456');
    expect(result.dockStationId).toBe('dock-station-2');
  });

  it('should throw an authentication error when tenantId is missing from context', () => {
    expect(() => {
      visionResolvers.Mutation.processDockImage(
        null,
        {
          imageUrl: 'https://images.example.com/dock-scan.jpg',
          dockStationId: 'dock-station-1'
        },
        {}
      );
    }).toThrow('Authentication required: Access token is missing or invalid.');

    expect(() => {
      visionResolvers.Mutation.processDockImage(
        null,
        {
          imageUrl: 'https://images.example.com/dock-scan.jpg',
          dockStationId: 'dock-station-1'
        },
        null
      );
    }).toThrow('Authentication required: Access token is missing or invalid.');
  });

  it('should reject localhost and internal loopback IP URLs to prevent SSRF', () => {
    expect(() => {
      visionResolvers.Mutation.processDockImage(
        null,
        {
          imageUrl: 'http://localhost/image.png',
          dockStationId: 'dock-station-1'
        },
        validContext
      );
    }).toThrow('Internal or reserved IP address blocked to prevent SSRF');

    expect(() => {
      visionResolvers.Mutation.processDockImage(
        null,
        {
          imageUrl: 'http://127.0.0.1/admin/internal.jpg',
          dockStationId: 'dock-station-1'
        },
        validContext
      );
    }).toThrow('Internal or reserved IP address blocked to prevent SSRF');

    expect(() => {
      visionResolvers.Mutation.processDockImage(
        null,
        {
          imageUrl: 'http://169.254.169.254/latest/meta-data/',
          dockStationId: 'dock-station-1'
        },
        validContext
      );
    }).toThrow('Internal or reserved IP address blocked to prevent SSRF');
  });

  it('should reject invalid URL schemes or non-string inputs', () => {
    expect(() => {
      visionResolvers.Mutation.processDockImage(
        null,
        {
          imageUrl: 'ftp://example.com/image.png',
          dockStationId: 'dock-station-1'
        },
        validContext
      );
    }).toThrow('Invalid protocol');

    expect(() => {
      visionResolvers.Mutation.processDockImage(
        null,
        {
          imageUrl: 12345 as any,
          dockStationId: 'dock-station-1'
        },
        validContext
      );
    }).toThrow('URL must be a string');
  });
});
