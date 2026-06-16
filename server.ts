import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));

// Initialize Gemini SDK with custom User-Agent for telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Endpoint to route and serve firebase-applet-config.json correctly to client
app.get("/firebase-applet-config.json", (req, res) => {
  res.sendFile(path.join(process.cwd(), "firebase-applet-config.json"));
});

// SMS Parsing API endpoint
app.post("/api/parse-sms", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== "string") {
      res.status(400).json({ error: "Lütfen analiz edilecek fatura SMS metnini girin." });
      return;
    }

    const currentYear = new Date().getFullYear();
    const systemPrompt = `Gelen fatura veya aidat SMS mesajlarını analiz eden ve içindeki fatura detaylarını çıkaran bir asistansın.
Bugünün tarihi: ${new Date().toISOString().split('T')[0]}. Yıl belirtilmeyen son ödeme tarihlerini varsayılan olarak cari yıl (${currentYear}) ile ilişkilendir.

ÖZEL KURALLAR:
1. TARİH AYIKLAMA & BOŞLUKLAR: Tarihler '17. 6.2026' veya '17.  06.2026' gibi düzensiz boşluklar içerebilir. Bu boşlukları temizle ve doğru şekilde 'YYYY-MM-DD' formatına dönüştür (Örn: '17. 6.2026' -> '2026-06-17').
2. TESİSAT SÖZCÜĞÜ = ELEKTRİK: Metin içerisinde 'elektrik' ibaresi geçmese dahi, 'tesisat', 'tesisata ait', 'nolu tesisata' veya 'tesisat numaralı' gibi ifadeler elektrik faturasını temsil eder. Bu tür faturaların türünü mutlaka 'Elektrik' / 'Elektrik Faturası' olarak belirle.
3. SAYISAL TUTARLAR: Türk Lirası tutarlarındaki virgülleri (.) noktaya çevirerek float sayı değerine dönüştür (Örn: '586,00' -> 586.00, '1917.24' -> 1917.24).
4. EKSİK SON ÖDEME GÜNÜ: Eğer kesin son ödeme günü belirtilmemişse (örneğin sadece "Haziran ayı içerisinde" denmişse), o ayın son gününü (örneğin 2026-06-30) son ödeme tarihi kabul et.
4a. AİDAT SON GÜNE BIRAKMAMAK SÖZCÜĞÜ KURALI: Eğer faturada veya metinde 'son güne bırakmamak', 'son güne bırakmamak kaydıyla' gibi bir ifade geçiyorsa ve ödemenin belirli bir ay içerisinde yapılması belirtilmişse (örneğin "Haziran ayı içerisinde" denmişse), son ödeme tarihini o ayın son gününün bir gün öncesi olacak şekilde ata (Örn: "Haziran ayı içerisinde son güne bırakmamak..." için Haziran ayının son günü 30 Haziran'dır, 1 gün öncesi ise 29 Haziran'dır yani son ödeme tarihini '2026-06-29' olarak belirle).
5. GERÇEK ÖDENECEK TUTAR / DEVLET DESTEĞİ: Fatura mesajlarında birden fazla tutar bulunuyorsa (örneğin devlet desteği içeren doğalgaz faturaları gibi tüketim bedeli ayrımı olan yerlerde), asıl ödenmesi gereken cebinizden çıkacak net tutarı faturaTutari olarak belirle. 'ödenmesi gereken', 'odenmesi gereken fatura tutari', 'net tutar' ifadesinin geçtiği sayıya öncelik ver (Örn: "...tuketim bedeli 218.14 TL... devlet destegi sonrasinda odenmesi gereken fatura tutari 130,00 TL'dir" metni için tutarı 130.00 olarak ayıkla).
6. TURKCELL / CEP TELEFONU / MOBİL FATURASI: Metin içerisinde 'İçerik/İletişim Ücretleriniz' veya 'Paycell İşlemleriniz' vb. ibareler geçiyorsa ya da Turkcell faturası ise faturaTipi'ni 'Mobil Fatura' veya 'Telefon Faturası' olarak ata. Kurum'u 'Turkcell' olarak belirle. Faturadaki toplam net ödenecek tutarı (örneğin 'Ödenmesi gereken fatura tutarı' veya 'TOPLAM') faturaTutari olarak belirle.
7. TELEFON NUMARASI EŞLEŞTİRME KURALLARI (TURKCELL / MOBİL): Faturada veya mesajda geçen cep telefonu numarası (bilgi 'daire' veya 'aciklama' alanında telefon numarası olarak da geçer):
   - Eğer telefon numarası '533 432 07 74' veya '5334320774' ise, 'kisi' değerini kesinlikle ve sadece 'Necati Sercan Çağan' olarak ata.
   - Eğer telefon numarası '544 224 19 21' veya '5442241921' ise, 'kisi' değerini kesinlikle ve sadece 'Deniz Çağan' olarak ata.
   - Eğer telefon numarası '538 487 07 74' veya '5384870774' ise, 'kisi' değerini kesinlikle ve sadece 'İpek Çağan' olarak ata.
   Eşleşen telefon numarasını sadeleştirerek 'daire' alanına '533 432 07 74' / '544 224 19 21' / '538 487 07 74' biçiminde temizce ata.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Şu SMS metnindeki faturaları çıkar ve JSON dizisi olarak dönüştür:\n\n"${text}"`,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Çıkarılan faturaların listesi",
          items: {
            type: Type.OBJECT,
            properties: {
              faturaTipi: {
                type: Type.STRING,
                description: "Faturanın türü (Örn: Aidat, Sıcak Su, Soğuk Su, Isınma, Doğalgaz, Elektrik, İnternet, Su vb.)",
              },
              faturaTutari: {
                type: Type.NUMBER,
                description: "Fatura tutarı TL bazında sayısal değer (Örn: 1917.24)",
              },
              sonOdemeTarihi: {
                type: Type.STRING,
                description: "Son ödeme tarihi YYYY-MM-DD formatında (Örn: 2026-06-16)",
              },
              donem: {
                type: Type.STRING,
                description: "Ödeme dönemi veya ait olduğu ay aralığı (Örn: Haziran 2026 or 07.05.2026 - 06.06.2026)",
              },
              kisi: {
                type: Type.STRING,
                description: "Faturada adı geçen kişi ismi (Örn: NECATİ SERCAN ÇAĞAN)",
              },
              daire: {
                type: Type.STRING,
                description: "Daire veya blok bilgisi (Örn: B2BLOK Daire 38)",
              },
              kurum: {
                type: Type.STRING,
                description: "Faturayı kesen kurum veya kuruluş (Örn: Niğde Emlak Konutları Site Yönetimi)",
              },
              aciklama: {
                type: Type.STRING,
                description: "Faturaya dair kısa/özet açıklama metni",
              },
            },
            required: ["faturaTipi", "faturaTutari", "sonOdemeTarihi", "donem"],
          },
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      res.status(500).json({ error: "Yapay zeka fatura bilgilerini çözümleyemedi." });
      return;
    }

    const parsedData = JSON.parse(resultText);
    res.json({ success: true, bills: parsedData });
  } catch (error: any) {
    console.error("Parse SMS Error:", error);
    res.status(500).json({ error: error.message || "Fatura çözümlenirken sistem hatası oluştu." });
  }
});

// Image Parsing API endpoint (for screenshot/photo uploads of bills)
app.post("/api/parse-bill-image", async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body;
    if (!imageBase64 || !mimeType) {
      res.status(400).json({ error: "Lütfen analiz edilecek fatura görselini yükleyin." });
      return;
    }

    // Clean up base64 prefix if present
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    const currentYear = new Date().getFullYear();
    const systemPrompt = `Gosterilen fatura gorseli veya ekran goruntusunu analiz eden ve içindeki fatura detaylarını çıkaran bir asistansın.
Bugünün tarihi: ${new Date().toISOString().split('T')[0]}. Yıl belirtilmeyen son ödeme tarihlerini varsayılan olarak cari yıl (${currentYear}) ile ilişkilendir.

ÖZEL KURALLAR:
1. GÖRSEL ANALİZ: Ekran görüntüsündeki tüm metinleri ve sayıları dikkatlice oku. Özellikle en üst veya en alt kısımlardaki telefon numarası, abone no vb. bilgileri 'daire' veya 'daire/blok no dairesel' ya da 'aciklama' olarak ata.
2. TARİH AYIKLAMA: Son Ödeme Tarihi, Fatura Kesim Tarihi gibi bilgileri bul. Son Ödeme Tarihini 'sonOdemeTarihi' alanına YYYY-MM-DD olarak ata (Örn: '05 Haziran 2026' -> '2026-06-05' veya '05.06.2026' -> '2026-06-05').
2a. AİDAT SON GÜNE BIRAKMAMAK SÖZCÜĞÜ KURALI: Eğer görselde veya faturada 'son güne bırakmamak', 'son güne bırakmamak kaydıyla' gibi bir ifade geçiyorsa ve ödemenin belirli bir ay içerisinde yapılması belirtilmişse (örneğin "Haziran ayı içerisinde" denmişse), son ödeme tarihini o ayın son gününün bir gün öncesi olacak şekilde ata (Örn: "Haziran ayı içerisinde son güne bırakmamak..." için Haziran ayının son günü 30 Haziran'dır, 1 gün öncesi ise 29 Haziran'dır yani son ödeme tarihini '2026-06-29' olarak belirle).
3. TURKCELL / CEP TELEFONU / MOBİL FATURASI: Görselde 'İLETİŞİM ÜCRETLERİNİZ', 'PAYCELL İŞLEMLERİNİZ' gibi kalemler varsa ya da Turkcell logosu/faturası ise faturaTipi'ni 'Mobil Fatura' veya 'Telefon Faturası' olarak belirle. Kurum'u 'Turkcell' olarak ata. Faturadaki toplam net ödenecek tutarı (Örn: TOPLAM: 860 TL) faturaTutari olarak belirle.
4. SAYISAL TUTARLAR: Sayıların noktalama işaretlerini kurallara göre float sayıya dönüştür (Örn: '860 TL' -> 860.00, '586,00' -> 586.00).
5. GERÇEK ÖDENECEK TUTAR: Görselde birden fazla tutar varsa, her zaman cebinizden çıkacak net toplam veya ödenecek nihai faturayı ('TOPLAM', 'Ödenecek Tutar') faturaTutari olarak çek.
6. TELEFON NUMARASI VE KİŞİ EŞLEŞTİRME KURALLARI (TURKCELL / MOBİL): Görselde sağ üstte, sol üstte veya herhangi bir yerinde cep telefonu numarası (Örn: '533 432 07 74' veya '5334320774', '544 224 19 21', '538 487 07 74') yer alıyorsa:
   - Eğer telefon numarası '533 432 07 74' veya '5334320774' ise, 'kisi' değerini kesinlikle ve sadece 'Necati Sercan Çağan' olarak ata.
   - Eğer telefon numarası '544 224 19 21' veya '5442241921' ise, 'kisi' değerini kesinlikle ve sadece 'Deniz Çağan' olarak ata.
   - Eğer telefon numarası '538 487 07 74' veya '5384870774' ise, 'kisi' değerini kesinlikle ve sadece 'İpek Çağan' olarak ata.
   Eşleşen telefon numarasını sadeleştirerek (Örn: '533 432 07 74') 'daire' alanına ata.`;

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const textPart = {
      text: "Bu fatura görselindeki veya ekran görüntüsündeki faturayı çıkar ve JSON dizisi olarak dönüştür.",
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          description: "Çıkarılan faturaların listesi",
          items: {
            type: Type.OBJECT,
            properties: {
              faturaTipi: {
                type: Type.STRING,
                description: "Faturanın türü (Örn: Mobil Fatura, Aidat, Doğalgaz, Elektrik vb.)",
              },
              faturaTutari: {
                type: Type.NUMBER,
                description: "Fatura tutarı TL bazında sayısal değer (Örn: 860.00)",
              },
              sonOdemeTarihi: {
                type: Type.STRING,
                description: "Son ödeme tarihi YYYY-MM-DD formatında (Örn: 2026-06-05)",
              },
              donem: {
                type: Type.STRING,
                description: "Ödeme dönemi veya ait olduğu ay (Örn: Mayıs 2026)",
              },
              kisi: {
                type: Type.STRING,
                description: "Faturada adı geçen kişi ismi",
              },
              daire: {
                type: Type.STRING,
                description: "Daire, telefon numarası veya tesisat no bilgisi (Örn: 5334320774, B2BLOK Daire 38 vb.)",
              },
              kurum: {
                type: Type.STRING,
                description: "Faturayı kesen kurum veya kuruluş (Örn: Turkcell, Niğde Emlak vb.)",
              },
              aciklama: {
                type: Type.STRING,
                description: "Faturaya dair kısa/özet açıklama metni",
              },
            },
            required: ["faturaTipi", "faturaTutari", "sonOdemeTarihi", "donem"],
          },
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      res.status(500).json({ error: "Yapay zeka görseli çözümleyemedi." });
      return;
    }

    const parsedData = JSON.parse(resultText);
    res.json({ success: true, bills: parsedData });
  } catch (error: any) {
    console.error("Parse Bill Image Error:", error);
    res.status(500).json({ error: error.message || "Fatura görseli çözümlenirken sistem hatası oluştu." });
  }
});

// Setup dev vs production environments
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

start();
