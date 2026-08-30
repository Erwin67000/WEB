/** Capture du canvas Three.js + export PDF de mise en situation. */

let grabFn = null

export function bindSceneCapture(fn) {
  grabFn = typeof fn === 'function' ? fn : null
}

export function captureSceneDataUrl(format = 'png') {
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  if (!grabFn) return null
  return grabFn(mime)
}

export function downloadScenePhoto(format = 'png') {
  const dataUrl = captureSceneDataUrl(format)
  if (!dataUrl) return false
  const ext = format === 'jpeg' ? 'jpg' : 'png'
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = `philae-scene.${ext}`
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  return true
}

function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image'))
    img.src = src
  })
}

function dataUrlToBytes(dataUrl) {
  const b64 = dataUrl.split(',')[1] || ''
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i)
  return out
}

/** PDF 1.4 une page, JPEG en pleine page. */
function jpegBytesToPdf(jpeg, imgW, imgH) {
  const a4w = 842
  const a4h = 595
  const landscape = imgW >= imgH
  const pageW = landscape ? a4w : a4h
  const pageH = landscape ? a4h : a4w
  const scale = Math.min(pageW / imgW, pageH / imgH)
  const w = imgW * scale
  const h = imgH * scale
  const x = (pageW - w) / 2
  const y = (pageH - h) / 2
  const objects = []
  const add = (s) => {
    objects.push(s)
    return objects.length
  }
  add('<< /Type /Catalog /Pages 2 0 R >>')
  add('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  add(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
  )
  const imgObj = `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
  const content = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`
  add(null)
  add(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)

  const encoder = new TextEncoder()
  const chunks = []
  let offset = 0
  const offsets = [0]
  const push = (u8) => {
    chunks.push(u8)
    offset += u8.length
  }
  push(encoder.encode('%PDF-1.4\n'))
  const writeObj = (i, bodyU8) => {
    offsets[i] = offset
    push(encoder.encode(`${i} 0 obj\n`))
    push(bodyU8)
    push(encoder.encode('\nendobj\n'))
  }
  writeObj(1, encoder.encode(objects[0]))
  writeObj(2, encoder.encode(objects[1]))
  writeObj(3, encoder.encode(objects[2]))
  offsets[4] = offset
  push(encoder.encode('4 0 obj\n'))
  push(encoder.encode(imgObj))
  push(jpeg)
  push(encoder.encode('\nendstream\nendobj\n'))
  writeObj(5, encoder.encode(objects[4]))

  const xrefAt = offset
  let xref = `xref\n0 6\n0000000000 65535 f \n`
  for (let i = 1; i <= 5; i += 1) {
    xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  push(encoder.encode(xref))
  push(
    encoder.encode(
      `trailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`,
    ),
  )
  let total = 0
  chunks.forEach((c) => {
    total += c.length
  })
  const out = new Uint8Array(total)
  let o = 0
  chunks.forEach((c) => {
    out.set(c, o)
    o += c.length
  })
  return out
}

/**
 * Compose la vue 3D + filigrane + encart logo / descriptif, puis télécharge un PDF.
 */
export async function downloadScenePdf({
  title = 'Meuble Philae',
  lines = [],
} = {}) {
  const view = captureSceneDataUrl('jpeg')
  if (!view) return false
  const photo = await loadImg(view)
  let logo = null
  try {
    logo = await loadImg('/logo-philae.jpg')
  } catch {
    try {
      logo = await loadImg('/logo-philae.svg')
    } catch {
      logo = null
    }
  }
  const w = photo.naturalWidth || photo.width
  const h = photo.naturalHeight || photo.height
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  ctx.drawImage(photo, 0, 0, w, h)

  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate(-Math.PI / 6)
  ctx.font = `700 ${Math.max(22, Math.round(w * 0.028))}px Georgia, serif`
  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Photo non contractuelle — Propriété de PHILAE', 0, 0)
  ctx.restore()

  const pad = Math.max(14, Math.round(w * 0.018))
  const boxW = Math.max(220, Math.round(w * 0.22))
  const boxH = Math.max(88, Math.round(h * 0.14))
  const bx = w - pad - boxW
  const by = h - pad - boxH
  ctx.fillStyle = 'rgba(245, 240, 230, 0.94)'
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.85)'
  ctx.lineWidth = 2
  ctx.fillRect(bx, by, boxW, boxH)
  ctx.strokeRect(bx, by, boxW, boxH)

  let tx = bx + 12
  const ty = by + 12
  if (logo) {
    const lh = Math.round(boxH * 0.42)
    const lw = Math.round((logo.width / Math.max(1, logo.height)) * lh)
    ctx.drawImage(logo, tx, ty, lw, lh)
    tx += lw + 10
  }
  ctx.fillStyle = '#1a1610'
  ctx.font = `700 ${Math.max(13, Math.round(w * 0.012))}px Georgia, serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('PHILAE', tx, ty + 2)
  ctx.font = `600 ${Math.max(11, Math.round(w * 0.011))}px system-ui, sans-serif`
  const textX = bx + 12
  let textY = by + Math.round(boxH * 0.52)
  const caption = [title, ...lines].filter(Boolean)
  caption.forEach((line) => {
    ctx.fillText(line, textX, textY)
    textY += Math.max(14, Math.round(h * 0.018))
  })

  const jpegUrl = c.toDataURL('image/jpeg', 0.9)
  const bytes = dataUrlToBytes(jpegUrl)
  const pdf = jpegBytesToPdf(bytes, w, h)
  const blob = new Blob([pdf], { type: 'application/pdf' })
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = 'philae-scene.pdf'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 2000)
  return true
}
