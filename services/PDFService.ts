// services/PDFService.ts
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { WeeklyReport, MonthlyReport } from '@/types/Report';
import { DataService } from './DataService';

/**
 * PDFService - generates printable A4 HTML -> PDF using expo-print,
 * moves to FileSystem.documentDirectory/reports/ and returns the file URI.
 *
 * Backwards-compatible API:
 * - generateWeeklyPDF(weeklyReport): Promise<string>  // returns saved file URI (same as original)
 * - generateMonthlyPDF(monthlyReport): Promise<string>
 *
 * Advanced API (new):
 * - generateWeeklyPDFAdvanced(weeklyReport, opts): Promise<{ uri?: string; base64?: string }>
 * - generateMonthlyPDFAdvanced(monthlyReport, opts): Promise<{ uri?: string; base64?: string }>
 *
 * Advanced options:
 *  - returnBase64?: boolean  -> if true, returns base64 content instead of saving file
 *  - logoPath?: string       -> optional image URL or file:// URI to include in the HTML
 */

const REPORTS_DIR = `${FileSystem.documentDirectory}reports/`;

export class PDFService {
  /* ------------------ Backwards-compatible methods ------------------ */

  // original-style: returns URI string (throws on failure)
  static async generateWeeklyPDF(weeklyReport: WeeklyReport): Promise<string> {
    const res = await this.generateWeeklyPDFAdvanced(weeklyReport, { returnBase64: false });
    if (!res.uri) throw new Error('Failed to generate weekly PDF (no uri returned)');
    return res.uri;
  }

  static async generateMonthlyPDF(monthlyReport: MonthlyReport): Promise<string> {
    const res = await this.generateMonthlyPDFAdvanced(monthlyReport, { returnBase64: false });
    if (!res.uri) throw new Error('Failed to generate monthly PDF (no uri returned)');
    return res.uri;
  }

  /* ------------------ Advanced methods (new) ------------------ */

  static async generateWeeklyPDFAdvanced(
    weeklyReport: WeeklyReport,
    opts?: { returnBase64?: boolean; logoPath?: string }
  ): Promise<{ uri?: string; base64?: string }> {
    try {
      const html = this.generateWeeklyHTML(weeklyReport, opts?.logoPath);

      const printOptions: Parameters<typeof Print.printToFileAsync>[0] = {
        html,
        base64: !!opts?.returnBase64,
      };

      const result = await Print.printToFileAsync(printOptions);
      // result: { uri, numberOfPages?, base64? }

      if (opts?.returnBase64 && result.base64) {
        return { base64: result.base64 };
      }

      if (!result.uri) {
        throw new Error('expo-print returned no URI for generated PDF');
      }

      await this.ensureReportsDir();

      const fileName = this.safeFileName(
        `DODOMA_CTF_Week_${weeklyReport.weekNumber}_${weeklyReport.weekStartDate}.pdf`
      );
      const newUri = `${REPORTS_DIR}${fileName}`;

      try {
        await FileSystem.moveAsync({ from: result.uri, to: newUri });
      } catch (moveErr) {
        console.warn('PDFService.moveAsync failed, attempting copy fallback', moveErr);
        try {
          await FileSystem.copyAsync({ from: result.uri, to: newUri });
          await FileSystem.deleteAsync(result.uri, { idempotent: true });
        } catch (copyErr) {
          console.error('PDFService.copyAsync fallback also failed', copyErr);
          // return original cached uri as last resort
          return { uri: result.uri };
        }
      }

      return { uri: newUri };
    } catch (error) {
      console.error('generateWeeklyPDFAdvanced error', error);
      throw new Error('Failed to generate weekly PDF');
    }
  }

  static async generateMonthlyPDFAdvanced(
    monthlyReport: MonthlyReport,
    opts?: { returnBase64?: boolean; logoPath?: string }
  ): Promise<{ uri?: string; base64?: string }> {
    try {
      const html = this.generateMonthlyHTML(monthlyReport, opts?.logoPath);

      const printOptions: Parameters<typeof Print.printToFileAsync>[0] = {
        html,
        base64: !!opts?.returnBase64,
      };

      const result = await Print.printToFileAsync(printOptions);

      if (opts?.returnBase64 && result.base64) {
        return { base64: result.base64 };
      }

      if (!result.uri) {
        throw new Error('expo-print returned no URI for generated PDF');
      }

      await this.ensureReportsDir();

      const monthName = DataService.getMonthName(monthlyReport.month);
      const fileName = this.safeFileName(`DODOMA_CTF_${monthName}_${monthlyReport.year}.pdf`);
      const newUri = `${REPORTS_DIR}${fileName}`;

      try {
        await FileSystem.moveAsync({ from: result.uri, to: newUri });
      } catch (moveErr) {
        console.warn('PDFService.moveAsync failed, attempting copy fallback', moveErr);
        try {
          await FileSystem.copyAsync({ from: result.uri, to: newUri });
          await FileSystem.deleteAsync(result.uri, { idempotent: true });
        } catch (copyErr) {
          console.error('PDFService.copyAsync fallback also failed', copyErr);
          return { uri: result.uri };
        }
      }

      return { uri: newUri };
    } catch (error) {
      console.error('generateMonthlyPDFAdvanced error', error);
      throw new Error('Failed to generate monthly PDF');
    }
  }

  /* ------------------ Printable HTML templates ------------------ */

  private static generateWeeklyHTML(report: WeeklyReport, logoPath?: string): string {
    const weekStart = new Date(report.weekStartDate);
    const weekEnd = new Date(report.weekEndDate);
    const logoHtml = logoPath ? `<img src="${logoPath}" class="brand-logo" alt="logo"/>` : '';

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Weekly Report - Week ${escapeHtml(String(report.weekNumber))}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    html,body { height:100%; margin:0; padding:0; background:#fff; }
    body{font-family:"Helvetica Neue", Arial, sans-serif;color:#222;font-size:12px;line-height:1.4}
    .doc-header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1e3a8a;padding-bottom:10px;margin-bottom:12px}
    .brand{display:flex;align-items:center;gap:12px}
    .brand-logo{width:56px;height:56px;object-fit:contain}
    .brand-title{font-size:18px;font-weight:700;color:#1e3a8a}
    .meta{text-align:right;font-size:12px;color:#555}
    .report-info{background:#f8fafc;padding:10px;border-radius:6px;margin-bottom:14px;display:flex;justify-content:space-between;gap:12px}
    .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px}
    .summary .card{background:#fff;border:1px solid #e6eef8;padding:10px;border-radius:6px;text-align:center}
    .summary .value{font-size:18px;font-weight:700;color:#1e3a8a}
    .summary .label{font-size:11px;color:#6b7280;margin-top:6px}
    table{width:100%;border-collapse:collapse;margin-top:6px}
    thead{background:#f1f5f9}
    thead th{padding:8px 10px;border:1px solid #e6eef8;font-weight:700;text-align:left;font-size:12px}
    tbody td{padding:8px 10px;border:1px solid #e6eef8;vertical-align:top;font-size:12px}
    tbody tr:nth-child(even) td{background:#fcfdff}
    thead{display:table-header-group}
    tfoot{display:table-row-group}
    .daily-row,.card{page-break-inside:avoid}
    .doc-footer{margin-top:18px;border-top:1px solid #e6eef8;padding-top:10px;text-align:center;color:#666;font-size:11px}
    .signatures{display:flex;gap:32px;margin-top:18px}
    .signature{flex:1;text-align:left}
    .sig-line{margin-top:36px;border-top:1px solid #ccc;width:70%}
  </style>
</head>
<body>
  <div class="doc-header">
    <div class="brand">
      ${logoHtml}
      <div>
        <div class="brand-title">DODOMA CTF</div>
        <div style="font-size:12px;color:#666">Student Canvassing Weekly Report</div>
      </div>
    </div>
    <div class="meta">
      <div><strong>Week:</strong> ${escapeHtml(String(report.weekNumber))}</div>
      <div><strong>Period:</strong> ${escapeHtml(weekStart.toLocaleDateString())} – ${escapeHtml(weekEnd.toLocaleDateString())}</div>
      <div style="margin-top:6px;">Generated: ${escapeHtml(new Date().toLocaleString())}</div>
    </div>
  </div>

  <div class="report-info">
    <div>
      <div><strong>Student:</strong> ${escapeHtml(report.studentName || '')}</div>
      <div style="color:#555;margin-top:4px;"><strong>Phone:</strong> ${escapeHtml(report.phoneNumber || '')}</div>
    </div>
    <div style="text-align:right;color:#555">
      <div><strong>Week Start:</strong> ${escapeHtml(weekStart.toLocaleDateString())}</div>
      <div style="margin-top:4px;"><strong>Week End:</strong> ${escapeHtml(weekEnd.toLocaleDateString())}</div>
    </div>
  </div>

  <div class="summary">
    <div class="card"><div class="value">${escapeHtml(String(Number(report.totalHours || 0)))}</div><div class="label">Total Hours</div></div>
    <div class="card"><div class="value">${escapeHtml(String(Number(report.totalBooksSold || 0)))}</div><div class="label">Books Sold</div></div>
    <div class="card"><div class="value">TSH ${escapeHtml(Number(report.totalAmount || 0).toLocaleString())}</div><div class="label">Total Sales</div></div>
  </div>

  <div class="section">
    <strong style="font-size:13px;color:#1e3a8a">Daily Reports</strong>
    <table role="table" aria-label="Daily reports">
      <thead>
        <tr>
          <th style="width:14%;">Date</th>
          <th style="width:10%;">Hours</th>
          <th style="width:12%;">Books</th>
          <th style="width:18%;">Sales (TSH)</th>
          <th style="width:18%;">Bible Studies</th>
          <th style="width:18%;">Prayers</th>
          <th style="width:18%;">Visits</th>
        </tr>
      </thead>
      <tbody>
        ${report.dailyReports
          .map(
            (d) => `
          <tr class="daily-row">
            <td>${escapeHtml(new Date(d.date).toLocaleDateString())} <div style="color:#666;font-size:11px;">${escapeHtml(
              DataService.getDayName(new Date(d.date))
            )}</div></td>
            <td>${escapeHtml(String(Number(d.hoursWorked || 0)))}</td>
            <td>${escapeHtml(String(Number(d.booksSold || 0)))}</td>
            <td>TSH ${escapeHtml(Number(d.dailyAmount || 0).toLocaleString())}</td>
            <td>${escapeHtml(String(Number(d.bibleStudies || 0)))}</td>
            <td>${escapeHtml(String(Number(d.prayersOffered || 0)))}</td>
            <td>${escapeHtml(String(Number(d.peopleVisited || 0)))}</td>
          </tr>
        `
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <div class="signatures">
    <div class="signature"><div style="font-weight:700">Prepared by</div><div class="sig-line"></div></div>
    <div class="signature"><div style="font-weight:700">Reviewed by</div><div class="sig-line"></div></div>
  </div>

  <div class="doc-footer">DODOMA CTF — Student Canvassing Report System.</div>
</body>
</html>`;
  }

  private static generateMonthlyHTML(report: MonthlyReport, logoPath?: string): string {
    const monthName = DataService.getMonthName(report.month);
    const logoHtml = logoPath ? `<img src="${logoPath}" class="brand-logo" alt="logo"/>` : '';
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Monthly Report - ${escapeHtml(monthName)} ${escapeHtml(String(report.year))}</title>
  <style>
    @page { size: A4; margin: 18mm; }
    body{font-family:"Helvetica Neue",Arial,sans-serif;color:#222;margin:0;font-size:12px}
    .wrap{padding:0 4mm}
    .header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1e3a8a;padding:8px 0;margin-bottom:12px}
    .brand-title{font-weight:700;color:#1e3a8a;font-size:16px}
    .meta{font-size:12px;color:#555;text-align:right}
    .section-title{color:#1e3a8a;font-weight:700;margin:8px 0}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px}
    .card{background:#fff;border:1px solid #e6eef8;padding:10px;border-radius:6px;text-align:center}
    .card .num{font-weight:700;color:#1e3a8a;font-size:16px}
    .week-list{margin-top:6px}
    .week-card{border:1px solid #e6eef8;padding:10px;border-radius:6px;margin-bottom:8px}
    .footer{margin-top:14px;border-top:1px solid #e6eef8;padding-top:8px;text-align:center;color:#666;font-size:11px}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <div>
        <div class="brand-title">DODOMA CTF</div>
        <div style="font-size:12px;color:#666">Monthly Canvassing Report</div>
      </div>
      <div class="meta">
        <div><strong>${escapeHtml(monthName)} ${escapeHtml(String(report.year))}</strong></div>
        <div>Generated: ${escapeHtml(new Date().toLocaleString())}</div>
      </div>
    </div>

    <div><strong>Student:</strong> ${escapeHtml(report.studentName || '')} &nbsp; <strong>Phone:</strong> ${escapeHtml(report.phoneNumber || '')}</div>

    <div class="section-title">Monthly Summary</div>
    <div class="grid">
      <div class="card"><div class="num">${escapeHtml(String(Number(report.totalHours || 0)))}</div><div style="font-size:11px;color:#666;margin-top:6px">Total Hours</div></div>
      <div class="card"><div class="num">${escapeHtml(String(Number(report.totalBooks || 0)))}</div><div style="font-size:11px;color:#666;margin-top:6px">Books Sold</div></div>
      <div class="card"><div class="num">TSH ${escapeHtml(Number(report.totalAmount || 0).toLocaleString())}</div><div style="font-size:11px;color:#666;margin-top:6px">Total Sales</div></div>
      <div class="card"><div class="num">${escapeHtml(String(Number(report.totalMinistryActivities || 0)))}</div><div style="font-size:11px;color:#666;margin-top:6px">Ministry Activities</div></div>
    </div>

    <div class="section-title">Weekly Breakdown</div>
    <div class="week-list">
      ${report.weeklyReports
        .map(
          (w) => `<div class="week-card">
          <div style="font-weight:700;color:#1e3a8a">Week ${escapeHtml(String(w.weekNumber))} — ${escapeHtml(
            new Date(w.weekStartDate).toLocaleDateString()
          )} to ${escapeHtml(new Date(w.weekEndDate).toLocaleDateString())}</div>
          <div style="margin-top:6px">Hours: ${escapeHtml(String(Number(w.totalHours || 0)))} | Books: ${escapeHtml(
            String(Number(w.totalBooksSold || 0))
          )} | Sales: TSH ${escapeHtml(Number(w.totalAmount || 0).toLocaleString())}</div>
          <div style="color:#666;margin-top:6px">Ministry: ${escapeHtml(String(Number(w.totalBibleStudies || 0)))} Bible Studies, ${escapeHtml(
            String(Number(w.totalPrayersOffered || 0))
          )} Prayers, ${escapeHtml(String(Number(w.totalBaptismsPerformed || 0)))} Baptisms</div>
        </div>`
        )
        .join('')}
    </div>

    <div class="footer">DODOMA CTF — Generated ${escapeHtml(new Date().toLocaleString())}</div>
  </div>
</body>
</html>`;
  }

  /* --------- Helpers --------- */

  private static async ensureReportsDir() {
    try {
      const info = await FileSystem.getInfoAsync(REPORTS_DIR);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(REPORTS_DIR, { intermediates: true });
      }
    } catch (err) {
      console.warn('ensureReportsDir failed', err);
      // allow moveAsync to fail later if dir cannot be created
    }
  }

  private static safeFileName(name: string) {
    // keep alphanum, underscores, dashes and dots; replace others with _
    return name.replace(/[^a-zA-Z0-9._-]/g, '_');
  }
}

/* ---------------- helper ---------------- */
function escapeHtml(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
