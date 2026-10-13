// ── TorqPro AI — React shell translations ────────────────────────────────────
// Scope: shell, navigation, and customer-demo-required React surfaces.
// Legacy iframe pages are Turkish-only and handled by legacy/index.html.
// Engineering terminology follows HARD RULE 08 — do not alter.

export const tr: Record<string, string> = {
  // ── Shell / header ────────────────────────────────────────────────────────
  'shell.logout':           'Çıkış',
  'shell.language_label':   'Dil seçici',

  // ── Sidebar controls ──────────────────────────────────────────────────────
  'shell.pinned':           'Sabitlendi',
  'shell.unpinned':         'Sabit değil',
  'shell.pin_title':        'Sabitlemeyi kaldır',
  'shell.unpin_title':      'Sabitle',
  'shell.collapse':         'Daralt',
  'shell.expand':           'Genişlet',

  // ── Navigation groups ─────────────────────────────────────────────────────
  'nav.dashboard':          'Dashboard',
  'nav.home':               'Ana Sayfa',
  'nav.calculation':        'Hesaplama',
  'nav.validation':         'Doğrulama',
  'nav.production':         'Üretim',
  'nav.knowledge':          'Bilgi',
  'nav.traceability':       'İzlenebilirlik',
  'nav.data':               'Veri',
  'nav.system':             'Sistem',

  // ── Navigation items ──────────────────────────────────────────────────────
  'nav.item.torque':        'Tork Hesap',
  'nav.item.n01391':        'OEM Tork Öngörüsü',
  'nav.item.vdi':           'Gelişmiş Analiz',
  'nav.item.checklist':     'Check-List',
  'nav.item.yetenek':       'Cm/Cmk Yetenek',
  'nav.item.validation':    'Teknik Doğrulama',
  'nav.item.sikici':        'Sıkıcı Takip',
  'nav.item.problem':       'Problem Yönetimi',
  'nav.item.oem':           'OEM Norm Sorgu',
  'nav.item.norm':          'Norm Rehberi',
  'nav.item.fmea':          'FMEA Kataloğu',
  'nav.item.rapor':         'Rapor Üret',
  'nav.item.arsiv':         'Arşiv',
  'nav.item.calibration':   'Kalibrasyon',
  'nav.item.qualitygate':   'Veri Kalite Kapısı',
  'nav.item.goldencases':   'Altın Senaryolar',
  'nav.item.releasecert':   'Sürüm Sertifikası',
  'nav.item.versions':      'Veri Sürümleri',
  'nav.item.dataadmin':     'Veri Yükleme & Onay',
  'nav.item.admin':         'Yönetici Paneli',

  // ── Dashboard page ────────────────────────────────────────────────────────
  'dash.title':             'Dashboard',
  'dash.api_status':        'API Durumu',
  'dash.version':           'Sürüm',
  'dash.database':          'Veritabanı',
  'dash.db_connected':      'Bağlı',
  'dash.db_error':          'Hata',
  'dash.server_time':       'Sunucu Zamanı',
  'dash.quick_access':      'Hızlı Erişim',
  'dash.quick_access_sub':  'Sık kullanılan mühendislik araçları',
  'dash.quick_access_text': 'Tork Hesap, OEM Öngörüsü, Kalibrasyon ve daha fazlası soldaki menüden erişilebilir.',

  // ── Torque Calculation page ───────────────────────────────────────────────
  'torque.title':           'Tork Hesap',
  'torque.subtitle':        'Mühendislik Kontrolü',
  'torque.guide':           'Modül Rehberi',
  'torque.guide_open':      'Modül rehberini aç',

  'torque.geometry':        'Geometri',
  'torque.diameter':        'Çap (d)',
  'torque.pitch':           'Adım (P)',
  'torque.stress_area':     'As',
  'torque.bearing_diam':    'Dw',

  'torque.friction':        'Sürtünme (μ)',
  'torque.thread_min':      'Diş min',
  'torque.thread_nom':      'Diş nom',
  'torque.thread_max':      'Diş max',
  'torque.bearing_min':     'Oturma Yüzeyi μ min',
  'torque.bearing_nom':     'Oturma Yüzeyi μ nom',
  'torque.bearing_max':     'Oturma Yüzeyi μ max',

  'torque.target':          'Hedef',
  'torque.yield_ratio':     'Akma kullanım oranı',
  'torque.rp02':            'Rp0.2',

  'torque.advanced_show':   'Gelişmiş parametreler',
  'torque.advanced_hide':   'Gelişmiş parametreleri gizle',
  'torque.material':        'Malzeme Dayanımı',
  'torque.bolt_rm':         'Civata Rm',
  'torque.nut_proof':       'Somun Proof',
  'torque.internal_rm':     'İç Malzeme Rm',
  'torque.engagement':      'Diş Kavrama',
  'torque.engagement_len':  'Kavrama uzunluğu (le)',

  'torque.calculate':       'Hesapla',
  'torque.calculating':     'Hesaplanıyor…',

  'torque.result_title':    'Önerilen Sıkma Torku',
  'torque.preload':         'Ön Yük (Fv)',
  'torque.nut_util':        'Somun kullanım',
  'torque.computed':        'Hesaplanan',
  'torque.thread_sf_int':   'Diş SF (iç)',
  'torque.thread_sf_ext':   'Diş SF (dış)',
  'torque.empty':           'Hesap sonuçları burada görünecek',
  'torque.footer':          'Deterministik hesap · VDI 2230 tabanlı · Backend yetkili',

  // ── Context visual titles (GEOMETRY-CONTEXT-01) ───────────────────────────
  'ctx.neutral':            'Bağlantı Diyagramı',
  'ctx.diameter_d':         'Çap (d)',
  'ctx.pitch_p':            'Adım (P)',
  'ctx.stress_area_as':     'As',
  'ctx.bearing_diameter_dw':'Dw',
  'ctx.thread_friction':    'Diş Sürtünmesi',
  'ctx.bearing_friction':   'Oturma Yüzeyi Sürtünmesi',
  'ctx.yield_utilization':  'Akma Kullanım Oranı',
  'ctx.rp02':               'Rp0.2',

  // Context visual subtitles
  'ctx.sub.diameter_d':           'Cıvata nominal çapı',
  'ctx.sub.pitch_p':              'Diş adımı',
  'ctx.sub.stress_area_as':       'Çekme gerilme alanı',
  'ctx.sub.bearing_diameter_dw':  'Etkin oturma çapı',
  'ctx.sub.thread_friction':      'Diş temas yüzeyi',
  'ctx.sub.bearing_friction':     'Baş/somun altı temas yüzeyi',
  'ctx.sub.yield_utilization':    'Hedef akma oranı',
  'ctx.sub.rp02':                 'Akma dayanımı (malzeme)',
}

export const en: Record<string, string> = {
  // ── Shell / header ────────────────────────────────────────────────────────
  'shell.logout':           'Logout',
  'shell.language_label':   'Language selector',

  // ── Sidebar controls ──────────────────────────────────────────────────────
  'shell.pinned':           'Pinned',
  'shell.unpinned':         'Unpinned',
  'shell.pin_title':        'Unpin sidebar',
  'shell.unpin_title':      'Pin sidebar',
  'shell.collapse':         'Collapse',
  'shell.expand':           'Expand',

  // ── Navigation groups ─────────────────────────────────────────────────────
  'nav.dashboard':          'Dashboard',
  'nav.home':               'Home',
  'nav.calculation':        'Calculation',
  'nav.validation':         'Validation',
  'nav.production':         'Production',
  'nav.knowledge':          'Information',
  'nav.traceability':       'Traceability',
  'nav.data':               'Data',
  'nav.system':             'System',

  // ── Navigation items ──────────────────────────────────────────────────────
  'nav.item.torque':        'Torque Calculation',
  'nav.item.n01391':        'OEM Torque Prediction',
  'nav.item.vdi':           'Advanced Analysis',
  'nav.item.checklist':     'Check-List',
  'nav.item.yetenek':       'Cm/Cmk Capability',
  'nav.item.validation':    'Technical Validation',
  'nav.item.sikici':        'Tool Tracking',
  'nav.item.problem':       'Problem Management',
  'nav.item.oem':           'OEM Norm Query',
  'nav.item.norm':          'Norm Guide',
  'nav.item.fmea':          'FMEA Catalog',
  'nav.item.rapor':         'Report',
  'nav.item.arsiv':         'Archive',
  'nav.item.calibration':   'Calibration',
  'nav.item.qualitygate':   'Data Quality Gate',
  'nav.item.goldencases':   'Golden Cases',
  'nav.item.releasecert':   'Release Certificate',
  'nav.item.versions':      'Data Versions',
  'nav.item.dataadmin':     'Data Upload & Approval',
  'nav.item.admin':         'Admin Panel',

  // ── Dashboard page ────────────────────────────────────────────────────────
  'dash.title':             'Dashboard',
  'dash.api_status':        'API Status',
  'dash.version':           'Version',
  'dash.database':          'Database',
  'dash.db_connected':      'Connected',
  'dash.db_error':          'Error',
  'dash.server_time':       'Server Time',
  'dash.quick_access':      'Quick Access',
  'dash.quick_access_sub':  'Frequently used engineering tools',
  'dash.quick_access_text': 'Torque Calculation, OEM Prediction, Calibration and more are accessible from the left menu.',

  // ── Torque Calculation page ───────────────────────────────────────────────
  'torque.title':           'Torque Calculation',
  'torque.subtitle':        'Engineering Control',
  'torque.guide':           'Module Guide',
  'torque.guide_open':      'Open module guide',

  'torque.geometry':        'Geometry',
  'torque.diameter':        'Diameter (d)',
  'torque.pitch':           'Pitch (P)',
  'torque.stress_area':     'As',
  'torque.bearing_diam':    'Dw',

  'torque.friction':        'Friction (μ)',
  'torque.thread_min':      'Thread min',
  'torque.thread_nom':      'Thread nom',
  'torque.thread_max':      'Thread max',
  'torque.bearing_min':     'Bearing Surface μ min',
  'torque.bearing_nom':     'Bearing Surface μ nom',
  'torque.bearing_max':     'Bearing Surface μ max',

  'torque.target':          'Target',
  'torque.yield_ratio':     'Yield Utilization',
  'torque.rp02':            'Rp0.2',

  'torque.advanced_show':   'Advanced Parameters',
  'torque.advanced_hide':   'Hide Advanced Parameters',
  'torque.material':        'Material Strength',
  'torque.bolt_rm':         'Bolt Rm',
  'torque.nut_proof':       'Nut Proof',
  'torque.internal_rm':     'Internal Material Rm',
  'torque.engagement':      'Thread Engagement',
  'torque.engagement_len':  'Engagement Length (le)',

  'torque.calculate':       'Calculate',
  'torque.calculating':     'Calculating…',

  'torque.result_title':    'Recommended Tightening Torque',
  'torque.preload':         'Preload (Fv)',
  'torque.nut_util':        'Nut Utilization',
  'torque.computed':        'Computed',
  'torque.thread_sf_int':   'Thread SF (int)',
  'torque.thread_sf_ext':   'Thread SF (ext)',
  'torque.empty':           'Calculation results will appear here',
  'torque.footer':          'Deterministic calculation · VDI 2230 based · Backend authoritative',

  // ── Context visual titles (GEOMETRY-CONTEXT-01) ───────────────────────────
  'ctx.neutral':            'Joint Diagram',
  'ctx.diameter_d':         'Diameter (d)',
  'ctx.pitch_p':            'Pitch (P)',
  'ctx.stress_area_as':     'As',
  'ctx.bearing_diameter_dw':'Dw',
  'ctx.thread_friction':    'Thread Friction',
  'ctx.bearing_friction':   'Bearing Surface Friction',
  'ctx.yield_utilization':  'Yield Utilization',
  'ctx.rp02':               'Rp0.2',

  // Context visual subtitles
  'ctx.sub.diameter_d':           'Bolt nominal diameter',
  'ctx.sub.pitch_p':              'Thread pitch',
  'ctx.sub.stress_area_as':       'Tensile stress area',
  'ctx.sub.bearing_diameter_dw':  'Effective bearing diameter',
  'ctx.sub.thread_friction':      'Thread contact surface',
  'ctx.sub.bearing_friction':     'Under-head/nut bearing surface',
  'ctx.sub.yield_utilization':    'Target yield ratio',
  'ctx.sub.rp02':                 'Yield strength (material)',
}
