// qualityGateGuide.ts — TorqPro AI Module Guide
// Module: Veri Kalite Kapısı | Veri Doğruluğu ve Kalite Kontrol

import type { ModuleGuide } from './GuideSchema';

export const qualitygateGuide: ModuleGuide = {
  id: 'qualitygate',
  title: 'Veri Kalite Kapısı',
  subtitle: 'Veri Doğruluğu ve Kalite Kontrol',
  version: '1.0.0',

  description: {
    heading: 'Veri Kalite Kapısı Modülü Nedir?',
    paragraphs: [
      'Veri Kalite Kapısı modülü, sisteme yüklenen veri setlerinin önceden tanımlanmış kalite kurallarına göre otomatik olarak doğrulandığı bir kural motoru ve denetim arabirimidir. Eksik değerler, aralık dışı girdiler, format hataları, tutarsız birim kullanımı ve referans bütünlüğü ihlalleri gibi sorunlar otomatik olarak tespit edilir.',
      'Her veri seti yüklendikten sonra sistem Veri Kalite Kapısı kurallarını çalıştırır ve her kural için geçti/kaldı sonucunu raporlar. Kritik hataların bulunduğu veri setleri onay sürecine alınmaz; uyarı seviyesindeki sorunlar ise insan incelemesiyle değerlendirilebilir.',
      'Kalite kuralları, mühendislik alanı uzmanları ile sistem yöneticisinin iş birliğiyle tanımlanır ve Veri Yükleme & Onay modülü üzerinden yapılandırılır. Kural seti zaman içinde yeni kalite gereksinimleri eklenerek genişletilebilir.',
    ],
    note: 'Kalite kapısından geçemeyen veri setlerini düzeltmeden hesaplama modüllerinde kullanmaya çalışmayın. Hatalı veri, hesaplama sonuçlarının güvenilirliğini doğrudan etkiler.',
  },

  workflow: [
    {
      step: 1,
      title: 'Veri Seti Yükleme',
      description: 'Doğrulanacak veri setini Veri Yükleme & Onay modülü aracılığıyla sisteme yükleyin. Yükleme tamamlandığında kalite kapısı otomatik olarak başlar.',
    },
    {
      step: 2,
      title: 'Otomatik Doğrulama Sonuçlarını İnceleme',
      description: 'Sistem her kalite kuralının sonucunu (geçti/uyarı/kaldı) listeler. Sorunlu alanlar vurgulanır ve hata mesajları gösterilir.',
    },
    {
      step: 3,
      title: 'Hata Düzeltme',
      description: 'Kritik hataları kaynak veride düzeltin ve veri setini yeniden yükleyin. Uyarı seviyesindeki sorunlar için gerekçe yazılarak geçiş onaylanabilir.',
    },
    {
      step: 4,
      title: 'Kalite Kapısı Onayı',
      description: 'Tüm kritik kurallar geçildikten sonra veri seti onay sürecine (Veri Yükleme & Onay) iletilir. Kalite kapısı sonuçları kayıt altına alınır.',
    },
  ],

  parameters: [],
  example: null,

  resultGuidance: {
    heading: 'Kalite Kapısı Sonuçlarının Yorumlanması',
    items: [
      {
        label: 'Kural Sonuç Durumları',
        description: 'Her kalite kuralı üç olası sonuç verir.',
        thresholds: [
          { color: 'green', label: 'Geçti', meaning: 'Veri bu kural için tüm gereksinimleri karşılıyor' },
          { color: 'yellow', label: 'Uyarı', meaning: 'Potansiyel sorun var, insan incelemesi önerilir' },
          { color: 'red', label: 'Kaldı', meaning: 'Kritik hata, veri seti düzeltilmeden ilerleyemez' },
        ],
      },
      {
        label: 'Genel Kalite Skoru',
        description: 'Tüm kuralların ağırlıklı ortalamasından hesaplanan genel skor, veri setinin bütünsel kalite durumunu gösterir. Düşük skor, çok sayıda uyarı veya başarısız kural olduğunu işaret eder.',
      },
    ],
  },

  faq: [
    {
      question: 'Kalite kuralları kimler tarafından tanımlanır?',
      answer: 'Kurallar mühendislik ekibi ve sistem yöneticisinin iş birliğiyle tasarlanır, yönetici tarafından sisteme girilir. Kural mantığı organizasyonun veri kalite standartlarını yansıtır.',
    },
    {
      question: 'Uyarı seviyesindeki bir sorun görmezden gelinebilir mi?',
      answer: 'Uyarılar, sorumlu kullanıcı gerekçe girerek geçebilir. Bu geçiş kararı kayıt altına alınır ve denetim izinde görünür.',
    },
    {
      question: 'Kalite kapısı geçmişine erişilebilir mi?',
      answer: 'Evet, her veri seti için geçmiş kalite kapısı çalıştırmaları ve sonuçları Arşiv modülünde saklanır.',
    },
  ],

  academyLinks: [
    {
      title: 'Mühendislik Verisinde Kalite Yönetimi',
      description: 'Veri kalite kurallarının tanımlanması, otomatik doğrulama süreçleri ve yaygın veri hatalarının önlenmesi.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
