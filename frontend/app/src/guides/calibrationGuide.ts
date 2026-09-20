// calibrationGuide.ts — TorqPro AI Module Guide
// Module: Kalibrasyon | Sıkma Aleti Kalibrasyon Yönetimi

import type { ModuleGuide } from './GuideSchema';

export const calibrationGuide: ModuleGuide = {
  id: 'calibration',
  title: 'Kalibrasyon',
  subtitle: 'Sıkma Aleti Kalibrasyon Yönetimi',
  version: '1.0.0',

  description: {
    heading: 'Kalibrasyon Modülü Nedir?',
    paragraphs: [
      'Kalibrasyon modülü, üretimde kullanılan sıkma aletlerinin kalibrasyon kayıtlarını, sertifikalarını ve geçerlilik durumlarını merkezi olarak yöneten bir sistemdir. Her alet için kalibrasyon geçmişi, son kalibrasyon tarihi, bir sonraki kalibrasyon vadesi ve sorumlu laboratuvar bilgileri tutulur.',
      'Modül, kalibrasyon vadeleri yaklaşan veya geçmiş aletler için otomatik uyarılar oluşturur. Kalibrasyon sonuçları (geçti/kaldı), ölçüm belirsizliği değerleri ve sertifika referans numaraları sisteme kaydedilir. Bu sayede üretimde yalnızca geçerli kalibrasyonlu aletlerin kullanılması güvence altına alınır.',
      'Kalibrasyon kayıtları Sıkıcı Takip modülüyle entegre çalışır; bir aletin kalibrasyon durumu güncellendiğinde bu değişiklik alet profilinde de anında yansır. ISO 9001 ve IATF 16949 gibi kalite yönetim sistemlerinin gerektirdiği izlenebilirlik gereksinimleri bu modül aracılığıyla karşılanır.',
    ],
    note: 'Kalibrasyon sertifikalarını sisteme yüklerken sertifika numarası, geçerlilik tarihi ve kalibrasyon yapan laboratuvar bilgilerini eksiksiz girin. Eksik bilgi, uyumluluk denetimlerinde sorun yaratabilir.',
  },

  workflow: [
    {
      step: 1,
      title: 'Kalibre Edilecek Aleti Seçme',
      description: 'Sıkıcı Takip modülünden veya doğrudan Kalibrasyon listesinden ilgili aleti bulun.',
    },
    {
      step: 2,
      title: 'Kalibrasyon Kaydı Oluşturma',
      description: 'Kalibrasyon tarihini, yapan laboratuvarı, sertifika numarasını ve bir sonraki kalibrasyon vadesini girin.',
    },
    {
      step: 3,
      title: 'Sonuç ve Sertifika Yükleme',
      description: 'Kalibrasyon sonucunu (geçti/kaldı) seçin ve sertifika belgesini sisteme yükleyin. Ölçüm belirsizliği değerlerini girin.',
    },
    {
      step: 4,
      title: 'Durum Güncelleme',
      description: 'Kayıt onaylandıktan sonra aletin durumu otomatik olarak güncellenir. Kalibrasyon vadeleri takvimde ve Sıkıcı Takip modülünde yansır.',
    },
  ],

  parameters: [],
  example: null,

  resultGuidance: {
    heading: 'Kalibrasyon Sonuçlarının Yorumlanması',
    items: [
      {
        label: 'Kalibrasyon Durumu',
        description: 'Her aletin mevcut kalibrasyon durumu renk kodlu olarak gösterilir.',
        thresholds: [
          { color: 'green', label: 'Geçerli', meaning: 'Kalibrasyon geçerli, alet kullanıma uygun' },
          { color: 'yellow', label: 'Vade Yaklaşıyor', meaning: 'Kalibrasyon vadesi 30 gün içinde dolacak' },
          { color: 'red', label: 'Süresi Dolmuş', meaning: 'Kalibrasyon süresi dolmuş, alet kullanımdan çıkarılmalı' },
          { color: 'gray', label: 'Kaldı', meaning: 'Son kalibrasyon başarısız, alet bakım/onarım gerektirir' },
        ],
      },
      {
        label: 'Ölçüm Belirsizliği',
        description: 'Alet kalibrasyon sertifikasında belirtilen ölçüm belirsizliği değeri, aletin uygulama toleransıyla karşılaştırılmalıdır. Belirsizlik değeri tolerans bandının önemli bir oranını oluşturuyorsa daha hassas bir alet değerlendirilebilir.',
      },
    ],
  },

  faq: [
    {
      question: 'Kalibrasyon vadesini kim belirler?',
      answer: 'Kalibrasyon periyodu genellikle üretici önerisi, kullanım yoğunluğu ve kalite yönetim sisteminin gereksinimlerine göre yetkili mühendis veya kalite ekibi tarafından belirlenir. Sistem, tanımlanan periyoda göre sonraki vadeyi otomatik hesaplar.',
    },
    {
      question: 'Bir alet kalibrasyonu başarısız olursa üretim durur mu?',
      answer: 'Sistem başarısız kalibrasyonu kayıt altına alır ve Sıkıcı Takip modülünde aletin durumunu "hizmet dışı" olarak günceller. Üretim durdurma kararı organizasyonun süreç kurallarına bağlıdır; sistem bildirim ve durum güncellemesi sağlar.',
    },
    {
      question: 'Dış laboratuvar sertifikaları sisteme nasıl eklenir?',
      answer: 'Kalibrasyon kaydı oluştururken sertifika belgesini (PDF vb.) yükleme alanından sisteme aktarabilirsiniz. Belge, alet kaydına bağlı olarak arşivde saklanır.',
    },
  ],

  academyLinks: [
    {
      title: 'Sıkma Aleti Kalibrasyon Yönetimi',
      description: 'ISO 9001 ve IATF 16949 kapsamında kalibrasyon planlaması, izlenebilirlik ve ölçüm belirsizliği yönetimi.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
