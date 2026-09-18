import { BLEED_IN, SAFE_MARGIN_IN, SPINE_SAFE_MARGIN_IN, computeWrapDimensions, type PaperType } from '../data/kdpCover'

export { loadImage, upscaleDataUrl } from './imageUpscale'

export type TextAlign = 'left' | 'center' | 'right'

export interface TextLayer {
  text: string
  sizePt: number
  color: string
  align: TextAlign
  yPct: number // 0-100, position of the text baseline area within the trim height
  bold: boolean
  fontFamily: 'serif' | 'sans'
}

export type ImageFit = 'cover' | 'stretch'

export interface ImageLayer {
  src: string | null
  zoom: number // 100 = fills the panel (cover fit), >100 zooms in
  posXPct: number // 0-100, pans the focal point horizontally
  posYPct: number // 0-100, pans the focal point vertically
  fit: ImageFit // 'cover' crops to fill without distortion, 'stretch' fills exactly and may distort
}

export type BackgroundMode = 'unified' | 'separate'

export interface CoverState {
  trimKey: string
  paperType: PaperType
  pageCount: number

  backgroundMode: BackgroundMode
  bgColor: string
  unified: ImageLayer
  front: ImageLayer
  back: ImageLayer
  spineColor: string

  title: TextLayer
  subtitle: TextLayer
  author: TextLayer
  blurb: TextLayer

  showSpineText: boolean
  spineFlip: boolean
  showBarcodeArea: boolean
}

export const FONT_STACK = {
  serif: '"Source Serif 4", Georgia, serif',
  sans: '"Inter", system-ui, sans-serif',
}

export function defaultCoverState(): CoverState {
  return {
    trimKey: '6x9',
    paperType: 'white',
    pageCount: 200,
    backgroundMode: 'separate',
    bgColor: '#0f2a4a',
    unified: { src: null, zoom: 100, posXPct: 50, posYPct: 50, fit: 'cover' },
    front: { src: null, zoom: 100, posXPct: 50, posYPct: 50, fit: 'cover' },
    back: { src: null, zoom: 100, posXPct: 50, posYPct: 50, fit: 'cover' },
    spineColor: '#0f2a4a',
    title: { text: 'Your Book Title', sizePt: 44, color: '#ffffff', align: 'center', yPct: 18, bold: true, fontFamily: 'serif' },
    subtitle: { text: 'A Compelling Subtitle Goes Here', sizePt: 18, color: '#ddb84a', align: 'center', yPct: 32, bold: false, fontFamily: 'sans' },
    author: { text: 'Author Name', sizePt: 20, color: '#ffffff', align: 'center', yPct: 92, bold: false, fontFamily: 'sans' },
    blurb: {
      text: 'A short, compelling description of the book goes here. Summarize the hook, the stakes, and why a reader should pick this up.',
      sizePt: 13,
      color: '#ffffff',
      align: 'left',
      yPct: 12,
      bold: false,
      fontFamily: 'sans',
    },
    showSpineText: true,
    spineFlip: false,
    showBarcodeArea: true,
  }
}

function drawImagePanel(ctx: CanvasRenderingContext2D, img: HTMLImageElement, layer: ImageLayer, x: number, y: number, w: number, h: number) {
  if (layer.fit === 'stretch') {
    drawImageStretch(ctx, img, layer, x, y, w, h)
  } else {
    drawImageCover(ctx, img, layer, x, y, w, h)
  }
}

function drawImageCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, layer: ImageLayer, x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()

  const zoom = Math.max(50, layer.zoom) / 100
  const panelRatio = w / h
  const imgRatio = img.width / img.height

  let drawW: number
  let drawH: number
  if (imgRatio > panelRatio) {
    drawH = h * zoom
    drawW = drawH * imgRatio
  } else {
    drawW = w * zoom
    drawH = drawW / imgRatio
  }

  const maxOffsetX = Math.max(0, drawW - w)
  const maxOffsetY = Math.max(0, drawH - h)
  const offsetX = (layer.posXPct / 100) * maxOffsetX
  const offsetY = (layer.posYPct / 100) * maxOffsetY

  const drawX = x - offsetX
  const drawY = y - offsetY
  ctx.drawImage(img, drawX, drawY, drawW, drawH)
  ctx.restore()
}

/** Fills the panel exactly (ignoring the image's aspect ratio); zoom/position can pan a stretched-in crop. */
function drawImageStretch(ctx: CanvasRenderingContext2D, img: HTMLImageElement, layer: ImageLayer, x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()

  const zoom = Math.max(50, layer.zoom) / 100
  const drawW = w * zoom
  const drawH = h * zoom

  const maxOffsetX = Math.max(0, drawW - w)
  const maxOffsetY = Math.max(0, drawH - h)
  const offsetX = (layer.posXPct / 100) * maxOffsetX
  const offsetY = (layer.posYPct / 100) * maxOffsetY

  ctx.drawImage(img, x - offsetX, y - offsetY, drawW, drawH)
  ctx.restore()
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const paragraphs = text.split('\n')
  const lines: string[] = []
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) {
      lines.push('')
      continue
    }
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
  }
  return lines
}

function setFont(ctx: CanvasRenderingContext2D, layer: TextLayer, dpi: number) {
  const px = (layer.sizePt / 72) * dpi
  ctx.font = `${layer.bold ? '700' : '400'} ${px}px ${FONT_STACK[layer.fontFamily]}`
  return px
}

export interface DrawOptions {
  dpi: number
  includeGuides: boolean
  images: { unified?: HTMLImageElement; front?: HTMLImageElement; back?: HTMLImageElement }
}

export function drawCover(canvas: HTMLCanvasElement, state: CoverState, opts: DrawOptions) {
  const dims = computeWrapDimensions(state.trimKey, state.pageCount, state.paperType)
  const { dpi } = opts
  const px = (inches: number) => inches * dpi

  canvas.width = Math.round(px(dims.wrapW))
  canvas.height = Math.round(px(dims.wrapH))
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const backRect = { x: px(dims.backX), y: 0, w: px(dims.trimW), h: px(dims.wrapH) }
  const spineRect = { x: px(dims.spineX), y: 0, w: px(dims.spineW), h: px(dims.wrapH) }
  const frontRect = { x: px(dims.frontX), y: 0, w: px(dims.trimW), h: px(dims.wrapH) }

  // Background fill
  ctx.fillStyle = state.bgColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  if (state.backgroundMode === 'unified') {
    if (opts.images.unified) {
      drawImagePanel(ctx, opts.images.unified, state.unified, 0, 0, canvas.width, canvas.height)
    }
  } else {
    ctx.fillStyle = state.spineColor
    ctx.fillRect(spineRect.x, spineRect.y, spineRect.w, spineRect.h)
    if (opts.images.back) drawImagePanel(ctx, opts.images.back, state.back, backRect.x, backRect.y, backRect.w, backRect.h)
    if (opts.images.front) drawImagePanel(ctx, opts.images.front, state.front, frontRect.x, frontRect.y, frontRect.w, frontRect.h)
  }

  // Front text
  drawTextLayer(ctx, state.title, frontRect, px(SAFE_MARGIN_IN), dpi)
  drawTextLayer(ctx, state.subtitle, frontRect, px(SAFE_MARGIN_IN), dpi)
  drawTextLayer(ctx, state.author, frontRect, px(SAFE_MARGIN_IN), dpi)

  // Back blurb (wrapped, top-anchored at yPct)
  drawBlurb(ctx, state.blurb, backRect, px(SAFE_MARGIN_IN), dpi)

  // Barcode placeholder (bottom-right of back panel, i.e. the edge nearest the spine)
  if (state.showBarcodeArea) {
    const bw = px(2)
    const bh = px(1.2)
    const bx = backRect.x + backRect.w - px(BLEED_IN) - px(0.25) - bw
    const by = backRect.y + backRect.h - px(BLEED_IN) - px(0.25) - bh
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(bx, by, bw, bh)
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = Math.max(1, dpi / 150)
    ctx.strokeRect(bx, by, bw, bh)
    ctx.fillStyle = 'rgba(0,0,0,0.45)'
    ctx.font = `${Math.round(dpi * 0.09)}px ${FONT_STACK.sans}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Barcode area', bx + bw / 2, by + bh / 2)
  }

  // Spine text
  if (state.showSpineText && dims.spineW > 0.05) {
    ctx.save()
    ctx.translate(spineRect.x + spineRect.w / 2, spineRect.y + spineRect.h / 2)
    ctx.rotate(state.spineFlip ? Math.PI / 2 : -Math.PI / 2)

    const spineTitleSize = clampSpineFont(state.title.sizePt * 0.55, dims.spineW, dpi)
    ctx.font = `700 ${spineTitleSize}px ${FONT_STACK[state.title.fontFamily]}`
    ctx.fillStyle = state.title.color
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(state.title.text, 0, -px(dims.trimH) * 0.12)

    const spineAuthorSize = clampSpineFont(state.author.sizePt * 0.55, dims.spineW, dpi)
    ctx.font = `400 ${spineAuthorSize}px ${FONT_STACK[state.author.fontFamily]}`
    ctx.fillStyle = state.author.color
    ctx.fillText(state.author.text, 0, px(dims.trimH) * 0.32)
    ctx.restore()
  }

  if (opts.includeGuides) {
    drawGuides(ctx, dims, dpi, px)
  }
}

function clampSpineFont(basePx: number, spineWIn: number, dpi: number) {
  const maxByWidth = spineWIn * dpi * 0.72
  return Math.max(6, Math.min(basePx, maxByWidth))
}

function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer, rect: { x: number; y: number; w: number; h: number }, margin: number, dpi: number) {
  if (!layer.text.trim()) return
  setFont(ctx, layer, dpi)
  ctx.fillStyle = layer.color
  ctx.textBaseline = 'middle'
  ctx.textAlign = layer.align
  const y = rect.y + rect.h * (layer.yPct / 100)
  let x = rect.x + rect.w / 2
  if (layer.align === 'left') x = rect.x + margin
  if (layer.align === 'right') x = rect.x + rect.w - margin

  const maxWidth = rect.w - margin * 2
  const lines = wrapLines(ctx, layer.text, maxWidth)
  const lineHeight = ((layer.sizePt / 72) * dpi) * 1.2
  const startY = y - ((lines.length - 1) * lineHeight) / 2
  lines.forEach((line, i) => ctx.fillText(line, x, startY + i * lineHeight))
}

function drawBlurb(ctx: CanvasRenderingContext2D, layer: TextLayer, rect: { x: number; y: number; w: number; h: number }, margin: number, dpi: number) {
  if (!layer.text.trim()) return
  setFont(ctx, layer, dpi)
  ctx.fillStyle = layer.color
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = layer.align
  let x = rect.x + rect.w / 2
  if (layer.align === 'left') x = rect.x + margin
  if (layer.align === 'right') x = rect.x + rect.w - margin

  const maxWidth = rect.w - margin * 2
  const lines = wrapLines(ctx, layer.text, maxWidth)
  const lineHeight = ((layer.sizePt / 72) * dpi) * 1.4
  let y = rect.y + rect.h * (layer.yPct / 100) + lineHeight
  for (const line of lines) {
    if (y > rect.y + rect.h - margin) break
    ctx.fillText(line, x, y)
    y += lineHeight
  }
}

function drawGuides(
  ctx: CanvasRenderingContext2D,
  dims: ReturnType<typeof computeWrapDimensions>,
  dpi: number,
  px: (inches: number) => number,
) {
  ctx.save()
  // Bleed line
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.85)'
  ctx.setLineDash([px(0.05), px(0.05)])
  ctx.lineWidth = Math.max(1, dpi / 150)
  ctx.strokeRect(px(BLEED_IN) / 2, px(BLEED_IN) / 2, px(dims.wrapW) - px(BLEED_IN), px(dims.wrapH) - px(BLEED_IN))

  // Trim lines (back / spine / front boundaries)
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.55)'
  ctx.setLineDash([])
  ctx.lineWidth = Math.max(1, dpi / 150)
  ctx.strokeRect(px(dims.backX), 0, px(dims.trimW), px(dims.wrapH))
  ctx.strokeRect(px(dims.frontX), 0, px(dims.trimW), px(dims.wrapH))
  ctx.strokeRect(px(dims.spineX), 0, px(dims.spineW), px(dims.wrapH))

  // Safe zone (front/back)
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.7)'
  ctx.setLineDash([px(0.04), px(0.04)])
  const m = px(SAFE_MARGIN_IN)
  ctx.strokeRect(px(dims.backX) + m, m, px(dims.trimW) - m * 2, px(dims.wrapH) - m * 2)
  ctx.strokeRect(px(dims.frontX) + m, m, px(dims.trimW) - m * 2, px(dims.wrapH) - m * 2)

  // Spine safe zone
  if (dims.spineW > 0.05) {
    const sm = px(SPINE_SAFE_MARGIN_IN)
    ctx.strokeRect(px(dims.spineX) + sm, m, Math.max(0, px(dims.spineW) - sm * 2), px(dims.wrapH) - m * 2)
  }
  ctx.restore()
}
