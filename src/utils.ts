import { Bill } from "./types";

/**
 * Formats a currency amount into Turkish Lira notation
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a date string (YYYY-MM-DD) into Turkish visual form (DD.MM.YYYY)
 */
export function formatDateTurkish(dateStr: string): string {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

/**
 * Generates an iCalendar (.ics) file content string for a given bill
 */
export function generateICS(bill: Bill): string {
  // Format target date for ICS (YYYYMMDD)
  const cleanDate = bill.sonOdemeTarihi.replace(/-/g, "");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  
  // Clean text fields for ICS safety
  const summary = `Fatura Ödeme: ${bill.faturaTipi} - ${bill.faturaTutari} TL`.replace(/[,;]/g, "\\$0");
  const description = [
    `Fatura Türü: ${bill.faturaTipi}`,
    `Fatura Tutarı: ${bill.faturaTutari} TL`,
    `Son Ödeme Tarihi: ${formatDateTurkish(bill.sonOdemeTarihi)}`,
    `Ait Olduğu Dönem: ${bill.donem}`,
    `Kurum: ${bill.kurum || "Belirtilmedi"}`,
    `Kişi: ${bill.kisi || "Belirtilmedi"}`,
    `Bölüm/Daire: ${bill.daire || "Belirtilmedi"}`,
    `Not: ${bill.aciklama || "Yok"}`
  ].join("\\n").replace(/[,;]/g, "\\$0");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BillParserAutomator//NONSGML v1.0//TR",
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${bill.id || Math.random().toString(36).substring(2)}@fatura.analiz`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${cleanDate}T120000`,
    `DTEND:${cleanDate}T130000`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT15M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Fatura son ödeme günü hatırlatması (15 dk kaldı)",
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT10M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Fatura son ödeme günü hatırlatması (10 dk kaldı)",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

/**
 * Generates an iCalendar (.ics) file content string for multiple bills
 */
export function generateBulkICS(billsList: Bill[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  
  const events = billsList.map(bill => {
    const cleanDate = bill.sonOdemeTarihi.replace(/-/g, "");
    
    // Clean text fields for ICS safety
    const summary = `Fatura Ödeme: ${bill.faturaTipi} - ${bill.faturaTutari} TL`.replace(/[,;]/g, "\\$0");
    const description = [
      `Fatura Türü: ${bill.faturaTipi}`,
      `Fatura Tutarı: ${bill.faturaTutari} TL`,
      `Son Ödeme Tarihi: ${formatDateTurkish(bill.sonOdemeTarihi)}`,
      `Ait Olduğu Dönem: ${bill.donem}`,
      `Kurum: ${bill.kurum || "Belirtilmedi"}`,
      `Kişi: ${bill.kisi || "Belirtilmedi"}`,
      `Bölüm/Daire: ${bill.daire || "Belirtilmedi"}`,
      `Not: ${bill.aciklama || "Yok"}`
    ].join("\\n").replace(/[,;]/g, "\\$0");

    return [
      "BEGIN:VEVENT",
      `UID:${bill.id || Math.random().toString(36).substring(2)}@fatura.analiz`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${cleanDate}T120000`,
      `DTEND:${cleanDate}T130000`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT15M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Fatura son ödeme günü hatırlatması (15 dk kaldı)",
      "END:VALARM",
      "BEGIN:VALARM",
      "TRIGGER:-PT10M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Fatura son ödeme günü hatırlatması (10 dk kaldı)",
      "END:VALARM",
      "END:VEVENT"
    ].join("\r\n");
  }).join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BillParserAutomator//NONSGML v1.0//TR",
    "CALSCALE:GREGORIAN",
    events,
    "END:VCALENDAR"
  ].join("\r\n");
}

/**
 * Triggers a native browser file download for a generated string
 */
export function downloadFile(filename: string, content: string, contentType: string = "text/calendar") {
  const blob = new Blob([content], { type: contentType + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Mock SMS samples based on actual Niğde Emlak examples
 */
export const SAMPLE_SMS_MESSAGES = [
  {
    title: "Turkcell (Necati Sercan Çağan - 5334320774)",
    text: "Degerli Musterimiz, 5334320774 nolu hattiniza ait Mayis 2026 donemi faturasi duzenlenmistir. Canli takip sonrasi PAYCELL ISLEMLERINIZ: 550,00 TL, ILETISIM UCRETLERINIZ: 283,00 TL, DIGER UCRETLERINIZ: 27,00 TL olup, Son odeme tarihi: 05.06.2026 dir. Odenmesi gereken toplam fatura tutari 860,00 TL dir.",
  },
  {
    title: "Turkcell (Deniz Çağan - 5442241921)",
    text: "Degerli Musterimiz, 5442241921 nolu hattiniza ait Haziran 2026 donemi faturasi duzenlenmistir. Tuketim detaylariniz sonrasi odenmesi gereken toplam fatura tutari 310,00 TL dir. Son odeme tarihi: 22.06.2026.",
  },
  {
    title: "Turkcell (İpek Çağan - 5384870774)",
    text: "Degerli Musterimiz, 5384870774 nolu hattiniza ait Haziran 2026 donemi faturasi duzenlenmistir. Odenmesi gereken toplam fatura tutari 215,00 TL dir. Son odeme tarihi: 25.06.2026.",
  },
  {
    title: "Doğalgaz (Enerya Yardımlı Tutar)",
    text: "Sn. Musterimiz, 032000522129  no.lu dogal gaz aboneliginize ait 16.06.2026 son odeme tarihli ilgili donem tuketim bedeli 218.14   TL olup, 89.94   TL ' lik devlet destegi sonrasinda odenmesi gereken fatura tutari 130,00 TL'dir. Fatura detaylari icin: https://enrfatura.enerya.com.tr/ettn/5254000F-F193-1FD1-98AE-B111D7AA4000 B001",
  },
  {
    title: "Tesisat No Elektrik (Spesifik)",
    text: "9516925 nolu tesisata ait 586,00 tutarli faturanin son odemesi 17. 6.2026. Faturaniza ulasmak icin: https://mpss.link/f/DIapy50blMeJdDDlIr1Osx1C1E0620 B016",
  },
  {
    title: "Aidat Faturası (Niğde Emlak)",
    text: "Sayın B2BLOK Daire 38 NECATİ SERCAN ÇAĞAN...Haziran ayı aidat bedeliniz 3701.00 TL dir.Ödemenizi Haziran ayı içerisinde son güne bırakmamak kaydıyla istediğiniz gün gerçekleştirebilirsiniz.Saygılarımızla.Niğde Emlak Konutları Site Yönetimi",
  },
  {
    title: "Sıcak/Soğuk Su & Isınma (Niğde Emlak)",
    text: "Sayın B2BLOK Daire 38 NECATİ SERCAN ÇAĞAN...2026 Mayıs 07.05.2026 - 06.06.2026 dönemi sıcak su soğuk su ısınma ve sistem kaybı fatura bedeliniz 1917.24 TL dir.Son ödeme tarihi 16.06.2026 dır.Saygılarımızla.Niğde Emlak Konutları Site Yönetimi",
  },
  {
    title: "Elektrik Faturası (CK Boğaziçi)",
    text: "Degerli Musterimiz, 1024859345 tesisat numarali sozlesmeniz icin 15.06.2026 son odeme tarihli ELEKTRİK faturasi 489.50 TL olarak duzenlenmistir. Donem: Mayis 2026. Mutlu gunler dileriz.",
  },
  {
    title: "Doğalgaz Faturası (Enerya)",
    text: "Sayın Abonemiz, 4592039 nolu sozlesmeniz icin 2026/05 donemi DOGALGAZ faturasi tahakkuk etmistiir. Fatura Bedeli: 824.10 TL, Son Odeme Tarihi: 22.06.2026. Enerya Kapadokya Gaz.",
  }
];
