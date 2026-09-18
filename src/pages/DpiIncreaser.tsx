import { useEffect, useMemo, useRef, useState } from 'react'
import SEO from '../components/SEO'
import Breadcrumbs from '../components/Breadcrumbs'
import Icon from '../components/Icon'
import { loadImage, upscaleDataUrl } from '../lib/imageUpscale'

const TARGET_DPI_PRESETS = [150, 300, 600]

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

function formatBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] ?? ''
  const bytes = Math.round((base64.length * 3) / 4)
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DpiIncreaser() {
  const [srcDataUrl, setSrcDataUrl] = useState<string | null>(null)
  const [fileName, setFileName] = useState('')
  const [naturalW, setNaturalW] = useState(0)
  const [naturalH, setNaturalH] = useState(0)

  const [widthIn, setWidthIn] = useState(6)
  const [targetDpi, setTargetDpi] = useState(300)
  const [outputFormat, setOutputFormat] = useState<'image/png' | 'image/jpeg'>('image/png')

  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ dataUrl: string; width: number; height: number; clamped: boolean } | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)

  const aspect = naturalH > 0 ? naturalW / naturalH : 1
  const heightIn = widthIn / (aspect || 1)
  const currentDpi = naturalW > 0 && widthIn > 0 ? naturalW / widthIn : 0
  const neededWidthPx = Math.round(widthIn * targetDpi)
  const scale = currentDpi > 0 ? targetDpi / currentDpi : 1

  const resultDpi = useMemo(() => {
    if (!result) return null
    return result.width / widthIn
  }, [result, widthIn])

  useEffect(() => {
    setResult(null)
    setError(null)
  }, [srcDataUrl, widthIn, targetDpi])

  async function handleFile(file: File) {
    setError(null)
    setResult(null)
    const dataUrl = await fileToDataUrl(file)
    const img = await loadImage(dataUrl)
    setSrcDataUrl(dataUrl)
    setFileName(file.name)
    setNaturalW(img.naturalWidth)
    setNaturalH(img.naturalHeight)
    setOutputFormat(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png')
  }

  async function handleIncrease() {
    if (!srcDataUrl || currentDpi <= 0) return
    setProcessing(true)
    setError(null)
    try {
      const needed = targetDpi / currentDpi
      const upscaled = await upscaleDataUrl(srcDataUrl, Math.max(1, needed), outputFormat)
      setResult(upscaled)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not increase DPI for this image.')
    } finally {
      setProcessing(false)
    }
  }

  function reset() {
    setSrcDataUrl(null)
    setFileName('')
    setNaturalW(0)
    setNaturalH(0)
    setResult(null)
    setError(null)
  }

  return (
    <>
      <SEO
        title="Image DPI Increaser"
        description="Upscale a low-resolution image to a target DPI at your print size — free, in-browser, no upload to a server."
      />
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Tools' }, { label: 'Image DPI Increaser' }]} />

      <div className="container-page py-14 sm:py-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-serif text-2xl font-bold text-navy-900 dark:text-white sm:text-3xl">Image DPI Increaser</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-300">
            Upload an image, tell it your print size and target DPI, and it upscales the image entirely in your browser — nothing is
            uploaded anywhere.
          </p>

          <div className="card mt-8 p-6">
            {!srcDataUrl ? (
              <div
                className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 p-10 text-center dark:border-navy-600"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const file = e.dataTransfer.files?.[0]
                  if (file) handleFile(file)
                }}
              >
                <Icon name="upload" className="h-8 w-8 text-slate-400" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Drag an image here, or</p>
                <button type="button" onClick={() => inputRef.current?.click()} className="btn-primary text-sm">
                  Choose an image
                </button>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(file)
                    e.target.value = ''
                  }}
                />
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-[minmax(0,220px)_1fr]">
                <div>
                  <img src={result?.dataUrl ?? srcDataUrl} alt="" className="w-full rounded-lg border border-slate-200 dark:border-navy-700" />
                  <p className="mt-2 truncate text-xs text-slate-500 dark:text-slate-400">{fileName}</p>
                  <button type="button" onClick={reset} className="btn-secondary mt-3 w-full text-xs">
                    <Icon name="trash" className="h-4 w-4" /> Remove
                  </button>
                </div>

                <div>
                  <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm dark:bg-navy-800">
                    <p className="text-slate-600 dark:text-slate-300">
                      Original: <strong className="text-navy-900 dark:text-white">{naturalW} × {naturalH} px</strong>
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Print width (in)
                      </label>
                      <input
                        type="number"
                        min={0.5}
                        step={0.1}
                        className="input"
                        value={widthIn}
                        onChange={(e) => setWidthIn(Math.max(0.1, Number(e.target.value) || 0.1))}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Print height (in)
                      </label>
                      <input type="number" className="input" value={heightIn.toFixed(2)} disabled />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Target DPI
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TARGET_DPI_PRESETS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setTargetDpi(p)}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
                            targetDpi === p
                              ? 'border-brand-500 bg-brand-50 text-brand-700 dark:border-cyan-400 dark:bg-cyan-400/10 dark:text-cyan-300'
                              : 'border-slate-300 text-slate-600 hover:border-brand-400 dark:border-navy-600 dark:text-slate-300'
                          }`}
                        >
                          {p} DPI
                        </button>
                      ))}
                      <input
                        type="number"
                        min={72}
                        max={1200}
                        className="input w-28"
                        value={targetDpi}
                        onChange={(e) => setTargetDpi(Math.min(1200, Math.max(72, Number(e.target.value) || 72)))}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                      Output format
                    </label>
                    <select className="input" value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as 'image/png' | 'image/jpeg')}>
                      <option value="image/png">PNG (lossless)</option>
                      <option value="image/jpeg">JPEG (smaller file)</option>
                    </select>
                  </div>

                  <div className="mt-5 rounded-xl bg-brand-50 p-4 text-sm dark:bg-brand-500/10">
                    <p className="text-slate-700 dark:text-slate-200">
                      Current: <strong>{currentDpi > 0 ? currentDpi.toFixed(0) : '—'} DPI</strong> at {widthIn}″ × {heightIn.toFixed(2)}″
                    </p>
                    <p className="mt-1 text-slate-700 dark:text-slate-200">
                      Needs <strong>{neededWidthPx.toLocaleString()} px</strong> wide for {targetDpi} DPI (scale ×{scale.toFixed(2)})
                    </p>
                  </div>

                  <button type="button" onClick={handleIncrease} disabled={processing || currentDpi >= targetDpi} className="btn-primary mt-4 w-full disabled:opacity-50">
                    <Icon name="sparkles" className="h-4 w-4" />
                    {processing ? 'Increasing DPI…' : currentDpi >= targetDpi ? 'Already at target DPI' : `Increase to ${targetDpi} DPI`}
                  </button>

                  {error && (
                    <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">{error}</p>
                  )}

                  {result && !error && (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10">
                      <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                        Done — {result.width} × {result.height} px (≈ {resultDpi?.toFixed(0)} DPI at {widthIn}″), {formatBytes(result.dataUrl)}
                      </p>
                      {result.clamped && (
                        <p className="mt-1 text-emerald-700/80 dark:text-emerald-300/80">
                          Your browser's canvas size limit meant it couldn't reach the full target — this is as far as it could safely go.
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => downloadDataUrl(result.dataUrl, `dpi-increased.${outputFormat === 'image/png' ? 'png' : 'jpg'}`)}
                        className="btn-primary mt-3"
                      >
                        <Icon name="download" className="h-4 w-4" /> Download
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            This upscales pixels — it sharpens and resamples but can't invent detail a low-resolution photo never had. For print jobs
            (like a KDP book cover), start from the highest-resolution source you have.
          </p>
        </div>
      </div>
    </>
  )
}
