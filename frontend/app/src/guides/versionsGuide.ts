// versionsGuide.ts — TorqPro AI Module Guide
// Module: Veri Sürümleri | Veri Seti Sürüm Geçmişi ve Yönetimi

import type { ModuleGuide } from './GuideSchema';

export const versionsGuide: ModuleGuide = {
  id: 'versions',
  title: 'Veri Sürümleri',
  subtitle: 'Veri Seti Sürüm Geçmişi ve Yönetimi',
  version: '1.0.0',

  description: {
    heading: 'Veri Sürümleri Modülü Nedir?',
    paragraphs: [
      'Veri Sürümleri modülü, sisteme yüklenen veri setlerinin ve model yapılandırmalarının sürüm geçmişini yönetir. Her veri güncellemesi yeni bir sürüm olarak kaydedilir; kim tarafından, ne zaman ve hangi değişikliklerle güncellendiği izlenebilir biçimde tutulur.',
      'Modül, aktif sürümün hangisi olduğunu netleştirir ve kullanıcıların gerektiğinde önceki bir sürüme geri dönmesine olanak tanır. Bu, üretimde kullanılan hesaplama değerlerinin kontrollü biçimde değiştirilmesini ve gerektiğinde geri alınabilmesini sağlar.',
      'Sürüm geçmişi, denetim ve izlenebilirlik gereksinimleri için kritik bir kayıttır. Hangi hesaplamaların hangi veri sürümü kullanılarak yapıldığı, arşiv kayıtlarıyla çapraz referanslanabilir ve veri kaynaklı farklılıkların kök neden analizinde kullanılabilir.',
    ],
    note: 'Aktif sürümü değiştirmeden önce bu değişikliğin mevcut hesaplama ve analiz süreçlerini nasıl etkileyeceğini değerlendirin. Kritik değişiklikler için Sürüm Sertifikası sürecini başlatın.',
  },

  workflow: [
    {
      step: 1,
      title: 'Sürüm Listesini Görüntüleme',
      description: 'Modül açıldığında mevcut tüm veri seti sürümleri tarih, yükleyen kullanıcı ve değişiklik özeti ile listelenir. Aktif sürüm belirgin biçimde işaretlidir.',
    },
    {
      step: 2,
      title: 'Sürüm Detayını İnceleme',
      description: 'İlgili sürümü seçerek değişiklik ayrıntılarını, onay durumunu ve bu sürümü kullanan hesaplama kayıtlarını görüntüleyin.',
    },
    {
      step: 3,
      title: 'Sürüm Karşılaştırma',
      description: 'İki farklı sürümü yan yana karşılaştırarak değişen değerleri ve etkilenen alanları belirleyin.',
    },
    {
      step: 4,
      title: 'Aktif Sürüm Değiştirme',
      description: 'Yetkili kullanıcı, belirli bir sürümü aktif olarak ayarlayabilir. Bu işlem kayıt altına alınır ve gerekirse Sürüm Sertifikası sürecini tetikler.',
    },
  ],

  parameters: [],
  example: null,
  resultGuidance: null,

  faq: [
    {
      question: 'Eski bir sürüme geri dönmek mümkün müdür?',
      answer: 'Evet, yetkili kullanıcı önceki bir sürümü aktif olarak belirleyebilir. Bu işlem, geri dönüş gerekçesi ve kullanıcı bilgisiyle birlikte kayıt altına alınır.',
    },
    {
      question: 'Bir sürüm silinebilir mi?',
      answer: 'Onaylanmış ve kullanılmış sürümler silinemez; bu kayıtlar denetim izi kapsamında korunur. Yalnızca henüz onaylanmamış taslak sürümler yönetici yetkileriyle kaldırılabilir.',
    },
    {
      question: 'Hangi hesaplamalar hangi veri sürümünü kullandı?',
      answer: 'Arşiv modülünde her hesaplama kaydı, o sırada aktif olan veri sürümü bilgisini içerir. Sürüm bazlı filtreleme ile belirli bir sürümü kullanan tüm hesaplamalara erişilebilir.',
    },
  ],

  academyLinks: [
    {
      title: 'Mühendislik Verisinde Sürüm Kontrolü',
      description: 'Veri seti sürüm yönetiminin önemi, en iyi uygulamalar ve izlenebilirlik gereksinimleri.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
