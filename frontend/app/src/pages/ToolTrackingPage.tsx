// ── ToolTrackingPage.tsx ─────────────────────────────────────────────────────
// Native React page for Sıkıcı Takip (Tool Tracking).
// C2.8: live GET /api/tools + GET /api/tools/summary reads.
// C2.9: POST /api/tools, PATCH /api/tools/{id}, DELETE /api/tools/{id},
//        POST /api/tools/{id}/capability-studies mutations + role gating.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from 'react'
import { Wrench, BookOpen, X, Pencil, Trash2, PlusCircle } from 'lucide-react'
import ModuleGuideDrawer from '../components/guidance/ModuleGuideDrawer'
import { toolTrackingGuide } from '../guides/toolTrackingGuide'
import { fetchTools, fetchToolsSummary, createTool, updateTool, deactivateTool, createCapabilityStudy } from '../services/toolTrackingApi'
import { mapApiTool, OPERATIONAL_STATUS_OPTIONS } from '../types/toolTracking'
import type { ToolTrackingRecord, ToolStatus, ToolsSummary, ToolCreatePayload, ToolPatchPayload, CapabilityStudyCreatePayload } from '../types/toolTracking'
import { ApiError } from '../services/apiClient'
import { useAuth } from '../hooks/useAuth'

// ── Status badge styling ──────────────────────────────────────────────────────

const STATUS_STYLE: Record<ToolStatus, { pill: string; cm: string }> = {
  'OK':             { pill: 'bg-tp-success/15 text-tp-success border-tp-success/30',   cm: 'text-tp-success' },
  'KONTROL':        { pill: 'bg-tp-warn/15   text-tp-warn   border-tp-warn/30',        cm: 'text-tp-warn'    },
  'YETERSİZ':       { pill: 'bg-tp-danger/15 text-tp-danger border-tp-danger/30',      cm: 'text-tp-danger'  },
  'SÜRESİ DOLMUŞ':  { pill: 'bg-tp-danger/15 text-tp-danger border-tp-danger/30',      cm: 'text-tp-danger'  },
}

const STATUS_STYLE_FALLBACK = {
  pill: 'bg-tp-surface-2 text-tp-text-2 border-tp-border',
  cm:   'text-tp-text-2',
}

function getStatusStyle(status: string) {
  return STATUS_STYLE[status as ToolStatus] ?? STATUS_STYLE_FALLBACK
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

function parseApiError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.'
    if (err.status === 403) return 'Bu işlem için yetkiniz bulunmuyor.'
    if (err.status === 404) return 'Kayıt bulunamadı. Liste yenilenecek.'
    if (err.status === 409) return 'Bu sicil numarası zaten kayıtlı.'
    if (err.status === 400 || err.status === 422) return err.detail || 'Geçersiz veri. Lütfen alanları kontrol edin.'
    return 'İşlem başarısız. Lütfen tekrar deneyin.'
  }
  return 'Sunucuya bağlanılamadı. Ağ bağlantınızı kontrol edin.'
}

// ── Shared modal wrapper ──────────────────────────────────────────────────────

function Modal({ title, onClose, children }: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="absolute inset-0 z-50 flex items-start justify-center pt-16
                 bg-black/40 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-tp-surface border border-tp-border rounded-xl shadow-xl
                   w-full max-w-lg mx-4 mb-8"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-tp-border">
          <span className="text-[13px] font-semibold text-tp-text">{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="text-tp-text-3 hover:text-tp-text transition-colors"
          >
            <X size={15} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Field component ───────────────────────────────────────────────────────────

function Field({ label, required, children }: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-tp-text-2">
        {label}{required && <span className="text-tp-danger ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const inputCls = "w-full px-2.5 py-1.5 rounded border border-tp-border bg-tp-bg text-[12px] text-tp-text placeholder:text-tp-text-3 focus:outline-none focus:border-tp-accent focus:ring-1 focus:ring-tp-accent/30 transition-colors"
const selectCls = inputCls + " cursor-pointer"

// ── Error inline banner ───────────────────────────────────────────────────────

function InlineError({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded bg-tp-danger/10 border border-tp-danger/30 text-tp-danger text-[12px]">
      <span>⚠</span><span>{msg}</span>
    </div>
  )
}

// ── Submit button ─────────────────────────────────────────────────────────────

function SubmitBtn({ saving, label, savingLabel = 'Kaydediliyor…' }: {
  saving: boolean
  label: string
  savingLabel?: string
}) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-tp-accent text-white
                 text-[12px] font-medium hover:bg-tp-accent-2 transition-colors shadow-sm
                 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {saving && (
        <span className="inline-block w-3 h-3 rounded-full border-2
                         border-white border-t-transparent animate-spin" />
      )}
      {saving ? savingLabel : label}
    </button>
  )
}

// ── Create Tool Modal ─────────────────────────────────────────────────────────

function CreateToolModal({ onClose, onSuccess }: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState<{
    registration_id: string
    model: string
    operation: string
    nominal_torque_nm: string
    tool_class: string
    operational_status: string
    capability_due_at: string
    capability_interval_days: string
    notes: string
  }>({
    registration_id: '',
    model: '',
    operation: '',
    nominal_torque_nm: '',
    tool_class: '',
    operational_status: 'OK',
    capability_due_at: '',
    capability_interval_days: '',
    notes: '',
  })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const torque = parseFloat(form.nominal_torque_nm)
    if (isNaN(torque) || torque <= 0) { setErr('Nominal tork sıfırdan büyük olmalıdır.'); return }
    const interval = form.capability_interval_days.trim()
      ? parseInt(form.capability_interval_days, 10) : null
    if (interval !== null && (isNaN(interval) || interval <= 0)) {
      setErr('Yetenek aralığı sıfırdan büyük tam sayı olmalıdır.'); return
    }
    const payload: ToolCreatePayload = {
      registration_id: form.registration_id.trim(),
      model: form.model.trim(),
      operation: form.operation.trim(),
      nominal_torque_nm: torque,
      tool_class: form.tool_class.trim(),
      operational_status: form.operational_status as any,
      notes: form.notes.trim() || null,
      capability_due_at: form.capability_due_at.trim() || null,
      capability_interval_days: interval,
    }
    setSaving(true)
    try {
      await createTool(payload)
      onSuccess()
    } catch (e) {
      setErr(parseApiError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Yeni Sıkıcı Ekle" onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        {err && <InlineError msg={err} />}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Sicil No" required>
            <input className={inputCls} value={form.registration_id}
              onChange={e => set('registration_id', e.target.value)}
              placeholder="G278" required autoFocus />
          </Field>
          <Field label="Sınıf" required>
            <input className={inputCls} value={form.tool_class}
              onChange={e => set('tool_class', e.target.value)}
              placeholder="A / B / C" required />
          </Field>
        </div>

        <Field label="Model" required>
          <input className={inputCls} value={form.model}
            onChange={e => set('model', e.target.value)}
            placeholder="EXACT 12" required />
        </Field>

        <Field label="Operasyon" required>
          <input className={inputCls} value={form.operation}
            onChange={e => set('operation', e.target.value)}
            placeholder="M10 Sıkma" required />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nominal Tork (Nm)" required>
            <input className={inputCls} type="number" min="0.001" step="any"
              value={form.nominal_torque_nm}
              onChange={e => set('nominal_torque_nm', e.target.value)}
              placeholder="25" required />
          </Field>
          <Field label="Operasyonel Durum" required>
            <select className={selectCls} value={form.operational_status}
              onChange={e => set('operational_status', e.target.value)}>
              {OPERATIONAL_STATUS_OPTIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Yetenek Bitiş (ISO tarih)">
            <input className={inputCls} value={form.capability_due_at}
              onChange={e => set('capability_due_at', e.target.value)}
              placeholder="2026-12-31T00:00:00Z" />
          </Field>
          <Field label="Yetenek Aralığı (gün)">
            <input className={inputCls} type="number" min="1" step="1"
              value={form.capability_interval_days}
              onChange={e => set('capability_interval_days', e.target.value)}
              placeholder="365" />
          </Field>
        </div>

        <Field label="Notlar">
          <textarea className={inputCls + ' resize-none'} rows={2}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="İsteğe bağlı not" />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 rounded bg-tp-surface-2 border border-tp-border
                       text-tp-text-2 text-[12px] hover:bg-tp-surface-3 transition-colors">
            İptal
          </button>
          <SubmitBtn saving={saving} label="Kaydet" />
        </div>
      </form>
    </Modal>
  )
}

// ── Edit Tool Modal ───────────────────────────────────────────────────────────

function EditToolModal({ tool, onClose, onSuccess }: {
  tool: ToolTrackingRecord
  onClose: () => void
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [form, setForm] = useState({
    model: tool.model,
    operation: tool.operation,
    nominal_torque_nm: String(tool.nominalTorqueNm),
    tool_class: tool.toolClass,
    operational_status: tool.operationalStatus,
    capability_due_at: tool.capabilityDueAt ?? '',
    capability_interval_days: tool.capabilityIntervalDays != null ? String(tool.capabilityIntervalDays) : '',
    notes: tool.notes ?? '',
  })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const torque = parseFloat(form.nominal_torque_nm)
    if (isNaN(torque) || torque <= 0) { setErr('Nominal tork sıfırdan büyük olmalıdır.'); return }
    const interval = form.capability_interval_days.trim()
      ? parseInt(form.capability_interval_days, 10) : null
    if (interval !== null && (isNaN(interval) || interval <= 0)) {
      setErr('Yetenek aralığı sıfırdan büyük tam sayı olmalıdır.'); return
    }
    const payload: ToolPatchPayload = {
      model: form.model.trim() || undefined,
      operation: form.operation.trim() || undefined,
      nominal_torque_nm: torque,
      tool_class: form.tool_class.trim() || undefined,
      operational_status: form.operational_status as any,
      notes: form.notes.trim() || null,
      capability_due_at: form.capability_due_at.trim() || null,
      capability_interval_days: interval,
    }
    setSaving(true)
    try {
      await updateTool(Number(tool.id), payload)
      onSuccess()
    } catch (e) {
      setErr(parseApiError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Sıkıcı Düzenle — ${tool.registrationId}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        {err && <InlineError msg={err} />}

        <Field label="Model" required>
          <input className={inputCls} value={form.model}
            onChange={e => set('model', e.target.value)} required autoFocus />
        </Field>

        <Field label="Operasyon" required>
          <input className={inputCls} value={form.operation}
            onChange={e => set('operation', e.target.value)} required />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Nominal Tork (Nm)" required>
            <input className={inputCls} type="number" min="0.001" step="any"
              value={form.nominal_torque_nm}
              onChange={e => set('nominal_torque_nm', e.target.value)} required />
          </Field>
          <Field label="Sınıf" required>
            <input className={inputCls} value={form.tool_class}
              onChange={e => set('tool_class', e.target.value)} required />
          </Field>
        </div>

        <Field label="Operasyonel Durum" required>
          <select className={selectCls} value={form.operational_status}
            onChange={e => set('operational_status', e.target.value)}>
            {OPERATIONAL_STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Yetenek Bitiş (ISO tarih)">
            <input className={inputCls} value={form.capability_due_at}
              onChange={e => set('capability_due_at', e.target.value)}
              placeholder="2026-12-31T00:00:00Z" />
          </Field>
          <Field label="Yetenek Aralığı (gün)">
            <input className={inputCls} type="number" min="1" step="1"
              value={form.capability_interval_days}
              onChange={e => set('capability_interval_days', e.target.value)} />
          </Field>
        </div>

        <Field label="Notlar">
          <textarea className={inputCls + ' resize-none'} rows={2}
            value={form.notes}
            onChange={e => set('notes', e.target.value)} />
        </Field>

        <div className="pt-1 pb-1 border-t border-tp-border/50">
          <p className="text-[11px] text-tp-text-3">
            Sicil no değiştirilemez. Pasife alma yalnızca admin yetkisiyle yapılır.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-0.5">
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 rounded bg-tp-surface-2 border border-tp-border
                       text-tp-text-2 text-[12px] hover:bg-tp-surface-3 transition-colors">
            İptal
          </button>
          <SubmitBtn saving={saving} label="Güncelle" />
        </div>
      </form>
    </Modal>
  )
}

// ── Deactivate Confirm Modal ──────────────────────────────────────────────────

function DeactivateModal({ tool, onClose, onSuccess }: {
  tool: ToolTrackingRecord
  onClose: () => void
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  async function handleConfirm() {
    setErr(null)
    setSaving(true)
    try {
      await deactivateTool(Number(tool.id))
      onSuccess()
    } catch (e) {
      setErr(parseApiError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Sıkıcıyı Pasife Al" onClose={onClose}>
      <div className="flex flex-col gap-4 p-5">
        {err && <InlineError msg={err} />}

        <p className="text-[13px] text-tp-text leading-relaxed">
          <span className="font-semibold">{tool.registrationId}</span> — {tool.model} kaydı pasife alınacaktır.
        </p>

        <ul className="text-[12px] text-tp-text-2 space-y-1 pl-4 list-disc">
          <li>Kayıt pasif hale gelir ve aktif listeden çıkar.</li>
          <li>Tüm yetenek çalışması geçmişi korunur.</li>
          <li>Bu işlem fiziksel silme değildir.</li>
        </ul>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 rounded bg-tp-surface-2 border border-tp-border
                       text-tp-text-2 text-[12px] hover:bg-tp-surface-3 transition-colors">
            İptal
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded bg-tp-danger text-white
                       text-[12px] font-medium hover:bg-tp-danger/80 transition-colors shadow-sm
                       disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving && (
              <span className="inline-block w-3 h-3 rounded-full border-2
                               border-white border-t-transparent animate-spin" />
            )}
            {saving ? 'Pasife alınıyor…' : 'Pasife Al'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ── Capability Study Modal ────────────────────────────────────────────────────

function CapabilityStudyModal({ tool, onClose, onSuccess }: {
  tool: ToolTrackingRecord
  onClose: () => void
  onSuccess: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const today = new Date().toISOString().slice(0, 10) + 'T00:00:00Z'
  const [form, setForm] = useState({
    analysis_type: '',
    cm: '', cmk: '', cp: '', cpk: '',
    lsl: '', usl: '',
    sample_count: '',
    method: '',
    source: '',
    study_date: today,
  })

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }
  function num(s: string): number | null {
    const v = s.trim(); return v === '' ? null : parseFloat(v)
  }
  function numInt(s: string): number | null {
    const v = s.trim(); return v === '' ? null : parseInt(v, 10)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    const cm = num(form.cm), cmk = num(form.cmk)
    const cp = num(form.cp), cpk = num(form.cpk)
    if ([cm, cmk, cp, cpk].every(v => v === null)) {
      setErr('En az bir yetenek değeri (Cm, Cmk, Cp veya Cpk) girilmelidir.')
      return
    }
    const sc = numInt(form.sample_count)
    if (sc !== null && sc <= 0) { setErr('Örnek sayısı sıfırdan büyük olmalıdır.'); return }
    const payload: CapabilityStudyCreatePayload = {
      analysis_type: form.analysis_type.trim(),
      cm, cmk, cp, cpk,
      lsl: num(form.lsl),
      usl: num(form.usl),
      sample_count: sc,
      method: form.method.trim() || null,
      source: form.source.trim() || null,
      study_date: form.study_date.trim(),
    }
    setSaving(true)
    try {
      await createCapabilityStudy(Number(tool.id), payload)
      onSuccess()
    } catch (e) {
      setErr(parseApiError(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={`Yetenek Çalışması Ekle — ${tool.registrationId}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-5">
        {err && <InlineError msg={err} />}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Analiz Türü" required>
            <input className={inputCls} value={form.analysis_type}
              onChange={e => set('analysis_type', e.target.value)}
              placeholder="Cm/Cmk" required autoFocus />
          </Field>
          <Field label="Çalışma Tarihi (ISO)" required>
            <input className={inputCls} value={form.study_date}
              onChange={e => set('study_date', e.target.value)} required />
          </Field>
        </div>

        <p className="text-[11px] text-tp-text-3">
          En az bir yetenek değeri zorunludur.
        </p>

        <div className="grid grid-cols-4 gap-2">
          {[['Cm', 'cm'], ['Cmk', 'cmk'], ['Cp', 'cp'], ['Cpk', 'cpk']].map(([label, key]) => (
            <Field key={key} label={label}>
              <input className={inputCls} type="number" step="any"
                value={(form as any)[key]}
                onChange={e => set(key, e.target.value)}
                placeholder="—" />
            </Field>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Field label="LSL">
            <input className={inputCls} type="number" step="any"
              value={form.lsl} onChange={e => set('lsl', e.target.value)} placeholder="—" />
          </Field>
          <Field label="USL">
            <input className={inputCls} type="number" step="any"
              value={form.usl} onChange={e => set('usl', e.target.value)} placeholder="—" />
          </Field>
          <Field label="Örnek Sayısı">
            <input className={inputCls} type="number" min="1" step="1"
              value={form.sample_count} onChange={e => set('sample_count', e.target.value)} placeholder="—" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Yöntem">
            <input className={inputCls} value={form.method}
              onChange={e => set('method', e.target.value)} placeholder="Manuel / Yazılım" />
          </Field>
          <Field label="Kaynak">
            <input className={inputCls} value={form.source}
              onChange={e => set('source', e.target.value)} placeholder="Ölçüm raporu" />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 rounded bg-tp-surface-2 border border-tp-border
                       text-tp-text-2 text-[12px] hover:bg-tp-surface-3 transition-colors">
            İptal
          </button>
          <SubmitBtn saving={saving} label="Ekle" savingLabel="Ekleniyor…" />
        </div>
      </form>
    </Modal>
  )
}

// ── Main Page Component ───────────────────────────────────────────────────────

type ActiveModal =
  | { kind: 'create' }
  | { kind: 'edit'; tool: ToolTrackingRecord }
  | { kind: 'deactivate'; tool: ToolTrackingRecord }
  | { kind: 'study'; tool: ToolTrackingRecord }
  | null

export default function ToolTrackingPage() {
  const { role } = useAuth()
  const canMutate = role === 'engineer' || role === 'admin'
  const canDelete = role === 'admin'

  const [guideOpen, setGuideOpen] = useState(false)
  const [modal, setModal] = useState<ActiveModal>(null)

  const [tools,   setTools]   = useState<ToolTrackingRecord[]>([])
  const [summary, setSummary] = useState<ToolsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  const loadData = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([fetchTools(), fetchToolsSummary()])
      .then(([toolsRes, summaryRes]) => {
        setTools(toolsRes.items.map(mapApiTool))
        setSummary(summaryRes)
      })
      .catch((err: unknown) => {
        if (err instanceof ApiError) {
          if (err.status === 401) setError('Oturum süreniz dolmuş olabilir. Lütfen tekrar giriş yapın.')
          else if (err.status === 403) setError('Bu sayfayı görüntüleme yetkiniz bulunmuyor.')
          else setError('Takım verileri yüklenemedi. Lütfen tekrar deneyin.')
        } else {
          setError('Sunucuya bağlanılamadı. Ağ bağlantınızı kontrol edin.')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function onMutationSuccess() {
    setModal(null)
    loadData()
  }

  const totalTools   = summary?.total    ?? tools.length
  const countOk      = summary?.by_operational_status?.['OK']       ?? tools.filter(t => t.status === 'OK').length
  const countKontrol = summary?.by_operational_status?.['KONTROL']  ?? tools.filter(t => t.status === 'KONTROL').length
  const countNok     = summary?.by_operational_status?.['YETERSİZ'] ?? tools.filter(t => t.status === 'YETERSİZ').length
  const expiredCount = summary?.expired_count ?? 0

  return (
    <div
      className="flex flex-col flex-1 overflow-hidden relative"
      style={guideOpen ? { paddingRight: 460 } : undefined}
    >
      <ModuleGuideDrawer
        guide={toolTrackingGuide}
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
      />

      {/* ── Scrollable content ───────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 overflow-y-auto px-6 py-5 gap-4">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg
                            bg-tp-surface-2 border border-tp-border text-tp-accent shrink-0">
              <Wrench size={18} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[15px] font-semibold text-tp-text leading-tight">
                Sıkıcı Takip
              </h1>
              <p className="text-[12px] text-tp-text-3 mt-0.5">
                Takım envanteri ve yetenek durum gösterimi
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!guideOpen && (
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full
                           bg-tp-surface-2 border border-tp-border
                           text-tp-text-2 text-[12px] font-medium
                           hover:bg-tp-surface-3 hover:border-tp-border-2 hover:text-tp-text
                           transition-colors shadow-sm"
              >
                <BookOpen size={13} className="text-tp-accent" />
                Modül Rehberi
              </button>
            )}

            {/* + Yeni Ekle — hidden for viewer */}
            {canMutate && (
              <button
                type="button"
                onClick={() => setModal({ kind: 'create' })}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded
                           bg-tp-accent text-white text-[12px] font-medium
                           hover:bg-tp-accent-2 transition-colors shadow-sm"
              >
                + Yeni Ekle
              </button>
            )}
          </div>
        </div>

        {/* ── Summary chips ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Toplam',         value: totalTools,   color: 'text-tp-text-2'   },
            { label: 'OK',             value: countOk,      color: 'text-tp-success'  },
            { label: 'Kontrol',        value: countKontrol, color: 'text-tp-warn'     },
            { label: 'Yetersiz',       value: countNok,     color: 'text-tp-danger'   },
            { label: 'Süresi Dolmuş',  value: expiredCount, color: 'text-tp-danger'   },
          ].map(chip => (
            <div
              key={chip.label}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full
                         bg-tp-surface-2 border border-tp-border text-[11px]"
            >
              <span className="text-tp-text-3">{chip.label}</span>
              <span className={`font-semibold ${chip.color}`}>{chip.value}</span>
            </div>
          ))}
        </div>

        {/* ── Expired banner — conditional ───────────────────────────────── */}
        {expiredCount > 0 && !loading && !error && (
          <div className="flex items-center gap-2 px-3 py-2 rounded
                          bg-tp-warn/10 border border-tp-warn/30
                          text-tp-warn text-[12px]">
            <span>⚠</span>
            <span>Yetenek çalışması süresi dolmuş sıkıcı kayıtları bulunmaktadır.</span>
          </div>
        )}

        {/* ── Loading ────────────────────────────────────────────────────── */}
        {loading && (
          <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-tp-text-3">
            <span className="inline-block w-3.5 h-3.5 rounded-full border-2
                             border-tp-accent border-t-transparent animate-spin" />
            Takım verileri yükleniyor…
          </div>
        )}

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {!loading && error && <InlineError msg={error} />}

        {/* ── Inventory table ────────────────────────────────────────────── */}
        {!loading && !error && (
          <div className="card overflow-x-auto">
            <div className="px-4 pt-4 pb-2">
              <span className="text-[13px] font-semibold text-tp-text">Sıkıcı Envanteri</span>
            </div>

            {tools.length === 0 ? (
              <div className="px-4 pb-4 text-[12px] text-tp-text-3">
                Kayıtlı sıkıcı bulunmuyor.
              </div>
            ) : (
              <table className="w-full text-[12px] border-collapse">
                <thead>
                  <tr className="border-b border-tp-border bg-tp-surface-2">
                    {['Sicil', 'Model', 'Operasyon', 'Nom.(Nm)', 'Sınıf', 'Cm/Cmk', 'Son Yetenek', 'Durum', ''].map(h => (
                      <th
                        key={h}
                        className="px-4 py-2.5 text-left text-[11px] font-medium
                                   text-tp-text-3 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tools.map((tool, i) => {
                    const style = getStatusStyle(tool.status)
                    return (
                      <tr
                        key={tool.id}
                        className={[
                          'border-b border-tp-border/50 transition-colors',
                          i % 2 === 0 ? 'bg-tp-bg' : 'bg-tp-surface',
                          'hover:bg-tp-surface-2 cursor-default',
                        ].join(' ')}
                      >
                        <td className="px-4 py-2.5 font-mono font-medium text-tp-text">
                          {tool.registrationId}
                        </td>
                        <td className="px-4 py-2.5 text-tp-text whitespace-nowrap">
                          {tool.model}
                        </td>
                        <td className="px-4 py-2.5 text-tp-text-2">
                          {tool.operation}
                        </td>
                        <td className="px-4 py-2.5 text-tp-text text-right tabular-nums">
                          {tool.nominalTorqueNm}
                        </td>
                        <td className="px-4 py-2.5 text-tp-text-2 text-center">
                          {tool.toolClass}
                        </td>
                        <td className={`px-4 py-2.5 font-mono tabular-nums ${style.cm}`}>
                          {tool.cm !== null && tool.cmk !== null
                            ? `${tool.cm.toFixed(2)}/${tool.cmk.toFixed(2)}`
                            : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-tp-text-2 whitespace-nowrap tabular-nums">
                          {tool.lastCapabilityDate ? formatDate(tool.lastCapabilityDate) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={[
                              'inline-flex items-center px-2 py-0.5 rounded-full',
                              'border text-[10px] font-semibold whitespace-nowrap',
                              style.pill,
                            ].join(' ')}
                          >
                            {tool.status}
                          </span>
                        </td>
                        {/* ── Row action buttons ─────────────────────────── */}
                        <td className="px-3 py-2.5">
                          {canMutate && (
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                title="Yetenek Çalışması Ekle"
                                onClick={() => setModal({ kind: 'study', tool })}
                                className="p-1 rounded text-tp-text-3 hover:text-tp-accent
                                           hover:bg-tp-surface-3 transition-colors"
                              >
                                <PlusCircle size={13} />
                              </button>
                              <button
                                type="button"
                                title="Düzenle"
                                onClick={() => setModal({ kind: 'edit', tool })}
                                className="p-1 rounded text-tp-text-3 hover:text-tp-accent
                                           hover:bg-tp-surface-3 transition-colors"
                              >
                                <Pencil size={13} />
                              </button>
                              {canDelete && (
                                <button
                                  type="button"
                                  title="Pasife Al"
                                  onClick={() => setModal({ kind: 'deactivate', tool })}
                                  className="p-1 rounded text-tp-text-3 hover:text-tp-danger
                                             hover:bg-tp-danger/10 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>{/* end scrollable */}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {modal?.kind === 'create' && (
        <CreateToolModal
          onClose={() => setModal(null)}
          onSuccess={onMutationSuccess}
        />
      )}
      {modal?.kind === 'edit' && (
        <EditToolModal
          tool={modal.tool}
          onClose={() => setModal(null)}
          onSuccess={onMutationSuccess}
        />
      )}
      {modal?.kind === 'deactivate' && (
        <DeactivateModal
          tool={modal.tool}
          onClose={() => setModal(null)}
          onSuccess={onMutationSuccess}
        />
      )}
      {modal?.kind === 'study' && (
        <CapabilityStudyModal
          tool={modal.tool}
          onClose={() => setModal(null)}
          onSuccess={onMutationSuccess}
        />
      )}
    </div>
  )
}
