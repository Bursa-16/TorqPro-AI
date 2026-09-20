// archiveGuide.ts — TorqPro AI Module Guide
// Module: Arşiv | Geçmiş Hesaplama ve Analiz Kayıtları

import type { ModuleGuide } from './GuideSchema';

export const arsivGuide: ModuleGuide = {
  id: 'arsiv',
  title: 'Arşiv',
  subtitle: 'Geçmiş Hesaplama ve Analiz Kayıtları',
  version: '1.0.0',

  description: {
    heading: 'Arşiv Modülü Nedir?',
    paragraphs: [
      'Arşiv modülü, TorqPro AI üzerinde gerçekleştirilen tüm hesaplama, analiz ve doğrulama oturumlarının geçmişe dönük kayıtlarına erişim sağlayan merkezi bir veri havuzudur. Her kayıt; oturum sahibi, tarih-saat damgası, ilgili modül, kullanılan parametreler ve sonuçlar gibi üst veriyi içerir.',
      'Kullanıcılar tarih aralığı, modül türü, proje kodu, kullanıcı veya anahtar kelime gibi çoklu filtreler kullanarak geçmiş kayıtları hızla bulabilir. Bulunan bir kayıt açılarak detayları incelenebilir, ilgili raporlara erişilebilir veya değerler yeni bir hesaplama için başlangıç noktası olarak kullanılabilir.',
      'Arşiv, izlenebilirlik ve denetim izi gereksinimleri için kritik bir bileşendir. Onaylanmış hesaplamalar, doğrulama kayıtları ve raporlar değişmez biçimde arşivde saklanır; bu kayıtlar üzerinde geriye dönük düzenleme yapılamaz.',
    ],
    note: 'Arşiv kayıtları salt okunurdur. Geçmiş bir hesaplamayı güncellemek yerine yeni bir oturum açın ve gerekirse eski kaydı referans olarak kullanın.',
  },

  workflow: [
    {
      step: 1,
      title: 'Arama ve Filtreleme',
      description: 'Tarih aralığı, modül türü, proje kodu veya kullanıcı gibi filtreler uygulayarak aradığınız kaydı bulun.',
    },
    {
      step: 2,
      title: 'Kayıt Listesini İnceleme',
      description: 'Filtrelenmiş sonuçları listede görüntüleyin. Her satırda oturum tarihi, sahibi, modül ve durum bilgisi yer alır.',
    },
    {
      step: 3,
      title: 'Kayıt Detayını Açma',
      description: 'İlgili kaydı seçerek parametre ve sonuç detaylarını, bağlı rapor ve doğrulama belgelerini görüntüleyin.',
    },
    {
      step: 4,
      title: 'Değerleri Yeni Hesaplamaya Aktarma',
      description: 'İstediğiniz geçmiş kayıttaki parametreleri kopyalayarak yeni bir hesaplama oturumu başlatmak için kullanabilirsiniz.',
    },
  ],

  parameters: [],
  example: null,
  resultGuidance: null,

  faq: [
    {
      question: 'Arşiv kayıtları ne kadar süre saklanır?',
      answer: 'Saklama süresi organizasyonun veri yönetim politikasına ve sistem yapılandırmasına bağlıdır. Yasal veya kalite gereksinimlerine tabi kayıtlar için ek saklama kuralları tanımlanabilir.',
    },
    {
      question: 'Geçmiş bir hesaplamayı silmek mümkün müdür?',
      answer: 'Onaylanmış kayıtlar silinemez. Taslak veya tamamlanmamış oturumlar yönetici yetkileriyle arşivden kaldırılabilir.',
    },
    {
      question: 'Arşivde aynı hesaplamanın birden fazla sürümü yer alabilir mi?',
      answer: 'Evet, her kayıt oturum bazlıdır. Aynı bağlantı için farklı parametrelerle yapılan hesaplamalar ayrı kayıtlar olarak arşivde görünür ve karşılaştırmalı incelemeye olanak tanır.',
    },
  ],

  academyLinks: [
    {
      title: 'Mühendislik Verisinin Arşivlenmesi ve İzlenebilirlik',
      description: 'Kalite yönetim sistemlerinde hesaplama kayıtlarının saklanması, denetim izi ve veri bütünlüğü gereksinimleri.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
