// services/PDFService.ts
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Platform } from 'react-native';
import { WeeklyReport, MonthlyReport, DailyReport, BookSale } from '@/types/Report';
import { DataService } from './DataService';

export class PDFService {
  // ---------- Public entry points ----------
  static async generateWeeklyPDF(weeklyReport: WeeklyReport): Promise<void> {
    return this._generateAndSavePdf({
      html: this.generateWeeklyHTML(weeklyReport),
      defaultFileName: `DODOMA_CTF_Week_${weeklyReport.weekNumber}_${this._safeDateStr(weeklyReport.weekStartDate)}.pdf`,
    });
  }

  static async generateMonthlyPDF(monthlyReport: MonthlyReport): Promise<void> {
    const monthName = DataService.getMonthName(monthlyReport.month);
    return this._generateAndSavePdf({
      html: this.generateMonthlyHTML(monthlyReport),
      defaultFileName: `DODOMA_CTF_${monthName}_${monthlyReport.year}.pdf`,
    });
  }

  // ---------- Core PDF creation & save/share flow ----------
  private static async _generateAndSavePdf(opts: { html: string; defaultFileName: string }) {
    try {
      // 1) Generate PDF (printToFileAsync). Request base64 when possible for more control.
      const printOptions: any = { html: opts.html };
      // base64 supported on Android and can be helpful to write reliably
      if (Platform.OS === 'android') printOptions.base64 = true;

      const result = await Print.printToFileAsync(printOptions);
      // result: { uri, base64?, numberOfPages? }

      // 2) Compose destination path in documentDirectory
      const fileName = opts.defaultFileName.replace(/\s+/g, '_');
      const destPath = `${FileSystem.documentDirectory}${fileName}`;

      // 3) If base64 present -> write file with base64 encoding (Android path)
      if ((result as any).base64) {
        await FileSystem.writeAsStringAsync(destPath, (result as any).base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } else if (result.uri) {
        // on iOS & other cases: move/copy the generated file from cache to documents
        // Ensure proper file:// prefix for moveAsync (FileSystem.moveAsync expects file:// uri)
        const from = (result.uri.startsWith('file://') ? result.uri : `file://${result.uri}`);
        const to = destPath.startsWith('file://') ? destPath : destPath;
        // If dest already exists, remove first
        const info = await FileSystem.getInfoAsync(destPath);
        if (info.exists) {
          await FileSystem.deleteAsync(destPath, { idempotent: true });
        }
        // Move: Note: moveAsync 'to' argument must be a proper file path (documentDirectory + filename)
        await FileSystem.moveAsync({ from, to });
      } else {
        throw new Error('Unable to obtain PDF data (no uri or base64 returned by Print.printToFileAsync).');
      }

      // 4) Try to share/save the file. Sharing opens system share dialog where user can "Save to Files" or choose storage apps.
      const finalUri = destPath; // FileSystem uses file paths like 'file:///...' internally for certain APIs
      if (Platform.OS === 'ios') {
        // iOS: Sharing is expected to work
        await Sharing.shareAsync(finalUri, { mimeType: 'application/pdf', dialogTitle: 'Pakua Taarifa' });
      } else {
        // Android: sharing should work; optionally attempt to save to MediaLibrary (needs permission)
        let shared = false;
        try {
          await Sharing.shareAsync(finalUri, { mimeType: 'application/pdf', dialogTitle: 'Pakua Taarifa' });
          shared = true;
        } catch (e) {
          // fallback to media library
          console.warn('Sharing failed, will try to save to media library:', e);
        }

        if (!shared) {
          const permission = await MediaLibrary.requestPermissionsAsync();
          if (permission.granted) {
            // createAssetAsync sometimes expects 'file://' prefix
            const localUri = finalUri.startsWith('file://') ? finalUri : `file://${finalUri}`;
            await MediaLibrary.createAssetAsync(localUri);
            Alert.alert('Imekamilika!', `PDF imehifadhiwa kwenye vifaa ivyo: ${fileName}`);
            return;
          } else {
            throw new Error('Media library permission denied — cannot save PDF.');
          }
        }
      }

      // Success
      Alert.alert('Imekamilika!', `PDF imehifadhiwa / kushirikiwa: ${fileName}`);
    } catch (err) {
      console.error('PDF generation error:', err);
      Alert.alert('Hitilafu', 'Kujenga PDF kulishindikana. Jaribu tena au angalia ruhusa za kuhifadhi.');
      throw err;
    }
  }

  // ---------- Helpers to format & aggregate (kept from your original) ----------
  private static fmtNum(n: number) {
    return Number(n || 0).toLocaleString();
  }

  private static fmtMoney(n: number) {
    return `TSH ${this.fmtNum(Number(n || 0))}`;
  }

  private static aggregateBooksFromDaily(dailies: DailyReport[]) {
    const map: Record<string, { title: string; unitPrice: number; qty: number; revenue: number }> = {};
    let totalQty = 0;
    let totalRevenue = 0;

    (dailies || []).forEach((d) => {
      const bookSales = Array.isArray(d.bookSales) ? d.bookSales : [];
      bookSales.forEach((b: BookSale) => {
        const title = (b.title || 'Untitled').trim();
        const price = Number(b.price || 0);
        const qty = Number(b.quantity || 0);
        if (!map[title]) {
          map[title] = { title, unitPrice: price, qty: 0, revenue: 0 };
        }
        map[title].qty += qty;
        map[title].revenue += price * qty;
        map[title].unitPrice = price || map[title].unitPrice;
        totalQty += qty;
        totalRevenue += price * qty;
      });
    });

    const list = Object.values(map);
    list.sort((a, b) => b.revenue - a.revenue);
    return { list, totalQty, totalRevenue };
  }

  // ---------- Weekly HTML ----------
  private static generateWeeklyHTML(report: WeeklyReport): string {
    const weekStart = new Date(report.weekStartDate);
    const weekEnd = new Date(report.weekEndDate);
    const dailyReports: DailyReport[] = Array.isArray(report.dailyReports) ? report.dailyReports : [];

    const totals = dailyReports.reduce(
      (acc, d) => {
        acc.hours += Number(d.hoursWorked || 0);
        acc.books += Number(d.booksSold || 0);
        acc.sales += Number(d.dailyAmount || 0);
        acc.freeLit += Number(d.freeLiterature || 0);
        acc.vop += Number(d.vopActivities || 0);
        acc.church += Number(d.churchAttendees || 0);
        acc.prayers += Number(d.prayersOffered || 0);
        acc.bible += Number(d.bibleStudies || 0);
        acc.baptisms += Number(d.baptismsPerformed || 0);
        acc.visits += Number(d.peopleVisited || 0);
        return acc;
      },
      { hours: 0, books: 0, sales: 0, freeLit: 0, vop: 0, church: 0, prayers: 0, bible: 0, baptisms: 0, visits: 0 }
    );

    const booksAgg = this.aggregateBooksFromDaily(dailyReports);

    // Add Student name & report type at top prominently
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Weekly Report - ${report.studentName || '-'} - Week ${report.weekNumber}</title>
          <style>
            body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial; margin:20px; color:#222; }
            .header { text-align:center; border-bottom:3px solid #1e3a8a; padding-bottom:10px; margin-bottom:20px; }
            .title { font-size:20px; font-weight:800; color:#0f172a; }
            .subtitle { font-size:13px; color:#374151; margin-top:6px; }
            .meta { margin-top:8px; font-size:12px; color:#374151; }
            table.info { width:100%; border-collapse:collapse; margin-top:14px; }
            table.info td { padding:8px; border:1px solid #e5e7eb; }
            table.info td.label { font-weight:700; background:#f8fafc; width:30% }
            .section { margin-top:18px; }
            .section-title { font-weight:700; color:#1e3a8a; margin-bottom:8px; }
            table.daily { width:100%; border-collapse:collapse; font-size:12px; }
            table.daily th, table.daily td { border:1px solid #e5e7eb; padding:6px; text-align:center; }
            table.daily th { background:#111827; color:#fff; }
            .books th { background:#059669; color:#fff; padding:8px; }
            .small { font-size:12px; color:#6b7280; }
            .footer { margin-top:20px; border-top:1px solid #e5e7eb; padding-top:10px; font-size:12px; color:#6b7280; text-align:center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">DODOMA CTF — WEEKLY REPORT</div>
            <div class="subtitle">${report.studentName || '-'} · Week ${report.weekNumber}</div>
            <div class="meta">${weekStart.toLocaleDateString()} — ${weekEnd.toLocaleDateString()}</div>
          </div>

          <table class="info">
            <tr><td class="label">Student</td><td>${report.studentName || '-'}</td></tr>
            <tr><td class="label">Phone</td><td>${report.phoneNumber || '-'}</td></tr>
            <tr><td class="label">Week</td><td>${report.weekNumber} (${weekStart.toLocaleDateString()} — ${weekEnd.toLocaleDateString()})</td></tr>
          </table>

          <div class="section">
            <div class="section-title">Weekly Summary</div>
            <div style="display:flex; gap:12px; flex-wrap:wrap;">
              <div style="min-width:120px; padding:10px; border:1px solid #e5e7eb; border-radius:6px; text-align:center;">
                <div style="font-weight:700; font-size:16px;">${this.fmtNum(report.totalHours)}</div><div class="small">Total Hours</div>
              </div>
              <div style="min-width:120px; padding:10px; border:1px solid #e5e7eb; border-radius:6px; text-align:center;">
                <div style="font-weight:700; font-size:16px;">${this.fmtNum(report.totalBooksSold)}</div><div class="small">Books Sold</div>
              </div>
              <div style="min-width:160px; padding:10px; border:1px solid #e5e7eb; border-radius:6px; text-align:center;">
                <div style="font-weight:700; font-size:16px;">${this.fmtMoney(report.totalAmount)}</div><div class="small">Total Sales</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Daily Breakdown</div>
            <table class="daily">
              <thead>
                <tr>
                  <th>Day</th><th>Hours</th><th>Books</th><th>Sales</th><th>Free Lit.</th><th>VOP</th><th>Church</th><th>Prayers</th><th>Bible</th><th>Baptisms</th><th>Visits</th>
                </tr>
              </thead>
              <tbody>
                ${(dailyReports || []).map(d => `
                  <tr>
                    <td style="text-align:left; font-weight:600;">${DataService.getDayName(new Date(d.date))} (${new Date(d.date).toLocaleDateString()})</td>
                    <td>${this.fmtNum(Number(d.hoursWorked || 0))}</td>
                    <td>${this.fmtNum(Number(d.booksSold || 0))}</td>
                    <td style="text-align:right">${this.fmtMoney(Number(d.dailyAmount || 0))}</td>
                    <td>${this.fmtNum(Number(d.freeLiterature || 0))}</td>
                    <td>${this.fmtNum(Number(d.vopActivities || 0))}</td>
                    <td>${this.fmtNum(Number(d.churchAttendees || 0))}</td>
                    <td>${this.fmtNum(Number(d.prayersOffered || 0))}</td>
                    <td>${this.fmtNum(Number(d.bibleStudies || 0))}</td>
                    <td>${this.fmtNum(Number(d.baptismsPerformed || 0))}</td>
                    <td>${this.fmtNum(Number(d.peopleVisited || 0))}</td>
                  </tr>
                `).join('')}
                <tr style="font-weight:700;">
                  <td>WEEK TOTAL</td>
                  <td>${this.fmtNum(totals.hours)}</td>
                  <td>${this.fmtNum(totals.books)}</td>
                  <td style="text-align:right">${this.fmtMoney(totals.sales)}</td>
                  <td>${this.fmtNum(totals.freeLit)}</td>
                  <td>${this.fmtNum(totals.vop)}</td>
                  <td>${this.fmtNum(totals.church)}</td>
                  <td>${this.fmtNum(totals.prayers)}</td>
                  <td>${this.fmtNum(totals.bible)}</td>
                  <td>${this.fmtNum(totals.baptisms)}</td>
                  <td>${this.fmtNum(totals.visits)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">Books Sold Details</div>
            ${booksAgg.list.length > 0 ? `
              <table class="books" style="width:100%; border-collapse:collapse; margin-top:8px;">
                <thead><tr><th>Title</th><th>Unit Price</th><th>Quantity</th><th>Total</th></tr></thead>
                <tbody>
                  ${booksAgg.list.map(b => `
                    <tr>
                      <td>${b.title}</td>
                      <td style="text-align:right">${this.fmtNum(b.unitPrice)}</td>
                      <td style="text-align:right">${this.fmtNum(b.qty)}</td>
                      <td style="text-align:right">${this.fmtNum(b.revenue)}</td>
                    </tr>
                  `).join('')}
                  <tr style="font-weight:700;">
                    <td>GRAND TOTAL</td><td></td>
                    <td style="text-align:right">${this.fmtNum(booksAgg.totalQty)}</td>
                    <td style="text-align:right">${this.fmtMoney(booksAgg.totalRevenue)}</td>
                  </tr>
                </tbody>
              </table>
            ` : `<div class="small">Hakuna mauzo ya vitabu katika wiki hii.</div>`}
          </div>

          <div class="footer">Generated on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} · DODOMA CTF 2025</div>
        </body>
      </html>
    `;
  }

  // ---------- Monthly HTML ----------
  private static generateMonthlyHTML(report: MonthlyReport): string {
    const monthName = DataService.getMonthName(report.month);
    const allDailyReports: DailyReport[] = [];
    (report.weeklyReports || []).forEach((w: WeeklyReport) => {
      if (Array.isArray((w as any).dailyReports)) {
        (w as any).dailyReports.forEach((d: DailyReport) => allDailyReports.push(d));
      }
    });

    const weeklySummaryHtml = (report.weeklyReports || []).map((w: WeeklyReport) => `
      <div style="border:1px solid #e5e7eb; padding:8px; border-radius:6px; margin-bottom:8px;">
        <div style="font-weight:700; color:#1e3a8a;">Week ${w.weekNumber} · ${new Date(w.weekStartDate).toLocaleDateString()} - ${new Date(w.weekEndDate).toLocaleDateString()}</div>
        <div>Hours: ${this.fmtNum(w.totalHours)} | Books: ${this.fmtNum(w.totalBooksSold)} | Sales: ${this.fmtMoney(w.totalAmount)}</div>
        <div style="font-size:12px; color:#6b7280;">Ministry: ${this.fmtNum(w.totalBibleStudies)} Bible Studies, ${this.fmtNum(w.totalPrayersOffered)} Prayers, ${this.fmtNum(w.totalBaptismsPerformed)} Baptisms</div>
      </div>
    `).join('');

    const booksAgg = this.aggregateBooksFromDaily(allDailyReports);

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Monthly Report - ${report.studentName || '-'} - ${monthName} ${report.year}</title>
          <style>
            body { font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial; margin:20px; color:#222; }
            .header { text-align:center; border-bottom:3px solid #1e3a8a; padding-bottom:10px; margin-bottom:18px; }
            .title { font-size:20px; font-weight:800; color:#0f172a; }
            .subtitle { font-size:13px; color:#374151; margin-top:6px; }
            .section { margin-top:14px; }
            .books th { background:#059669; color:#fff; padding:8px; }
            .small { font-size:12px; color:#6b7280; }
            .footer { margin-top:20px; border-top:1px solid #e5e7eb; padding-top:10px; font-size:12px; color:#6b7280; text-align:center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">DODOMA CTF — MONTHLY REPORT</div>
            <div class="subtitle">${report.studentName || '-'} · ${monthName} ${report.year}</div>
          </div>

          <div style="display:flex; gap:12px; justify-content:space-between;">
            <div><strong>Student:</strong> ${report.studentName || '-'}<br /><span class="small">Phone: ${report.phoneNumber || '-'}</span></div>
            <div><strong>Month:</strong> ${monthName} ${report.year}<br /><span class="small">Weeks: ${this.fmtNum((report.weeklyReports || []).length)}</span></div>
          </div>

          <div class="section">
            <div style="font-weight:700; color:#1e3a8a; margin-bottom:8px;">Monthly Summary</div>
            <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px;">
              <div style="padding:10px; border:1px solid #e5e7eb; border-radius:6px; text-align:center;">
                <div style="font-weight:700; font-size:16px;">${this.fmtNum(report.totalHours)}</div><div class="small">Total Hours</div>
              </div>
              <div style="padding:10px; border:1px solid #e5e7eb; border-radius:6px; text-align:center;">
                <div style="font-weight:700; font-size:16px;">${this.fmtNum(report.totalBooks)}</div><div class="small">Books Sold</div>
              </div>
              <div style="padding:10px; border:1px solid #e5e7eb; border-radius:6px; text-align:center;">
                <div style="font-weight:700; font-size:16px;">${this.fmtMoney(report.totalAmount)}</div><div class="small">Total Sales</div>
              </div>
              <div style="padding:10px; border:1px solid #e5e7eb; border-radius:6px; text-align:center;">
                <div style="font-weight:700; font-size:16px;">${this.fmtNum(report.totalMinistryActivities || 0)}</div><div class="small">Ministry Activities</div>
              </div>
            </div>
          </div>

          <div class="section">
            <div style="font-weight:700; color:#1e3a8a; margin-bottom:8px;">Weekly Breakdown</div>
            ${weeklySummaryHtml || '<div class="small">No weekly data available</div>'}
          </div>

          <div class="section">
            <div style="font-weight:700; color:#1e3a8a; margin-bottom:8px;">Books Sold (Monthly Aggregated)</div>
            ${booksAgg.list.length > 0 ? `
              <table class="books" style="width:100%; border-collapse:collapse;">
                <thead><tr><th>Book Title</th><th>Unit Price</th><th>Quantity</th><th>Total</th></tr></thead>
                <tbody>
                  ${booksAgg.list.map(b => `
                    <tr>
                      <td>${b.title}</td>
                      <td style="text-align:right">${this.fmtNum(b.unitPrice)}</td>
                      <td style="text-align:right">${this.fmtNum(b.qty)}</td>
                      <td style="text-align:right">${this.fmtNum(b.revenue)}</td>
                    </tr>
                  `).join('')}
                  <tr style="font-weight:700;">
                    <td>GRAND TOTAL</td><td></td>
                    <td style="text-align:right">${this.fmtNum(booksAgg.totalQty)}</td>
                    <td style="text-align:right">${this.fmtMoney(booksAgg.totalRevenue)}</td>
                  </tr>
                </tbody>
              </table>
            ` : `<div class="small">Hakuna mauzo ya vitabu katika mwezi huu.</div>`}
          </div>

          <div class="footer">Generated on ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()} · DODOMA CTF 2025</div>
        </body>
      </html>
    `;
  }

  // ---------- Utilities ----------
  private static _safeDateStr(d: string) {
    return new Date(d).toISOString().split('T')[0];
  }
}
