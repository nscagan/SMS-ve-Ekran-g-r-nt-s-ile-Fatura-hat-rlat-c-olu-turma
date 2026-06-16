import { useState } from "react";
import { Bill } from "../types";
import { formatCurrency, formatDateTurkish, generateICS, generateBulkICS, downloadFile } from "../utils";
import { Calendar, Trash2, Edit2, Check, X, FileDown, ExternalLink, CalendarPlus } from "lucide-react";

interface InvoiceTableProps {
  bills: Bill[];
  onDelete: (id: string) => void;
  onUpdate: (updated: Bill) => void;
  onSyncToGoogleCalendar: (bill: Bill) => Promise<void>;
  onBulkSyncToGoogleCalendar: (targetBills: Bill[]) => Promise<void>;
  googleCalendarConnected: boolean;
  isSyncingId: string | null;
  isBulkSyncing: boolean;
}

export default function InvoiceTable({
  bills,
  onDelete,
  onUpdate,
  onSyncToGoogleCalendar,
  onBulkSyncToGoogleCalendar,
  googleCalendarConnected,
  isSyncingId,
  isBulkSyncing
}: InvoiceTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Bill>>({});

  // Dynamic calculations for overall and unpaid totals
  const totalAmount = bills.reduce((sum, b) => sum + b.faturaTutari, 0);
  const unpaidBills = bills.filter(b => !b.isPaid);
  const unpaidAmount = unpaidBills.reduce((sum, b) => sum + b.faturaTutari, 0);
  const unpaidBillsCount = unpaidBills.length;

  const handleBulkDownloadICS = () => {
    if (bills.length === 0) return;
    const icsContent = generateBulkICS(bills);
    const filename = `toplu_fatura_hatirlaticilari_${new Date().toISOString().slice(0, 10)}.ics`;
    downloadFile(filename, icsContent);
  };

  // Group bills and calculate summaries by month
  const getMonthlySummaries = () => {
    const map: Record<string, {
      key: string;
      label: string;
      monthName: string;
      year: string;
      bills: Bill[];
      totalAmount: number;
      unpaidAmount: number;
      unpaidCount: number;
    }> = {};
    
    bills.forEach(b => {
      const dateStr = b.sonOdemeTarihi;
      if (!dateStr) return;
      const parts = dateStr.split("-");
      const year = parts[0] || "----";
      const monthVal = parts[1] || "01";
      const monthIndex = parseInt(monthVal, 10) - 1;
      const monthNames = [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
      ];
      const monthName = monthNames[monthIndex] || "Bilinmeyen";
      const key = `${year}-${monthVal}`;
      const label = `${monthName} ${year}`;
      
      if (!map[key]) {
        map[key] = {
          key,
          label,
          monthName,
          year,
          bills: [],
          totalAmount: 0,
          unpaidAmount: 0,
          unpaidCount: 0
        };
      }
      
      map[key].bills.push(b);
      map[key].totalAmount += b.faturaTutari;
      if (!b.isPaid) {
        map[key].unpaidAmount += b.faturaTutari;
        map[key].unpaidCount += 1;
      }
    });
    
    // Sort keys chronologically
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  };

  const monthlySummaries = getMonthlySummaries();

  const handleMonthlyDownloadICS = (label: string, monthlyBills: Bill[]) => {
    const icsContent = generateBulkICS(monthlyBills);
    const filename = `${label.replace(/\s+/g, "_")}_fatura_hatirlaticilari.ics`;
    downloadFile(filename, icsContent);
  };

  // Start editing a bill inline
  const startEdit = (bill: Bill) => {
    setEditingId(bill.id);
    setEditForm({ ...bill });
  };

  // Save edited bill
  const saveEdit = () => {
    if (editingId && editForm.faturaTipi && editForm.sonOdemeTarihi) {
      onUpdate(editForm as Bill);
      setEditingId(null);
    }
  };

  // Render badge class for different bill categories
  const getCategoryBadge = (type: string) => {
    const lower = type.toLowerCase();
    if (lower.includes("aidat")) {
      return "bg-amber-100 text-amber-700 border border-amber-200";
    } else if (lower.includes("su") || lower.includes("ısınma") || lower.includes("sıcak")) {
      return "bg-blue-100 text-blue-700 border border-blue-200";
    } else if (lower.includes("elektrik") || lower.includes("enerji")) {
      return "bg-yellow-100 text-yellow-700 border border-yellow-200";
    } else if (lower.includes("gaz") || lower.includes("doğalgaz")) {
      return "bg-orange-100 text-orange-700 border border-orange-200";
    } else if (lower.includes("telekom") || lower.includes("internet") || lower.includes("tv")) {
      return "bg-purple-100 text-purple-700 border border-purple-200";
    }
    return "bg-slate-100 text-slate-700 border border-slate-200";
  };

  // Trigger local .ics download
  const handleDownloadICS = (bill: Bill) => {
    const icsContent = generateICS(bill);
    const filename = `${bill.faturaTipi.replace(/\s+/g, "_")}_${bill.sonOdemeTarihi}.ics`;
    downloadFile(filename, icsContent);
  };

  // Parse date fields into visual segments
  const getDateParts = (dateStr: string) => {
    if (!dateStr) return { day: "--", month: "---", year: "----" };
    const date = new Date(dateStr);
    const months = [
      "OCAK", "ŞUBAT", "MART", "NİSAN", "MAYIS", "HAZİRAN",
      "TEMMUZ", "AĞUSTOS", "EYLÜL", "EKİM", "KASIM", "ARALIK"
    ];
    return {
      day: dateStr.split("-")[2] || "--",
      month: months[date.getMonth()] || "---",
      year: dateStr.split("-")[0] || "----"
    };
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden" id="invoice-table-section">
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider">
            Adım 2: Çözümlenen Faturalar ve İşlemler
          </h2>
          <p className="text-slate-500 text-xs mt-0.5">
            Otomatik ayıklanan bilgileri inceleyin, düzenleyin ve takviminize tek tıkla kaydedin.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-widest bg-white py-1.5 px-3 rounded-lg border border-slate-200">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
          Toplam: {bills.length} Fatura
        </div>
      </div>

      {bills.length === 0 ? (
        <div className="p-12 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-4 border border-slate-200">
            <Calendar className="w-8 h-8" />
          </div>
          <h3 className="text-slate-800 font-bold text-sm uppercase tracking-wider">Henüz Fatura Ayıklanmadı</h3>
          <p className="text-slate-500 text-xs max-w-sm mt-1">
            Sol taraftaki alana faturanıza ait SMS mesajını yapıştırarak "ANALİZ ET VE KONTROL ET" tuşuna basın.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/30">
                <th className="py-3 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider w-[100px] text-center">Durum</th>
                <th className="py-3 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Takvim Tarihi</th>
                <th className="py-3 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fatura Detayı</th>
                <th className="py-3 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kişi & Konut</th>
                <th className="py-3 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Tutar (TL)</th>
                <th className="py-3 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hatırlatıcı Ekle</th>
                <th className="py-3 px-6 text-[11px] font-bold text-slate-400 uppercase tracking-wider text-right">Düzenle / Sil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {bills.map((bill) => {
                const isEditing = editingId === bill.id;
                const { day, month, year } = getDateParts(isEditing ? (editForm.sonOdemeTarihi || "") : bill.sonOdemeTarihi);
                const isPaid = bill.isPaid || false;

                return (
                  <tr 
                    key={bill.id} 
                    className={`transition-all duration-150 ${
                      isPaid 
                        ? "bg-emerald-50/20 hover:bg-emerald-50/30 text-slate-400" 
                        : "hover:bg-slate-50/50"
                    }`}
                  >
                    {/* Checkbox column */}
                    <td className="py-4 px-6 text-center valign-middle">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <input
                          type="checkbox"
                          id={`isPaid-${bill.id}`}
                          checked={isPaid}
                          onChange={() => onUpdate({ ...bill, isPaid: !isPaid })}
                          className="w-4 h-4 text-emerald-600 bg-slate-100 border-slate-300 rounded focus:ring-emerald-500 focus:ring-2 cursor-pointer transition-all"
                          title={isPaid ? "Ödenmedi olarak işaretle" : "Ödendi olarak işaretle"}
                        />
                        <span className={`text-[9px] font-extrabold uppercase tracking-widest ${isPaid ? "text-emerald-600" : "text-slate-400"}`}>
                          {isPaid ? "ÖDENDİ" : "BEKLİYOR"}
                        </span>
                      </div>
                    </td>

                    {/* Calendar Badge Column */}
                    <td className="py-4 px-6 valign-middle">
                      <div className="flex items-center gap-3">
                        <div className={`rounded-lg p-2.5 shadow-md text-center min-w-[70px] shrink-0 border transition-all ${
                          isPaid 
                            ? "bg-slate-300 border-slate-400 opacity-60" 
                            : "bg-slate-900 border-slate-700"
                        }`}>
                          <div className={`text-[9px] font-black tracking-widest leading-none mb-1 ${isPaid ? "text-slate-600 line-through" : "text-blue-400"}`}>{month}</div>
                          <div className={`text-2xl font-black leading-none ${isPaid ? "text-slate-700 line-through" : "text-white"}`}>{day}</div>
                          <div className={`text-[8px] tracking-wider mt-1 ${isPaid ? "text-slate-500 line-through" : "text-slate-400"}`}>{year}</div>
                        </div>
                        {isEditing && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Ödeme Son Tarihi:</span>
                            <input
                              type="date"
                              className="p-1 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none text-slate-800"
                              value={editForm.sonOdemeTarihi || ""}
                              onChange={(e) => setEditForm({ ...editForm, sonOdemeTarihi: e.target.value })}
                            />
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Bill Category and Summary */}
                    <td className="py-4 px-6">
                      {isEditing ? (
                        <div className="flex flex-col gap-2 max-w-xs text-slate-800">
                          <input
                            type="text"
                            placeholder="Fatura Tipi"
                            className="p-1 px-2 text-xs border border-slate-200 rounded font-semibold focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            value={editForm.faturaTipi || ""}
                            onChange={(e) => setEditForm({ ...editForm, faturaTipi: e.target.value })}
                          />
                          <input
                            type="text"
                            placeholder="Kurum/Yönetim"
                            className="p-1 px-2 text-xs border border-slate-200 rounded text-slate-600 focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            value={editForm.kurum || ""}
                            onChange={(e) => setEditForm({ ...editForm, kurum: e.target.value })}
                          />
                          <input
                            type="text"
                            placeholder="Dönem"
                            className="p-1 px-2 text-xs border border-slate-200 rounded text-slate-500 italic focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            value={editForm.donem || ""}
                            onChange={(e) => setEditForm({ ...editForm, donem: e.target.value })}
                          />
                        </div>
                      ) : (
                        <div className={`flex flex-col gap-1 ${isPaid ? "opacity-70" : ""}`}>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase ${isPaid ? "bg-slate-200 text-slate-500 line-through" : getCategoryBadge(bill.faturaTipi)}`}>
                              {bill.faturaTipi}
                            </span>
                          </div>
                          <div className={`font-bold text-sm mt-1 transition-all ${isPaid ? "line-through text-slate-400 italic" : "text-slate-800"}`}>
                            {bill.kurum || "Belirtilmeyen Kurum"}
                          </div>
                          <div className={`text-xs italic transition-all ${isPaid ? "line-through text-slate-400" : "text-slate-500"}`}>
                            Aralık/Dönem: {bill.donem}
                          </div>
                          {bill.aciklama && (
                            <div className={`text-[11px] max-w-xs mt-0.5 line-clamp-1 transition-all ${isPaid ? "line-through text-slate-400/80" : "text-slate-400"}`}>
                              {bill.aciklama}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Person / Daire Details */}
                    <td className="py-4 px-6">
                      {isEditing ? (
                        <div className="flex flex-col gap-2 max-w-xs text-slate-800">
                          <input
                            type="text"
                            placeholder="Ad Soyad"
                            className="p-1 px-2 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            value={editForm.kisi || ""}
                            onChange={(e) => setEditForm({ ...editForm, kisi: e.target.value })}
                          />
                          <input
                            type="text"
                            placeholder="Daire/No"
                            className="p-1 px-2 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            value={editForm.daire || ""}
                            onChange={(e) => setEditForm({ ...editForm, daire: e.target.value })}
                          />
                        </div>
                      ) : (
                        <div className={`flex flex-col text-xs gap-1 ${isPaid ? "opacity-70" : ""}`}>
                          {bill.kisi && (
                            <div className={`font-semibold uppercase transition-all ${isPaid ? "line-through text-slate-400 italic" : "text-slate-800"}`}>
                              {bill.kisi}
                            </div>
                          )}
                          {bill.daire && (
                            <div className={`border px-1.5 py-0.5 rounded w-fit font-mono transition-all ${
                              isPaid 
                                ? "line-through text-slate-400 bg-slate-55 border-slate-200" 
                                : "text-slate-500 bg-slate-100 border-slate-200"
                            }`}>
                              {bill.daire}
                            </div>
                          )}
                          {!bill.kisi && !bill.daire && <span className="text-slate-400 italic">Bilgi Yok</span>}
                        </div>
                      )}
                    </td>

                    {/* Bill Amount in TRY */}
                    <td className="py-4 px-6">
                      {isEditing ? (
                        <div className="flex items-center gap-1 text-slate-800">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Tutar"
                            className="p-1 w-24 text-xs font-bold border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                            value={editForm.faturaTutari || ""}
                            onChange={(e) => setEditForm({ ...editForm, faturaTutari: parseFloat(e.target.value) || 0 })}
                          />
                          <span className="text-xs text-slate-400 font-bold">TL</span>
                        </div>
                      ) : (
                        <div className={`text-lg font-black font-mono tracking-tight transition-all ${
                          isPaid 
                            ? "line-through text-slate-400 italic" 
                            : "text-blue-600"
                        }`}>
                          {formatCurrency(bill.faturaTutari)}
                        </div>
                      )}
                    </td>

                    {/* Direct sync button and offline alarm download */}
                    <td className="py-4 px-6">
                      <div className="flex flex-col sm:flex-row gap-2">
                        {/* Option A: Google Calendar Sync */}
                        {bill.savedToCalendar ? (
                          <div className="flex flex-col gap-1">
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded flex items-center justify-center gap-1">
                              <Check className="w-3 h-3" /> Takvime Eklendi
                            </span>
                            {bill.calendarEventLink && (
                              <a
                                href={bill.calendarEventLink}
                                target="_blank"
                                rel="noreferrer noreferrer"
                                className="text-[10px] text-blue-600 hover:underline flex items-center justify-center gap-0.5"
                              >
                                Takvimde Gör <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={() => onSyncToGoogleCalendar(bill)}
                            disabled={isSyncingId !== null}
                            className={`flex items-center justify-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold transition-all border shadow-sm ${
                              googleCalendarConnected
                                ? "bg-slate-900 border-slate-800 text-white hover:bg-slate-800"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                            } ${isPaid ? "opacity-50 cursor-not-allowed" : ""}`}
                            title={
                              googleCalendarConnected
                                ? "Google Takvim'e saat 12:00 olarak 10/15dk hatırlatmalı kaydet"
                                : "Önce Google Takvim bağlantısını yapın veya direkt indirin"
                            }
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                            {isSyncingId === bill.id ? "Senkronize ediliyor..." : "Google'a Kaydet"}
                          </button>
                        )}

                        {/* Option B: Manual Alarm Download */}
                        <button
                          onClick={() => handleDownloadICS(bill)}
                          className={`flex items-center justify-center gap-1 px-2.5 py-1.5 bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 rounded text-xs font-bold transition-all shadow-sm ${
                            isPaid ? "opacity-50" : ""
                          }`}
                          title="Telefonuna veya bilgisayarına takvim dosyası (.ics) olarak kaydet"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>Hatırlatıcı İndir</span>
                        </button>
                      </div>
                    </td>

                    {/* Inline actions - edit / delete */}
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2 text-slate-800">
                        {isEditing ? (
                          <>
                            <button
                              onClick={saveEdit}
                              className="p-1 px-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded text-xs font-bold flex items-center gap-0.5 shadow-sm"
                              title="Kaydet"
                            >
                              <Check className="w-3.5 h-3.5" /> Kaydet
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="p-1 px-2 bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 rounded text-xs"
                              title="İptal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => startEdit(bill)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded border border-transparent hover:border-slate-200 transition-all"
                              title="Faturayı Düzenle"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDelete(bill.id)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded border border-transparent hover:border-red-200 transition-all"
                              title="Sil"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Monthly Breakdown and Reminders */}
        {monthlySummaries.length > 0 && (
          <div className="p-6 bg-slate-50/50 border-t border-slate-200/80" id="monthly-summaries-container">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4">
              Aylık Fatura Dağılımı ve Toplu İşlemler
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {monthlySummaries.map((month) => (
                <div key={month.key} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between gap-4 hover:border-slate-300 transition-all animate-fade-in" id={`month-card-${month.key}`}>
                  <div>
                    {/* Header: Month name */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-black text-xs uppercase">
                          {month.monthName.slice(0,3)}
                        </div>
                        <span className="font-extrabold text-sm text-slate-800">{month.label}</span>
                      </div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                        {month.bills.length} Fatura
                      </span>
                    </div>

                    {/* Totals Info */}
                    <div className="space-y-2 border-t border-b border-slate-100 py-3 my-2 text-xs">
                      <div className="flex justify-between items-center text-slate-500">
                        <span>Aylık Toplam Tutar:</span>
                        <span className="font-mono font-bold text-slate-800">{formatCurrency(month.totalAmount)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-500">Bekleyen Borç:</span>
                        <span className={`font-mono font-black ${month.unpaidAmount > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                          {formatCurrency(month.unpaidAmount)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>Ödeme Durumu:</span>
                        <span className="font-semibold">{month.unpaidCount} Ödenmemiş Hatırlatıcı</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for this specific month */}
                  <div className="flex flex-col gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => handleMonthlyDownloadICS(month.label, month.bills)}
                      className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black transition-all border border-blue-200 cursor-pointer"
                      title={`${month.label} faturası için toplu hatırlatıcı indir (.ics)`}
                    >
                      <FileDown className="w-3.5 h-3.5 text-blue-700" />
                      <span>{month.monthName.toUpperCase()} İÇİN HATIRLATICI İNDİR (.ICS)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onBulkSyncToGoogleCalendar(month.bills)}
                      disabled={isBulkSyncing || isSyncingId !== null}
                      className={`w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg text-[10px] font-black transition-all border cursor-pointer ${
                        googleCalendarConnected
                          ? "bg-slate-900 border-slate-800 text-white hover:bg-slate-800"
                          : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                      title={
                        googleCalendarConnected
                          ? `${month.label} faturalarını Google Takvime kaydeder`
                          : "Google hesabı bağlı olmalıdır"
                      }
                    >
                      <CalendarPlus className="w-3.5 h-3.5 text-current" />
                      <span>{month.monthName.toUpperCase()} GOOGLE'A KAYDET</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom Summary Bar & Bulk Actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-col lg:flex-row items-center justify-between gap-6" id="bulk-actions-footer">
          {/* Invoice Totals */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full lg:w-auto">
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3 shadow-xs min-w-[200px]" id="total-amount-card">
              <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-lg">
                Σ
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">TOPLAM TUTAR</div>
                <div className="text-base font-black text-slate-800 font-mono leading-tight">{formatCurrency(totalAmount)}</div>
                <div className="text-[10px] text-slate-400 font-bold">{bills.length} Fatura</div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-3 shadow-xs min-w-[200px]" id="unpaid-amount-card">
              <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center font-bold text-lg animate-pulse">
                ⌛
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">BEKLEYEN TUTAR</div>
                <div className="text-base font-black text-amber-600 font-mono leading-tight">{formatCurrency(unpaidAmount)}</div>
                <div className="text-[10px] text-slate-400 font-bold">{unpaidBillsCount} Ödenmeyen</div>
              </div>
            </div>
          </div>

          {/* Bulk Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
            <button
              type="button"
              id="bulk-download-ics-btn"
              onClick={handleBulkDownloadICS}
              className="flex items-center justify-center gap-2 px-5 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all shadow-md hover:shadow-lg focus:outline-none cursor-pointer"
              title="Tüm faturalarınızı tek bir toplu takvim hatırlatıcı (.ics) dosyasında indirin"
            >
              <FileDown className="w-4 h-4 shrink-0 text-white" />
              <span>TÜMÜ İÇİN HATIRLATICI İNDİR (.ICS)</span>
            </button>

            <button
              type="button"
              id="bulk-google-calendar-btn"
              onClick={() => onBulkSyncToGoogleCalendar(bills)}
              disabled={isBulkSyncing || isSyncingId !== null}
              className={`flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-xs font-black transition-all border shadow-sm cursor-pointer ${
                googleCalendarConnected
                  ? "bg-slate-900 border-slate-800 text-white hover:bg-slate-800"
                  : "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
              }`}
              title={
                googleCalendarConnected
                  ? "Takvime eklenmemiş tüm faturaları sırayla Google Hesabınıza kaydeder"
                  : "Google hesabınız bağlı olmalıdır (Yukarıda bağlantı kurun)"
              }
            >
              <CalendarPlus className="w-4 h-4 shrink-0" />
              <span>
                {isBulkSyncing ? "GOOGLE'A KAYDEDİLİYOR..." : "TÜMÜNÜ GOOGLE'A KAYDET"}
              </span>
            </button>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
