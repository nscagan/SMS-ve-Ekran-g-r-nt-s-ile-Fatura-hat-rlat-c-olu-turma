export interface Bill {
  id: string;
  faturaTipi: string;
  faturaTutari: number;
  sonOdemeTarihi: string; // YYYY-MM-DD
  donem: string;
  kisi?: string;
  daire?: string;
  kurum?: string;
  aciklama?: string;
  savedToCalendar?: boolean;
  calendarEventId?: string;
  calendarEventLink?: string;
  createdAt: string;
  isPaid?: boolean;
}
