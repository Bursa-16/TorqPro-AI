// toolTrackingGuide.ts — TorqPro AI Module Guide
// Module: Sıkıcı Takip | Sıkma Aleti Durum ve Performans Takibi

import type { ModuleGuide } from './GuideSchema';

export const sikiciGuide: ModuleGuide = {
  id: 'sikici',
  title: 'Sıkıcı Takip',
  subtitle: 'Sıkma Aleti Durum ve Performans Takibi',
  version: '1.0.0',

  description: {
    heading: 'Sıkıcı Takip Modülü Nedir?',
    paragraphs: [
      'Sıkıcı Takip modülü, üretim süreçlerinde kullanılan tornavidalar, moment anahtarları, pnömatik sıkma aletleri ve benzer ekipmanların envanter, durum ve performans bilgilerini merkezi olarak yönetir. Her alete ait kimlik bilgisi, kalibrasyon tarihleri, atandığı istasyon ve kullanım geçmişi bu modül üzerinden izlenir.',
      'Modül, aletin mevcut durumunu (aktif, bakımda, hizmet dışı) ve bir sonraki kalibrasyon tarihini gerçek zamanlı olarak gösterir. Kalibrasyon tarihi yaklaşan veya geçmiş aletler için otomatik uyarılar oluşturulur, böylece kalibrasyon dışı aletin üretimde kullanılmasının önüne geçilir.',
      'Kullanım geçmişi, aletin hangi montaj istasyonlarında, hangi tarih aralıklarında ve hangi operatörler tarafından kullanıldığını kaydeder. Bu bilgiler, kalite sorunlarının köken analizi sırasında belirli bir zaman dilimine ilişkin alet durumunun tespit edilmesine olanak tanır.',
    ],
    note: 'Kalibrasyon süresi dolmuş bir aletin aktif olarak işaretlenmesi sistem tarafından uyarıyla karşılanır. Bu tür aletleri üretimde kullanmadan önce mutlaka Kalibrasyon modülünden durumunu güncelleyin.',
  },

  workflow: [
    {
      step: 1,
      title: 'Alet Kaydı Görüntüleme',
      description: 'Modül açıldığında mevcut tüm sıkma aletlerinin listesi, durumu ve kalibrasyon bilgileriyle birlikte görüntülenir. Filtreler ile istasyon, durum veya alet türüne göre daraltma yapabilirsiniz.',
    },
    {
      step: 2,
      title: 'Alet Detayına Erişim',
      description: 'Listeden bir alete tıklayarak seri numarası, model, atandığı istasyon, kalibrasyon tarihleri ve kullanım geçmişini görüntüleyin.',
    },
    {
      step: 3,
      title: 'Durum Güncelleme',
      description: 'Aletin durumunu güncelleme yapın: aktif, bakımda veya hizmet dışı seçeneklerinden birini seçerek değişiklik gerekçesini kaydedin.',
    },
    {
      step: 4,
      title: 'Kalibrasyon Hatırlatıcı Takibi',
      description: 'Kırmızı veya sarı renkte işaretlenen aletler kalibrasyon tarihi yaklaşan ya da geçmiş aletleri gösterir. Bu aletleri Kalibrasyon modülüne yönlendirin.',
    },
  ],

  parameters: [],
  example: null,
  resultGuidance: null,

  faq: [
    {
      question: 'Yeni bir sıkma aleti sisteme nasıl eklenir?',
      answer: 'Yeni alet kaydı Veri Yükleme & Onay modülü veya yönetici paneli aracılığıyla oluşturulur. Seri numarası, alet tipi, nominal tork kapasitesi ve ilk kalibrasyon tarihi gibi bilgiler girilir.',
    },
    {
      question: 'Bir aletin geçmiş kullanım kayıtlarına erişebilir miyim?',
      answer: 'Evet, alet detay sayfasında kullanım geçmişi sekmesinden zaman damgası, operatör ve istasyon bilgisiyle birlikte tüm kullanım kayıtlarına erişilebilir.',
    },
    {
      question: 'Kalibrasyon uyarıları kimlerine iletilir?',
      answer: 'Uyarılar, sistem ayarlarında tanımlanan sorumlu kullanıcılara (ör. kalite mühendisi, bakım sorumlusu) bildirim olarak iletilir. Bildirim tercihleri yönetici tarafından yapılandırılır.',
    },
  ],

  academyLinks: [
    {
      title: 'Sıkma Aleti Yönetimi ve İzlenebilirlik',
      description: 'Üretimde sıkma aleti envanteri, bakım planlaması ve kalibrasyon yönetimi için en iyi uygulamalar.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
