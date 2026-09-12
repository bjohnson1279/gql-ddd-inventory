import fs from 'fs';
import path from 'path';

export class FileStorageService {
  private readonly storageDir: string;

  constructor() {
    this.storageDir = path.resolve(__dirname, '../../../../uploads/reports');
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  public getFilePath(filename: string): string {
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
