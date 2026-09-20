// ── oemPredictionGuide.ts ────────────────────────────────────────────────────
// Module guide for OEM Tork Öngörüsü.
// Route: /app/calculation/oem-prediction → legacyPageId "n01391"
// Implementation: Legacy iframe — LegacyIframePage with moduleId="oem-prediction"
//
// supportsExampleLoad: false — legacy iframe; no safe form-population path.
// supportsDemoMode: false   — iframe content not directly controllable.
// ─────────────────────────────────────────────────────────────────────────────

import type { ModuleGuide } from './GuideSchema'

export const oemPredictionGuide: ModuleGuide = {
  id: 'oem-prediction',
  title: 'OEM Tork Öngörüsü',
  subtitle: 'Üretici Verilerine Dayalı Sıkıştırma Tork Tahmini',
  version: '1.0.0',

  // ── 1. Bu Modül Nedir? ────────────────────────────────────────────────────
  description: {
    heading: 'OEM Tork Öngörüsü Nedir?',
    paragraphs: [
      'OEM Tork Öngörüsü modülü, üretici (OEM) spesifikasyonlarına ve bağlantı parametrelerine göre sıkıştırma tork değerini tahmin etmenizi sağlar. Standart tork hesabı yerine, belirli bir üretici bağlamına göre öngörü üretmek için tasarlanmıştır.',
      'Modül, legacy uygulama altyapısı üzerinde çalışmaktadır. Girdi alanları ve hesaplama mantığı bu altyapı tarafından yönetilmektedir.',
    ],
    note: 'Bu modül legacy iframe altyapısıyla sunulmaktadır. İçerik ve form davranışı legacy uygulama tarafından kontrol edilir.',
  },

  // ── 2. Çalışma Akışı ─────────────────────────────────────────────────────
  workflow: [
    {
      step: 1,
      title: 'Bağlantı Parametrelerini Girin',
      description: 'Cıvata çapı, diş adımı, malzeme ve hedef ön yük gibi temel bağlantı bilgilerini ilgili alanlara girin.',
    },
    {
      step: 2,
      title: 'OEM Bağlamını Belirtin',
      description: 'Üretici spesifikasyonuna veya bağlantı uygulamasına özgü ek bilgileri girin. Bu bilgiler öngörü modelinin doğruluğunu etkiler.',
    },
    {
      step: 3,
      title: 'Öngörüyü Çalıştırın',
      description: 'Hesapla veya Öngör düğmesine basın. Sistem mevcut girdi değerlerine göre öngörülen tork aralığını hesaplar.',
    },
    {
      step: 4,
      title: 'Sonuçları Değerlendirin',
      description: 'Öngörülen tork değerini ve varsa güven aralığı bilgisini inceleyin. Sonuçları kendi OEM gereksinimlerinizle karşılaştırın.',
    },
  ],

  // ── 3. Parametreler ───────────────────────────────────────────────────────
  parameters: [
    {
      label: 'Cıvata Çapı',
      symbol: 'd',
      unit: 'mm',
      explanation: 'Nominal cıvata çapı. Tork öngörüsünün temel geometrik girdisidir.',
    },
    {
      label: 'Diş Adımı',
      symbol: 'P',
      unit: 'mm',
      explanation: 'Metrik diş adımı. Cıvata sınıfıyla birlikte sıkma mekanizması verimliliğini belirler.',
    },
    {
      label: 'Malzeme / Mukavemet Sınıfı',
      symbol: '—',
      unit: '',
      explanation: 'Cıvata mukavemet sınıfı (örn. 8.8, 10.9, 12.9) veya malzeme tanımı. Akma dayanımı ve ön yük kapasitesi bu bilgiden türetilir.',
    },
    {
      label: 'Sürtünme Katsayısı',
      symbol: 'μ',
      unit: '',
      explanation: 'Diş ve yatak yüzeyleri için sürtünme katsayısı. OEM uygulamalarında genellikle yüzey kaplama ve yağlama durumuna bağlıdır.',
    },
    {
      label: 'Hedef Ön Yük',
      symbol: 'F_v',
      unit: 'kN',
      explanation: 'İstenilen sıkıştırma kuvveti. OEM spesifikasyonunda belirtilen minimum veya nominal ön yük değeri.',
    },
  ],

  // ── 4. Örnek Uygulama ─────────────────────────────────────────────────────
  // Legacy iframe — form-population not supported
  example: null,

  // ── 5. Sonuçları Nasıl Okurum? ────────────────────────────────────────────
  resultGuidance: {
    heading: 'Sonuçları Nasıl Yorumlamalısınız?',
    items: [
      {
        label: 'Öngörülen Sıkıştırma Torku',
        description:
          'Mevcut girdi parametrelerine göre hesaplanan hedef sıkıştırma torku. Bu değer, OEM spesifikasyonlarının ön yükü güvenli biçimde sağlaması için gereken tork aralığını yansıtır.',
        thresholds: [
          { color: 'green', label: 'OEM Aralığı İçinde', meaning: 'Hesaplanan tork değeri üretici toleransı içindedir.' },
          { color: 'yellow', label: 'Sınır Durumu', meaning: 'Değer tolerans sınırına yakındır — girdileri doğrulayın.' },
          { color: 'red', label: 'Aralık Dışı', meaning: 'Öngörülen tork OEM sınırları dışında — parametreleri gözden geçirin.' },
        ],
      },
      {
        label: 'Öngörü Niteliği',
        description:
          'Sonuç bir mühendislik tahminidir; kesin bir standart değer değildir. OEM spesifikasyon dokümanlarıyla karşılaştırılarak doğrulanmalıdır.',
      },
    ],
  },

  // ── 6. SSS ────────────────────────────────────────────────────────────────
  faq: [
    {
      question: 'OEM Tork Öngörüsü ile standart Tork Hesabı arasındaki fark nedir?',
      answer: 'Standart Tork Hesabı, VDI 2230 ve DIN 946 formüllerine dayalı deterministik sonuçlar üretir. OEM Tork Öngörüsü ise belirli bir üretici bağlamını esas alarak tahmini bir tork aralığı sunar — bu nedenle sonuç danışma niteliğindedir.',
    },
    {
      question: 'Sonucu doğrudan üretim torkmetresinde kullanabilir miyim?',
      answer: 'Öngörü, başlangıç noktası olarak kullanılabilir; ancak OEM prosedürleriniz ve kalibrasyonlu ölçüm ekipmanınızla doğrulanmadan üretim parametresi olarak uygulanmamalıdır.',
    },
    {
      question: 'Sürtünme katsayısını bilmiyorsam ne girmeliyim?',
      answer: 'Kuru çelik yüzey için μ ≈ 0,12–0,14, yağlı yüzey için μ ≈ 0,10–0,12 aralığı referans alınabilir. Kesin değer için OEM spesifikasyonuna veya yüzey kaplama üreticisinin verilerine başvurun.',
    },
    {
      question: 'Bu modül AI kullanıyor mu?',
      answer: 'Mevcut uygulama, girdilere dayalı formül tabanlı öngörü üretmektedir. AI danışma desteği varsa çıktı açıkça etiketlenir.',
    },
  ],

  // ── 7. Academy ────────────────────────────────────────────────────────────
  academyLinks: [
    {
      title: 'OEM Tork Spesifikasyonları Nasıl Okunur?',
      description: 'Üretici servis kılavuzlarından tork değerlerini doğru şekilde yorumlama rehberi.',
      available: false,
    },
    {
      title: 'Sürtünme Katsayısı Seçimi',
      description: 'Farklı yüzey kaplamalar ve yağlama koşulları için μ değeri seçme kılavuzu.',
      available: false,
    },
  ],

  // ── 8. Demo adımları ──────────────────────────────────────────────────────
  // supportsDemoMode: false — legacy iframe content not directly controllable
  demoSteps: [],

  // ── Flags ─────────────────────────────────────────────────────────────────
  supportsExampleLoad: false,
  supportsDemoMode: false,
}
