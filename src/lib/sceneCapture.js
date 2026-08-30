/** Capture du canvas Three.js (vue courante = géométrie du configurateur). */

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
