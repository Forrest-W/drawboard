import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'

type Tool = 'pen' | 'eraser'

type StrokePoint = {
  x: number
  y: number
  pressure: number
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function getPressure(e: PointerEvent) {
  if (typeof e.pressure === 'number' && e.pressure > 0) return e.pressure
  return 0.5
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export default function Blackboard() {
  const { user, logout } = useAuth()
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const drawingRef = useRef(false)
  const lastPtRef = useRef<StrokePoint | null>(null)

  const undoRef = useRef<ImageData[]>([])
  const redoRef = useRef<ImageData[]>([])

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#e8f4ff') // chalk-ish
  const [size, setSize] = useState(10)
  const [exportBg, setExportBg] = useState(true)

  const dpr = useMemo(() => Math.max(1, Math.floor(window.devicePixelRatio || 1)), [])

  function getCtx() {
    const c = canvasRef.current
    if (!c) return null
    const ctx = c.getContext('2d', { willReadFrequently: true })
    return ctx
  }

  function snapshotForUndo() {
    const ctx = getCtx()
    const c = canvasRef.current
    if (!ctx || !c) return
    try {
      const img = ctx.getImageData(0, 0, c.width, c.height)
      undoRef.current.push(img)
      if (undoRef.current.length > 30) undoRef.current.shift()
      redoRef.current = []
    } catch {
      // ignore security/oom edge cases
    }
  }

  function restore(img: ImageData) {
    const ctx = getCtx()
    const c = canvasRef.current
    if (!ctx || !c) return
    ctx.putImageData(img, 0, 0)
  }

  function canUndo() {
    return undoRef.current.length > 0
  }
  function canRedo() {
    return redoRef.current.length > 0
  }

  function undo() {
    const ctx = getCtx()
    const c = canvasRef.current
    if (!ctx || !c || !canUndo()) return
    const current = ctx.getImageData(0, 0, c.width, c.height)
    const prev = undoRef.current.pop()!
    redoRef.current.push(current)
    restore(prev)
  }

  function redo() {
    const ctx = getCtx()
    const c = canvasRef.current
    if (!ctx || !c || !canRedo()) return
    const current = ctx.getImageData(0, 0, c.width, c.height)
    const next = redoRef.current.pop()!
    undoRef.current.push(current)
    restore(next)
  }

  function clear() {
    const ctx = getCtx()
    const c = canvasRef.current
    if (!ctx || !c) return
    snapshotForUndo()
    ctx.clearRect(0, 0, c.width, c.height)
  }

  function ensureCanvasSize() {
    const wrap = wrapRef.current
    const c = canvasRef.current
    if (!wrap || !c) return
    const rect = wrap.getBoundingClientRect()
    const nextW = Math.max(1, Math.floor(rect.width * dpr))
    const nextH = Math.max(1, Math.floor(rect.height * dpr))
    if (c.width === nextW && c.height === nextH) return

    const ctx = getCtx()
    if (!ctx) return
    const prev = ctx.getImageData(0, 0, c.width || 1, c.height || 1)

    c.width = nextW
    c.height = nextH
    c.style.width = `${Math.floor(rect.width)}px`
    c.style.height = `${Math.floor(rect.height)}px`

    const nextCtx = getCtx()
    if (!nextCtx) return
    nextCtx.putImageData(prev, 0, 0)
  }

  function toLocal(e: PointerEvent): StrokePoint | null {
    const c = canvasRef.current
    if (!c) return null
    const rect = c.getBoundingClientRect()
    const x = (e.clientX - rect.left) * dpr
    const y = (e.clientY - rect.top) * dpr
    return {
      x: clamp(x, 0, c.width),
      y: clamp(y, 0, c.height),
      pressure: clamp(getPressure(e), 0.1, 1),
    }
  }

  function drawChalkSegment(a: StrokePoint, b: StrokePoint) {
    const ctx = getCtx()
    if (!ctx) return

    const baseSize = size * dpr
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    const step = Math.max(1, Math.floor(baseSize / 3))
    const steps = Math.max(1, Math.floor(dist / step))

    const isEraser = tool === 'eraser'
    ctx.save()
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 1 : i / steps
      const x = a.x + (b.x - a.x) * t
      const y = a.y + (b.y - a.y) * t
      const p = a.pressure + (b.pressure - a.pressure) * t

      const jitter = baseSize * 0.08
      const jx = (Math.random() - 0.5) * jitter
      const jy = (Math.random() - 0.5) * jitter

      const r = (baseSize / 2) * (0.65 + 0.7 * p)
      const alpha = isEraser ? 1 : 0.06 + 0.14 * p

      ctx.beginPath()
      ctx.globalAlpha = alpha
      ctx.fillStyle = color
      ctx.shadowColor = isEraser ? 'transparent' : 'rgba(255,255,255,0.25)'
      ctx.shadowBlur = isEraser ? 0 : Math.max(0, r * 0.25)
      ctx.arc(x + jx, y + jy, r, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  }

  useEffect(() => {
    ensureCanvasSize()
    const ro = new ResizeObserver(() => ensureCanvasSize())
    if (wrapRef.current) ro.observe(wrapRef.current)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType !== 'touch' && e.pointerType !== 'pen') return
      c.setPointerCapture(e.pointerId)
      drawingRef.current = true
      snapshotForUndo()
      redoRef.current = []
      lastPtRef.current = toLocal(e)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (!drawingRef.current) return
      const last = lastPtRef.current
      const next = toLocal(e)
      if (!last || !next) return
      drawChalkSegment(last, next)
      lastPtRef.current = next
    }

    const end = () => {
      drawingRef.current = false
      lastPtRef.current = null
    }

    c.addEventListener('pointerdown', onPointerDown)
    c.addEventListener('pointermove', onPointerMove)
    c.addEventListener('pointerup', end)
    c.addEventListener('pointercancel', end)
    c.addEventListener('pointerleave', end)

    return () => {
      c.removeEventListener('pointerdown', onPointerDown)
      c.removeEventListener('pointermove', onPointerMove)
      c.removeEventListener('pointerup', end)
      c.removeEventListener('pointercancel', end)
      c.removeEventListener('pointerleave', end)
    }
  }, [color, dpr, size, tool])

  async function exportPng() {
    const c = canvasRef.current
    if (!c) return

    const out = document.createElement('canvas')
    out.width = c.width
    out.height = c.height
    const ctx = out.getContext('2d')
    if (!ctx) return

    if (exportBg) {
      ctx.fillStyle = '#0b2a20'
      ctx.fillRect(0, 0, out.width, out.height)
    }
    ctx.drawImage(c, 0, 0)

    const blob = await new Promise<Blob | null>((resolve) =>
      out.toBlob((b) => resolve(b), 'image/png'),
    )
    if (!blob) return
    downloadBlob(blob, `drawboard-${Date.now()}.png`)
  }

  const cursorStyle =
    tool === 'eraser'
      ? { cursor: 'crosshair' }
      : {
          cursor: 'crosshair',
        }

  return (
    <div className="bb">
      <header className="bb-toolbar" role="toolbar" aria-label="blackboard tools">
        <div className="bb-left">
          <div className="bb-title">
            <div className="bb-title-main">电子黑板</div>
            <div className="bb-title-sub">
              {user ? `当前用户：${user.name}` : '画画并导出为图片'}
            </div>
          </div>
        </div>

        <div className="bb-controls">
          <div className="bb-seg">
            <button
              type="button"
              className={tool === 'pen' ? 'bb-btn bb-btn-on' : 'bb-btn'}
              onClick={() => setTool('pen')}
            >
              画笔
            </button>
            <button
              type="button"
              className={tool === 'eraser' ? 'bb-btn bb-btn-on' : 'bb-btn'}
              onClick={() => setTool('eraser')}
            >
              橡皮
            </button>
          </div>

          <label className="bb-field">
            <span>颜色</span>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              disabled={tool === 'eraser'}
              aria-label="color"
            />
          </label>

          <label className="bb-field bb-range">
            <span>粗细</span>
            <input
              type="range"
              min={2}
              max={42}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              aria-label="brush size"
            />
          </label>

          <div className="bb-seg">
            <button type="button" className="bb-btn" onClick={undo} disabled={!canUndo()}>
              撤销
            </button>
            <button type="button" className="bb-btn" onClick={redo} disabled={!canRedo()}>
              重做
            </button>
          </div>

          <button type="button" className="bb-btn bb-danger" onClick={clear}>
            清空
          </button>

          <label className="bb-check">
            <input
              type="checkbox"
              checked={exportBg}
              onChange={(e) => setExportBg(e.target.checked)}
            />
            <span>导出带黑板底色</span>
          </label>

          <button type="button" className="bb-btn bb-primary" onClick={exportPng}>
            导出 PNG
          </button>

          {user && (
            <button type="button" className="bb-btn" onClick={logout}>
              退出登录
            </button>
          )}
        </div>
      </header>

      <div className="bb-board" ref={wrapRef}>
        <canvas ref={canvasRef} className="bb-canvas" style={cursorStyle} />
        <div className="bb-hint">提示：支持鼠标/触摸/手写笔绘制</div>
      </div>
    </div>
  )
}

