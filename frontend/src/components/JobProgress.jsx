/*
  Live bar for a background job. The server reports a floor (`percent`) and how far
  the bar may drift (`ceiling`). Between polls the fill eases toward the ceiling and
  stops short of it, so a long model call still looks like it is moving.
*/

import { useEffect, useRef, useState } from 'react'
import './JobProgress.css'

// About 95% of the gap in 45s for the long extract, and in 12s for every other step.
const EXTRACT_TAU_MS = 45000 / Math.log(20)
const STEP_TAU_MS = 12000 / Math.log(20)

export default function JobProgress({ progress }) {
  const shownRef = useRef(progress?.percent ?? 0)
  const progressRef = useRef(progress)
  const [shown, setShown] = useState(() => progress?.percent ?? 0)
  const signature = progress
    ? `${progress.phase}|${progress.percent}|${progress.ceiling}|${progress.label}`
    : ''

  useEffect(() => {
    progressRef.current = progress
  })

  useEffect(() => {
    const current = progressRef.current
    if (!current) return undefined
    const tau = current.phase === 'extracting' ? EXTRACT_TAU_MS : STEP_TAU_MS
    const floor = Number(current.percent) || 0
    const ceiling = Math.max(floor, Number(current.ceiling) || floor)
    let value = Math.max(shownRef.current, floor)
    if (ceiling > floor) value = Math.min(value, ceiling - 0.05)
    shownRef.current = value
    setShown(value)

    let last = performance.now()
    let frame
    const tick = (now) => {
      const gap = ceiling - value
      if (gap > 0.05) {
        value += gap * (1 - Math.exp(-(now - last) / tau))
        if (value > ceiling - 0.05) value = ceiling - 0.05
        shownRef.current = value
        setShown(value)
      }
      last = now
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [signature])

  if (!progress) return null

  const value = Math.max(0, Math.min(100, shown))
  const label = progress.label || 'Working'

  return (
    <div className="job-progress">
      <div
        className="job-progress-track"
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="job-progress-fill" style={{ width: `${value}%` }} />
      </div>
      <p className="job-progress-label">{label}</p>
    </div>
  )
}
