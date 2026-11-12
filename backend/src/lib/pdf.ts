import PDFDocument from "pdfkit";

export interface PDFLineItem {
  description: string;
  quantity: string;
  unitPrice: string;
  discount?: string;
  taxAmount?: string;
  lineTotal: string;
}

export interface PDFDocumentData {
  title: string; // "TAX INVOICE" | "PURCHASE BILL"
  documentNumber: string;
  date: string;
  dueDate?: string;
  status: string;
  company: {
    name: string;
    ntn?: string | null;
    address?: string | null;
    currency?: string;
  };
  contact: {
    name: string;
    type: string;
    ntn?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  items: PDFLineItem[];
  subtotal: string;
  taxTotal: string;
  total: string;
  paidAmount: string;
  balanceDue: string;
  notes?: string | null;
}

export async function generateDocumentPDF(data: PDFDocumentData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers: Buffer[] = [];

      doc.on("data", (chunk: any) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err: any) => reject(err));

      const currency = data.company.currency || "PKR";

      // Header Banner
      doc.fontSize(20).font("Helvetica-Bold").fillColor("#0F172A").text(data.company.name.toUpperCase(), 40, 40);
      doc.fontSize(9).font("Helvetica").fillColor("#475569");
      if (data.company.ntn) doc.text(`NTN: ${data.company.ntn}`);
      if (data.company.address) doc.text(`Address: ${data.company.address}`);

      // Document Title & Number
      doc.fontSize(16).font("Helvetica-Bold").fillColor("#065F46").text(data.title, 400, 40, { align: "right" });
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#0F172A").text(data.documentNumber, 400, 62, { align: "right" });
      doc.fontSize(9).font("Helvetica").fillColor("#475569");
      doc.text(`Date: ${data.date}`, 400, 78, { align: "right" });
      if (data.dueDate) doc.text(`Due Date: ${data.dueDate}`, 400, 92, { align: "right" });
      doc.text(`Status: ${data.status}`, 400, 106, { align: "right" });

      doc.moveTo(40, 130).lineTo(555, 130).strokeColor("#E2E8F0").lineWidth(1).stroke();

      // Bill To / Vendor Box
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#0F172A").text(data.contact.type === "VENDOR" ? "VENDOR DETAILS:" : "BILL TO:", 40, 145);
      doc.fontSize(10).font("Helvetica-Bold").fillColor("#1E293B").text(data.contact.name, 40, 160);
      doc.fontSize(9).font("Helvetica").fillColor("#475569");
      let contactY = 175;
      if (data.contact.ntn) {
        doc.text(`NTN: ${data.contact.ntn}`, 40, contactY);
        contactY += 14;
      }
      if (data.contact.address) {
        doc.text(`Address: ${data.contact.address}`, 40, contactY);
        contactY += 14;
      }
      if (data.contact.phone || data.contact.email) {
        doc.text(`${data.contact.phone || ""} ${data.contact.email ? `(${data.contact.email})` : ""}`, 40, contactY);
        contactY += 14;
      }

      // Line Items Table Header
      const tableTop = Math.max(contactY + 15, 230);
      doc.rect(40, tableTop, 515, 22).fillColor("#F8FAFC").fill();
      doc.fillColor("#0F172A").fontSize(8).font("Helvetica-Bold");

      doc.text("#", 45, tableTop + 6);
      doc.text("ITEM / DESCRIPTION", 65, tableTop + 6);
      doc.text("QTY", 280, tableTop + 6, { width: 40, align: "right" });
      doc.text("PRICE", 330, tableTop + 6, { width: 55, align: "right" });
      doc.text("DISC", 390, tableTop + 6, { width: 45, align: "right" });
      doc.text("TAX", 440, tableTop + 6, { width: 45, align: "right" });
      doc.text("TOTAL", 490, tableTop + 6, { width: 60, align: "right" });

      doc.moveTo(40, tableTop + 22).lineTo(555, tableTop + 22).strokeColor("#CBD5E1").lineWidth(0.5).stroke();

      // Table Rows
      let currentY = tableTop + 28;
      data.items.forEach((item, index) => {
        if (currentY > 700) {
          doc.addPage();
          currentY = 40;
        }

        doc.font("Helvetica").fontSize(8).fillColor("#1E293B");
        doc.text(String(index + 1), 45, currentY);
        doc.text(item.description || "Item", 65, currentY, { width: 210 });
        doc.text(item.quantity, 280, currentY, { width: 40, align: "right" });
        doc.text(item.unitPrice, 330, currentY, { width: 55, align: "right" });
        doc.text(item.discount || "0.00", 390, currentY, { width: 45, align: "right" });
        doc.text(item.taxAmount || "0.00", 440, currentY, { width: 45, align: "right" });
        doc.text(item.lineTotal, 490, currentY, { width: 60, align: "right" });

        currentY += 20;
        doc.moveTo(40, currentY - 5).lineTo(555, currentY - 5).strokeColor("#F1F5F9").lineWidth(0.5).stroke();
      });

      // Summary Section
      const summaryTop = currentY + 15;
      const summaryLeft = 360;

      doc.font("Helvetica").fontSize(9).fillColor("#475569");
      doc.text("Subtotal:", summaryLeft, summaryTop);
      doc.font("Helvetica-Bold").fillColor("#0F172A").text(`${currency} ${data.subtotal}`, 450, summaryTop, { align: "right", width: 105 });

      doc.font("Helvetica").fontSize(9).fillColor("#475569").text("Sales Tax:", summaryLeft, summaryTop + 16);
      doc.font("Helvetica-Bold").fillColor("#0F172A").text(`${currency} ${data.taxTotal}`, 450, summaryTop + 16, { align: "right", width: 105 });

      doc.moveTo(summaryLeft, summaryTop + 32).lineTo(555, summaryTop + 32).strokeColor("#CBD5E1").lineWidth(0.5).stroke();

      doc.font("Helvetica-Bold").fontSize(11).fillColor("#065F46").text("Grand Total:", summaryLeft, summaryTop + 38);
      doc.text(`${currency} ${data.total}`, 450, summaryTop + 38, { align: "right", width: 105 });

      doc.font("Helvetica").fontSize(9).fillColor("#475569").text("Amount Paid:", summaryLeft, summaryTop + 56);
      doc.font("Helvetica-Bold").fillColor("#0F172A").text(`${currency} ${data.paidAmount}`, 450, summaryTop + 56, { align: "right", width: 105 });

      doc.moveTo(summaryLeft, summaryTop + 72).lineTo(555, summaryTop + 72).strokeColor("#CBD5E1").lineWidth(0.5).stroke();

      doc.font("Helvetica-Bold").fontSize(10).fillColor("#991B1B").text("Balance Due:", summaryLeft, summaryTop + 78);
      doc.text(`${currency} ${data.balanceDue}`, 450, summaryTop + 78, { align: "right", width: 105 });

      // Notes
      if (data.notes) {
        doc.fontSize(8).font("Helvetica-Bold").fillColor("#475569").text("NOTES / TERMS:", 40, summaryTop);
        doc.font("Helvetica").fillColor("#64748B").text(data.notes, 40, summaryTop + 14, { width: 300 });
      }

      // Footer
      doc.fontSize(8).font("Helvetica").fillColor("#94A3B8").text(
        `Generated on ${new Date().toLocaleString()} • Double-Entry ERP System • All amounts in ${currency}`,
        40,
        780,
        { align: "center", width: 515 }
      );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
