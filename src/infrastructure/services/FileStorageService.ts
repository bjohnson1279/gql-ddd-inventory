import fs from 'fs';
import path from 'path';

export class FileStorageService {
  private readonly storageDir: string;

  constructor(customStorageDir?: string) {
    // Resolve relative to project root (3 levels up from src/infrastructure/services)
    this.storageDir = customStorageDir || path.resolve(__dirname, '../../../uploads/reports');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  public getFilePath(filename: string): string {
    if (typeof filename !== 'string' || filename.trim() === '') {
      throw new Error("Invalid file name: filename must be a non-empty string.");
    }
    // Security check: reject null bytes to prevent path truncation or unhandled errors
    if (filename.includes('\0')) {
      throw new Error("Invalid file path: null bytes are not permitted.");
    }
    const fullPath = path.resolve(this.storageDir, filename);
    if (!fullPath.startsWith(this.storageDir + path.sep)) {
      throw new Error("Invalid file path: path traversal detected.");
    }
    return fullPath;
  }

  public async saveFile(filename: string, buffer: Buffer): Promise<string> {
    const fullPath = this.getFilePath(filename);
    fs.writeFileSync(fullPath, buffer);
    return `/uploads/reports/${filename}`;
  }

  public getWriteStream(filename: string): fs.WriteStream {
    const fullPath = this.getFilePath(filename);
    return fs.createWriteStream(fullPath);
  }
}
