// releaseCertGuide.ts — TorqPro AI Module Guide
// Module: Sürüm Sertifikası | Yazılım Sürüm Onay ve Sertifikasyon

import type { ModuleGuide } from './GuideSchema';

export const releasecertGuide: ModuleGuide = {
  id: 'releasecert',
  title: 'Sürüm Sertifikası',
  subtitle: 'Yazılım Sürüm Onay ve Sertifikasyon',
  version: '1.0.0',

  description: {
    heading: 'Sürüm Sertifikası Modülü Nedir?',
    paragraphs: [
      'Sürüm Sertifikası modülü, TorqPro AI yazılımının veya içerdiği veri setleri ve hesaplama motorlarının yeni bir sürümünün üretim ortamına alınmadan önce geçmesi gereken onay sürecini yönetir. Her sürüm için tamamlanması gereken doğrulama kontrolleri, yetkili imzalar ve sertifika belgesi bu modül üzerinden oluşturulur.',
      'Sürüm onay süreci, Altın Senaryolar regresyon testlerinin geçilmesi, Teknik Doğrulama onayları ve belirlenen paydaşların dijital imzalarını kapsar. Tüm kontrol noktaları sürüm kaydında görünür; eksik onay varsa sertifika oluşturulamaz.',
      'Tamamlanan sürüm sertifikaları değişmez biçimde arşive alınır ve gelecekteki denetimlerde referans olarak kullanılabilir. Hangi sürümün ne zaman, kim tarafından onaylandığı ve hangi koşullar altında üretime alındığı tam izlenebilirlikle kayıt altındadır.',
    ],
    note: 'Sürüm sertifikası sürecini başlatmadan önce ilgili Altın Senaryo testlerinin ve Teknik Doğrulama kayıtlarının tamamlanmış olduğunu kontrol edin. Eksik ön koşullar süreci bloke eder.',
  },

  workflow: [
    {
      step: 1,
      title: 'Sürüm Kaydı Oluşturma',
      description: 'Yeni sürüm numarasını, kapsamını (yazılım, veri seti, hesaplama motoru) ve değişiklik özetini girerek sürüm kaydını oluşturun.',
    },
    {
      step: 2,
      title: 'Ön Koşul Kontrolü',
      description: 'Sistem ilgili Altın Senaryo test sonuçlarını ve Teknik Doğrulama kayıtlarını otomatik olarak kontrol eder. Eksik ön koşullar listelenir.',
    },
    {
      step: 3,
      title: 'Paydaş Onayları',
      description: 'Tanımlanan onaylayıcılar (kalite mühendisi, yazılım sorumlusu, yönetici) sırayla ya da paralel olarak onaylarını sisteme kaydeder.',
    },
    {
      step: 4,
      title: 'Sertifika Oluşturma',
      description: 'Tüm onaylar tamamlandığında sistem sürüm sertifikasını otomatik oluşturur. Sertifika indirilip paylaşılabilir ve arşive kaydedilir.',
    },
  ],

  parameters: [],
  example: null,
  resultGuidance: null,

  faq: [
    {
      question: 'Bir onaylayıcı ret kararı verirse süreç nasıl ilerler?',
      answer: 'Ret durumunda sürüm kaydı askıya alınır ve ret gerekçesi sisteme kaydedilir. İlgili sorunlar çözüldükten sonra süreç yeniden başlatılabilir.',
    },
    {
      question: 'Sürüm sertifikası formatı özelleştirilebilir mi?',
      answer: 'Sertifika şablonu sistem yöneticisi tarafından yapılandırılabilir. Organizasyonun logosunu, onay matrisini ve yasal uyarıları içeren özel şablonlar tanımlanabilir.',
    },
    {
      question: 'Geçmiş sürüm sertifikalarına nasıl erişilir?',
      answer: 'Tüm tamamlanmış sertifikalar Arşiv modülüne otomatik olarak kaydedilir. Sürüm numarası veya tarih aralığına göre filtreleyerek erişebilirsiniz.',
    },
  ],

  academyLinks: [
    {
      title: 'Yazılım Sürüm Yönetimi ve Kalite Kapısı Süreçleri',
      description: 'Mühendislik yazılımlarında sürüm sertifikasyon süreçleri, kontrol noktaları ve denetim izi yönetimi.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
