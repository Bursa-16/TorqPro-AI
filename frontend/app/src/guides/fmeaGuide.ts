// fmeaGuide.ts — TorqPro AI Module Guide
// Module: FMEA Kataloğu | Bağlantı Arıza Modu ve Etki Analizi

import type { ModuleGuide } from './GuideSchema';

export const fmeaGuide: ModuleGuide = {
  id: 'fmea',
  title: 'FMEA Kataloğu',
  subtitle: 'Bağlantı Arıza Modu ve Etki Analizi',
  version: '1.0.0',

  description: {
    heading: 'FMEA Kataloğu Modülü Nedir?',
    paragraphs: [
      'FMEA Kataloğu modülü, cıvatalı bağlantı sistemlerine özgü arıza modlarını, bu modların olası etkilerini ve önerilen kontrol önlemlerini içeren yapılandırılmış bir referans veritabanıdır. Katalog, mühendislerin yeni tasarımlar veya üretim süreçleri için FMEA çalışması yaparken başlangıç noktası olarak kullanabilecekleri önceden tanımlanmış senaryolar sunar.',
      'Her FMEA girişi; arıza modunun tanımı, potansiyel nedenleri, etkileri, önerilen tespit ve önleme kontrolleri ile RPN (Risk Priority Number) referans değerlerini içerir. Bu yapı, AIAG-VDA FMEA metodolojisiyle uyumludur. Kullanıcılar katalog içeriğini kendi süreç veya ürünlerine uyarlayabilir.',
      'Katalog içeriği statik bir başlangıç referansı olarak sunulur. Kuruluşa özgü deneyimler ve geçmiş problem kayıtları sistem yöneticisi aracılığıyla kataloğa eklenebilir, böylece zaman içinde kurumsal bilgi birikimi oluşturulur.',
    ],
    note: 'FMEA Kataloğu bir referans kütüphanesidir; nihai FMEA dokümanı mühendislik ekibi tarafından proje bağlamına göre uyarlanarak hazırlanmalıdır. Katalog değerleri otomatik olarak onaylı FMEA sayılmaz.',
  },

  workflow: [
    {
      step: 1,
      title: 'Katalog Arama',
      description: 'Bağlantı türü, arıza modu veya proses adımı gibi anahtar kelimelerle kataloğu arayın.',
    },
    {
      step: 2,
      title: 'İlgili Arıza Modlarını Seçme',
      description: 'Projeniz veya sürecinizle ilgili arıza modlarını listeden seçin ve çalışma sayfanıza ekleyin.',
    },
    {
      step: 3,
      title: 'Senaryo Uyarlama',
      description: 'Seçilen senaryoları projeye özel koşullara göre düzenleyin: önem, olasılık ve tespit derecelendirmelerini güncelleyin.',
    },
    {
      step: 4,
      title: 'Kontrol Önerilerini İnceleme',
      description: 'Her arıza modu için önerilen önleme ve tespit kontrollerini inceleyin; uygulanabilir olanları aksiyon planına ekleyin.',
    },
  ],

  parameters: [],
  example: null,
  resultGuidance: null,

  faq: [
    {
      question: 'Kataloğa kuruluşumuza özgü arıza modları eklenebilir mi?',
      answer: 'Evet, sistem yöneticisi Veri Yükleme & Onay modülü aracılığıyla kuruluşa özgü arıza modlarını ve kontrol önerilerini kataloğa ekleyebilir.',
    },
    {
      question: 'Katalog AIAG-VDA standartlarıyla uyumlu mu?',
      answer: 'Katalog yapısı AIAG-VDA FMEA metodolojisi referans alınarak tasarlanmıştır. Ancak nihai FMEA çalışmasının resmi uygunluk değerlendirmesi mühendislik ekibinin sorumluluğundadır.',
    },
    {
      question: 'FMEA çalışmasını buradan doğrudan oluşturabilir miyim?',
      answer: 'Modül bir başlangıç kataloğu sunmaktadır; tam FMEA dokümanının oluşturulması ve yönetimi ayrı bir süreçtir. Katalog, bu süreci hızlandırmak için referans malzeme sağlar.',
    },
  ],

  academyLinks: [
    {
      title: 'Bağlantı Sistemlerinde FMEA Uygulaması',
      description: 'AIAG-VDA metodolojisi çerçevesinde cıvatalı bağlantı arıza modlarının analizi ve kontrol stratejileri.',
      available: false,
    },
    {
      title: 'RPN Hesaplama ve Risk Önceliklendirme',
      description: 'Risk öncelik sayısının hesaplanması, yorumlanması ve azaltma stratejilerinin planlanması.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
