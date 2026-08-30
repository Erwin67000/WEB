import { useCallback, useEffect, useRef } from 'react'
import { useActiveConfigStore } from '../store/ConfigStoreContext.jsx'
import { useI18n } from '@texte/I18nProvider.jsx'
import {
  PHOTO_STEPS,
  uvFromPointer,
  xPlusUv,
  defaultZuv,
  defaultYuv,
} from '../lib/photoCalib.js'

function pct([u, v]) {
  return { left: `${u * 100}%`, top: `${v * 100}%` }
}

function GizmoMark({ uv, pulse }) {
  if (!uv) return null
  return (
    <div
      className={`photo-calib-gizmo${pulse ? ' is-pulse' : ''}`}
      style={pct(uv)}
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

  const toUv = useCallback(
    (ev) => {
      const el = wrapRef.current
      if (!el) return [0.5, 0.5]
      return uvFromPointer(ev, el)
    },
    [],
  )

  const onMove = (ev) => {
    if (!calib || step === 'done') return
    setPhotoCalib({ hoverUv: toUv(ev) })
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
      setPhotoCalib({ zUv: uv, step: 'axisY' })
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
  const yPt =
    calib.yUv ||
    (step === 'axisY' && origin && calib.hoverUv ? calib.hoverUv : null)
  const dirX = origin ? xPlusUv({ ...calib, xUv: xPt || calib.xUv }, origin) : [1, 0]
  const ghostZ = origin && !calib.zUv ? defaultZuv(origin) : null
  const ghostY =
    origin && !calib.yUv ? defaultYuv(origin, dirX) : null

  const stepIndex =
    step === 'done' ? 5 : Math.max(1, PHOTO_STEPS.indexOf(step) + 1)
  const hideCursor =
    step === 'origin' ||
    step === 'axisX' ||
    step === 'axisZ' ||
    step === 'axisY'

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
        {step === 'origin' && (
          <line
            className="rail-x is-hint"
            x1={`${calib.xA[0] * 100}%`}
            y1={`${calib.xA[1] * 100}%`}
            x2={`${calib.xB[0] * 100}%`}
            y2={`${calib.xB[1] * 100}%`}
          />
        )}
        {origin && xPt && (
          <line
            className="axis-x"
            x1={`${origin[0] * 100}%`}
            y1={`${origin[1] * 100}%`}
            x2={`${xPt[0] * 100}%`}
            y2={`${xPt[1] * 100}%`}
          />
        )}
        {ghostZ && origin && (step === 'origin' || step === 'axisX') && (
          <line
            className="axis-ghost z"
            x1={`${origin[0] * 100}%`}
            y1={`${origin[1] * 100}%`}
            x2={`${ghostZ[0] * 100}%`}
            y2={`${ghostZ[1] * 100}%`}
          />
        )}
        {ghostY && origin && (step === 'origin' || step === 'axisX' || step === 'axisZ') && (
          <line
            className="axis-ghost y"
            x1={`${origin[0] * 100}%`}
            y1={`${origin[1] * 100}%`}
            x2={`${ghostY[0] * 100}%`}
            y2={`${ghostY[1] * 100}%`}
          />
        )}
        {origin && zPt && (
          <line
            className="axis-z"
            x1={`${origin[0] * 100}%`}
            y1={`${origin[1] * 100}%`}
            x2={`${zPt[0] * 100}%`}
            y2={`${zPt[1] * 100}%`}
          />
        )}
        {origin && yPt && (
          <line
            className="axis-y"
            x1={`${origin[0] * 100}%`}
            y1={`${origin[1] * 100}%`}
            x2={`${yPt[0] * 100}%`}
            y2={`${yPt[1] * 100}%`}
          />
        )}
      </svg>

      {step === 'origin' && <GizmoMark uv={calib.hoverUv} pulse />}
      {origin && step !== 'origin' && <GizmoMark uv={origin} />}

      <div className="photo-calib-card">
        <div className="photo-calib-progress" aria-hidden>
          {['1', '2', '3', '4', '·'].map((n, i) => (
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
