// normGuideGuide.ts — TorqPro AI Module Guide
// Module: Norm Rehberi | Bağlantı Standardları ve Norm Kılavuzu

import type { ModuleGuide } from './GuideSchema';

export const normGuide: ModuleGuide = {
  id: 'norm',
  title: 'Norm Rehberi',
  subtitle: 'Bağlantı Standardları ve Norm Kılavuzu',
  version: '1.0.0',

  description: {
    heading: 'Norm Rehberi Modülü Nedir?',
    paragraphs: [
      'Norm Rehberi modülü, bağlantı elemanlarına ilişkin uluslararası ve endüstriyel standartların (DIN, ISO, VDI, EN vb.) referans kılavuzuna erişim sağlayan bir bilgi tabanıdır. Cıvata, somun, rondela ve diğer bağlantı elemanlarına ait standart numaraları, boyut serileri, malzeme sınıfları ve uygulama alanları bu modül üzerinden sorgulanabilir.',
      'Kullanıcılar standart adı, numara veya bağlantı elemanı türüne göre arama yapabilir. Her standart girişi; kapsam, ilgili boyut tabloları, malzeme gereksinimleri ve uygulama notları gibi özet bilgiler içerir. Bu sayede mühendisler tasarım veya üretim aşamasında doğru standardı hızla bulabilir.',
      'Modül, statik bir referans kaynağı olarak işlev görür. İçerik güncellemeleri sistem yöneticisi tarafından yönetilir. Sık başvurulan standartlar favori listesine eklenebilir ve kolayca tekrar erişilebilir.',
    ],
    note: 'Norm Rehberi yalnızca referans bilgi sunar; hesaplama sonuçları üretmez. Buradaki standart değerleri uygulamaya koymadan önce proje bağlamında yetkili mühendis tarafından doğrulanmalıdır.',
  },

  workflow: [
    {
      step: 1,
      title: 'Standart Arama',
      description: 'Arama kutusuna standart numarası (ör. ISO 4762), konu (ör. altı köşe başlı cıvata) veya anahtar kelime girin.',
    },
    {
      step: 2,
      title: 'Sonuçları Filtreleme',
      description: 'Standart kuruluşu (DIN, ISO, VDI vb.), bağlantı türü veya geçerlilik durumuna göre sonuçları daraltın.',
    },
    {
      step: 3,
      title: 'Standart Detayını İnceleme',
      description: 'Seçilen standardın kapsam özetini, boyut tablolarını, malzeme sınıflandırmalarını ve uygulama notlarını okuyun.',
    },
    {
      step: 4,
      title: 'Favori veya Referans Ekleme',
      description: 'Sık kullanılan standartları favorilere ekleyin veya hesaplama modülünde referans olarak işaretleyin.',
    },
  ],

  parameters: [],
  example: null,
  resultGuidance: null,

  faq: [
    {
      question: 'Kılavuzda hangi standart kuruluşları kapsanmaktadır?',
      answer: 'Mevcut içerik DIN, ISO, VDI ve EN standartlarını kapsamaktadır. Organizasyona özgü iç standartlar da sistem yöneticisi tarafından eklenebilir.',
    },
    {
      question: 'Standardın tam metni bu modül üzerinden görülebilir mi?',
      answer: 'Hayır. Modül özet ve referans bilgi sunar; standart kuruluşlarına ait tam metinler telif hakkı kapsamındadır ve ilgili kuruluştan ayrıca temin edilmelidir.',
    },
    {
      question: 'Güncellenen veya iptal edilen standartlar sisteme nasıl yansır?',
      answer: 'Standart durumu (geçerli, revize, iptal) her girişte belirtilir. Güncellemeler Veri Yükleme & Onay modülü aracılığıyla yönetici tarafından sisteme aktarılır.',
    },
  ],

  academyLinks: [
    {
      title: 'Bağlantı Elemanı Standartlarına Giriş',
      description: 'DIN, ISO ve VDI standartlarının bağlantı mühendisliğinde nasıl kullanıldığına dair kapsamlı bir giriş rehberi.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
