import { useEffect, useMemo, useRef, useState } from 'react'
import SEO from '../components/SEO'
import Breadcrumbs from '../components/Breadcrumbs'
import Icon from '../components/Icon'
import {
  TRIM_SIZES,
  PAPER_TYPES,
  MIN_PAGE_COUNT,
  MAX_PAGE_COUNT,
  MIN_PAGES_FOR_SPINE_TEXT,
  computeWrapDimensions,
  type PaperType,
} from '../data/kdpCover'
import {
  defaultCoverState,
  drawCover,
  loadImage,
  upscaleDataUrl,
  type CoverState,
  type ImageFit,
  type ImageLayer,
  type TextAlign,
  type TextLayer,
} from '../lib/kdpCoverRender'

const PREVIEW_DPI = 110
const EXPORT_DPI = 300
const TARGET_DPI = 300

type PanelTab = 'setup' | 'front' | 'spine' | 'back' | 'preflight'
type ImageKey = 'unified' | 'front' | 'back'

interface PreflightCheck {
  id: string
  label: string
  detail: string
  status: 'pass' | 'warning'
  fixImageKey?: ImageKey
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export default function KdpCoverMaker() {
  const [state, setState] = useState<CoverState>(defaultCoverState)
  const [tab, setTab] = useState<PanelTab>('setup')
  const [showGuides, setShowGuides] = useState(true)
  const [exporting, setExporting] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imagesRef = useRef<{ unified?: HTMLImageElement; front?: HTMLImageElement; back?: HTMLImageElement }>({})
  const [imgVersion, setImgVersion] = useState(0)

  const dims = useMemo(() => computeWrapDimensions(state.trimKey, state.pageCount, state.paperType), [state.trimKey, state.pageCount, state.paperType])

  function update(patch: Partial<CoverState>) {
    setState((s) => ({ ...s, ...patch }))
  }
  function updateText(key: 'title' | 'subtitle' | 'author' | 'blurb', patch: Partial<TextLayer>) {
    setState((s) => ({ ...s, [key]: { ...s[key], ...patch } }))
  }
  function updateImage(key: 'unified' | 'front' | 'back', patch: Partial<ImageLayer>) {
    setState((s) => ({ ...s, [key]: { ...s[key], ...patch } }))
  }

  const [enhancingKey, setEnhancingKey] = useState<ImageKey | null>(null)
  const [enhanceError, setEnhanceError] = useState<{ key: ImageKey; message: string } | null>(null)

  function panelWidthInFor(key: ImageKey) {
    return key === 'unified' ? dims.wrapW : dims.trimW
  }

  function effectiveDpiFor(key: ImageKey): number | null {
    const img = imagesRef.current[key]
    if (!img) return null
    return img.naturalWidth / panelWidthInFor(key)
  }

  async function enhanceImage(key: ImageKey) {
    const layer = state[key]
    const currentDpi = effectiveDpiFor(key)
    if (!layer.src || currentDpi === null || currentDpi >= TARGET_DPI) return
    setEnhancingKey(key)
    setEnhanceError(null)
    try {
      const scale = TARGET_DPI / currentDpi
      const upscaled = await upscaleDataUrl(layer.src, scale)
      updateImage(key, { src: upscaled.dataUrl })
    } catch (err) {
      console.error('Increase DPI failed', err)
      setEnhanceError({ key, message: err instanceof Error ? err.message : 'Could not increase DPI for this image.' })
    } finally {
      setEnhancingKey(null)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      const next: typeof imagesRef.current = {}
      if (state.unified.src) next.unified = await loadImage(state.unified.src)
      if (state.front.src) next.front = await loadImage(state.front.src)
      if (state.back.src) next.back = await loadImage(state.back.src)
      if (!cancelled) {
        imagesRef.current = next
        setImgVersion((v) => v + 1)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [state.unified.src, state.front.src, state.back.src])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    drawCover(canvas, state, { dpi: PREVIEW_DPI, includeGuides: showGuides, images: imagesRef.current })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, showGuides, imgVersion])

  const preflight = useMemo<PreflightCheck[]>(() => {
    const checks: PreflightCheck[] = []

    checks.push(
      state.pageCount >= MIN_PAGE_COUNT && state.pageCount <= MAX_PAGE_COUNT
        ? { id: 'pages', label: 'Page count', detail: `${state.pageCount} pages is within KDP's printable range.`, status: 'pass' }
        : { id: 'pages', label: 'Page count', detail: `KDP paperbacks must be between ${MIN_PAGE_COUNT} and ${MAX_PAGE_COUNT} pages.`, status: 'warning' },
    )

    checks.push(
      dims.spineW >= 0.06
        ? { id: 'spine-width', label: 'Spine width', detail: `Spine is ${dims.spineW.toFixed(3)} in — wide enough to print.`, status: 'pass' }
        : { id: 'spine-width', label: 'Spine width', detail: `Spine is only ${dims.spineW.toFixed(3)} in. Increase page count for a printable spine.`, status: 'warning' },
    )

    if (state.showSpineText) {
      checks.push(
        state.pageCount >= MIN_PAGES_FOR_SPINE_TEXT
          ? { id: 'spine-text', label: 'Spine text', detail: 'Spine is wide enough for readable spine text.', status: 'pass' }
          : {
              id: 'spine-text',
              label: 'Spine text',
              detail: `KDP recommends spine text only above ~${MIN_PAGES_FOR_SPINE_TEXT} pages. Consider hiding spine text.`,
              status: 'warning',
            },
      )
    }

    const edgeCheck = (layer: TextLayer, name: string) => {
      if (!layer.text.trim()) return
      const tooHigh = layer.yPct < 4
      const tooLow = layer.yPct > 96
      checks.push(
        tooHigh || tooLow
          ? { id: `safe-${name}`, label: `${name} safe zone`, detail: `${name} sits very close to the trim edge — move it inward.`, status: 'warning' }
          : { id: `safe-${name}`, label: `${name} safe zone`, detail: `${name} sits within the safe area.`, status: 'pass' },
      )
    }
    edgeCheck(state.title, 'Title')
    edgeCheck(state.subtitle, 'Subtitle')
    edgeCheck(state.author, 'Author')

    const resCheck = (img: HTMLImageElement | undefined, panelWidthIn: number, name: string, key: ImageKey) => {
      if (!img) return
      const effectiveDpi = img.naturalWidth / panelWidthIn
      checks.push(
        effectiveDpi >= TARGET_DPI
          ? { id: `res-${name}`, label: `${name} image resolution`, detail: `≈ ${Math.round(effectiveDpi)} DPI — print quality.`, status: 'pass' }
          : {
              id: `res-${name}`,
              label: `${name} image resolution`,
              detail: `≈ ${Math.round(effectiveDpi)} DPI. Below ${TARGET_DPI} DPI — use "Increase DPI" to upscale, or upload a higher-resolution image.`,
              status: 'warning',
              fixImageKey: key,
            },
      )
    }
    if (state.backgroundMode === 'unified') {
      resCheck(imagesRef.current.unified, dims.wrapW, 'Wrap', 'unified')
    } else {
      resCheck(imagesRef.current.front, dims.trimW, 'Front', 'front')
      resCheck(imagesRef.current.back, dims.trimW, 'Back', 'back')
    }

    checks.push({ id: 'bleed', label: 'Bleed', detail: '0.125 in bleed is included automatically on all outer edges.', status: 'pass' })

    return checks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, dims, imgVersion])

  const passCount = preflight.filter((c) => c.status === 'pass').length
  const warnCount = preflight.length - passCount

  async function exportAt(dpi: number, includeGuides: boolean) {
    const off = document.createElement('canvas')
    drawCover(off, state, { dpi, includeGuides, images: imagesRef.current })
    return off
  }

  async function handleExportPng(kind: 'wrap' | 'front' | 'back') {
    setExporting(true)
    try {
      const full = await exportAt(EXPORT_DPI, false)
      let out = full
      if (kind !== 'wrap') {
        const trimPx = Math.round(dims.trimW * EXPORT_DPI)
        const heightPx = Math.round(dims.wrapH * EXPORT_DPI)
        const startX = kind === 'front' ? Math.round(dims.frontX * EXPORT_DPI) : Math.round(dims.backX * EXPORT_DPI)
        const cropped = document.createElement('canvas')
        cropped.width = trimPx
        cropped.height = heightPx
        const cctx = cropped.getContext('2d')!
        cctx.drawImage(full, startX, 0, trimPx, heightPx, 0, 0, trimPx, heightPx)
        out = cropped
      }
      downloadDataUrl(out.toDataURL('image/png'), `kdp-cover-${kind}.png`)
    } finally {
      setExporting(false)
    }
  }

  async function handleExportPdf() {
    setExporting(true)
    try {
      const [full, { jsPDF }] = await Promise.all([exportAt(EXPORT_DPI, false), import('jspdf')])
      const pdf = new jsPDF({ unit: 'in', format: [dims.wrapW, dims.wrapH], orientation: dims.wrapW >= dims.wrapH ? 'landscape' : 'portrait' })
      const dataUrl = full.toDataURL('image/jpeg', 0.95)
      pdf.addImage(dataUrl, 'JPEG', 0, 0, dims.wrapW, dims.wrapH)
      pdf.save('kdp-cover-print-ready.pdf')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <SEO
        title="KDP Cover Maker"
        description="Design a print-ready Amazon KDP paperback cover: front, spine and back with automatic spine width, bleed, safe zones and preflight checks."
      />
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Tools' }, { label: 'KDP Cover Maker' }]} />

      <div className="container-page py-10 sm:py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-2xl font-bold text-navy-900 dark:text-white sm:text-3xl">KDP Cover Maker</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">
              Design a full front + spine + back wrap cover for KDP paperbacks with automatic spine width, bleed and safe-zone guides.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => handleExportPng('front')} disabled={exporting} className="btn-secondary text-xs disabled:opacity-50">
              <Icon name="image" className="h-4 w-4" /> Front PNG
            </button>
            <button type="button" onClick={() => handleExportPng('back')} disabled={exporting} className="btn-secondary text-xs disabled:opacity-50">
              <Icon name="image" className="h-4 w-4" /> Back PNG
            </button>
            <button type="button" onClick={() => handleExportPng('wrap')} disabled={exporting} className="btn-secondary text-xs disabled:opacity-50">
              <Icon name="download" className="h-4 w-4" /> Full Wrap PNG
            </button>
            <button type="button" onClick={handleExportPdf} disabled={exporting} className="btn-primary text-xs disabled:opacity-50">
              <Icon name="download" className="h-4 w-4" /> {exporting ? 'Exporting…' : 'Export Print PDF'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
          {/* Preview */}
          <div className="order-2 lg:order-1">
            <div className="card p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="flex flex-wrap gap-4 text-slate-600 dark:text-slate-300">
                  <span>
                    Trim: <strong className="text-navy-900 dark:text-white">{dims.trimW}″ × {dims.trimH}″</strong>
                  </span>
                  <span>
                    Spine: <strong className="text-navy-900 dark:text-white">{dims.spineW.toFixed(3)}″</strong>
                  </span>
                  <span>
                    Full wrap: <strong className="text-navy-900 dark:text-white">{dims.wrapW.toFixed(3)}″ × {dims.wrapH.toFixed(3)}″</strong>
                  </span>
                </div>
                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} />
                  Show guides
                </label>
              </div>

              <div className="overflow-auto rounded-xl bg-slate-100 p-3 dark:bg-navy-950">
                <canvas ref={canvasRef} className="mx-auto block max-w-full rounded-md shadow-card-lg" style={{ height: 'auto' }} />
              </div>

              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Layout, left to right: back cover · spine · front cover. Red dashed = bleed edge, gray = trim line, blue dashed = safe zone for text.
              </p>
            </div>

            {/* Preflight */}
            <div className="card mt-6 p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold text-navy-900 dark:text-white">Export Check</h2>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Passed {passCount} · {warnCount} to review
                </span>
              </div>
              <ul className="space-y-2">
                {preflight.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-navy-700">
                    {c.status === 'pass' ? (
                      <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Icon name="alertTriangle" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-navy-900 dark:text-white">{c.label}</p>
                      <p className="text-slate-500 dark:text-slate-400">{c.detail}</p>
                      {c.fixImageKey && (
                        <button
                          type="button"
                          onClick={() => enhanceImage(c.fixImageKey as ImageKey)}
                          disabled={enhancingKey === c.fixImageKey}
                          className="btn-secondary mt-2 px-3 py-1 text-xs disabled:opacity-50"
                        >
                          <Icon name="sparkles" className="h-3.5 w-3.5" />
                          {enhancingKey === c.fixImageKey ? 'Increasing DPI…' : 'Increase DPI'}
                        </button>
                      )}
                      {c.fixImageKey && enhanceError && enhanceError.key === c.fixImageKey && (
                        <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">{enhanceError.message}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Controls */}
          <div className="order-1 lg:order-2">
            <div className="card p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-xs font-semibold dark:bg-navy-800">
                {(['setup', 'front', 'spine', 'back', 'preflight'] as PanelTab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={`flex-1 rounded-md px-2 py-1.5 capitalize transition-colors ${
                      tab === t ? 'bg-white text-brand-700 shadow-sm dark:bg-navy-900 dark:text-cyan-300' : 'text-slate-500 hover:text-navy-800 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {t === 'preflight' ? 'Check' : t}
                  </button>
                ))}
              </div>

              {tab === 'setup' && (
                <SetupPanel
                  state={state}
                  update={update}
                  dpi={effectiveDpiFor('unified')}
                  onEnhance={() => enhanceImage('unified')}
                  enhancing={enhancingKey === 'unified'}
                  enhanceError={enhanceError?.key === 'unified' ? enhanceError.message : null}
                />
              )}
              {tab === 'front' && (
                <FrontPanel
                  state={state}
                  update={update}
                  updateText={updateText}
                  updateImage={updateImage}
                  dpi={effectiveDpiFor('front')}
                  onEnhance={() => enhanceImage('front')}
                  enhancing={enhancingKey === 'front'}
                  enhanceError={enhanceError?.key === 'front' ? enhanceError.message : null}
                />
              )}
              {tab === 'spine' && <SpinePanel state={state} update={update} />}
              {tab === 'back' && (
                <BackPanel
                  state={state}
                  update={update}
                  updateText={updateText}
                  updateImage={updateImage}
                  dpi={effectiveDpiFor('back')}
                  onEnhance={() => enhanceImage('back')}
                  enhancing={enhancingKey === 'back'}
                  enhanceError={enhanceError?.key === 'back' ? enhanceError.message : null}
                />
              )}
              {tab === 'preflight' && (
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  <p>See the full Export Check list under the preview on the left. Fix any warnings before uploading your cover to KDP.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</label>
      {children}
    </div>
  )
}

function ImageUploader({
  layer,
  onFile,
  onClear,
  onChange,
  dpi,
  onEnhance,
  enhancing,
  enhanceError,
}: {
  layer: ImageLayer
  onFile: (dataUrl: string) => void
  onClear: () => void
  onChange: (patch: Partial<ImageLayer>) => void
  dpi?: number | null
  onEnhance?: () => void
  enhancing?: boolean
  enhanceError?: string | null
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const lowRes = dpi !== undefined && dpi !== null && dpi < 300
  return (
    <div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary flex-1 text-xs">
          <Icon name="upload" className="h-4 w-4" /> {layer.src ? 'Replace image' : 'Upload image'}
        </button>
        {layer.src && (
          <button type="button" onClick={onClear} className="btn-secondary text-xs">
            <Icon name="trash" className="h-4 w-4" />
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          if (file) onFile(await fileToDataUrl(file))
          e.target.value = ''
        }}
      />
      {layer.src && dpi !== undefined && dpi !== null && (
        <div className={`mt-2 flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs ${lowRes ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'}`}>
          <span>≈ {Math.round(dpi)} DPI at print size{lowRes ? ' — below 300 DPI' : ''}</span>
          {lowRes && onEnhance && (
            <button type="button" onClick={onEnhance} disabled={enhancing} className="shrink-0 font-semibold underline decoration-dotted disabled:opacity-50">
              {enhancing ? 'Increasing…' : 'Increase DPI'}
            </button>
          )}
        </div>
      )}
      {enhanceError && <p className="mt-2 text-xs font-medium text-rose-600 dark:text-rose-400">{enhanceError}</p>}
      {layer.src && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Fit</label>
            <select className="input" value={layer.fit} onChange={(e) => onChange({ fit: e.target.value as ImageFit })}>
              <option value="cover">Cover (crop to fill, no distortion)</option>
              <option value="stretch">Stretch (fill exactly, may distort)</option>
            </select>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Zoom</span>
              <span>{layer.zoom}%</span>
            </div>
            <input type="range" min={100} max={300} value={layer.zoom} onChange={(e) => onChange({ zoom: Number(e.target.value) })} className="w-full" />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Position X</span>
              <span>{layer.posXPct}%</span>
            </div>
            <input type="range" min={0} max={100} value={layer.posXPct} onChange={(e) => onChange({ posXPct: Number(e.target.value) })} className="w-full" />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Position Y</span>
              <span>{layer.posYPct}%</span>
            </div>
            <input type="range" min={0} max={100} value={layer.posYPct} onChange={(e) => onChange({ posYPct: Number(e.target.value) })} className="w-full" />
          </div>
        </div>
      )}
    </div>
  )
}

function TextControls({ layer, onChange, sizeRange = [10, 90] }: { layer: TextLayer; onChange: (patch: Partial<TextLayer>) => void; sizeRange?: [number, number] }) {
  return (
    <div className="space-y-3">
      <textarea className="input" rows={2} value={layer.text} onChange={(e) => onChange({ text: e.target.value })} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Size</span>
            <span>{layer.sizePt}pt</span>
          </div>
          <input type="range" min={sizeRange[0]} max={sizeRange[1]} value={layer.sizePt} onChange={(e) => onChange({ sizePt: Number(e.target.value) })} className="w-full" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Color</label>
          <input type="color" value={layer.color} onChange={(e) => onChange({ color: e.target.value })} className="h-9 w-full rounded-md border border-slate-300 dark:border-navy-600" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Align</label>
          <select className="input" value={layer.align} onChange={(e) => onChange({ align: e.target.value as TextAlign })}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500 dark:text-slate-400">Font</label>
          <select className="input" value={layer.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value as 'serif' | 'sans' })}>
            <option value="serif">Serif</option>
            <option value="sans">Sans</option>
          </select>
        </div>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Vertical position</span>
          <span>{layer.yPct}%</span>
        </div>
        <input type="range" min={0} max={100} value={layer.yPct} onChange={(e) => onChange({ yPct: Number(e.target.value) })} className="w-full" />
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
        <input type="checkbox" checked={layer.bold} onChange={(e) => onChange({ bold: e.target.checked })} />
        Bold
      </label>
    </div>
  )
}

function SetupPanel({
  state,
  update,
  dpi,
  onEnhance,
  enhancing,
  enhanceError,
}: {
  state: CoverState
  update: (p: Partial<CoverState>) => void
  dpi?: number | null
  onEnhance?: () => void
  enhancing?: boolean
  enhanceError?: string | null
}) {
  return (
    <div>
      <Field label="Trim size">
        <select className="input" value={state.trimKey} onChange={(e) => update({ trimKey: e.target.value })}>
          {TRIM_SIZES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Interior paper">
        <select className="input" value={state.paperType} onChange={(e) => update({ paperType: e.target.value as PaperType })}>
          {PAPER_TYPES.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Page count">
        <input
          type="number"
          className="input"
          min={MIN_PAGE_COUNT}
          max={MAX_PAGE_COUNT}
          value={state.pageCount}
          onChange={(e) => update({ pageCount: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field label="Background mode">
        <select className="input" value={state.backgroundMode} onChange={(e) => update({ backgroundMode: e.target.value as 'unified' | 'separate' })}>
          <option value="separate">Separate front / back images</option>
          <option value="unified">One image across the full wrap</option>
        </select>
      </Field>
      <Field label="Base color (fallback / spine)">
        <input type="color" value={state.bgColor} onChange={(e) => update({ bgColor: e.target.value })} className="h-9 w-full rounded-md border border-slate-300 dark:border-navy-600" />
      </Field>
      {state.backgroundMode === 'unified' && (
        <Field label="Full-wrap image">
          <ImageUploader
            layer={state.unified}
            onFile={(src) => update({ unified: { ...state.unified, src } })}
            onClear={() => update({ unified: { ...state.unified, src: null } })}
            onChange={(patch) => update({ unified: { ...state.unified, ...patch } })}
            dpi={dpi}
            onEnhance={onEnhance}
            enhancing={enhancing}
            enhanceError={enhanceError}
          />
        </Field>
      )}
    </div>
  )
}

function FrontPanel({
  state,
  update,
  updateText,
  updateImage,
  dpi,
  onEnhance,
  enhancing,
  enhanceError,
}: {
  state: CoverState
  update: (p: Partial<CoverState>) => void
  updateText: (key: 'title' | 'subtitle' | 'author' | 'blurb', patch: Partial<TextLayer>) => void
  updateImage: (key: 'unified' | 'front' | 'back', patch: Partial<ImageLayer>) => void
  dpi?: number | null
  onEnhance?: () => void
  enhancing?: boolean
  enhanceError?: string | null
}) {
  return (
    <div>
      {state.backgroundMode === 'separate' && (
        <Field label="Front cover image">
          <ImageUploader
            layer={state.front}
            onFile={(src) => update({ front: { ...state.front, src } })}
            onClear={() => update({ front: { ...state.front, src: null } })}
            onChange={(patch) => updateImage('front', patch)}
            dpi={dpi}
            onEnhance={onEnhance}
            enhancing={enhancing}
            enhanceError={enhanceError}
          />
        </Field>
      )}
      <Field label="Title">
        <TextControls layer={state.title} onChange={(p) => updateText('title', p)} sizeRange={[18, 90]} />
      </Field>
      <Field label="Subtitle">
        <TextControls layer={state.subtitle} onChange={(p) => updateText('subtitle', p)} sizeRange={[10, 40]} />
      </Field>
      <Field label="Author">
        <TextControls layer={state.author} onChange={(p) => updateText('author', p)} sizeRange={[10, 40]} />
      </Field>
    </div>
  )
}

function SpinePanel({ state, update }: { state: CoverState; update: (p: Partial<CoverState>) => void }) {
  return (
    <div>
      <Field label="Spine background color">
        <input
          type="color"
          value={state.spineColor}
          onChange={(e) => update({ spineColor: e.target.value })}
          disabled={state.backgroundMode === 'unified'}
          className="h-9 w-full rounded-md border border-slate-300 disabled:opacity-50 dark:border-navy-600"
        />
      </Field>
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input type="checkbox" checked={state.showSpineText} onChange={(e) => update({ showSpineText: e.target.checked })} />
        Show title &amp; author on spine
      </label>
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input type="checkbox" checked={state.spineFlip} onChange={(e) => update({ spineFlip: e.target.checked })} />
        Flip spine text direction
      </label>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Spine text uses the Title and Author text and colors from the Front tab, auto-scaled to fit the spine width. KDP only prints spine text reliably above ~{MIN_PAGES_FOR_SPINE_TEXT} pages.
      </p>
    </div>
  )
}

function BackPanel({
  state,
  update,
  updateText,
  updateImage,
  dpi,
  onEnhance,
  enhancing,
  enhanceError,
}: {
  state: CoverState
  update: (p: Partial<CoverState>) => void
  updateText: (key: 'title' | 'subtitle' | 'author' | 'blurb', patch: Partial<TextLayer>) => void
  updateImage: (key: 'unified' | 'front' | 'back', patch: Partial<ImageLayer>) => void
  dpi?: number | null
  onEnhance?: () => void
  enhancing?: boolean
  enhanceError?: string | null
}) {
  return (
    <div>
      {state.backgroundMode === 'separate' && (
        <Field label="Back cover image">
          <ImageUploader
            layer={state.back}
            onFile={(src) => update({ back: { ...state.back, src } })}
            onClear={() => update({ back: { ...state.back, src: null } })}
            onChange={(patch) => updateImage('back', patch)}
            dpi={dpi}
            onEnhance={onEnhance}
            enhancing={enhancing}
            enhanceError={enhanceError}
          />
        </Field>
      )}
      <Field label="Back cover blurb">
        <TextControls layer={state.blurb} onChange={(p) => updateText('blurb', p)} sizeRange={[9, 20]} />
      </Field>
      <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input type="checkbox" checked={state.showBarcodeArea} onChange={(e) => update({ showBarcodeArea: e.target.checked })} />
        Reserve barcode area (2″ × 1.2″)
      </label>
    </div>
  )
}
