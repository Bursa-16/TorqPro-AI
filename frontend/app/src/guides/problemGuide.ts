// problemGuide.ts — TorqPro AI Module Guide
// Module: Problem Yönetimi | Üretim Sorunu Kayıt ve Takip Sistemi

import type { ModuleGuide } from './GuideSchema';

export const problemGuide: ModuleGuide = {
  id: 'problem',
  title: 'Problem Yönetimi',
  subtitle: 'Üretim Sorunu Kayıt ve Takip Sistemi',
  version: '1.0.0',

  description: {
    heading: 'Problem Yönetimi Modülü Nedir?',
    paragraphs: [
      'Problem Yönetimi modülü, üretim süreçlerinde karşılaşılan bağlantı ve sıkma kaynaklı sorunların kaydedildiği, kök neden analizinin yapıldığı ve düzeltici/önleyici aksiyonların takip edildiği merkezi bir sistemdir. Her sorun kaydı; bulgu tarihi, etkilenen ürün veya istasyon, sorun tanımı ve öncelik seviyesi gibi temel bilgileri içerir.',
      'Modül, 8D, 5 Neden ve balık kılçığı gibi yaygın kök neden analizi yöntemlerini destekleyen yapılandırılmış alanlar sunar. Düzeltici aksiyon planları, sorumlu kişi atamaları ve hedef kapatma tarihleriyle birlikte sisteme girilir ve takip edilir.',
      'Problem kayıtları diğer modüllerle ilişkilendirilebilir: Check-List modülünden açılan başarısız maddeler, FMEA kataloğundaki ilgili arıza modları veya sıkma aleti sorunları Sıkıcı Takip modülüne bağlanabilir. Bu entegrasyon, sorunun tüm boyutlarıyla izlenmesini sağlar.',
    ],
    note: 'Sorunları mümkün olduğunca erken kaydedin. İlk gözlem notları ve kanıtlar (fotoğraf, ölçüm verisi) kayıt kalitesini önemli ölçüde artırır ve kök neden analizini hızlandırır.',
  },

  workflow: [
    {
      step: 1,
      title: 'Yeni Sorun Kaydı Açma',
      description: 'Sorun bulgu tarihini, etkilenen istasyonu veya ürünü, sorun tanımını ve öncelik seviyesini (kritik, yüksek, orta, düşük) girin.',
    },
    {
      step: 2,
      title: 'Kök Neden Analizi',
      description: 'Seçilen analiz yöntemi (5 Neden, 8D vb.) için ilgili alanları doldurun. Kök nedeni ve katkıda bulunan faktörleri kaydedin.',
    },
    {
      step: 3,
      title: 'Düzeltici Aksiyon Planı',
      description: 'Her kök neden için düzeltici aksiyonu, sorumlu kişiyi ve hedef tamamlanma tarihini girin. Aksiyonlar takip listesine eklenir.',
    },
    {
      step: 4,
      title: 'İlerleme Takibi',
      description: 'Düzeltici aksiyonların tamamlanma durumunu güncelleyin. Sistem, gecikmeli aksiyonlar için uyarı oluşturur.',
    },
    {
      step: 5,
      title: 'Kaydı Kapatma',
      description: 'Tüm aksiyonlar tamamlandıktan ve etkinliği doğrulandıktan sonra kaydı kapatın. Kapanış notu ve doğrulama kanıtını ekleyin.',
    },
  ],

  parameters: [],
  example: null,
  resultGuidance: null,

  faq: [
    {
      question: 'Bir problem kaydı başka bir modüldeki bulgudan otomatik açılabilir mi?',
      answer: 'Evet, Check-List modülünde başarısız işaretlenen maddeler ve kalibrasyon modülündeki uygunsuzluklar Problem Yönetimi modülünde otomatik kayıt oluşturabilir. Bu entegrasyon sistem yapılandırmasına bağlıdır.',
    },
    {
      question: 'Problem kayıtları raporlanabilir mi?',
      answer: 'Evet, açık ve kapalı kayıtların özeti, aksiyon tamamlanma oranları ve kök neden kategorileri Rapor Üret modülü aracılığıyla dışa aktarılabilir.',
    },
    {
      question: 'Benzer sorunlarda geçmiş kayıtlara nasıl başvurulur?',
      answer: 'Arşiv modülü ve Problem Yönetimi içindeki arama filtreleri kullanılarak sorun türü, etkilenen istasyon veya tarih aralığına göre geçmiş kayıtlara erişilebilir.',
    },
  ],

  academyLinks: [
    {
      title: 'Üretimde Problem Çözme Yöntemleri: 8D ve 5 Neden',
      description: 'Bağlantı sorunlarında yapılandırılmış problem çözme süreçleri ve kök neden analizi teknikleri.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
