import React, { useState, useEffect } from "react";
import { Bill } from "./types";
import { formatCurrency, formatDateTurkish, SAMPLE_SMS_MESSAGES } from "./utils";
import { initAuth, googleSignIn, logout } from "./firebase";
import InvoiceTable from "./components/InvoiceTable";
import { 
  FileText, 
  Sparkles, 
  Calendar, 
  Clock, 
  HelpCircle, 
  LogOut, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  ChevronRight,
  ShieldCheck,
  Zap,
  RefreshCcw,
  PlusCircle,
  Image,
  Upload,
  X,
  Trash2
} from "lucide-react";

export default function App() {
  const [bills, setBills] = useState<Bill[]>([]);
  const [smsText, setSmsText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncingId, setIsSyncingId] = useState<string | null>(null);
  const [isBulkSyncing, setIsBulkSyncing] = useState(false);

  // Bill Image Uploading state
  const [billImage, setBillImage] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | null>(null);
  const [isParsingImage, setIsParsingImage] = useState(false);
  const [activeInputTab, setActiveInputTab] = useState<"sms" | "image">("sms");
  
  // Auth state
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Messages/Warnings
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Manual Add Form visibility & state
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState<Partial<Bill>>({
    faturaTipi: "Aidat",
    faturaTutari: 0,
    sonOdemeTarihi: new Date().toISOString().split("T")[0],
    donem: "",
    kisi: "",
    daire: "",
    kurum: "",
    aciklama: ""
  });

  // Load bills on startup
  useEffect(() => {
    const saved = localStorage.getItem("parsed_bills");
    if (saved) {
      try {
        setBills(JSON.parse(saved));
      } catch (e) {
        console.error("Local bills parse failure:", e);
      }
    }

    // Try starting Firebase Authentication state listener
    initAuth(
      (user, token) => {
        setGoogleUser(user);
        setAccessToken(token);
        setNeedsAuth(false);
      },
      () => {
        setNeedsAuth(true);
      }
    ).catch(err => {
      console.warn("Auth initialization skipped or not configured:", err);
    });
  }, []);

  // Sync state to local storage when changed
  const saveBillsToStorage = (newBills: Bill[]) => {
    setBills(newBills);
    localStorage.setItem("parsed_bills", JSON.stringify(newBills));
  };

  // Login handler
  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setAccessToken(result.accessToken);
        setNeedsAuth(false);
        setSuccess("Google Hesabı başarıyla bağlandı! Artık doğrudan Google Takvim'e kayıt yapabilirsiniz.");
      }
    } catch (err: any) {
      console.error(err);
      if (err.message && (err.message.includes("hazır değil") || err.message.includes("Firebase config"))) {
        setError(
          "Google Takvim API projesi şu anda AI Studio sandbox ortamında hazırlanıyor. Ancak faturanızı takviminize kaydetmek için 'Google'a Kaydet' yerine hemen yanındaki 'Hatırlatıcı İndir' butonunu kullanarak .ics takvim alarm dosyasını tek tıkla indirebilir, bilgisayarınızda veya cep telefonunuzda açarak 10 ve 15 dakika kala sesli alarmlarla takviminize anında ekleyebilirsiniz!"
        );
      } else {
        setError(err.message || "Google Giriş yetkilendirmesi sırasında bir hata oluştu. Takvim hatırlatıcı alarmını el ile indirmek için 'Hatırlatıcı İndir' seçeneğini kullanabilirsiniz.");
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setGoogleUser(null);
      setAccessToken(null);
      setNeedsAuth(true);
      setSuccess("Giriş bağlantısı güvenle kapatıldı.");
    } catch (err: any) {
      setError("Çıkış sırasında hata: " + err.message);
    }
  };

  // Duplicate check pending records
  const [pendingBills, setPendingBills] = useState<Bill[] | null>(null);
  const [duplicateConflict, setDuplicateConflict] = useState<{
    existing: Bill;
    incoming: Bill;
  } | null>(null);

  // Deletion verification
  const [deletingBillId, setDeletingBillId] = useState<string | null>(null);

  // Past due-date check pending records
  const [pastDuePendingBills, setPastDuePendingBills] = useState<Bill[] | null>(null);
  const [currentCheckingPastDueBill, setCurrentCheckingPastDueBill] = useState<Bill | null>(null);
  const [pastDuePassedBills, setPastDuePassedBills] = useState<Bill[]>([]);
  const [pastDueDefaultSuccessMsg, setPastDueDefaultSuccessMsg] = useState<string | undefined>(undefined);

  // Returns true if a date string in YYYY-MM-DD format is in the past
  const isDateInPast = (dateStr: string) => {
    if (!dateStr) return false;
    // We compare with the local date portion to avoid complex timezone shifts
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    return dateStr < todayStr;
  };

  const startAddBillsFlow = (incoming: Bill[], successMsg?: string) => {
    const pastDueBills = incoming.filter(b => isDateInPast(b.sonOdemeTarihi));
    const cleanBills = incoming.filter(b => !isDateInPast(b.sonOdemeTarihi));

    if (pastDueBills.length > 0) {
      setPastDuePendingBills(pastDueBills);
      setCurrentCheckingPastDueBill(pastDueBills[0]);
      setPastDuePassedBills(cleanBills);
      setPastDueDefaultSuccessMsg(successMsg);
    } else {
      addBillsWithDuplicateCheck(incoming, bills, successMsg);
    }
  };

  const handleAcceptPastDue = () => {
    if (!currentCheckingPastDueBill || !pastDuePendingBills) return;
    const updatedPassed = [...pastDuePassedBills, currentCheckingPastDueBill];
    const remaining = pastDuePendingBills.filter(b => b.id !== currentCheckingPastDueBill.id);

    if (remaining.length > 0) {
      setPastDuePendingBills(remaining);
      setPastDuePassedBills(updatedPassed);
      setCurrentCheckingPastDueBill(remaining[0]);
    } else {
      setPastDuePendingBills(null);
      setCurrentCheckingPastDueBill(null);
      setPastDuePassedBills([]);
      addBillsWithDuplicateCheck(updatedPassed, bills, pastDueDefaultSuccessMsg);
    }
  };

  const handleRejectPastDue = () => {
    if (!currentCheckingPastDueBill || !pastDuePendingBills) return;
    const remaining = pastDuePendingBills.filter(b => b.id !== currentCheckingPastDueBill.id);

    if (remaining.length > 0) {
      setPastDuePendingBills(remaining);
      setCurrentCheckingPastDueBill(remaining[0]);
    } else {
      setPastDuePendingBills(null);
      setCurrentCheckingPastDueBill(null);
      const finalPassed = pastDuePassedBills;
      setPastDuePassedBills([]);

      if (finalPassed.length > 0) {
        addBillsWithDuplicateCheck(finalPassed, bills, pastDueDefaultSuccessMsg);
      } else {
        setSuccess("Geçmiş tarihli fatura eklenmedi.");
      }
    }
  };

  // Checks and adds newly parsed/entered bills to stored bills list
  const addBillsWithDuplicateCheck = (incoming: Bill[], currentBillsList = bills, defaultSuccessMsg?: string) => {
    let conflict: { existing: Bill; incoming: Bill } | null = null;
    let remainingIncoming: Bill[] = [];

    for (let idx = 0; idx < incoming.length; idx++) {
      const inc = incoming[idx];
      // Match by same sonOdemeTarihi and same faturaTutari
      const dup = currentBillsList.find(
        b => b.sonOdemeTarihi === inc.sonOdemeTarihi && Number(b.faturaTutari) === Number(inc.faturaTutari)
      );
      if (dup) {
        conflict = { existing: dup, incoming: inc };
        remainingIncoming = incoming.filter((_, i) => i !== idx);
        break;
      }
    }

    if (conflict) {
      setDuplicateConflict(conflict);
      setPendingBills(remainingIncoming);
    } else {
      // No conflicts remaining, save all of them
      saveBillsToStorage([...incoming, ...currentBillsList]);
      if (defaultSuccessMsg) {
        setSuccess(defaultSuccessMsg);
      }
    }
  };

  const handleResolveFirstUploaded = () => {
    if (!duplicateConflict) return;
    const nextIncoming = pendingBills || [];
    setDuplicateConflict(null);
    setPendingBills(null);
    addBillsWithDuplicateCheck(nextIncoming, bills);
    setSuccess("Yinelenen yeni fatura eklenmedi, ilk yüklenen fatura korundu.");
  };

  const handleResolveSecondUploaded = () => {
    if (!duplicateConflict) return;
    const { existing, incoming } = duplicateConflict;
    const updatedBills = bills.map(b => b.id === existing.id ? incoming : b);
    const nextIncoming = pendingBills || [];
    setDuplicateConflict(null);
    setPendingBills(null);
    
    setBills(updatedBills);
    localStorage.setItem("parsed_bills", JSON.stringify(updatedBills));
    addBillsWithDuplicateCheck(nextIncoming, updatedBills);
    setSuccess(`Eski fatura bilgileri yeni gelen fatura (${incoming.faturaTipi} - ${incoming.faturaTutari} TL) ile değiştirildi.`);
  };

  const handleResolveKeepBoth = () => {
    if (!duplicateConflict) return;
    const { incoming } = duplicateConflict;
    const updatedBills = [incoming, ...bills];
    const nextIncoming = pendingBills || [];
    setDuplicateConflict(null);
    setPendingBills(null);
    
    setBills(updatedBills);
    localStorage.setItem("parsed_bills", JSON.stringify(updatedBills));
    addBillsWithDuplicateCheck(nextIncoming, updatedBills);
    setSuccess("Aynı tarih ve tutarda olmasına rağmen her iki fatura da başarıyla kaydedildi.");
  };

  // Parse SMS text using Node.js proxy endpoint
  const handleParseSMS = async () => {
    if (!smsText.trim()) {
      setError("Lütfen analiz edilecek SMS faturası metnini ilgili alana yapıştırın.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/parse-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: smsText }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Sunucu SMS formatını çözümleyemedi.");
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.bills)) {
        // Enforce valid unique ID
        const newlyParsed: Bill[] = data.bills.map((item: any, i: number) => ({
          ...item,
          id: `bill-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
          createdAt: new Date().toISOString(),
          savedToCalendar: false
        }));

        if (newlyParsed.length === 0) {
          throw new Error("Cümlelerde anlamlı fatura girdisi bulunamadı. Lütfen kopyaladığınız içeriği kontrol edin.");
        }

        startAddBillsFlow(
          newlyParsed,
          `Yapay zeka ${newlyParsed.length} adet faturayı başarıyla ayıkladı! Tablodan inceleyebilirsiniz.`
        );
        setSmsText(""); // Reset text field after succeed
      } else {
        throw new Error("Fatura çözümlemesi boş döndü.");
      }
    } catch (err: any) {
      console.error("Parsing failed:", err);
      setError(err.message || "Fatura ayıklanamadı. Lütfen mesaj formatını değiştirip tekrar deneyin.");
    } finally {
      setIsLoading(false);
    }
  };

  // Image handling methods for screenshots / photos of bills
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Lütfen geçerli bir resim dosyası seçin (PNG, JPG, JPEG vb.).");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setBillImage(reader.result as string);
      setImageMimeType(file.type);
      setSuccess("Fatura görseli/ekran görüntüsü başarıyla yüklendi! Yapay zeka ile okumak için 'Yapay Zeka ile Çözümle' butonuna tıklayabilirsiniz.");
    };
    reader.onerror = () => {
      setError("Görsel okunurken bir hata oluştu.");
    };
    reader.readAsDataURL(file);
  };

  const handleParseImage = async () => {
    if (!billImage || !imageMimeType) {
      setError("Lütfen önce bir fatura görseli seçin.");
      return;
    }

    setIsParsingImage(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/parse-bill-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: billImage,
          mimeType: imageMimeType,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || "Görsel faturası çözümlenemedi.");
      }

      const data = await response.json();
      if (data.success && Array.isArray(data.bills)) {
        const newlyParsed: Bill[] = data.bills.map((item: any, i: number) => ({
          ...item,
          id: `bill-image-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`,
          createdAt: new Date().toISOString(),
          savedToCalendar: false
        }));

        if (newlyParsed.length === 0) {
          throw new Error("Görselde anlaşılır fatura bilgisi bulunamadı.");
        }

        startAddBillsFlow(
          newlyParsed,
          `Yapay zeka ${newlyParsed.length} adet faturayı görselden başarıyla ayıkladı!`
        );
        // Clear image state on success
        setBillImage(null);
        setImageMimeType(null);
      } else {
        throw new Error("Görsel analizinde fatura tablosu oluşturulamadı.");
      }
    } catch (err: any) {
      console.error("Image parsing error:", err);
      setError(err.message || "Görsel çözümlenemedi. Lütfen görselin net ve okunur olduğundan emin olup tekrar deneyin.");
    } finally {
      setIsParsingImage(false);
    }
  };

  const handleClearImage = () => {
    setBillImage(null);
    setImageMimeType(null);
    setSuccess(null);
  };

  // Add bill manually
  const handleAddManualBill = () => {
    if (!manualForm.faturaTipi || !manualForm.faturaTutari || !manualForm.sonOdemeTarihi) {
      setError("Lütfen fatura türü, tutarı ve son ödeme tarihini eksiksiz doldurun.");
      return;
    }

    const newBill: Bill = {
      id: `bill-manual-${Date.now()}`,
      faturaTipi: manualForm.faturaTipi,
      faturaTutari: Number(manualForm.faturaTutari),
      sonOdemeTarihi: manualForm.sonOdemeTarihi,
      donem: manualForm.donem || "Cari Dönem",
      kisi: manualForm.kisi || "",
      daire: manualForm.daire || "",
      kurum: manualForm.kurum || "",
      aciklama: manualForm.aciklama || "",
      savedToCalendar: false,
      createdAt: new Date().toISOString()
    };

    startAddBillsFlow(
      [newBill],
      "Fatura el ile başarıyla oluşturuldu."
    );
    setShowManualForm(false);
    // Reset form
    setManualForm({
      faturaTipi: "Aidat",
      faturaTutari: 0,
      sonOdemeTarihi: new Date().toISOString().split("T")[0],
      donem: "",
      kisi: "",
      daire: "",
      kurum: "",
      aciklama: ""
    });
  };

  // Delete bill flow
  const handleDeleteBill = (id: string) => {
    setDeletingBillId(id);
  };

  const handleConfirmDelete = () => {
    if (!deletingBillId) return;
    const filtered = bills.filter(b => b.id !== deletingBillId);
    saveBillsToStorage(filtered);
    setDeletingBillId(null);
    setSuccess("Fatura başarıyla silindi.");
  };

  // Update bill (e.g., inline edit changes)
  const handleUpdateBill = (updatedBill: Bill) => {
    const updated = bills.map(b => b.id === updatedBill.id ? updatedBill : b);
    saveBillsToStorage(updated);
    setSuccess("Fatura bilgileri güncellendi.");
  };

  // Sync to Google Calendar API
  const handleSyncToGoogleCalendar = async (bill: Bill) => {
    if (!accessToken) {
      setError(
        "Faturayı doğrudan Google Takvim'e kaydetmek için önce yukarıdaki 'GOOGLE TAKVİM BAĞLA' butonuyla giriş yapılmalıdır. Ancak, entegrasyon projesi şu anda AI Studio sandbox ortamında hazırlanma aşamasında olduğu için, hemen yanındaki 'Hatırlatıcı İndir' (veya alt kısımdaki 'Hatırlatıcı İndir') butonuna tıklayarak alarm dosyasını saniyeler içinde cihazınıza yükleyebilir ve doğrudan takviminize (Apple, Google, Outlook) 10 ve 15 dk kala alarmları ile birlikte kaydedebilirsiniz!"
      );
      // Auto blink login block
      const element = document.getElementById("google-login-block");
      element?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    setIsSyncingId(bill.id);
    setError(null);
    setSuccess(null);

    try {
      // Precise hours: 12:00 PM on due date
      const startDateTime = `${bill.sonOdemeTarihi}T12:00:00`;
      const endDateTime = `${bill.sonOdemeTarihi}T13:00:00`;
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Istanbul";

      const eventPayload = {
        summary: `🔔 Fatura Son Ödeme Günü: ${bill.faturaTipi} (${formatCurrency(bill.faturaTutari)})`,
        description: [
          `Fatura Türü: ${bill.faturaTipi}`,
          `Fatura Tutarı: ${bill.faturaTutari} TL`,
          `Dönem: ${bill.donem}`,
          `Kurum: ${bill.kurum || "Belirtilmedi"}`,
          `Abone/Daire: ${bill.daire || "Belirtilmedi"}`,
          `Ad Soyad: ${bill.kisi || "Belirtilmedi"}`,
          `Açıklama: ${bill.aciklama || ""}`,
          `---`,
          `Bu hatırlatıcı Fatura Analiz ve Hatırlatıcı uygulaması tarafından otomatik olarak oluşturuldu.`
        ].join("\n"),
        start: {
          dateTime: startDateTime,
          timeZone: timeZone
        },
        end: {
          dateTime: endDateTime,
          timeZone: timeZone
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 15 },
            { method: "popup", minutes: 10 }
          ]
        }
      };

      const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(eventPayload),
      });

      if (!response.ok) {
        throw new Error(`Google Takvim API hatası: ${response.statusText} (${response.status})`);
      }

      const responseData = await response.json();
      
      // Update local item
      const updated = bills.map(b => b.id === bill.id ? {
        ...b,
        savedToCalendar: true,
        calendarEventId: responseData.id,
        calendarEventLink: responseData.htmlLink
      } : b);

      saveBillsToStorage(updated);
      setSuccess(`"${bill.faturaTipi}" faturası Google Takviminize saat 12:00 programlı, 10 ve 15 dakika öncesinde bildirim uyarısıyla kaydedildi!`);
    } catch (err: any) {
      console.error(err);
      setError(`Google Takvim'e kaydedilirken sorun oluştu: ${err.message || err}`);
    } finally {
      setIsSyncingId(null);
    }
  };

  // Bulk sync to Google Calendar API
  const handleBulkSyncToGoogleCalendar = async (targetBills: Bill[]) => {
    if (!accessToken) {
      setError(
        "Faturaları toplu olarak Google Takvim'e kaydetmek için önce yukarıdaki 'GOOGLE TAKVİM BAĞLA' butonuyla giriş yapılmalıdır. Ancak takvim alarm dosyasını toplu indirmek için hemen yanındaki 'Hatırlatıcı İndir (.ICS)' butonunu kullanabilirsiniz!"
      );
      const element = document.getElementById("google-login-block");
      element?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    // Filter out bills already saved to calendar or take everything if requested
    const billsToSync = targetBills.filter(b => !b.savedToCalendar);
    if (billsToSync.length === 0) {
      setSuccess("Tüm faturalar zaten Google Takvim'e kaydedilmiş durumda!");
      return;
    }

    setIsBulkSyncing(true);
    setError(null);
    setSuccess(null);

    let successCount = 0;
    let failCount = 0;
    let updatedBills = [...bills];

    for (const bill of billsToSync) {
      try {
        const startDateTime = `${bill.sonOdemeTarihi}T12:00:00`;
        const endDateTime = `${bill.sonOdemeTarihi}T13:00:00`;
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Istanbul";

        const eventPayload = {
          summary: `🔔 Fatura Son Ödeme Günü: ${bill.faturaTipi} (${formatCurrency(bill.faturaTutari)})`,
          description: [
            `Fatura Türü: ${bill.faturaTipi}`,
            `Fatura Tutarı: ${bill.faturaTutari} TL`,
            `Dönem: ${bill.donem}`,
            `Kurum: ${bill.kurum || "Belirtilmedi"}`,
            `Abone/Daire: ${bill.daire || "Belirtilmedi"}`,
            `Ad Soyad: ${bill.kisi || "Belirtilmedi"}`,
            `Açıklama: ${bill.aciklama || ""}`,
            `---`,
            `Bu hatırlatıcı Fatura Analiz ve Hatırlatıcı uygulaması tarafından otomatik olarak oluşturuldu.`
          ].join("\n"),
          start: {
            dateTime: startDateTime,
            timeZone: timeZone
          },
          end: {
            dateTime: endDateTime,
            timeZone: timeZone
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: "popup", minutes: 15 },
              { method: "popup", minutes: 10 }
            ]
          }
        };

        const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(eventPayload),
        });

        if (response.ok) {
          const responseData = await response.json();
          updatedBills = updatedBills.map(b => b.id === bill.id ? {
            ...b,
            savedToCalendar: true,
            calendarEventId: responseData.id,
            calendarEventLink: responseData.htmlLink
          } : b);
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.error("Bulk sync error: ", err);
        failCount++;
      }
    }

    saveBillsToStorage(updatedBills);

    if (failCount === 0) {
      setSuccess(`Harika! ${successCount} adet faturanın tamamı Google Takviminize başarıyla kaydedildi.`);
    } else {
      setSuccess(`Eşitleme tamamlandı. ${successCount} fatura eklendi, ${failCount} adet faturada hata oluştu.`);
    }
    setIsBulkSyncing(false);
  };

  // Get next imminent bill for the dark dashboard widget
  const getNextImminentBill = () => {
    if (bills.length === 0) return null;
    // Sort by soonest due date
    const sorted = [...bills].sort((a, b) => new Date(a.sonOdemeTarihi).getTime() - new Date(b.sonOdemeTarihi).getTime());
    return sorted[0];
  };

  const imminentBill = getNextImminentBill();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* Global Header */}
      <header className="h-20 bg-white border-b border-slate-200 px-6 md:px-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-black text-xl hover:scale-105 transition-transform shadow-md">
            %
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-800 uppercase flex items-center gap-1.5">
              Fatura <span className="font-light text-blue-600">Parser</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none">
              Geometric Dynamic Engine
            </p>
          </div>
        </div>

        {/* OAuth / Settings info */}
        <div className="flex items-center gap-4">
          {googleUser ? (
            <div className="flex items-center gap-3 bg-slate-100 p-1.5 pr-3 rounded-full border border-slate-200">
              <img 
                src={googleUser.photoURL || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&h=80"} 
                alt="Profile" 
                className="w-7 h-7 rounded-full object-cover border border-slate-300"
                referrerPolicy="no-referrer"
              />
              <div className="hidden sm:block text-left">
                <div className="text-xs font-bold text-slate-700 leading-tight">{googleUser.displayName}</div>
                <div className="text-[9px] text-emerald-600 font-bold tracking-wider leading-none">TAKIM BAĞLANDI</div>
              </div>
              <button 
                onClick={handleLogout}
                className="p-1 px-2.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-full transition-colors text-xs flex items-center gap-1 shadow-sm border border-slate-300 ml-1 bg-white"
                title="Girişi Kapat"
              >
                <LogOut className="w-3 h-3" />
                <span className="hidden md:inline">Çıkış</span>
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              id="google-login-block"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm tracking-wider flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              {isLoggingIn ? "BAĞLANIYOR..." : "GOOGLE TAKVİM BAĞLA"}
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Workspace */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 md:p-10 p-b-16">
        
        {/* Left Hand: SMS Copy Box and Controls (col-span-5) */}
        <section className="lg:col-span-5 flex flex-col gap-6" id="left-workspace-panel">
          
          {/* SMS & Görsel Çözümleme Kartı */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                Adım 1: Fatura Girişi
              </h2>
              <span className="text-[10px] bg-slate-100 px-2 py-1 rounded-md text-slate-500 font-bold uppercase tracking-wide">
                AI Çözümleme
              </span>
            </div>

            {/* Tab Buttons */}
            <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
              <button
                type="button"
                onClick={() => setActiveInputTab("sms")}
                className={`flex-1 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeInputTab === "sms"
                    ? "bg-white text-slate-800 shadow"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                SMS Metni Yapıştır
              </button>
              <button
                type="button"
                onClick={() => setActiveInputTab("image")}
                className={`flex-1 py-2 rounded-md text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeInputTab === "image"
                    ? "bg-white text-slate-800 shadow"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                <Image className="w-3.5 h-3.5" />
                Ekran Görüntüsü Yükle
              </button>
            </div>

            {activeInputTab === "sms" ? (
              <>
                <p className="text-xs text-slate-500 mb-3">
                  Gelen elektrik, doğalgaz, internet, Turkcell veya site yönetimi aidatı SMS metnini kopyalayıp buraya yapıştırın. Yapay zeka otomatik olarak tutar, tarih ve kurum bilgilerini ayıklar.
                </p>

                <textarea 
                  className="w-full min-h-[160px] p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-700 leading-relaxed focus:ring-2 focus:ring-blue-500 focus:outline-none resize-none placeholder-slate-400 focus:bg-white transition-all"
                  placeholder="Mesajı buraya yapıştırın... (Örn: 9516925 nolu tesisata ait 586,00 tutarli faturanin son odemesi 17. 6.2026...)"
                  value={smsText}
                  onChange={(e) => setSmsText(e.target.value)}
                />

                {/* Parse trigger */}
                <div className="flex flex-col gap-3 mt-4">
                  <button 
                    onClick={handleParseSMS}
                    disabled={isLoading}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 tracking-wider text-xs shadow-md disabled:bg-blue-400"
                  >
                    {isLoading ? (
                      <>
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                        BİLGİLER ÇIKARILIYOR...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        ANALİZ ET & TABLOYA DÖNÜŞTÜR
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-slate-500 mb-3">
                  Turkcell, Enerya veya elektrik faturası ekran görüntüsünü (screenshot) yükleyin. Yapay zeka tüm verileri görselden en doğru şekilde okuyacaktır.
                </p>

                {!billImage ? (
                  <div 
                    onClick={() => document.getElementById("bill-image-input")?.click()}
                    className="w-full min-h-[160px] border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-lg flex flex-col items-center justify-center p-4 bg-slate-50 hover:bg-blue-50/30 cursor-pointer transition-all gap-2"
                  >
                    <Upload className="w-8 h-8 text-slate-400 animate-pulse" />
                    <span className="text-xs font-bold text-slate-600">Ekran Görüntüsü Seçin veya Sürükleyin</span>
                    <span className="text-[10px] text-slate-400">JPG, JPEG veya PNG formatında dosya</span>
                    <input 
                      type="file" 
                      id="bill-image-input" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageSelect} 
                    />
                  </div>
                ) : (
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col items-center gap-3 relative">
                    <button 
                      onClick={handleClearImage}
                      className="absolute top-2 right-2 p-1 bg-white hover:bg-slate-100 text-slate-500 hover:text-slate-800 rounded-full border border-slate-200 shadow"
                      title="Görseli Kaldır"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <img 
                      src={billImage} 
                      alt="Fatura Ekran Görüntüsü" 
                      className="max-h-[180px] object-contain rounded border border-slate-200 shadow-sm"
                    />
                    <div className="text-[10px] text-slate-500 truncate max-w-full font-mono">
                      Görsel Hazır
                    </div>
                  </div>
                )}

                {/* Parse image trigger */}
                <div className="flex flex-col gap-3 mt-4">
                  <button 
                    onClick={handleParseImage}
                    disabled={isParsingImage || !billImage}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2 tracking-wider text-xs shadow-md disabled:bg-emerald-400"
                  >
                    {isParsingImage ? (
                      <>
                        <RefreshCcw className="w-4 h-4 animate-spin" />
                        GÖRSEL ÇÖZÜMLENİYOR...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        YAPAY ZEKA İLE GÖRSELİ ÇÖZÜMLE
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            <button
              onClick={() => setShowManualForm(!showManualForm)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-all text-xs border border-slate-300 flex items-center justify-center gap-1.5 mt-3 animate-fadeIn"
            >
              <Plus className="w-4 h-4" />
              {showManualForm ? "Manuel Giriş Formunu Kapat" : "Manuel Fatura Girişi Yap"}
            </button>
          </div>

          {/* Optional Manual Entry Form */}
          {showManualForm && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-fadeIn">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-1">
                <PlusCircle className="w-4 h-4 text-slate-500" />
                El ile Fatura Bilgisi Girin
              </h3>
              
              <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Fatura Tipi:</label>
                  <select 
                    className="p-2 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    value={manualForm.faturaTipi}
                    onChange={(e) => setManualForm({ ...manualForm, faturaTipi: e.target.value })}
                  >
                    <option value="Aidat">Site Aidatı</option>
                    <option value="Doğalgaz">Doğalgaz</option>
                    <option value="Elektrik">Elektrik</option>
                    <option value="Su">Sıcak / Soğuk Su</option>
                    <option value="İnternet">İnternet / TV</option>
                    <option value="Diğer">Diğer Ödeme</option>
                  </select>
                </div>
                
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Ödeme Tutarı (TL):</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="p-1 px-2 border border-slate-200 rounded h-[34px] focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    value={manualForm.faturaTutari || ""}
                    onChange={(e) => setManualForm({ ...manualForm, faturaTutari: parseFloat(e.target.value) || 0 })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Son Ödeme Günü:</label>
                  <input 
                    type="date" 
                    className="p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    value={manualForm.sonOdemeTarihi || ""}
                    onChange={(e) => setManualForm({ ...manualForm, sonOdemeTarihi: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Dönem:</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Haziran 2026"
                    className="p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    value={manualForm.donem || ""}
                    onChange={(e) => setManualForm({ ...manualForm, donem: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-bold text-slate-600">Kurum / Alıcı:</label>
                  <input 
                    type="text" 
                    placeholder="Örn: Niğde Emlak Konutları Site Yönetimi"
                    className="p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    value={manualForm.kurum || ""}
                    onChange={(e) => setManualForm({ ...manualForm, kurum: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Kişi Ad/Soyad:</label>
                  <input 
                    type="text" 
                    placeholder="Ad Soyad"
                    className="p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    value={manualForm.kisi || ""}
                    onChange={(e) => setManualForm({ ...manualForm, kisi: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-bold text-slate-600">Daire / Blok No:</label>
                  <input 
                    type="text" 
                    placeholder="Örn: B2BLOK Daire 38"
                    className="p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 focus:outline-none"
                    value={manualForm.daire || ""}
                    onChange={(e) => setManualForm({ ...manualForm, daire: e.target.value })}
                  />
                </div>
              </div>

              <button
                onClick={handleAddManualBill}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded text-xs transition-colors shadow-sm"
              >
                YENİ GİRDİ EKLE
              </button>
            </div>
          )}

          {/* Quick-try Templates card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider mb-3">
              Örnek SMS Şablonları (Denemek İçin Tıklayın)
            </h3>
            <div className="flex flex-col gap-2">
              {SAMPLE_SMS_MESSAGES.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => setSmsText(sample.text)}
                  className="p-2.5 bg-slate-50 hover:bg-blue-50 rounded-lg hover:border-blue-300 border border-slate-200 text-left transition-all group flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                      {sample.title}
                    </div>
                    <div className="text-[11px] text-slate-400 line-clamp-1 max-w-[320px] mt-0.5 font-mono">
                      {sample.text}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                </button>
              ))}
            </div>
          </div>

        </section>

        {/* Right Hand: Rendered Database Table & Imminent Event Reminder (col-span-12 or col-span-7) */}
        <section className="lg:col-span-7 flex flex-col gap-6">

          {/* Status Message Alerts */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2.5 shadow-sm animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block">Bir Hata Oluştu</span>
                {error}
                <div className="mt-2 flex gap-2">
                  <button 
                    onClick={() => setError(null)}
                    className="text-[10px] font-black underline hover:text-rose-950"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2.5 shadow-sm animate-fadeIn">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-extrabold block">İşlem Başarılı</span>
                {success}
                <button 
                  onClick={() => setSuccess(null)}
                  className="mt-1 text-[10px] font-black underline hover:text-emerald-950 block"
                >
                  Anladım
                </button>
              </div>
            </div>
          )}

          {/* Parsed Bills Table */}
          {(() => {
            const sortedByDate = [...bills].sort((a, b) => {
              const dateA = a.sonOdemeTarihi || "";
              const dateB = b.sonOdemeTarihi || "";
              if (!dateA) return 1;
              if (!dateB) return -1;
              return dateA.localeCompare(dateB);
            });
            return (
              <InvoiceTable 
                bills={sortedByDate}
                onDelete={handleDeleteBill}
                onUpdate={handleUpdateBill}
                onSyncToGoogleCalendar={handleSyncToGoogleCalendar}
                onBulkSyncToGoogleCalendar={handleBulkSyncToGoogleCalendar}
                googleCalendarConnected={!needsAuth}
                isSyncingId={isSyncingId}
                isBulkSyncing={isBulkSyncing}
              />
            );
          })()}

          {/* Imminent/Reminder Widget */}
          {imminentBill && (
            <div className="bg-slate-900 rounded-xl p-6 relative overflow-hidden text-white shadow-xl min-h-[220px] flex flex-col justify-between">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse"></span>
                  <h2 className="text-xs font-black uppercase text-blue-400 tracking-widest text-[10px]">
                    Adım 3: Sıradaki En Yakın Fatura Hatırlatması
                  </h2>
                </div>
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  {/* Big Date Display */}
                  <div className="bg-white/10 p-5 rounded-lg border border-white/20 shrink-0 text-center min-w-[90px]">
                    <div className="text-blue-400 text-xs font-bold uppercase mb-1">
                      {new Date(imminentBill.sonOdemeTarihi).toLocaleDateString("tr-TR", { month: "short" }).toUpperCase()}
                    </div>
                    <div className="text-white text-4xl font-black leading-none">
                      {imminentBill.sonOdemeTarihi.split("-")[2]}
                    </div>
                    <div className="text-white/60 text-[10px] tracking-wider mt-2">
                      {imminentBill.sonOdemeTarihi.split("-")[0]}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 text-[10px] font-bold rounded border border-orange-500/30 uppercase tracking-widest">
                        {imminentBill.faturaTipi}
                      </span>
                      {imminentBill.savedToCalendar && (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded border border-emerald-500/30 uppercase tracking-widest">
                          Google Takvim'e Senkronize
                        </span>
                      )}
                    </div>
                    
                    <div className="text-lg font-bold">
                      {imminentBill.kurum || "Fatura Ödemesi"}
                    </div>
                    
                    <div className="text-slate-400 text-xs">
                      Saat: <span className="text-white font-bold">12:00</span> olarak planlandı. Uyanma alarm uyarısı: 
                    </div>
                    
                    <div className="flex gap-2.5 mt-1.5">
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-md text-[10px] border border-blue-500/30 font-semibold">
                        Alert: 15 dakika kala
                      </span>
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded-md text-[10px] border border-blue-500/30 font-semibold">
                        Alert: 10 dakika kala
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between z-10 text-xs">
                <span className="text-slate-400 text-[11px] italic">
                  * 12:00 Son Ödeme Hatırlatıcı Otomasyonu
                </span>
                
                {!imminentBill.savedToCalendar ? (
                  <button 
                    onClick={() => handleSyncToGoogleCalendar(imminentBill)}
                    className="text-xs font-bold text-white bg-blue-600 px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors uppercase tracking-wider shadow-md"
                  >
                    Google Takvim'e Ekle
                  </button>
                ) : (
                  <span className="text-emerald-400 font-bold text-[11px] uppercase tracking-widest flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Takviminizde Güvende
                  </span>
                )}
              </div>

              {/* Decorative geometric circle in bg */}
              <div className="absolute -bottom-20 -right-20 w-64 h-64 border-[32px] border-white/5 rounded-full pointer-events-none"></div>
            </div>
          )}

        </section>

      </main>

      {/* Yinelenen Fatura Uyarı Modalı */}
      {duplicateConflict && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fadeIn"
          id="duplicate-warning-modal"
        >
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white flex items-center gap-3">
              <AlertCircle className="w-8 h-8 shrink-0 text-white animate-bounce" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Aynı Son Ödeme Tarihi ve Tutar Algılandı!</h3>
                <p className="text-xs text-white/90 font-medium">Sistemde çakışan iki kayıt tespit edildi.</p>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex flex-col gap-5">
              
              <p className="text-xs text-slate-600 leading-relaxed">
                Yüklemek istediğiniz fatura ile sisteminizde kayıtlı olan faturanın <span className="font-bold underline text-slate-800">Son Ödeme Tarihi</span> ve <span className="font-bold underline text-slate-800">Fatura Tutarı</span> birebir eşleşmektedir. Tablonuzun düzenini korumak için lütfen aşağıdan faturaya dair doğru seçimi yapınız:
              </p>

              {/* Grid comparing the conflict */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                {/* Existing Bill Card */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl relative">
                  <span className="absolute top-2 right-2 text-[9px] bg-slate-200 text-slate-600 font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    İlk Yüklenen (Eski)
                  </span>
                  
                  <div className="flex flex-col gap-1.5 mt-3">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Fatura Detayları</div>
                    <div className="text-xs font-black text-slate-800">{duplicateConflict.existing.faturaTipi}</div>
                    
                    <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px] text-slate-600 mt-1">
                      <div>Tutar:</div>
                      <div className="font-mono text-slate-900 font-semibold">{formatCurrency(duplicateConflict.existing.faturaTutari)}</div>
                      
                      <div>Son Ödeme:</div>
                      <div className="font-mono text-slate-900 font-semibold">{formatDateTurkish(duplicateConflict.existing.sonOdemeTarihi)}</div>
                      
                      <div>Dönem / Kurum:</div>
                      <div className="truncate text-slate-900 font-medium">{duplicateConflict.existing.donem || "Cari Dönem"} / {duplicateConflict.existing.kurum || "-"}</div>
                      
                      <div>Kişi / Daire:</div>
                      <div className="truncate text-slate-900 font-medium">{duplicateConflict.existing.kisi || "Belirtilmedi"} / {duplicateConflict.existing.daire || "-"}</div>
                    </div>
                  </div>
                </div>

                {/* Incoming Bill Card */}
                <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl relative">
                  <span className="absolute top-2 right-2 text-[9px] bg-blue-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                    İkinci Yüklenen (Yeni)
                  </span>

                  <div className="flex flex-col gap-1.5 mt-3">
                    <div className="text-[10px] text-blue-400 font-bold uppercase">Gelen Yeni Bilgiler</div>
                    <div className="text-xs font-black text-blue-800">{duplicateConflict.incoming.faturaTipi}</div>
                    
                    <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px] text-slate-600 mt-1">
                      <div>Tutar:</div>
                      <div className="font-mono text-blue-900 font-semibold">{formatCurrency(duplicateConflict.incoming.faturaTutari)}</div>
                      
                      <div>Son Ödeme:</div>
                      <div className="font-mono text-blue-900 font-semibold">{formatDateTurkish(duplicateConflict.incoming.sonOdemeTarihi)}</div>
                      
                      <div>Dönem / Kurum:</div>
                      <div className="truncate text-blue-900 font-medium">{duplicateConflict.incoming.donem || "Cari Dönem"} / {duplicateConflict.incoming.kurum || "-"}</div>
                      
                      <div>Kişi / Daire:</div>
                      <div className="truncate text-blue-900 font-medium">{duplicateConflict.incoming.kisi || "Belirtilmedi"} / {duplicateConflict.incoming.daire || "-"}</div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Choices */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100 mt-1">
                <button
                  type="button"
                  onClick={handleResolveFirstUploaded}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-extrabold text-xs rounded-xl transition-all shadow-sm flex flex-col items-center justify-center gap-0.5 p-2 h-14"
                >
                  <span className="uppercase text-[10px] tracking-wider block text-slate-800">İlk Yüklenen Kalsın</span>
                  <span className="text-[9px] text-slate-400 font-normal">Mevcut kaydı korur, yeni olanı eklemez</span>
                </button>

                <button
                  type="button"
                  onClick={handleResolveSecondUploaded}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex flex-col items-center justify-center gap-0.5 p-2 h-14"
                >
                  <span className="uppercase text-[10px] tracking-wider block">İkinci Yüklenen Kalsın</span>
                  <span className="text-blue-100 text-[9px] font-normal">Mevcudu siler, yerine yenisini koyar</span>
                </button>

                <button
                  type="button"
                  onClick={handleResolveKeepBoth}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex flex-col items-center justify-center gap-0.5 p-2 h-14"
                >
                  <span className="uppercase text-[10px] tracking-wider block">Her İkisi de Kalsın</span>
                  <span className="text-emerald-100 text-[9px] font-normal">Çakışmayı yok sayıp ikisini de kaydeder</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Geçmiş Son Ödeme Tarihi Uyarı Modalı */}
      {currentCheckingPastDueBill && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fadeIn"
          id="past-due-warning-modal"
        >
          <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-500 to-rose-600 p-5 text-white flex items-center gap-3">
              <Clock className="w-8 h-8 shrink-0 text-white animate-pulse" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Geçmiş Son Ödeme Tarihi!</h3>
                <p className="text-xs text-white/90 font-medium">Bu faturanın son ödeme tarihi geçmiş bir tarihtir.</p>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex flex-col gap-5">
              
              <p className="text-sm text-slate-700 font-semibold leading-relaxed">
                Bu Faturanın Son Ödeme Tarihi geçmiştir. Yine de listeye ekleyeyim mi?
              </p>

              {/* Invoice Details Card */}
              <div className="p-4 bg-rose-50/30 border border-rose-200 rounded-xl relative">
                <span className="absolute top-2 right-2 text-[9px] bg-red-600 text-white font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider animate-pulse">
                  SÜRESİ GEÇMİŞ
                </span>
                
                <div className="flex flex-col gap-1.5 mt-2">
                  <div className="text-[10px] text-rose-500 font-bold uppercase">Yüklenecek Fatura Bilgileri</div>
                  <div className="text-xs font-black text-slate-850">{currentCheckingPastDueBill.faturaTipi}</div>
                  
                  <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px] text-slate-600 mt-1">
                    <div>Tutar:</div>
                    <div className="font-mono text-slate-900 font-semibold">{formatCurrency(currentCheckingPastDueBill.faturaTutari)}</div>
                    
                    <div>Son Ödeme Tarihi:</div>
                    <div className="font-mono text-red-600 font-bold">{formatDateTurkish(currentCheckingPastDueBill.sonOdemeTarihi)}</div>
                    
                    <div>Dönem / Kurum:</div>
                    <div className="truncate text-slate-900 font-semibold">{currentCheckingPastDueBill.donem || "Cari Dönem"} / {currentCheckingPastDueBill.kurum || "-"}</div>
                    
                    <div>Kişi / Daire:</div>
                    <div className="truncate text-slate-900 font-semibold">{currentCheckingPastDueBill.kisi || "Belirtilmedi"} / {currentCheckingPastDueBill.daire || "-"}</div>
                  </div>
                </div>
              </div>

              {/* Action Choices */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100 mt-1">
                <button
                  type="button"
                  onClick={handleRejectPastDue}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-extrabold text-xs rounded-xl transition-all shadow-sm flex flex-col items-center justify-center gap-0.5 p-2 h-14 animate-fade"
                >
                  <span className="uppercase text-[10px] tracking-wider block text-slate-800">Hayır, Ekleme</span>
                  <span className="text-[9px] text-slate-400 font-normal">Faturayı iptal et ve yoksay</span>
                </button>

                <button
                  type="button"
                  onClick={handleAcceptPastDue}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex flex-col items-center justify-center gap-0.5 p-2 h-14"
                >
                  <span className="uppercase text-[10px] tracking-wider block">Evet, Listeye Ekle</span>
                  <span className="text-emerald-100 text-[9px] font-normal">Geçmiş olmasına rağmen listeye ekle</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Fatura Silme Onay Modalı */}
      {deletingBillId && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fadeIn"
          id="delete-warning-modal"
        >
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-scaleUp">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-500 to-rose-600 p-5 text-white flex items-center gap-3">
              <Trash2 className="w-8 h-8 shrink-0 text-white animate-bounce" />
              <div>
                <h3 className="text-sm font-black uppercase tracking-wider">Faturayı Sil!</h3>
                <p className="text-xs text-white/90 font-medium font-sans">Bu işlem geri alınamaz.</p>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex flex-col gap-5">
              
              <div className="text-sm text-slate-700 leading-relaxed font-sans font-medium">
                Seçtiğiniz faturayı tablodan ve sisteminizden kalıcı olarak silmek istediğinize emin misiniz?
              </div>

              {/* Bill brief details if found */}
              {(() => {
                const targetBill = bills.find(b => b.id === deletingBillId);
                if (!targetBill) return null;
                return (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Silinecek Fatura</div>
                    <div className="text-xs font-black text-slate-800">{targetBill.faturaTipi}</div>
                    <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px] text-slate-600 mt-1 font-sans">
                      <div>Tutar:</div>
                      <div className="font-mono text-slate-900 font-bold">{formatCurrency(targetBill.faturaTutari)}</div>
                      <div>Kurum/Daire:</div>
                      <div className="truncate text-slate-900 font-semibold">{targetBill.kurum || "-"} / {targetBill.daire || "Belirtilmedi"}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Action Choices */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-100 mt-1">
                <button
                  type="button"
                  onClick={() => setDeletingBillId(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 font-extrabold text-xs rounded-xl transition-all shadow-sm flex flex-col items-center justify-center gap-0.5 p-2 h-14"
                >
                  <span className="uppercase text-[10px] tracking-wider block text-slate-800">Hayır, Vazgeç</span>
                  <span className="text-[9px] text-slate-400 font-normal font-sans">Faturayı korur</span>
                </button>

                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-xl transition-all shadow-md flex flex-col items-center justify-center gap-0.5 p-2 h-14"
                >
                  <span className="uppercase text-[10px] tracking-wider block text-white font-sans font-black">Evet, Sil</span>
                  <span className="text-red-100 text-[9px] font-normal font-sans">Kayıtlardan kaldırır</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Footer Status Indicators */}
      <footer className="h-12 bg-white border-t border-slate-200 px-6 md:px-12 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div> 
            Kayıt Altyapısı Aktif
          </span>
          <span className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${googleUser ? "bg-blue-500" : "bg-amber-500"}`}></div> 
            {googleUser ? "Google Bağlı" : "Google Bağlı Değil (İndirme Aktif)"}
          </span>
        </div>
        <div className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
          V.2.1.0 • GEOMETRIC PRECISION ENGINE
        </div>
      </footer>
    </div>
  );
}
