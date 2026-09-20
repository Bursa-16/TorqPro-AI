// technicalGuide.ts — TorqPro AI Module Guide
// Module: Teknik Doğrulama | Bağlantı Teknik Doğrulama Süreci

import type { ModuleGuide } from './GuideSchema';

export const validationGuide: ModuleGuide = {
  id: 'validation',
  title: 'Teknik Doğrulama',
  subtitle: 'Bağlantı Teknik Doğrulama Süreci',
  version: '1.0.0',

  description: {
    heading: 'Teknik Doğrulama Modülü Nedir?',
    paragraphs: [
      'Teknik Doğrulama modülü, mühendislik hesaplamalarının ve bağlantı tasarımlarının yetkili mühendisler tarafından incelenerek onaylandığı yapılandırılmış bir gözden geçirme sürecini yönetir. Bir hesaplama veya analiz sonucunun üretime geçmeden önce teknik doğruluğunun teyit edilmesi bu modül aracılığıyla sağlanır.',
      'Doğrulama süreci çok aşamalı bir iş akışı içerir: hesabı yapan mühendis dokümanı gönderir, atanan doğrulayıcı inceleme yapar ve onay veya ret kararını gerekçesiyle birlikte kaydeder. Tüm gözden geçirme adımları tarih-saat damgası ve kullanıcı bilgisiyle izlenir.',
      'Bu modül, mühendislik değişiklik yönetimi (ECM) süreçleriyle entegre çalışabilir ve denetim izi oluşturarak kurumsal kalite standartlarına uyumu destekler. Onaylanan doğrulamalar otomatik olarak arşive aktarılır.',
    ],
    note: 'Doğrulama sürecini başlatmadan önce hesaplama verilerinin eksiksiz ve güncel olduğundan emin olun. Eksik veriyle gönderilen belgeler doğrulayıcı tarafından iade edilebilir.',
  },

  workflow: [
    {
      step: 1,
      title: 'Doğrulama Talebi Oluşturma',
      description: 'Hesaplama veya analiz sonucunu seçerek doğrulama talebi oluşturun. İlgili belgeleri ve açıklayıcı notları ekleyin.',
    },
    {
      step: 2,
      title: 'Doğrulayıcı Atama',
      description: 'Talep, yetkili mühendis listesinden seçilen doğrulayıcıya atanır. Sistem, atama bildirimini ilgili kişiye iletir.',
    },
    {
      step: 3,
      title: 'Teknik İnceleme',
      description: 'Doğrulayıcı hesaplamayı, kullanılan parametreleri ve sonuçları inceler. Sorular veya düzeltme talepleri yorum alanına girilir.',
    },
    {
      step: 4,
      title: 'Onay veya Red Kararı',
      description: 'Doğrulayıcı incelemeyi tamamladıktan sonra onay veya ret kararını gerekçesiyle birlikte sisteme kaydeder.',
    },
    {
      step: 5,
      title: 'Arşivleme',
      description: 'Onaylanan doğrulamalar sürüm numarasıyla birlikte arşive aktarılır ve Sürüm Sertifikası modülünde referans olarak kullanılabilir.',
    },
  ],

  parameters: [],
  example: null,
  resultGuidance: null,

  faq: [
    {
      question: 'Bir doğrulama talebi reddedilirse ne olur?',
      answer: 'Ret durumunda sistem, talebi hazırlayan mühendise bildirim gönderir. Mühendis gerekli düzeltmeleri yaparak talebi yeniden gönderebilir. Tüm revizyon geçmişi kayıt altında tutulur.',
    },
    {
      question: 'Birden fazla doğrulayıcı atanabilir mi?',
      answer: 'Evet, sistem ardışık veya paralel doğrulayıcı atamasını destekleyebilir. Yapılandırma sistem yöneticisi tarafından tanımlanır.',
    },
    {
      question: 'Doğrulama sürecinin tamamlanma süresi izlenebilir mi?',
      answer: 'Evet, her talebin açılış, inceleme başlangıcı ve kapatma tarihleri kayıt altındadır. Yöneticiler bekleyen talepleri ve süre aşımlarını pano üzerinden izleyebilir.',
    },
  ],

  academyLinks: [
    {
      title: 'Mühendislik Doğrulama ve Onay Süreçleri',
      description: 'Bağlantı tasarımı doğrulaması için en iyi uygulamalar ve iş akışı tasarımı rehberi.',
      available: false,
    },
  ],

  demoSteps: [],
  supportsExampleLoad: false,
  supportsDemoMode: false,
};
