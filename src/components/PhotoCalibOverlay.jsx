import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useActiveConfigStore } from '../store/ConfigStoreContext.jsx'
import { useI18n } from '@texte/I18nProvider.jsx'
import {
  PHOTO_STEPS,
  photoUvFromPointer,
  photoToViewUv,
  letterboxRect,
  xPlusUv,
  defaultZuv,
  defaultYuv,
  snapToXAxis,
  dirFrom,
} from '../lib/photoCalib.js'

function pct(photoUv, rect) {
  if (!photoUv) return { left: '50%', top: '50%' }
  const [u, v] = photoToViewUv(photoUv, rect)
  return { left: `${u * 100}%`, top: `${v * 100}%` }
}

function linePts(a, b, rect) {
  const A = photoToViewUv(a, rect)
  const B = photoToViewUv(b, rect)
  return {
    x1: `${A[0] * 100}%`,
    y1: `${A[1] * 100}%`,
    x2: `${B[0] * 100}%`,
    y2: `${B[1] * 100}%`,
  }
}

function GizmoMark({ uv, pulse, rect }) {
  if (!uv) return null
  return (
    <div
      className={`photo-calib-gizmo${pulse ? ' is-pulse' : ''}`}
      style={pct(uv, rect)}
      aria-hidden
    >
      <svg viewBox="0 0 72 72" width="72" height="72">
        <line x1="36" y1="36" x2="66" y2="36" stroke="#e24b4b" strokeWidth="3.2" />
        <polygon points="66,36 58,32 58,40" fill="#e24b4b" />
        <line x1="36" y1="36" x2="36" y2="8" stroke="#4aa3ff" strokeWidth="3.2" />
        <polygon points="36,8 32,16 40,16" fill="#4aa3ff" />
        <line x1="36" y1="36" x2="14" y2="54" stroke="#3dce6a" strokeWidth="3.2" />
        <polygon points="14,54 22,48 18,44" fill="#3dce6a" />
        <circle cx="36" cy="36" r="5" fill="#f5e6b8" stroke="#1a1610" strokeWidth="1.4" />
        <text x="62" y="32" fill="#e24b4b" fontSize="8" fontWeight="700">
          X
        </text>
        <text x="40" y="12" fill="#4aa3ff" fontSize="8" fontWeight="700">
          Z
        </text>
        <text x="8" y="62" fill="#3dce6a" fontSize="8" fontWeight="700">
          Y
        </text>
      </svg>
    </div>
  )
}

export default function PhotoCalibOverlay() {
  const { t } = useI18n()
  const wrapRef = useRef(null)
  const calib = useActiveConfigStore((s) => s.photoCalib)
  const setPhotoCalib = useActiveConfigStore((s) => s.setPhotoCalib)
  const resetPhotoCalib = useActiveConfigStore((s) => s.resetPhotoCalib)
  const step = calib?.step || 'origin'
  const photoAspect = calib?.photoAspect || 1.5
  const [rect, setRect] = useState({ x: 0, y: 0, w: 1, h: 1 })

  const syncRect = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setRect(letterboxRect(r.width / Math.max(1, r.height), photoAspect))
  }, [photoAspect])

  useLayoutEffect(() => {
    syncRect()
    const el = wrapRef.current
    if (!el) return undefined
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncRect)
      return () => window.removeEventListener('resize', syncRect)
    }
    const ro = new ResizeObserver(syncRect)
    ro.observe(el)
    return () => ro.disconnect()
  }, [syncRect])

  const toUv = useCallback(
    (ev) => {
      const el = wrapRef.current
      if (!el) return [0.5, 0.5]
      return photoUvFromPointer(ev, el, photoAspect)
    },
    [photoAspect],
  )

  const onMove = (ev) => {
    if (!calib || step === 'done') return
    const uv = toUv(ev)
    if (step === 'axisY0' && calib.originUv) {
      setPhotoCalib({ hoverUv: snapToXAxis(uv, calib, calib.originUv) })
      return
    }
    setPhotoCalib({ hoverUv: uv })
  }

  const onClick = (ev) => {
    if (!calib) return
    ev.preventDefault()
    const uv = toUv(ev)
    if (step === 'origin') {
      setPhotoCalib({ originUv: uv, hoverUv: uv, step: 'axisX' })
      return
    }
    if (step === 'axisX') {
      setPhotoCalib({ xUv: uv, step: 'axisZ' })
      return
    }
    if (step === 'axisZ') {
      setPhotoCalib({ zUv: uv, step: 'axisY0' })
      return
    }
    if (step === 'axisY0') {
      const y0 = snapToXAxis(uv, calib, calib.originUv)
      setPhotoCalib({ y0Uv: y0, hoverUv: y0, step: 'axisY' })
      return
    }
    if (step === 'axisY') {
      setPhotoCalib({ yUv: uv, step: 'scale' })
      return
    }
    if (step === 'scale') {
      setPhotoCalib({ step: 'done' })
    }
  }

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const onWheel = (ev) => {
      if (step !== 'scale' && step !== 'done') return
      ev.preventDefault()
      const prev = calib?.scale || 1
      const next = Math.min(4, Math.max(0.25, prev * (ev.deltaY > 0 ? 0.92 : 1.08)))
      setPhotoCalib({ scale: next })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [calib, step, setPhotoCalib])

  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key === 'Escape') {
        if (step === 'origin') return
        const i = PHOTO_STEPS.indexOf(step)
        const prev = i <= 0 ? 'origin' : PHOTO_STEPS[i - 1]
        const patch = { step: prev, hoverUv: calib.hoverUv }
        if (prev === 'origin') patch.originUv = null
        if (prev === 'axisX') patch.xUv = null
        if (prev === 'axisZ') patch.zUv = null
        if (prev === 'axisY0') patch.y0Uv = null
        if (prev === 'axisY') patch.yUv = null
        setPhotoCalib(patch)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, calib, setPhotoCalib])

  if (!calib || step === 'done') return null

  const origin = calib.originUv || (step === 'origin' ? calib.hoverUv : null)
  const xPt =
    calib.xUv ||
    (step === 'axisX' && origin && calib.hoverUv ? calib.hoverUv : null)
  const zPt =
    calib.zUv ||
    (step === 'axisZ' && origin && calib.hoverUv ? calib.hoverUv : null)
  const dirX = origin ? xPlusUv({ ...calib, xUv: xPt || calib.xUv }, origin) : [1, 0]
  const y0Pt =
    calib.y0Uv ||
    (step === 'axisY0' && origin && calib.hoverUv
      ? snapToXAxis(calib.hoverUv, { ...calib, xUv: xPt || calib.xUv }, origin)
      : null)
  const yPt =
    calib.yUv ||
    (step === 'axisY' && y0Pt && calib.hoverUv ? calib.hoverUv : null)
  const ghostZ = origin && !calib.zUv ? defaultZuv(origin) : null
  const ghostYFrom = y0Pt || origin
  const ghostY =
    ghostYFrom && !calib.yUv ? defaultYuv(origin || ghostYFrom, dirX, ghostYFrom) : null
  const yDir = y0Pt && yPt ? dirFrom(y0Pt, yPt) : null
  const yFromOrigin =
    origin && yDir
      ? [origin[0] + yDir[0] * 0.18, origin[1] + yDir[1] * 0.18]
      : null
  const xRail =
    origin && dirX && (step === 'axisY0' || step === 'axisY')
      ? [
          [origin[0] - dirX[0] * 1.4, origin[1] - dirX[1] * 1.4],
          [origin[0] + dirX[0] * 1.4, origin[1] + dirX[1] * 1.4],
        ]
      : null

  const stepIndex =
    step === 'done' ? PHOTO_STEPS.length : Math.max(1, PHOTO_STEPS.indexOf(step) + 1)
  const hideCursor =
    step === 'origin' ||
    step === 'axisX' ||
    step === 'axisZ' ||
    step === 'axisY0' ||
    step === 'axisY'

  const frame = {
    x: `${rect.x * 100}%`,
    y: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  }

  return (
    <div
      ref={wrapRef}
      className={`photo-calib${hideCursor ? ' is-drawing' : ''}${
        step === 'origin' ? ' is-origin' : ''
      }`}
      onPointerMove={onMove}
      onPointerDown={(e) => {
        if (e.target.closest('.photo-calib-card')) return
        if (e.button === 0) onClick(e)
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg className="photo-calib-svg" aria-hidden>
        <rect className="photo-calib-frame" {...frame} />
        {step === 'origin' && (
          <line
            className="rail-x is-hint"
            {...linePts(calib.xA, calib.xB, rect)}
          />
        )}
        {xRail && (
          <line className="rail-x is-hint" {...linePts(xRail[0], xRail[1], rect)} />
        )}
        {origin && xPt && (
          <line className="axis-x" {...linePts(origin, xPt, rect)} />
        )}
        {ghostZ && origin && (step === 'origin' || step === 'axisX') && (
          <line className="axis-ghost z" {...linePts(origin, ghostZ, rect)} />
        )}
        {ghostY &&
          ghostYFrom &&
          (step === 'origin' ||
            step === 'axisX' ||
            step === 'axisZ' ||
            step === 'axisY0') && (
            <line className="axis-ghost y" {...linePts(ghostYFrom, ghostY, rect)} />
          )}
        {origin && zPt && (
          <line className="axis-z" {...linePts(origin, zPt, rect)} />
        )}
        {y0Pt && yPt && (
          <line className="axis-y" {...linePts(y0Pt, yPt, rect)} />
        )}
        {yFromOrigin && origin && (
          <line className="axis-y is-from-origin" {...linePts(origin, yFromOrigin, rect)} />
        )}
        {y0Pt && (
          <circle
            className="y0-mark"
            cx={`${photoToViewUv(y0Pt, rect)[0] * 100}%`}
            cy={`${photoToViewUv(y0Pt, rect)[1] * 100}%`}
            r="6"
          />
        )}
      </svg>

      {step === 'origin' && <GizmoMark uv={calib.hoverUv} pulse rect={rect} />}
      {origin && step !== 'origin' && <GizmoMark uv={origin} rect={rect} />}

      <div className="photo-calib-card">
        <div className="photo-calib-progress" aria-hidden>
          {['1', '2', '3', '4', '5', '·'].map((n, i) => (
            <span
              key={n + i}
              className={`dot${stepIndex > i ? ' on' : ''}${
                stepIndex === i + 1 ? ' current' : ''
              }`}
            >
              {n}
            </span>
          ))}
        </div>
        <p className="photo-calib-title">{t(`config.photoStep${step}`)}</p>
        <p className="photo-calib-help">{t(`config.photoHelp${step}`)}</p>
        <div className="photo-calib-actions">
          <button
            type="button"
            className="btn-sm"
            onClick={(e) => {
              e.stopPropagation()
              resetPhotoCalib()
            }}
          >
            {t('config.photoRestart')}
          </button>
          {step === 'scale' && (
            <button
              type="button"
              className="btn-sm primary"
              onClick={(e) => {
                e.stopPropagation()
                setPhotoCalib({ step: 'done' })
              }}
            >
              {t('config.photoConfirm')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
