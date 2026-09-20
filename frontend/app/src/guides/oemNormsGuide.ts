// oemNormsGuide.ts — TorqPro AI Module Guide
// Module: OEM Norm Sorgu | OEM Tork ve Bağlantı Normları Veritabanı

import type { ModuleGuide } from './GuideSchema';

export const oemGuide: ModuleGuide = {
  id: 'oem',
  title: 'OEM Norm Sorgu',
  subtitle: 'OEM Tork ve Bağlantı Normları Veritabanı',
  version: '1.0.0',

  description: {
    heading: 'OEM Norm Sorgu Modülü Nedir?',
    paragraphs: [
      'OEM Norm Sorgu modülü, araç üreticileri (OEM) tarafından yayımlanan tork değerlerini, bağlantı spesifikasyonlarını ve montaj normlarını sorgulayabileceğiniz merkezi bir veritabanı arayüzüdür. Marka, model, montaj bölgesi veya parça numarası gibi kriterlerle hızlı arama yapılabilir.',
      'Veritabanı, üreticilerin servis kılavuzlarından ve teknik bültenlerinden derlenen referans değerleri içerir. Her girdi; tork aralığı, sıkma açısı, kullanılacak yağlayıcı tipi, cıvata sınıfı ve uygulama koşulları gibi bilgileri kapsar. Bu sayede saha mühendisleri ve kalite ekipleri, üretici kaynaklı spesifikasyonlara hızla ulaşabilir.',
      'Sorgulanan değerler doğrudan hesaplama modüllerine aktarılabilir veya raporlara dahil edilebilir. Veri tabanının içeriği Veri Yükleme & Onay modülü aracılığıyla güncellenir ve her güncelleme sürüm geçmişine kaydedilir.',
    ],
    note: 'OEM normları üretici revizyonlarıyla değişebilir. Sorgu sonuçlarının mevcut servis dökümantasyonuyla tutarlı olup olmadığını kritik uygulamalarda teyit edin.',
  },

  workflow: [
    {
      step: 1,
      title: 'Arama Kriterlerinin Belirlenmesi',
      description: 'Marka, model yılı, motor türü veya montaj bölgesi gibi bilinen kriterleri girin. En az bir arama kriteri zorunludur.',
    },
    {
      step: 2,
      title: 'Sonuç Listesini İnceleme',
      description: 'Sisteme eşleşen OEM normlarını listeler. Sonuçları bağlantı türü, tork aralığı veya yayım tarihine göre sıralayabilirsiniz.',
    },
    {
      step: 3,
      title: 'Norm Detayını Görüntüleme',
      description: 'İlgili normu seçerek tork değeri, sıkma adımları, yağlama gereksinimleri ve kaynak referansı gibi detaylara ulaşın.',
    },
    {
      step: 4,
      title: 'Değerlerin Kullanımı',
      description: 'Bulunan değerleri hesaplama modüllerine aktarın veya Rapor Üret modülüne referans olarak ekleyin.',
    },
  ],

  parameters: [],
  example: null,
  resultGuidance: null,

  faq: [
    {
      question: 'Veritabanında bulunmayan bir OEM normu için ne yapmalıyım?',
      answer: 'İlgili normu resmi OEM kaynaklarından temin ederek Veri Yükleme & Onay modülü aracılığıyla yöneticinize iletebilirsiniz. Onay sürecinden geçen veriler veritabanına eklenir.',
    },
    {
      question: 'Sorgulama geçmişi saklanıyor mu?',
      answer: 'Evet, kullanıcı bazlı son sorgular sistem tarafından kaydedilir ve hızlı erişim için listelenir. Arşiv modülünde de sorgu geçmişine filtrelenmiş erişim mümkündür.',
    },
    {
      question: 'Veriler ne sıklıkla güncellenir?',
      answer: 'Güncelleme sıklığı organizasyonun veri yönetim politikasına bağlıdır. Her güncelleme Veri Sürümleri modülünde sürüm numarasıyla kayıt altına alınır.',
    },
  ],

  academyLinks: [
    {
      title: 'OEM Bağlantı Spesifikasyonlarını Anlama',
      description: 'Araç üreticisi tork normlarının nasıl okunacağı, yorumlanacağı ve üretim süreçlerine nasıl entegre edileceği.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
