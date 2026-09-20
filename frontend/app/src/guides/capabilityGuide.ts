// capabilityGuide.ts — TorqPro AI Module Guide
// Module: Cm/Cmk Yetenek Analizi | İstatistiksel Süreç Yetenek Değerlendirmesi

import type { ModuleGuide } from './GuideSchema';

export const yetenekGuide: ModuleGuide = {
  id: 'yetenek',
  title: 'Cm/Cmk Yetenek Analizi',
  subtitle: 'İstatistiksel Süreç Yetenek Değerlendirmesi',
  version: '1.0.0',

  description: {
    heading: 'Cm/Cmk Yetenek Analizi Nedir?',
    paragraphs: [
      'Yetenek Analizi modülü, sıkma süreçlerinin istatistiksel performansını değerlendirmek için Cm (makine yeteneği) ve Cmk (ortalama kaymasını dikkate alan makine yeteneği) indekslerini hesaplar. Bu indeksler, bir sıkma aletinin belirli tolerans sınırları içinde tutarlı sonuçlar üretip üretemeyeceğini gösterir.',
      'Cm indeksi, süreç dağılımının genişliğini tolerans bandıyla karşılaştırarak aletin teorik yeteneğini ölçer. Cmk ise sürecin ortalama değerinin tolerans merkezine olan uzaklığını da hesaba katarak gerçek performansı yansıtır. İki indeks arasındaki fark, olası bir alet ayar sapmasına işaret edebilir.',
      'Modül, kullanıcının girdiği ölçüm verileri veya sisteme bağlı veri kaynaklarından beslenerek analizi otomatik olarak yürütür. Sonuçlar grafik ve sayısal özet olarak sunulur; yetersiz yetenek durumunda öneriler sistem tarafından oluşturulur.',
    ],
    note: 'Anlamlı bir Cm/Cmk sonucu için en az 30 ölçüm verisi kullanılması önerilir. Daha az veri, indekslerin güvenilirliğini düşürür.',
  },

  workflow: [
    {
      step: 1,
      title: 'Tolerans Sınırlarının Tanımlanması',
      description: 'Analiz edilecek sıkma parametresi için üst tolerans sınırı (USL) ve alt tolerans sınırı (LSL) değerlerini girin.',
    },
    {
      step: 2,
      title: 'Ölçüm Verisi Girişi',
      description: 'Sıkma aleti ölçüm verilerini manuel olarak girin veya bağlı veri kaynağından içe aktarın.',
    },
    {
      step: 3,
      title: 'Analiz Çalıştırma',
      description: 'Veri girişi tamamlandıktan sonra analizi başlatın. Sistem Cm ve Cmk değerlerini hesaplar, dağılım grafiği ve kontrol limitlerini görselleştirir.',
    },
    {
      step: 4,
      title: 'Sonuçları Yorumlama',
      description: 'Hesaplanan indeksleri referans eşik değerleriyle karşılaştırın. Yetersiz yetenek durumunda sistem düzeltici aksiyon önerisi sunar.',
    },
    {
      step: 5,
      title: 'Rapor Oluşturma',
      description: 'Analiz sonuçlarını Rapor Üret modülü aracılığıyla PDF veya Excel formatında dışa aktarın.',
    },
  ],

  parameters: [],
  example: null,

  resultGuidance: {
    heading: 'Cm / Cmk Sonuçlarının Yorumlanması',
    items: [
      {
        label: 'Cm / Cmk ≥ 1.67',
        description: 'Süreç yüksek yeteneğe sahiptir. Tolerans sınırları içinde çok güvenli çalışma aralığı mevcuttur.',
        thresholds: [
          { color: 'green', label: '≥ 1.67', meaning: 'Mükemmel yetenek' },
          { color: 'yellow', label: '1.33 – 1.67', meaning: 'Yeterli yetenek' },
          { color: 'orange', label: '1.00 – 1.33', meaning: 'Kabul edilebilir, iyileştirme önerilir' },
          { color: 'red', label: '< 1.00', meaning: 'Yetersiz yetenek, acil müdahale gerekli' },
        ],
      },
      {
        label: 'Cm ile Cmk Arasındaki Fark',
        description: 'Cm ve Cmk arasında büyük bir fark varsa süreç ortalaması tolerans merkezinden kaymıştır. Alet ayarı veya kurulum kontrolü yapılmalıdır.',
      },
    ],
  },

  faq: [
    {
      question: 'Cm ve Cmk arasındaki temel fark nedir?',
      answer: 'Cm yalnızca süreç dağılımının genişliğini değerlendirirken, Cmk dağılımın tolerans merkezine olan uzaklığını da dikkate alır. Cm yüksek ama Cmk düşükse aletin potansiyeli yeterli fakat ayarı merkezi dışına kaymıştır.',
    },
    {
      question: 'Hangi minimum veri sayısı gereklidir?',
      answer: 'İstatistiksel güvenilirlik için en az 30 ölçüm önerilir. Otomotiv sektöründe yaygın olan AIAG kılavuzlarına göre 50 veya daha fazla ölçüm ile daha sağlıklı sonuç elde edilir.',
    },
    {
      question: 'Analiz sonuçları arşive kaydedilir mi?',
      answer: 'Evet. Her analiz oturumu Arşiv modülüne otomatik olarak kaydedilir ve ilerleyen dönemlerde karşılaştırma amacıyla erişilebilir.',
    },
  ],

  academyLinks: [
    {
      title: 'Süreç Yeteneği: Cm ve Cmk Kavramları',
      description: 'Makine yeteneği indekslerinin teorik temeli, hesaplama yöntemleri ve endüstriyel yorumlama rehberi.',
      available: false,
    },
    {
      title: 'Sıkma Süreçlerinde İstatistiksel Kalite Kontrol',
      description: 'Tork ve açı kontrolünde istatistiksel yöntemlerin uygulanması hakkında ileri düzey içerik.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
