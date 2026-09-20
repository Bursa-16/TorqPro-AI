// goldenCasesGuide.ts — TorqPro AI Module Guide
// Module: Altın Senaryolar | Doğrulanmış Referans Hesaplama Senaryoları

import type { ModuleGuide } from './GuideSchema';

export const goldencasesGuide: ModuleGuide = {
  id: 'goldencases',
  title: 'Altın Senaryolar',
  subtitle: 'Doğrulanmış Referans Hesaplama Senaryoları',
  version: '1.0.0',

  description: {
    heading: 'Altın Senaryolar Modülü Nedir?',
    paragraphs: [
      'Altın Senaryolar modülü, mühendislik ekibi tarafından doğrulanmış ve onaylanmış referans hesaplama senaryolarını barındıran bir kütüphanedir. Bu senaryolar; belirli bağlantı tipleri, malzeme kombinasyonları veya süreç koşulları için doğru hesaplamanın nasıl yapılması gerektiğini gösterir.',
      'Her altın senaryo; giriş parametreleri, beklenen ara sonuçlar ve nihai çıktıları içerir. Sistem güncellemeleri veya algoritma değişikliklerinin ardından mevcut hesaplama motorunun bu senaryolara göre doğru sonuç verip vermediğini kontrol etmek için regresyon testi aracı olarak kullanılır.',
      'Altın senaryolar aynı zamanda yeni kullanıcıların sistemi öğrenmesi için referans örnekler ve eğitim materyali işlevi görür. Senaryolar yetkili mühendisler tarafından Teknik Doğrulama sürecinden geçirilerek bu kütüphaneye eklenir.',
    ],
    note: 'Altın senaryolar değişmez referanslardır. Mevcut bir senaryoyu güncellemek yerine yeni bir senaryo oluşturun ve gerekirse eskisini arşive alın.',
  },

  workflow: [
    {
      step: 1,
      title: 'Senaryo Arama ve Seçimi',
      description: 'Bağlantı tipi, malzeme sınıfı veya uygulama alanı gibi kriterlerle kütüphanede arama yapın. İlgili altın senaryoyu bulun ve seçin.',
    },
    {
      step: 2,
      title: 'Senaryo Detaylarını İnceleme',
      description: 'Senaryonun giriş parametrelerini, hesaplama adımlarını ve beklenen çıktı değerlerini inceleyin. Onay tarihi ve doğrulayan mühendis bilgisine erişin.',
    },
    {
      step: 3,
      title: 'Regresyon Testi Çalıştırma',
      description: 'Seçilen senaryoyu mevcut hesaplama motoru üzerinde çalıştırın. Sonuçları beklenen değerlerle karşılaştırın; sapmalar varsa rapor alın.',
    },
    {
      step: 4,
      title: 'Referans Olarak Kullanma',
      description: 'Yeni hesaplamalar için altın senaryoyu başlangıç noktası olarak kullanabilir; parametreleri ihtiyaca göre uyarlayabilirsiniz.',
    },
  ],

  parameters: [],
  example: null,
  resultGuidance: null,

  faq: [
    {
      question: 'Bir altın senaryo nasıl kütüphaneye eklenir?',
      answer: 'Senaryo önerisi Teknik Doğrulama modülü üzerinden yetkili mühendise gönderilir. Onay sonrası sistem yöneticisi senaryoyu altın kütüphaneye ekler.',
    },
    {
      question: 'Regresyon testinde bir senaryo başarısız olursa ne yapılır?',
      answer: 'Başarısız senaryo, hesaplama motorunda beklenmedik bir değişiklik veya hata olduğuna işaret eder. Durum Problem Yönetimi modülüne kaydedilmeli ve ilgili mühendis bilgilendirilmelidir.',
    },
    {
      question: 'Altın senaryolar eğitim amaçlı kullanılabilir mi?',
      answer: 'Evet, doğrulanmış senaryolar yeni kullanıcıların sistem mantığını anlaması ve hesaplama süreçlerini öğrenmesi için ideal referanslardır.',
    },
  ],

  academyLinks: [
    {
      title: 'Referans Senaryo Yönetimi ve Regresyon Testi',
      description: 'Mühendislik yazılımlarında altın senaryo kütüphanelerinin oluşturulması ve regresyon testi süreçleri.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
