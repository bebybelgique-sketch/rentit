import { useEffect, useRef } from 'react'

const COLORS = ['#6c63ff', '#a89cff', '#7c73ff', '#4fc3f7', '#5a52d5']
const PARTICLE_COUNT = 160
const MAX_LINK_DIST = 110   // constellation line distance

export default function StatsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf: number
    let w = 0, h = 0

    const resize = () => {
      w = canvas.width  = canvas.offsetWidth
      h = canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Particles ──────────────────────────────────────────────
    const px  = new Float32Array(PARTICLE_COUNT)
    const py  = new Float32Array(PARTICLE_COUNT)
    const pvx = new Float32Array(PARTICLE_COUNT)
    const pvy = new Float32Array(PARTICLE_COUNT)
    const psize   = new Float32Array(PARTICLE_COUNT)
    const popacity = new Float32Array(PARTICLE_COUNT)
    const ppulse  = new Float32Array(PARTICLE_COUNT)
    const pcolor  = new Uint8Array(PARTICLE_COUNT)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      px[i] = Math.random() * 1600
      py[i] = Math.random() * 600
      pvx[i] = (Math.random() - 0.5) * 0.38
      pvy[i] = (Math.random() - 0.5) * 0.38
      psize[i] = 0.8 + Math.random() * 2.2
      popacity[i] = 0.25 + Math.random() * 0.55
      ppulse[i] = Math.random() * Math.PI * 2
      pcolor[i] = Math.floor(Math.random() * COLORS.length)
    }

    // ── Glows (like Hero's ambient orbs) ──────────────────────
    const glows = [
      { xf: 0.22, yf: 0.5,  r: 260, colorA: 'rgba(108,99,255,0.18)', colorB: 'rgba(108,99,255,0)',  phase: 0 },
      { xf: 0.78, yf: 0.5,  r: 200, colorA: 'rgba(79,195,247,0.12)',  colorB: 'rgba(79,195,247,0)',   phase: 1.4 },
      { xf: 0.5,  yf: 0.85, r: 180, colorA: 'rgba(168,156,255,0.1)', colorB: 'rgba(168,156,255,0)', phase: 2.8 },
    ]

    // ── IntersectionObserver — pause off-screen ────────────────
    let visible = true
    const obs = new IntersectionObserver(([e]) => { visible = e.isIntersecting }, { threshold: 0 })
    obs.observe(canvas)

    let t = 0

    const draw = () => {
      raf = requestAnimationFrame(draw)
      if (!visible) return
      ctx.clearRect(0, 0, w, h)
      t += 0.012

      // ── Ambient glows ──────────────────────────────────────
      for (const g of glows) {
        const pulse = 1 + 0.06 * Math.sin(t * 0.7 + g.phase)
        const cx = w * g.xf, cy = h * g.yf, r = g.r * pulse
        const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
        gr.addColorStop(0, g.colorA)
        gr.addColorStop(1, g.colorB)
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fillStyle = gr
        ctx.fill()
      }

      // ── Constellation lines ────────────────────────────────
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        for (let j = i + 1; j < PARTICLE_COUNT; j++) {
          const dx = px[i] - px[j], dy = py[i] - py[j]
          const d2 = dx * dx + dy * dy
          if (d2 < MAX_LINK_DIST * MAX_LINK_DIST) {
            const alpha = (1 - Math.sqrt(d2) / MAX_LINK_DIST) * 0.18
            ctx.beginPath()
            ctx.moveTo(px[i], py[i])
            ctx.lineTo(px[j], py[j])
            ctx.strokeStyle = `rgba(108,99,255,${alpha.toFixed(3)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      // ── Particles ──────────────────────────────────────────
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        px[i] += pvx[i]; py[i] += pvy[i]
        ppulse[i] += 0.028
        if (px[i] < 0) px[i] = w; if (px[i] > w) px[i] = 0
        if (py[i] < 0) py[i] = h; if (py[i] > h) py[i] = 0

        const a = popacity[i] * (0.6 + 0.4 * Math.sin(ppulse[i]))
        const col = COLORS[pcolor[i]]
        const hex = Math.floor(a * 255).toString(16).padStart(2, '0')

        ctx.shadowBlur = psize[i] > 1.8 ? 8 : 0
        ctx.shadowColor = col
        ctx.beginPath()
        ctx.arc(px[i], py[i], psize[i], 0, Math.PI * 2)
        ctx.fillStyle = col + hex
        ctx.fill()
      }
      ctx.shadowBlur = 0
    }

    raf = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      obs.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }}
    />
  )
}
