import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useActiveConfigStore } from '../store/ConfigStoreContext.jsx'
import { useI18n } from '@texte/I18nProvider.jsx'
import { photoUvFromPointer, photoToViewUv, letterboxRect } from '../lib/photoCalib.js'
import {
  MATCH_STEPS,
  MATCH_LINE_OF,
  AXIS_COLOR,
  vanishPoint,
  isLine,
  matchFovDeg,
} from '../lib/photoMatch.js'

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

function clipUv(uv) {
  return [
    Math.min(2.4, Math.max(-1.4, uv[0])),
    Math.min(2.4, Math.max(-1.4, uv[1])),
  ]
}

function nextStep(step) {
  const i = MATCH_STEPS.indexOf(step)
  return MATCH_STEPS[Math.min(MATCH_STEPS.length - 1, i + 1)]
}

function prevStep(step) {
  const i = MATCH_STEPS.indexOf(step)
  return MATCH_STEPS[Math.max(0, i - 1)]
}

function Handle({ uv, color, rect }) {
  if (!uv) return null
  const p = photoToViewUv(uv, rect)
  return (
    <circle
      cx={`${p[0] * 100}%`}
      cy={`${p[1] * 100}%`}
      r="5"
      fill={color}
      stroke="#1a1610"
      strokeWidth="1.4"
    />
  )
}

function AxisPair({ lines, axis, rect, hoverLine }) {
  const color = AXIS_COLOR[axis]
  const pair = [lines?.[axis]?.[0], lines?.[axis]?.[1]]
  const hover = hoverLine && hoverLine.axis === axis ? hoverLine : null
  const l0 = pair[0]
  const l1 = pair[1] || hover
  const vp = isLine(l0) && isLine(l1) ? vanishPoint(l0, l1) : null
  const segs = pair.filter(isLine)
  if (hover) segs.push(hover)
  return (
    <g className={`vp-axis vp-${axis}`}>
      {vp && !vp.infinite && vp.uv &&
        segs.map((ln, i) => (
          <line
            key={`g${i}`}
            className="vp-guide"
            stroke={color}
            {...linePts(ln.a, clipUv(vp.uv), rect)}
          />
        ))}
      {segs.map((ln, i) => (
        <g key={i}>
          <line className={`axis-${axis === 'z' ? 'z' : axis === 'y' ? 'y' : 'x'}`} {...linePts(ln.a, ln.b, rect)} />
          <Handle uv={ln.a} color={color} rect={rect} />
          <Handle uv={ln.b} color={color} rect={rect} />
        </g>
      ))}
    </g>
  )
}

export default function PhotoCalibOverlay() {
  const { t } = useI18n()
  const wrapRef = useRef(null)
  const calib = useActiveConfigStore((s) => s.photoCalib)
  const setPhotoCalib = useActiveConfigStore((s) => s.setPhotoCalib)
  const resetPhotoCalib = useActiveConfigStore((s) => s.resetPhotoCalib)
  const step = calib?.step || 'x1'
  const photoAspect = calib?.photoAspect || 1.5
  const [rect, setRect] = useState({ x: 0, y: 0, w: 1, h: 1 })
  const dragRef = useRef(null)

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

  const commitLine = (a, b) => {
    const spec = MATCH_LINE_OF[step]
    if (!spec) return
    const [axis, idx] = spec
    const lines = {
      x: [...(calib.lines?.x || [null, null])],
      y: [...(calib.lines?.y || [null, null])],
      z: [...(calib.lines?.z || [null, null])],
    }
    lines[axis] = [...lines[axis]]
    lines[axis][idx] = { a, b }
    setPhotoCalib({ lines, pending: null, hoverUv: b, step: nextStep(step) })
  }

  const onMove = (ev) => {
    if (!calib || step === 'done') return
    setPhotoCalib({ hoverUv: toUv(ev) })
  }

  const onDown = (ev) => {
    if (!calib || ev.button !== 0) return
    if (ev.target.closest('.photo-calib-card')) return
    ev.preventDefault()
    const uv = toUv(ev)
    if (step === 'origin') {
      setPhotoCalib({ originUv: uv, hoverUv: uv, step: 'scale' })
      return
    }
    if (step === 'scale') {
      setPhotoCalib({ step: 'done' })
      return
    }
    if (!MATCH_LINE_OF[step]) return
    if (calib.pending) {
      commitLine(calib.pending, uv)
      dragRef.current = null
      return
    }
    dragRef.current = { start: uv, moved: false }
    setPhotoCalib({ pending: uv, hoverUv: uv })
  }

  const onUp = (ev) => {
    if (!dragRef.current || !calib?.pending) return
    const uv = toUv(ev)
    const s = dragRef.current.start
    const dist = Math.hypot(uv[0] - s[0], uv[1] - s[1])
    dragRef.current = null
    if (dist > 0.012) commitLine(s, uv)
  }

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
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
      if (ev.key !== 'Escape' || !calib) return
      if (calib.pending) {
        setPhotoCalib({ pending: null })
        return
      }
      if (step === 'x1') return
      const prev = prevStep(step)
      const spec = MATCH_LINE_OF[prev]
      const patch = { step: prev, pending: null }
      if (prev === 'origin') patch.originUv = null
      if (spec) {
        const [axis, idx] = spec
        const lines = {
          x: [...(calib.lines?.x || [null, null])],
          y: [...(calib.lines?.y || [null, null])],
          z: [...(calib.lines?.z || [null, null])],
        }
        lines[axis] = [...lines[axis]]
        lines[axis][idx] = null
        patch.lines = lines
      }
      setPhotoCalib(patch)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step, calib, setPhotoCalib])

  if (!calib || step === 'done') return null

  const hoverLine =
    calib.pending && calib.hoverUv && MATCH_LINE_OF[step]
      ? { axis: MATCH_LINE_OF[step][0], a: calib.pending, b: calib.hoverUv }
      : null

  const stepIndex = Math.max(1, MATCH_STEPS.indexOf(step) + 1)
  const drawing = Boolean(MATCH_LINE_OF[step]) || step === 'origin'
  const fov = matchFovDeg(calib)
  const frame = {
    x: `${rect.x * 100}%`,
    y: `${rect.y * 100}%`,
    width: `${rect.w * 100}%`,
    height: `${rect.h * 100}%`,
  }

  return (
    <div
      ref={wrapRef}
      className={`photo-calib${drawing ? ' is-drawing' : ''}${
        step === 'origin' ? ' is-origin' : ''
      }`}
      onPointerMove={onMove}
      onPointerDown={onDown}
      onPointerUp={onUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg className="photo-calib-svg" aria-hidden>
        <rect className="photo-calib-frame" {...frame} />
        {step === 'x1' && calib.xA && calib.xB && (
          <line className="rail-x is-hint" {...linePts(calib.xA, calib.xB, rect)} />
        )}
        <AxisPair lines={calib.lines} axis="x" rect={rect} hoverLine={hoverLine} />
        <AxisPair lines={calib.lines} axis="z" rect={rect} hoverLine={hoverLine} />
        <AxisPair lines={calib.lines} axis="y" rect={rect} hoverLine={hoverLine} />
        {calib.originUv && (
          <circle
            className="origin-mark"
            cx={`${photoToViewUv(calib.originUv, rect)[0] * 100}%`}
            cy={`${photoToViewUv(calib.originUv, rect)[1] * 100}%`}
            r="7"
            fill="#f5e6b8"
            stroke="#1a1610"
            strokeWidth="1.6"
          />
        )}
      </svg>

      {step === 'origin' && (
        <div className="photo-calib-gizmo is-pulse" style={pct(calib.hoverUv, rect)} aria-hidden>
          <svg viewBox="0 0 72 72" width="72" height="72">
            <circle cx="36" cy="36" r="6" fill="#f5e6b8" stroke="#1a1610" strokeWidth="1.6" />
          </svg>
        </div>
      )}

      <div className="photo-calib-card">
        <div className="photo-calib-progress" aria-hidden>
          {['1', '2', '3', '4', '5', '6', '7', '·'].map((n, i) => (
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
        {fov && step === 'scale' ? (
          <p className="photo-calib-help" style={{ marginTop: '-0.4rem' }}>
            {t('config.photoFovReadout', { n: Math.round(fov) })}
          </p>
        ) : null}
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
