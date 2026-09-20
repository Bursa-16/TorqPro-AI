// ── torqueGuide.ts ─────────────────────────────────────────────────────────
// Data-driven guide configuration for Tork Hesap (Torque Calculation) module.
// All guide content lives here — TorqueCalcPage only wires callbacks and anchors.
// ────────────────────────────────────────────────────────────────────────────
import type {
  WorkflowStep,
  ParameterEntry,
  FAQEntry,
  AcademyLink,
  DemoStep,
  ModuleGuide,
  ExampleValues,
  GuideExample,
} from './GuideSchema'

// Re-export canonical shared types for consumers that imported them from here
export type { WorkflowStep, ParameterEntry, FAQEntry, AcademyLink, DemoStep, ExampleValues, GuideExample }

// ── Section 1: Bu Modül Nedir? ──────────────────────────────────────────────
export const moduleDescription = {
  heading: 'Bu Modül Nedir?',
  paragraphs: [
    'Tork Hesap modülü, bir bağlantı elemanına uygulanması gereken sıkma torkunu ve beraberindeki ön yükü deterministik olarak hesaplar. Soru: "Bu civata, hedef ön yüke ulaşmak için kaç Nm ile sıkılmalı?"',
    'Hesap; civata geometrisi, malzeme özellikleri ve sürtünme katsayılarını giriş olarak alır; VDI 2230 tabanlı tork–ön yük ilişkisini kullanarak nominal, minimum ve maksimum tork değerlerini üretir.',
    'Modül deterministik çalışır: aynı girdi her zaman aynı çıktıyı verir. Stokastik belirsizlik, min/nom/max sürtünme üçlüsü ile yönetilir.',
    'Kullanım senaryoları: yeni bağlantı tasarımı, mevcut prosese tork doğrulama, kayış-tork analizi için referans değer üretimi.',
  ],
  note: 'Bu modül VDI 2230 prensiplerine dayanmaktadır. Nihai üretim kararları için yetkili mühendislik onayı alınmalıdır.',
}

// ── Section 2: Nasıl Kullanılır? ────────────────────────────────────────────
export const workflowSteps: WorkflowStep[] = [
  {
    step: 1,
    title: 'Civata geometrisini kontrol et',
    description: 'Çap (d), adım (P), gerilme alanı (As) ve efektif yatak çapı (Dw) değerlerini standart tablosundan veya teknik çizimden gir. Standart bağlantı elemanları için As değeri ilgili normlarda mevcuttur.',
    anchorId: 'guide-anchor-geometri',
  },
  {
    step: 2,
    title: 'Sürtünme katsayılarını gir',
    description: 'Diş ve yatak yüzeyleri için min/nom/max sürtünme değerlerini kaplama ve yağlama durumuna göre belirle. Değerler belirsizse VDI 2230 Tablo A9\'dan yararlan.',
    anchorId: 'guide-anchor-surtunme',
  },
  {
    step: 3,
    title: 'Hedef kullanım oranını belirle',
    description: 'Akma kullanım oranı (tipik: 0,70–0,80) cıvatanın kapasite yüzdesini belirler. Dinamik yükler için 0,70; statik için 0,75–0,80 önerilir. Rp0.2 malzemenin minimum akma dayanımıdır.',
    anchorId: 'guide-anchor-hedef',
  },
  {
    step: 4,
    title: 'Gelişmiş parametreleri gerektiğinde kontrol et',
    description: '"Gelişmiş parametreler" bölümünü aç; civata Rm, somun proof ve iç malzeme Rm değerlerini doğrula. Bu veriler diş güvenlik katsayılarının hesabında kullanılır.',
    anchorId: 'guide-anchor-advanced',
  },
  {
    step: 5,
    title: 'Hesapla',
    description: '"Hesapla" düğmesine tıkla. Backend tüm değerleri doğrular ve nominal, minimum, maksimum tork ile ön yük değerlerini döndürür.',
    anchorId: 'guide-anchor-cta',
  },
  {
    step: 6,
    title: 'Sonuçları değerlendir',
    description: 'Sağ panelde önerilen nominal tork, tork aralığı, ön yük, somun kullanım oranı ve diş güvenlik katsayılarını incele. Yeşil = uygun, sarı = sınırda, kırmızı = revizyon gerekli.',
    anchorId: 'guide-anchor-result',
  },
]

// ── Section 3: Parametreler ──────────────────────────────────────────────────
export const parameters: ParameterEntry[] = [
  {
    label: 'Çap',
    symbol: 'd',
    unit: 'mm',
    explanation: 'Cıvata nominal dış çapı. M10 → 10 mm. Tüm geometrik hesapların temel girdisidir.',
    anchorId: 'guide-anchor-geometri',
  },
  {
    label: 'Adım',
    symbol: 'P',
    unit: 'mm',
    explanation: 'Diş adımı. İnce diş varyantlarında standart adımdan farklı olabilir; teknik çizimi kontrol et.',
    caution: 'Yanlış adım, hesaplanan tork değerini önemli ölçüde etkiler.',
    anchorId: 'guide-anchor-geometri',
  },
  {
    label: 'Gerilme Alanı',
    symbol: 'As',
    unit: 'mm²',
    explanation: 'Cıvata gerilme kesit alanı. DIN EN ISO 898-1 Tablo 4\'te nominal değerler verilmiştir. M10 kaba diş: 58 mm².',
    anchorId: 'guide-anchor-geometri',
  },
  {
    label: 'Efektif Yatak Çapı',
    symbol: 'Dw',
    unit: 'mm',
    explanation: 'Baş veya somun temas yüzeyinin ortalama etki çapı. Anahtar yüzeyi ve delik çapından geometrik olarak türetilir.',
    anchorId: 'guide-anchor-geometri',
  },
  {
    label: 'Diş Sürtünmesi (min)',
    symbol: 'μ_Gmin',
    explanation: 'Diş yüzeyi minimum sürtünme katsayısı. Maksimum ön yük koşulunu belirler.',
    anchorId: 'guide-anchor-surtunme',
  },
  {
    label: 'Diş Sürtünmesi (nom)',
    symbol: 'μ_Gnom',
    explanation: 'Nominal sürtünme katsayısı. Nominal tork hesabında kullanılır.',
    anchorId: 'guide-anchor-surtunme',
  },
  {
    label: 'Diş Sürtünmesi (max)',
    symbol: 'μ_Gmax',
    explanation: 'Maksimum sürtünme katsayısı. Minimum ön yük koşulunu belirler.',
    anchorId: 'guide-anchor-surtunme',
  },
  {
    label: 'Oturma Yüzeyi μ min',
    symbol: 'μ_Kmin',
    explanation: 'Cıvata başı veya somun altı ile pul/bağlanan yüzey arasındaki minimum sürtünme katsayısı. Maksimum tork değerini belirler.',
    anchorId: 'guide-anchor-surtunme',
  },
  {
    label: 'Oturma Yüzeyi μ nom',
    symbol: 'μ_Knom',
    explanation: 'Cıvata başı veya somun altı ile pul/bağlanan yüzey arasındaki sürtünme katsayısı. Nominal tork hesabında kullanılır.',
    anchorId: 'guide-anchor-surtunme',
  },
  {
    label: 'Oturma Yüzeyi μ max',
    symbol: 'μ_Kmax',
    explanation: 'Cıvata başı veya somun altı ile pul/bağlanan yüzey arasındaki maksimum sürtünme katsayısı. Minimum ön yük koşulunu belirler.',
    caution: 'Oturma yüzeyi ve diş sürtünmeleri birbirinden bağımsız olabilir; her yüzeyi ayrı değerlendir.',
    anchorId: 'guide-anchor-surtunme',
  },
  {
    label: 'Akma Kullanım Oranı',
    symbol: 'ν',
    explanation: 'Cıvatanın akma dayanımına ne kadar yükleneceği oranı. 0,75 → Rp0.2\'nin %75\'i kadar ön yük. Tipik aralık: 0,65–0,80.',
    caution: '0,80\'in üzerinde kalan rezerv marjı daraldığından dinamik uygulamalarda dikkatli ol.',
    anchorId: 'guide-anchor-hedef',
  },
  {
    label: 'Akma Dayanımı',
    symbol: 'Rp0.2',
    unit: 'MPa',
    explanation: 'Cıvata malzemesinin 0,2% kalıcı uzama sınırı. 8.8 sınıfı: 640 MPa; 10.9: 900 MPa; 12.9: 1080 MPa.',
    anchorId: 'guide-anchor-hedef',
  },
  {
    label: 'Civata Çekme Dayanımı',
    symbol: 'Rm',
    unit: 'MPa',
    explanation: 'Cıvata malzemesi nihai çekme dayanımı. Diş kesme güvenlik katsayısı (dış) hesabında kullanılır.',
    anchorId: 'guide-anchor-advanced',
  },
  {
    label: 'Somun Proof Basıncı',
    symbol: 'Sp',
    unit: 'MPa',
    explanation: 'Somun proof yük basıncı (DIN EN ISO 898-2). Somun kullanım oranının hesabında referans değer olarak kullanılır.',
    anchorId: 'guide-anchor-advanced',
  },
  {
    label: 'İç Malzeme Dayanımı',
    symbol: 'Rm_int',
    unit: 'MPa',
    explanation: 'Dişli iç parçanın (karşı diş) çekme dayanımı. Daha düşük dayanımlı malzemelerde diş kesme SF\'yi sınırlar.',
    caution: 'Alüminyum gövde gibi düşük dayanımlı iç malzemelerde bu değeri mutlaka doğrula.',
    anchorId: 'guide-anchor-advanced',
  },
  {
    label: 'Kavrama Uzunluğu',
    symbol: 'le',
    unit: 'mm',
    explanation: 'Etkin diş kavrama uzunluğu. Diş kesme güvenlik katsayılarının hesabında kullanılır. Tipik öneri: le ≥ 1×d.',
    caution: 'Yetersiz kavrama uzunluğu diş soyulmasına yol açabilir.',
    anchorId: 'guide-anchor-advanced',
  },
]

// ── Section 4: Örnek Uygulama ────────────────────────────────────────────────
export const guideExample: GuideExample = {
  title: 'M10 Flanş Bağlantısı — Tipik Çelik/Çelik',
  useCase: 'Çelik gövdeye çelik flanş montajı. 10.9 sınıfı civata, standart kaba diş, yağlı (MoS₂) yüzey.',
  values: {
    diameter_mm: 10,
    pitch_mm: 1.5,
    stress_area_mm2: 58,
    effective_bearing_diameter_mm: 15,
    rp02_mpa: 900,
    target_yield_ratio: 0.75,
    mu_thread_min: 0.08,
    mu_thread_nom: 0.10,
    mu_thread_max: 0.12,
    mu_bearing_min: 0.08,
    mu_bearing_nom: 0.10,
    mu_bearing_max: 0.12,
    engagement_mm: 12,
    internal_rm_mpa: 800,
    bolt_rm_mpa: 1000,
    nut_proof_mpa: 830,
  } satisfies ExampleValues,
  notes: 'MoS₂ yağlama nedeniyle sürtünme katsayıları kuru bağlantıya göre düşük alınmıştır. "Hesapla"ya tıklayarak sonuçları doğrula.',
}

// ── Section 5: Sonuçları Nasıl Okurum? ──────────────────────────────────────
export const resultGuidance = {
  heading: 'Sonuçları Nasıl Okurum?',
  items: [
    {
      label: 'Önerilen Sıkma Torku',
      description: 'Nominal sürtünme değerleri kullanılarak hesaplanan sıkma torku (Nm). Üretim prosesinde hedef değer olarak kullanılır.',
    },
    {
      label: 'Tork Min / Max Aralığı',
      description: 'Sürtünme belirsizliği göz önüne alınarak hesaplanan alt ve üst tork sınırları. Proses toleransı bu aralıkla belirlenir.',
    },
    {
      label: 'Ön Yük (Fv)',
      description: 'Nominal tork altında oluşacak cıvata ön yükü (kN). Bağlantı tasarımında esas alınan kuvvet budur.',
    },
    {
      label: 'Somun Kullanım Oranı',
      description: 'Mevcut ön yükün somun proof kapasitesine oranı (%).',
      thresholds: [
        { color: 'green', label: 'Yeşil (< %75)', meaning: 'Uygun — güvenli bölge' },
        { color: 'amber', label: 'Sarı (%75–90)', meaning: 'Sınırda — somun seçimini gözden geçir' },
        { color: 'red', label: 'Kırmızı (> %90)', meaning: 'Kritik — somun kapasitesi yetersiz, revizyon gerekli' },
      ],
    },
    {
      label: 'Diş SF (İç / Dış)',
      description: 'İç ve dış dişler için diş kesme güvenlik katsayısı. SF < 1,0 kırmızı gösterilir; diş soyulması riski yüksektir. SF ≥ 1,0 yeşil gösterilir.',
    },
    {
      label: 'Bağlantı Diyagramı',
      description: 'Sıkma kuvvetlerini ve bağlantı durumunu görselleştiren şematik diyagram.',
    },
  ],
}

// ── Section 6: Sık Sorulan Sorular ──────────────────────────────────────────
export const faqItems: FAQEntry[] = [
  {
    question: 'Sürtünme katsayısını bilmiyorsam ne yapmalıyım?',
    answer: 'VDI 2230 Tablo A9\'da yaygın yüzey/kaplama kombinasyonları için referans aralıklar mevcuttur. Belirsiz durumlarda muhafazakâr (geniş) aralık kullan: min 0,08 / nom 0,12 / max 0,16.',
  },
  {
    question: 'Min/nom/max sürtünme neden kullanılıyor?',
    answer: 'Aynı sürtünme katsayısıyla çalışan tüm bağlantılar pratikte farklı sürtünme gösterir. Min/max değerleri, üretim sürecinde tork aralığını güvence altına almak için kullanılır. Min sürtünme → max ön yük; max sürtünme → min ön yük.',
  },
  {
    question: 'Tork aralığı neden değişiyor?',
    answer: 'Sürtünme katsayısındaki farklılık, aynı tork altında farklı ön yük oluşturur. Geniş tork aralığı genellikle geniş μ aralığından kaynaklanır. Yüzey tutarlılığını artırmak tork aralığını daraltır.',
  },
  {
    question: 'Somun kullanım oranı neden yükseliyor?',
    answer: 'Akma kullanım oranı veya Rp0.2 artışı ön yükü artırır, bu da somun kullanım oranını yükseltir. Ayrıca düşük somun proof değeri seçimi oranı artırır. Çözüm: daha yüksek sınıflı somun seçimi veya hedef kullanım oranını düşürme.',
  },
  {
    question: 'Hangi durumda Gelişmiş Analiz modülüne geçmeliyim?',
    answer: 'Dinamik yükler, çarpma, ısıl genleşme farkı, çoklu yükleme senaryoları veya bağlantı bütünlüğü analizi gerekiyorsa Gelişmiş Analiz (VDI 2230 kapsamlı) modülünü kullan.',
  },
  {
    question: 'Sonucu doğrudan üretimde kullanabilir miyim?',
    answer: 'Bu modül mühendislik referans değeri üretir. Üretim uygulaması için yetkili mühendislik onayı, yazılı proses talimatı ve kalibrasyon kayıtlı sıkma ekipmanı gereklidir.',
  },
]

// ── Section 7: Academy / Tutorial ────────────────────────────────────────────
export const academyLinks: AcademyLink[] = [
  {
    title: 'Tork–Ön Yük İlişkisi',
    description: 'Sıkma torku ile oluşan ön yük arasındaki temel ilişki ve etki eden parametreler.',
    available: false,
  },
  {
    title: 'Sürtünmenin Tork Hesabına Etkisi',
    description: 'Yüzey kaplaması, yağlama ve sürtünme katsayısı belirsizliğinin tork aralığına etkisi.',
    available: false,
  },
  {
    title: 'Cıvata Ön Yükü Temelleri',
    description: 'Ön yük kavramı, kayıp mekanizmaları ve tasarım hedefleri.',
    available: false,
  },
  {
    title: 'VDI 2230 Giriş',
    description: 'VDI 2230 standardının kapsamı, hesap adımları ve kullanım alanları.',
    available: false,
  },
  {
    title: 'Diş ve Oturma Yüzeyi Sürtünmesi',
    description: 'İki ayrı sürtünme bölgesinin (diş ve oturma yüzeyi) tork dağılımına katkısı.',
    available: false,
  },
  {
    title: 'Sonuç Yorumlama Rehberi',
    description: 'Tork, ön yük ve güvenlik katsayılarını üretim kararına nasıl dönüştürürsünüz.',
    available: false,
  },
]

// ── Guided Demo Steps ─────────────────────────────────────────────────────────
export const demoSteps: DemoStep[] = [
  {
    index: 1,
    total: 6,
    label: '1/6 Geometri',
    title: 'Civata Geometrisi',
    description: 'Çap (d), adım (P), gerilme alanı (As) ve efektif yatak çapı (Dw) alanlarını gir. Standart civata için bu değerler norm tablosundan alınır.',
    anchorId: 'guide-anchor-geometri',
  },
  {
    index: 2,
    total: 6,
    label: '2/6 Sürtünme',
    title: 'Sürtünme Katsayıları',
    description: 'Diş ve yatak yüzeyleri için min/nom/max sürtünme değerlerini gir. Yüzey kaplaması ve yağlama durumuna göre bu değerler değişir.',
    anchorId: 'guide-anchor-surtunme',
  },
  {
    index: 3,
    total: 6,
    label: '3/6 Hedef',
    title: 'Hedef Kullanım Oranı',
    description: 'Akma kullanım oranını ve Rp0.2 malzeme dayanımını gir. Bu iki değer hedef ön yükü belirler.',
    anchorId: 'guide-anchor-hedef',
  },
  {
    index: 4,
    total: 6,
    label: '4/6 Gelişmiş',
    title: 'Gelişmiş Parametreler',
    description: 'Malzeme dayanım değerlerini ve kavrama uzunluğunu gir. Bu alan, diş güvenlik katsayılarını etkiler.',
    anchorId: 'guide-anchor-advanced',
  },
  {
    index: 5,
    total: 6,
    label: '5/6 Hesapla',
    title: 'Hesapla',
    description: '"Hesapla" düğmesine tıkla. Backend tüm değerleri doğrular ve nominal, minimum, maksimum tork ile ön yük sonuçlarını döndürür.',
    anchorId: 'guide-anchor-cta',
  },
  {
    index: 6,
    total: 6,
    label: '6/6 Sonuçlar',
    title: 'Sonuçları Değerlendir',
    description: 'Sağ panelde önerilen nominal tork, tork aralığı, ön yük, somun kullanım oranı ve diş güvenlik katsayılarını incele.',
    anchorId: 'guide-anchor-result',
  },
]

// ── Assembled ModuleGuide ─────────────────────────────────────────────────────
export const torqueGuide: ModuleGuide = {
  id: 'torque',
  title: 'Tork Hesap',
  subtitle: 'Mühendislik Kılavuzu',
  version: '1.0.0',
  description: moduleDescription,
  workflow: workflowSteps,
  parameters,
  example: guideExample,
  resultGuidance,
  faq: faqItems,
  academyLinks,
  demoSteps,
  supportsExampleLoad: true,
  supportsDemoMode: true,
}
