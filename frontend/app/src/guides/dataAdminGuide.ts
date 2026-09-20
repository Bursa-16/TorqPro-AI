// dataAdminGuide.ts — TorqPro AI Module Guide
// Module: Veri Yükleme & Onay | Veri Seti Yükleme, İnceleme ve Onay Süreci

import type { ModuleGuide } from './GuideSchema';

export const dataadminGuide: ModuleGuide = {
  id: 'dataadmin',
  title: 'Veri Yükleme & Onay',
  subtitle: 'Veri Seti Yükleme, İnceleme ve Onay Süreci',
  version: '1.0.0',

  description: {
    heading: 'Veri Yükleme & Onay Modülü Nedir?',
    paragraphs: [
      'Veri Yükleme & Onay modülü, mühendislik veri setlerinin (OEM normları, malzeme parametreleri, kalibrasyon referansları, hesaplama tabloları vb.) sisteme toplu olarak yüklendiği, incelendiği ve onaylandığı merkezi yönetim arayüzüdür. Yalnızca yetkili kullanıcılar bu modüle erişebilir.',
      'Yükleme süreci üç aşamadan oluşur: önce veri dosyası sisteme aktarılır ve Veri Kalite Kapısı tarafından otomatik olarak doğrulanır. Ardından yetkili inceleyici veriyi gözden geçirir ve onay ya da ret kararı verir. Onaylanan veri, Veri Sürümleri modülünde yeni bir sürüm olarak kaydedilir ve aktif hale getirilir.',
      'Bu modül aynı zamanda sistem genelindeki şablonları (check-list, rapor şablonu vb.), kalite kurallarını ve kullanıcı yapılandırmalarını yönetmek için de kullanılır. Tüm değişiklikler denetim izi kapsamında kayıt altındadır.',
    ],
    note: 'Büyük veri setlerini yüklemeden önce bir örnek dosyayla Veri Kalite Kapısı kurallarını test edin. Bu yaklaşım, yaygın format hatalarını erkenden tespit etmenizi sağlar ve süreç verimliliğini artırır.',
  },

  workflow: [
    {
      step: 1,
      title: 'Veri Dosyasını Hazırlama',
      description: 'Yüklenecek veri setini sistem tarafından desteklenen formatta (ör. Excel, CSV, JSON) hazırlayın. Şablon dosyayı modülden indirerek başlayabilirsiniz.',
    },
    {
      step: 2,
      title: 'Yükleme ve Otomatik Doğrulama',
      description: 'Hazırlanan dosyayı yükleme alanına sürükleyin ya da dosya seçiciyle seçin. Sistem dosyayı Veri Kalite Kapısı kurallarına göre otomatik olarak doğrular.',
    },
    {
      step: 3,
      title: 'Doğrulama Sonuçlarını İnceleme',
      description: 'Kalite kapısı sonuçlarını inceleyin. Kritik hatalar varsa kaynakta düzeltin ve yeniden yükleyin. Uyarılar için gerekçe girerek ilerleyebilirsiniz.',
    },
    {
      step: 4,
      title: 'İnceleme ve Onay',
      description: 'Yetkili inceleyici veri setini içerik olarak gözden geçirir. Onay kararı gerekçesiyle birlikte sisteme kaydedilir.',
    },
    {
      step: 5,
      title: 'Sürüm Yayımlama',
      description: 'Onaylanan veri yeni bir sürüm olarak Veri Sürümleri modülüne kaydedilir. Yönetici aktif sürümü güncelleyerek yeni verinin sisteme yansımasını sağlar.',
    },
  ],

  parameters: [],
  example: null,
  resultGuidance: null,

  faq: [
    {
      question: 'Hangi dosya formatları desteklenmektedir?',
      answer: 'Standart olarak Excel (xlsx), CSV ve JSON formatları desteklenmektedir. Veri tipine göre ek format gereksinimleri olabilir; desteklenen formatların tam listesi sistem yöneticinizden öğrenilebilir.',
    },
    {
      question: 'Onay sürecinde birden fazla inceleyici atanabilir mi?',
      answer: 'Evet, veri türüne göre farklı inceleyici rolleri ve ardışık onay akışları yapılandırılabilir. Bu yapı sistem yöneticisi tarafından tanımlanır.',
    },
    {
      question: 'Yanlışlıkla onaylanan bir veri seti geri alınabilir mi?',
      answer: 'Onaylanmış veri seti silinmez; ancak Veri Sürümleri modülünden önceki sürüm aktif hale getirilerek hatanın etkisi giderilebilir. Yanlış onay durumu Problem Yönetimi modülüne kaydedilmelidir.',
    },
  ],

  academyLinks: [
    {
      title: 'Mühendislik Veri Yönetimi ve Onay Süreçleri',
      description: 'Büyük ölçekli veri setlerinin hazırlanması, kalite doğrulama ve kontrollü yayımlama iş akışları.',
      available: false,
    },
    {
      title: 'Veri Kalite Standartları ve Doğrulama Kuralları',
      description: 'Mühendislik verisi için kalite kural tasarımı ve otomatik doğrulama mekanizmalarının yapılandırılması.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
