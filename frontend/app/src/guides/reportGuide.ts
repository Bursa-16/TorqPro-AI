// reportGuide.ts — TorqPro AI Module Guide
// Module: Rapor Üret | Hesaplama ve Analiz Raporu Oluşturma

import type { ModuleGuide } from './GuideSchema';

export const raporGuide: ModuleGuide = {
  id: 'rapor',
  title: 'Rapor Üret',
  subtitle: 'Hesaplama ve Analiz Raporu Oluşturma',
  version: '1.0.0',

  description: {
    heading: 'Rapor Üret Modülü Nedir?',
    paragraphs: [
      'Rapor Üret modülü, TorqPro AI içindeki hesaplama ve analiz sonuçlarını düzenli, paylaşılabilir belgelere dönüştürür. Tork hesapları, yetenek analizleri, doğrulama sonuçları ve problem yönetimi kayıtları gibi çeşitli modüllerin çıktıları PDF veya Excel formatında raporlanabilir.',
      'Raporlar, kuruluşun tanımladığı şablon ve marka kimliği unsurlarını (logo, başlık, onay bölümü) içerecek şekilde yapılandırılabilir. Kullanıcılar hangi bölümlerin rapora dahil edileceğini seçebilir: giriş, kullanılan parametreler, hesaplama adımları, sonuçlar ve öneriler.',
      'Oluşturulan raporlar otomatik olarak arşive kaydedilir ve paylaşım için indirilebilir. Onay bölümü içeren raporlar Teknik Doğrulama modülüyle ilişkilendirilerek dijital imza sürecine dahil edilebilir.',
    ],
    note: 'Rapor oluşturmadan önce tüm hesaplama ve analiz verilerinin tamamlandığını ve güncel olduğunu doğrulayın. Taslak durumdaki veriler rapora dahil edildiğinde bu açıkça belirtilir.',
  },

  workflow: [
    {
      step: 1,
      title: 'Rapor Kaynağı Seçimi',
      description: 'Rapora dahil edilecek hesaplama oturumunu, analizi veya modül çıktısını seçin. Birden fazla kaynak tek rapora eklenebilir.',
    },
    {
      step: 2,
      title: 'Rapor Şablonu ve Bölüm Seçimi',
      description: 'Kullanılacak rapor şablonunu seçin ve hangi bölümlerin (özet, detaylı hesaplamalar, grafikler, sonuçlar) dahil edileceğini belirleyin.',
    },
    {
      step: 3,
      title: 'Rapor Üretimi',
      description: 'Sistem seçilen içeriği şablona göre biçimlendirir ve raporu oluşturur. İşlem süresi içerik hacmine göre değişir.',
    },
    {
      step: 4,
      title: 'İnceleme ve İndirme',
      description: 'Oluşturulan raporu önizleyin, gerekiyorsa bölüm seçimlerini güncelleyerek yeniden oluşturun. Onayladıktan sonra PDF veya Excel olarak indirin.',
    },
  ],

  parameters: [],
  example: null,
  resultGuidance: null,

  faq: [
    {
      question: 'Hangi dosya formatları desteklenmektedir?',
      answer: 'Standart olarak PDF ve Excel (xlsx) formatları desteklenmektedir. Ek format seçenekleri sistem yapılandırmasına bağlı olarak değişebilir.',
    },
    {
      question: 'Rapor şablonları özelleştirilebilir mi?',
      answer: 'Evet, kuruluşa özgü şablonlar (logo, renk, bölüm düzeni) sistem yöneticisi tarafından Veri Yükleme & Onay modülü aracılığıyla tanımlanabilir.',
    },
    {
      question: 'Oluşturulan raporlara daha sonra erişilebilir mi?',
      answer: 'Evet, tüm oluşturulan raporlar Arşiv modülüne otomatik olarak kaydedilir. Tarih, modül ve kullanıcı bilgisine göre filtreleyerek geçmiş raporlara erişebilirsiniz.',
    },
  ],

  academyLinks: [
    {
      title: 'Mühendislik Raporu Hazırlama Rehberi',
      description: 'Teknik raporların yapılandırılması, içerik seçimi ve paydaşlar için etkili sunum teknikleri.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
