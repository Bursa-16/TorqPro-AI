// ── advancedAnalysisGuide.ts ─────────────────────────────────────────────────
// Module guide for Gelişmiş Bağlantı Analizi (VDI 2230).
// Content based on ACTUAL AdvancedAnalysisPage.tsx implementation:
//   - 5 inputs: v_plaka, v_boy, v_n, v_FA, v_malzeme
//   - ΔT (v_dT) is display-only — not part of calculation
//   - Pure JS calculation: δp, δb, Φ, ΔFb, evaluation (Φ < 0.2)
//   - No backend API call
//   - supportsExampleLoad: false — page does not expose a form-population path
// ─────────────────────────────────────────────────────────────────────────────

import type { ModuleGuide } from './GuideSchema'

export const advancedAnalysisGuide: ModuleGuide = {
  id: 'advanced-analysis',
  title: 'Gelişmiş Bağlantı Analizi',
  subtitle: 'VDI 2230 Uyum ve Yük Dağılımı',
  version: '1.0.0',

  // ── 1. Bu Modül Nedir? ────────────────────────────────────────────────────
  description: {
    heading: 'Gelişmiş Bağlantı Analizi Nedir?',
    paragraphs: [
      'Bu modül, VDI 2230 standardına göre bağlantı elemanlarının uyum (compliance) davranışını ve harici yük dağılımını hesaplar. Plaka ve civata esnekliklerini karşılaştırarak yükün ne kadarının cıvataya aktarıldığını belirler.',
      'Hesaplama; plaka uyum katsayısı (δp), civata uyum katsayısı (δb) ve yük dağılım faktörü Φ (Phi) üzerinden yürütülür. Φ değeri 0,2\'nin altında kalıyorsa bağlantı optimum aralıkta değerlendirilebilir.',
      'Modül tamamen istemci taraflı çalışır — sunucuya herhangi bir istek göndermez.',
    ],
    note: 'ΔT alanı bilgi amaçlıdır; mevcut hesaplamaya dahil edilmemektedir.',
  },

  // ── 2. Çalışma Akışı ─────────────────────────────────────────────────────
  workflow: [
    {
      step: 1,
      title: 'Malzeme Seçin',
      description: 'Plaka malzemesini seçin: Çelik (E = 210 GPa) veya Alüminyum (E = 70 GPa). Bu seçim elastisite modülünü belirler.',
      anchorId: 'adv-malzeme',
    },
    {
      step: 2,
      title: 'Geometri Girin',
      description: 'Plaka kalınlığını (mm) ve civata boyunu (mm) girin. Bu değerler uyum katsayılarının hesabında doğrudan kullanılır.',
      anchorId: 'adv-geometri',
    },
    {
      step: 3,
      title: 'Yük Parametrelerini Girin',
      description: 'Yük giriş faktörünü (n/η) ve işletme yükünü FA (kN) girin. n faktörü, yükün kenetle temas yüzeyine göre nerede uygulandığını tanımlar.',
      anchorId: 'adv-yuk',
    },
    {
      step: 4,
      title: 'Hesapla',
      description: '"Hesapla" düğmesine basın. Sonuçlar anlık olarak hesaplanır: δp, δb, Φ değerleri ve ek civata kuvveti ΔFb görüntülenir.',
      anchorId: 'adv-hesapla',
    },
    {
      step: 5,
      title: 'Sonuçları Yorumlayın',
      description: 'Φ < 0,2 ise bağlantı optimal aralıktadır. Uyum diyagramı, plaka ve civata esneklik oranlarını görsel olarak gösterir.',
      anchorId: 'adv-sonuclar',
    },
  ],

  // ── 3. Parametreler ───────────────────────────────────────────────────────
  parameters: [
    {
      label: 'Plaka Kalınlığı',
      symbol: 't',
      unit: 'mm',
      explanation: 'Bağlantı elemanının sıkıştırdığı plaka ya da flanşın toplam kalınlığı. Plaka uyum katsayısı δp = t / (E_p × 100) formülüyle hesaplanır.',
      caution: 'Çok ince plakalar yüksek δp değerine yol açarak Φ\'yi artırır.',
      fieldKey: 'v_plaka',
      anchorId: 'adv-plaka',
    },
    {
      label: 'Civata Boyu',
      symbol: 'L',
      unit: 'mm',
      explanation: 'Cıvatanın etkin uzunluğu. Civata uyum katsayısı δb = L / (E_b × A_b) üzerinden hesaplanır. E_b = 210 GPa, A_b = 78,5 mm² (sabit referans kesit).',
      caution: 'Çok kısa civata kullanmak δb\'yi düşürür ve Φ\'yi azaltır — bu olumlu olmakla birlikte minimum kavrama boyu gereksinimini karşıladığınızdan emin olun.',
      fieldKey: 'v_boy',
      anchorId: 'adv-boy',
    },
    {
      label: 'Yük Giriş Faktörü',
      symbol: 'n / η',
      unit: '',
      explanation: 'Dış kuvvetin nerede uygulandığını tanımlayan boyutsuz faktör (0–1 arası). n = 0,5 değeri yükün kenetle temas düzlemine eşit uzaklıkta uygulandığı duruma karşılık gelir.',
      caution: 'n faktörü bağlantı geometrisine ve standart uygulamaya göre belirlenmelidir; keyfi girilmemelidir.',
      fieldKey: 'v_n',
      anchorId: 'adv-n',
    },
    {
      label: 'İşletme Yükü',
      symbol: 'FA',
      unit: 'kN',
      explanation: 'Cıvata eksenine paralel uygulanan dış çekme kuvveti. Hesaplama içinde N\'a çevrilir (FA × 1000).',
      fieldKey: 'v_FA',
      anchorId: 'adv-FA',
    },
    {
      label: 'Plaka Malzemesi',
      symbol: 'E_p',
      unit: 'GPa',
      explanation: 'Plaka elastisite modülü. Çelik için 210 GPa, Alüminyum için 70 GPa kullanılır. Bu değer δp hesabında doğrudan etki eder.',
      fieldKey: 'v_malzeme',
      anchorId: 'adv-malzeme',
    },
    {
      label: 'Sıcaklık Değişimi',
      symbol: 'ΔT',
      unit: '°C',
      explanation: 'Bilgi amaçlı gösterim alanı. Mevcut hesaplamaya dahil edilmemektedir. Termal genleşme etkilerini değerlendirmek için ek analiz gerekir.',
      caution: 'Bu alan hesaplamaya dahil değildir.',
      fieldKey: 'v_dT',
      anchorId: 'adv-dT',
    },
  ],

  // ── 4. Örnek Uygulama ─────────────────────────────────────────────────────
  // supportsExampleLoad: false — AdvancedAnalysisPage does not expose a
  // safe form-population path callable from outside the component.
  example: null,

  // ── 5. Sonuçları Nasıl Okurum? ────────────────────────────────────────────
  resultGuidance: {
    heading: 'Sonuçları Nasıl Yorumlamalısınız?',
    items: [
      {
        label: 'Yük Dağılım Faktörü Φ',
        description:
          'Dış yükün ne kadarının cıvataya aktarıldığını gösterir. Φ = δp / (δp + δb) formülüyle hesaplanır. Düşük Φ değeri, cıvatanın dış yükten çok ön gerilme tarafından taşındığı anlamına gelir.',
        thresholds: [
          { color: 'green', label: 'Φ < 0,2', meaning: 'Optimal — cıvata ön gerilmesi korunur, bağlantı stabiltir.' },
          { color: 'yellow', label: '0,2 ≤ Φ ≤ 0,4', meaning: 'Kabul edilebilir — yük paylaşımı izlenmeli.' },
          { color: 'red', label: 'Φ > 0,4', meaning: 'Yüksek — cıvata yorulma yüklenmesi riski artar, geometri gözden geçirilmeli.' },
        ],
      },
      {
        label: 'Ek Civata Kuvveti ΔFb',
        description:
          'Dış yükün cıvataya aktarılan kısmı: ΔFb = n × Φ × FA. Bu değer, ön gerilme kuvvetine ek olarak cıvatayı zorlayan yük miktarını verir.',
      },
      {
        label: 'Plaka Uyumu δp',
        description:
          'Plakadaki birim yük başına elastik deformasyon (mm/N). Yüksek δp → plaka daha esnek → Φ yükselir.',
      },
      {
        label: 'Civata Uyumu δb',
        description:
          'Cıvatadaki birim yük başına elastik deformasyon (mm/N). Düşük δb → civata sert → Φ düşer, ön gerilme korunur.',
      },
    ],
  },

  // ── 6. SSS ────────────────────────────────────────────────────────────────
  faq: [
    {
      question: 'Alüminyum plaka seçtiğimde Φ neden artar?',
      answer: 'Alüminyumun elastisite modülü (70 GPa), çeliğin (210 GPa) üçte biri kadardır. Bu nedenle aynı kalınlıkta alüminyum plaka, çeliğe göre üç kat daha yüksek uyum katsayısı (δp) üretir ve Φ değerini yükseltir.',
    },
    {
      question: 'ΔT neden sonuçları değiştirmiyor?',
      answer: 'ΔT alanı şu an bilgi amaçlı bir gösterim alanıdır; hesaplamaya dahil edilmemektedir. Termal genleşme etkilerini hesaba katmak için ek bir analiz modülü gerekmektedir.',
    },
    {
      question: 'n = 0,5 nasıl bir senaryoya karşılık gelir?',
      answer: 'n = 0,5, dış yükün bağlantı uzunluğunun orta noktasında uygulandığı standart senaryodur. Yük uygulama konumu değiştiğinde — örneğin flanş yüzeyinde veya civata başı altında — n değeri buna göre ayarlanmalıdır.',
    },
    {
      question: 'Hesaplama herhangi bir sunucuya bağlanıyor mu?',
      answer: 'Hayır. Tüm hesaplama tarayıcı içinde gerçekleşir. Ağ bağlantısına gerek yoktur.',
    },
    {
      question: 'Sabit A_b = 78,5 mm² değeri neden kullanılıyor?',
      answer: 'Bu değer M10 cıvata için gerilme alanına karşılık gelir ve civata uyum referansı olarak kullanılır. Farklı çaplarda daha hassas bir analiz için bu değerin bağlantınıza özgü olarak güncellenmesi gerekir.',
    },
  ],

  // ── 7. Academy ────────────────────────────────────────────────────────────
  academyLinks: [
    {
      title: 'VDI 2230 Uyum Yöntemi',
      description: 'Plaka ve civata esnekliklerinin Φ faktörüne etkisi — adım adım açıklama.',
      available: false,
    },
    {
      title: 'Yük Giriş Faktörü n Nasıl Belirlenir?',
      description: 'Farklı bağlantı geometrileri için n değeri belirleme rehberi.',
      available: false,
    },
  ],

  // ── 8. Demo adımları ──────────────────────────────────────────────────────
  demoSteps: [
    {
      index: 1,
      total: 4,
      label: '1/4 Malzeme',
      title: 'Plaka Malzemesini Seçin',
      description: 'Çelik veya Alüminyum seçeneğini belirleyin. Seçim elastisite modülünü otomatik olarak ayarlar.',
      anchorId: 'adv-malzeme',
    },
    {
      index: 2,
      total: 4,
      label: '2/4 Geometri',
      title: 'Plaka Kalınlığı ve Civata Boyu',
      description: 'Plaka kalınlığını ve civata boyunu mm cinsinden girin.',
      anchorId: 'adv-geometri',
    },
    {
      index: 3,
      total: 4,
      label: '3/4 Yük',
      title: 'Yük Parametreleri',
      description: 'Yük giriş faktörü n ve işletme yükü FA değerlerini girin.',
      anchorId: 'adv-yuk',
    },
    {
      index: 4,
      total: 4,
      label: '4/4 Sonuçlar',
      title: 'Hesapla ve Yorumla',
      description: '"Hesapla" düğmesine basın. Φ değerini ve uyum diyagramını inceleyin.',
      anchorId: 'adv-sonuclar',
    },
  ],

  // ── Flags ─────────────────────────────────────────────────────────────────
  supportsExampleLoad: false,
  supportsDemoMode: true,
}
