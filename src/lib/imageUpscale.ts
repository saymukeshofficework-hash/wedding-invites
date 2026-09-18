const imageCache = new Map<string, HTMLImageElement>()

export function loadImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src)
  if (cached) return Promise.resolve(cached)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      imageCache.set(src, img)
      resolve(img)
    }
    img.onerror = reject
    img.src = src
  })
}

/**
 * Stay safely under the canvas area limit that mobile browsers (notably iOS
 * Safari) silently enforce — around 16.7M px — beyond which getContext('2d')
 * can return null or drawImage can silently no-op instead of throwing.
 */
const MAX_UPSCALE_OUTPUT_AREA = 16_000_000

function get2dContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error("This browser couldn't allocate a canvas large enough for that upscale. Try a smaller source image.")
  }
  return ctx
}

export interface UpscaleResult {
  dataUrl: string
  width: number
  height: number
  /** true if the requested scale had to be reduced to stay under the browser's canvas size limit. */
  clamped: boolean
}

/**
 * Upscales an image data URL by the given factor using progressive 2x steps
 * (each pass gets browser bilinear/bicubic smoothing), which holds up better
 * than a single large stretch for boosting a low-DPI image. The target size
 * is clamped to stay under common mobile canvas limits.
 */
export async function upscaleDataUrl(src: string, scale: number, outputType: 'image/png' | 'image/jpeg' = 'image/png'): Promise<UpscaleResult> {
  const img = await loadImage(src)
  if (img.width === 0 || img.height === 0) {
    throw new Error('Image has no readable dimensions.')
  }
  let targetW = Math.max(1, Math.round(img.width * scale))
  let targetH = Math.max(1, Math.round(img.height * scale))
  let clamped = false

  if (targetW * targetH > MAX_UPSCALE_OUTPUT_AREA) {
    const clamp = Math.sqrt(MAX_UPSCALE_OUTPUT_AREA / (targetW * targetH))
    targetW = Math.max(1, Math.round(targetW * clamp))
    targetH = Math.max(1, Math.round(targetH * clamp))
    clamped = true
  }

  let curCanvas = document.createElement('canvas')
  curCanvas.width = img.width
  curCanvas.height = img.height
  const firstCtx = get2dContext(curCanvas)
  firstCtx.drawImage(img, 0, 0)
  let curW = img.width
  let curH = img.height

  while (curW < targetW || curH < targetH) {
    const nextW = Math.min(targetW, Math.round(curW * 2))
    const nextH = Math.min(targetH, Math.round(curH * 2))
    const next = document.createElement('canvas')
    next.width = nextW
    next.height = nextH
    const nctx = get2dContext(next)
    nctx.imageSmoothingEnabled = true
    nctx.imageSmoothingQuality = 'high'
    nctx.drawImage(curCanvas, 0, 0, nextW, nextH)
    curCanvas = next
    curW = nextW
    curH = nextH
  }

  const dataUrl = curCanvas.toDataURL(outputType, outputType === 'image/jpeg' ? 0.95 : undefined)
  if (!dataUrl || dataUrl === 'data:,') {
    throw new Error("This browser couldn't export the upscaled image. Try a smaller source image.")
  }
  return { dataUrl, width: curW, height: curH, clamped }
}
