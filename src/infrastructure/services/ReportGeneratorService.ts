import { prisma } from "../persistence/prismaClient";
import { FileStorageService } from "./FileStorageService";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { format as formatCsv } from "fast-csv";
import fs from "fs";
import crypto from "crypto";

export class ReportGeneratorService {
  private fileStorage = new FileStorageService();

  public async generateReport(reportDefinitionId: string, executionId: string, format: string): Promise<string> {
    const def = await prisma.reportDefinitionModel.findUnique({ where: { id: reportDefinitionId } });
    if (!def) throw new Error("Report definition not found");

    // Mock query logic based on type
    let data: any[] = [];
    if (def.type === "INVENTORY_VALUATION") {
      const inventory = await prisma.inventoryItem.findMany({ take: 100 });
      data = inventory.map(i => ({ sku: i.sku, quantity: i.quantity, location: i.locationId }));
    } else {
      data = [{ note: "No data available for this report type" }];
    }

    const filename = `${def.type.toLowerCase()}_${executionId}.${format.toLowerCase()}`;
    
    if (format.toLowerCase() === "csv") {
      return await this.generateCsv(filename, data);
    } else if (format.toLowerCase() === "xlsx") {
      return await this.generateXlsx(filename, data);
    } else if (format.toLowerCase() === "pdf") {
      return await this.generatePdf(filename, data);
    }

    throw new Error(`Unsupported format: ${format}`);
  }

  private async generateCsv(filename: string, data: any[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const stream = this.fileStorage.getWriteStream(filename);
      const csvStream = formatCsv({ headers: true });
      csvStream.pipe(stream);
      data.forEach(row => csvStream.write(row));
      csvStream.end();
      stream.on("finish", () => resolve(`/uploads/reports/${filename}`));
      stream.on("error", reject);
    });
  }

  private async generateXlsx(filename: string, data: any[]): Promise<string> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Report");
    if (data.length > 0) {
      sheet.columns = Object.keys(data[0]).map(key => ({ header: key, key }));
      data.forEach(row => sheet.addRow(row));
    }
    const fullPath = this.fileStorage.getFilePath(filename);
    await workbook.xlsx.writeFile(fullPath);
    return `/uploads/reports/${filename}`;
  }

  private async generatePdf(filename: string, data: any[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument();
      const stream = this.fileStorage.getWriteStream(filename);
      doc.pipe(stream);
      
      doc.fontSize(16).text("Report Export", { align: "center" });
      doc.moveDown();
      doc.fontSize(10);
      
      data.forEach((row, index) => {
        doc.text(`${index + 1}. ${JSON.stringify(row)}`);
        doc.moveDown(0.5);
      });
      
      doc.end();
      stream.on("finish", () => resolve(`/uploads/reports/${filename}`));
      stream.on("error", reject);
    });
  }
}
