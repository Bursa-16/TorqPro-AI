// checklistGuide.ts — TorqPro AI Module Guide
// Module: Check-List | Bağlantı Doğrulama Kontrol Listesi

import type { ModuleGuide } from './GuideSchema';

export const checklistGuide: ModuleGuide = {
  id: 'checklist',
  title: 'Check-List',
  subtitle: 'Bağlantı Doğrulama Kontrol Listesi',
  version: '1.0.0',

  description: {
    heading: 'Bağlantı Doğrulama Kontrol Listesi Nedir?',
    paragraphs: [
      'Check-List modülü, cıvata ve bağlantı elemanı montaj süreçlerinin önceden tanımlanmış kriterlere göre doğrulanmasını sağlayan yapılandırılmış bir kontrol sistemidir. Her montaj noktası için gerekli adımlar liste halinde sunulur; kullanıcı her maddeyi geçti (pass) ya da kaldı (fail) olarak işaretler.',
      'Bu modül, üretim hattında veya mühendislik doğrulama süreçlerinde standart operasyon prosedürlerinin (SOP) eksiksiz uygulanmasını güvence altına almak amacıyla kullanılır. Kontrol listelerinde tork değeri doğrulaması, görsel muayene, bağlantı sırası ve moment anahtarı seçimi gibi kriterler yer alabilir.',
      'Tamamlanan kontrol listeleri kayıt altına alınır ve izlenebilirlik için arşive aktarılabilir. Kısmen tamamlanmış veya başarısız madde içeren listeler için uyarı mekanizmaları devreye girer ve operatörün düzeltici aksiyon alması beklenir.',
    ],
    note: 'Her kontrol listesi oturumu kayıt altına alınır. Başarısız madde bulunan listeleri kapatmadan önce ilgili düzeltici aksiyonları not edin.',
  },

  workflow: [
    {
      step: 1,
      title: 'Kontrol Listesi Seçimi',
      description: 'Uygulanacak bağlantı türüne veya üretim operasyonuna karşılık gelen kontrol listesi şablonunu seçin.',
    },
    {
      step: 2,
      title: 'Madde Madde Doğrulama',
      description: 'Her kontrol maddesini sırayla inceleyin. Kritere uygunsa "Geçti", uygun değilse "Kaldı" olarak işaretleyin.',
    },
    {
      step: 3,
      title: 'Başarısız Madde Yönetimi',
      description: 'Kalan maddeler için açıklama alanına gözlemi girin ve gerekiyorsa Problem Yönetimi modülüne bağlantı oluşturun.',
    },
    {
      step: 4,
      title: 'Onay ve Kayıt',
      description: 'Tüm maddeler tamamlandıktan sonra listeyi onaylayın. Sistem, tarih-saat damgası ve kullanıcı bilgisiyle birlikte kaydı arşive alır.',
    },
  ],

  parameters: [],
  example: null,

  resultGuidance: null,

  faq: [
    {
      question: 'Bir kontrol listesi yarıda bırakılabilir mi?',
      answer: 'Evet, sistem taslak olarak kaydedebilir. Ancak onaylanmamış listeler izlenebilirlik kapsamında tamamlanmış sayılmaz ve uyarı durumunda kalır.',
    },
    {
      question: 'Kontrol listesi şablonları nasıl oluşturulur veya güncellenir?',
      answer: 'Şablonlar sistem yöneticisi tarafından Veri Yükleme & Onay modülü aracılığıyla tanımlanır. Operatörler mevcut şablonları kullanabilir ancak içeriklerini doğrudan değiştiremez.',
    },
    {
      question: 'Geçmiş kontrol listesi kayıtlarına nasıl ulaşabilirim?',
      answer: 'Arşiv modülünü kullanarak tarih aralığı, operatör veya bağlantı türüne göre filtreleyerek geçmiş kayıtlara erişebilirsiniz.',
    },
  ],

  academyLinks: [
    {
      title: 'Bağlantı Doğrulama ve SOP Yönetimi',
      description: 'Montaj kontrol listeleri ve standart operasyon prosedürlerinin oluşturulması hakkında kapsamlı kılavuz.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
