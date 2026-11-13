import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { prisma } from "../../config/prisma.js";

export interface ReportExportData {
  title: string;
  companyName: string;
  subtitle?: string;
  columns: { header: string; key: string; width: number; align?: "left" | "right" | "center" }[];
  rows: Record<string, any>[];
  summaryRows?: Record<string, any>[];
}

export class ExportService {
  /**
   * Generates a styled Excel workbook buffer using ExcelJS
   */
  static async generateExcel(data: ReportExportData): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Acme Enterprise ERP";
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(data.title.substring(0, 31));

    // 1. Company Header
    worksheet.mergeCells("A1", `${String.fromCharCode(64 + Math.max(data.columns.length, 3))}1`);
    const titleCell = worksheet.getCell("A1");
    titleCell.value = data.companyName.toUpperCase();
    titleCell.font = { name: "Arial", size: 14, bold: true, color: { argb: "FF0F172A" } };
    titleCell.alignment = { horizontal: "left" };

    // 2. Report Title & Subtitle
    worksheet.mergeCells("A2", `${String.fromCharCode(64 + Math.max(data.columns.length, 3))}2`);
    const subCell = worksheet.getCell("A2");
    subCell.value = `${data.title} ${data.subtitle ? `— ${data.subtitle}` : ""}`;
    subCell.font = { name: "Arial", size: 10, italic: true, color: { argb: "FF475569" } };
    subCell.alignment = { horizontal: "left" };

    worksheet.addRow([]); // Blank row

    // 3. Table Column Headers
    const headerRow = worksheet.addRow(data.columns.map((c) => c.header));
    headerRow.height = 24;
    headerRow.eachCell((cell, colIndex) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1E293B" } // Obsidian / Slate
      };
      cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.alignment = {
        vertical: "middle",
        horizontal: data.columns[colIndex - 1]?.align || "left"
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "medium", color: { argb: "FF065F46" } }
      };
    });

    // 4. Data Rows
    for (const r of data.rows) {
      const rowValues = data.columns.map((c) => r[c.key] ?? "");
      const row = worksheet.addRow(rowValues);
      row.height = 20;
      row.eachCell((cell, colIndex) => {
        cell.font = { name: "Arial", size: 9 };
        const align = data.columns[colIndex - 1]?.align || "left";
        cell.alignment = { vertical: "middle", horizontal: align };
        cell.border = {
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } }
        };
      });
    }

    // 5. Summary / Footer Rows
    if (data.summaryRows && data.summaryRows.length > 0) {
      for (const sum of data.summaryRows) {
        const sumValues = data.columns.map((c) => sum[c.key] ?? "");
        const sumRow = worksheet.addRow(sumValues);
        sumRow.height = 22;
        sumRow.eachCell((cell, colIndex) => {
          cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF0F172A" } };
          cell.alignment = {
            vertical: "middle",
            horizontal: data.columns[colIndex - 1]?.align || "left"
          };
          cell.border = {
            top: { style: "thin", color: { argb: "FF0F172A" } },
            bottom: { style: "double", color: { argb: "FF0F172A" } }
          };
        });
      }
    }

    // Adjust column widths
    data.columns.forEach((col, idx) => {
      worksheet.getColumn(idx + 1).width = col.width || 18;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Generates a styled PDF report buffer using PDFKit
   */
  static async generatePDF(data: ReportExportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 40, size: "A4", layout: data.columns.length > 6 ? "landscape" : "portrait" });
        const buffers: Buffer[] = [];

        doc.on("data", (chunk: any) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", (err: any) => reject(err));

        // Company Banner
        doc.fontSize(16).font("Helvetica-Bold").fillColor("#0F172A").text(data.companyName.toUpperCase(), 40, 40);
        doc.fontSize(12).font("Helvetica-Bold").fillColor("#065F46").text(data.title.toUpperCase(), 40, 62);
        if (data.subtitle) {
          doc.fontSize(8).font("Helvetica").fillColor("#64748B").text(data.subtitle, 40, 78);
        }

        const pageWidth = doc.page.width - 80;
        let y = 100;

        // Table Header
        const totalColWidth = data.columns.reduce((acc, c) => acc + c.width, 0);
        const scale = pageWidth / totalColWidth;

        doc.rect(40, y, pageWidth, 20).fill("#1E293B");
        doc.fillColor("#FFFFFF").fontSize(8).font("Helvetica-Bold");

        let curX = 45;
        data.columns.forEach((c) => {
          const colW = c.width * scale;
          doc.text(c.header, curX, y + 6, { width: colW - 6, align: c.align || "left" });
          curX += colW;
        });

        y += 24;

        // Table Rows
        doc.font("Helvetica").fontSize(8).fillColor("#1E293B");

        for (const row of data.rows) {
          if (y > doc.page.height - 60) {
            doc.addPage();
            y = 40;
          }

          curX = 45;
          data.columns.forEach((c) => {
            const colW = c.width * scale;
            const val = String(row[c.key] ?? "");
            doc.text(val, curX, y, { width: colW - 6, align: c.align || "left" });
            curX += colW;
          });

          y += 16;
          doc.moveTo(40, y - 2).lineTo(40 + pageWidth, y - 2).strokeColor("#E2E8F0").lineWidth(0.5).stroke();
        }

        // Summary Rows
        if (data.summaryRows && data.summaryRows.length > 0) {
          y += 4;
          for (const sRow of data.summaryRows) {
            if (y > doc.page.height - 60) {
              doc.addPage();
              y = 40;
            }

            doc.font("Helvetica-Bold").fontSize(8).fillColor("#0F172A");
            curX = 45;
            data.columns.forEach((c) => {
              const colW = c.width * scale;
              const val = String(sRow[c.key] ?? "");
              doc.text(val, curX, y, { width: colW - 6, align: c.align || "left" });
              curX += colW;
            });

            y += 16;
            doc.moveTo(40, y - 2).lineTo(40 + pageWidth, y - 2).strokeColor("#0F172A").lineWidth(1).stroke();
          }
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
