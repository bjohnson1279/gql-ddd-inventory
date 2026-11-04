import fs from 'fs';
import path from 'path';
import os from 'os';
import { FileStorageService } from '../../../src/infrastructure/services/FileStorageService';

describe('FileStorageService', () => {
  let tempDir: string;
  let service: FileStorageService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'filestorage-test-'));
    service = new FileStorageService(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should instantiate and create storage directory if it does not exist', () => {
    const customDir = path.join(tempDir, 'sub', 'reports');
    const customService = new FileStorageService(customDir);
    expect(fs.existsSync(customDir)).toBe(true);
    const validPath = customService.getFilePath('report.csv');
    expect(validPath).toBe(path.join(customDir, 'report.csv'));
  });

  it('should resolve safe filename within storage directory', () => {
    const fullPath = service.getFilePath('report-123.csv');
    expect(fullPath).toBe(path.join(tempDir, 'report-123.csv'));
  });

  it('should throw an error for path traversal attempts', () => {
    expect(() => service.getFilePath('../etc/passwd')).toThrow('path traversal detected');
    expect(() => service.getFilePath('../../secret.txt')).toThrow('path traversal detected');
    expect(() => service.getFilePath('/etc/passwd')).toThrow('path traversal detected');
  });

  it('should reject null bytes in filename', () => {
    expect(() => service.getFilePath('report.csv\0.evil')).toThrow('null bytes are not permitted');
  });

  it('should reject invalid or empty filename inputs', () => {
    expect(() => service.getFilePath('')).toThrow('filename must be a non-empty string');
    expect(() => service.getFilePath('   ')).toThrow('filename must be a non-empty string');
    expect(() => (service as any).getFilePath(null)).toThrow('filename must be a non-empty string');
    expect(() => (service as any).getFilePath(undefined)).toThrow('filename must be a non-empty string');
    expect(() => (service as any).getFilePath(12345)).toThrow('filename must be a non-empty string');
  });

  it('should save file safely and return the public upload path', async () => {
    const filename = 'sample-report.txt';
    const buffer = Buffer.from('hello world', 'utf8');
    const result = await service.saveFile(filename, buffer);
    expect(result).toBe('/uploads/reports/sample-report.txt');
    expect(fs.readFileSync(path.join(tempDir, filename), 'utf8')).toBe('hello world');
  });
});
