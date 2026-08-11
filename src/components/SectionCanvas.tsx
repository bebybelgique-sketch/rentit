import { useEffect, useRef } from 'react'

export type CanvasVariant = 'stats' | 'categories' | 'steps' | 'trust' | 'owners' | 'b2b'

interface Props {
  variant: CanvasVariant
  style?: React.CSSProperties
}

// ─── PALETTE ────────────────────────────────────────────────────────────────
const PURPLE = ['#6c63ff', '#a89cff', '#5046e4', '#c4bfff']
const MULTI  = ['#6c63ff', '#16a34a', '#f59e0b', '#0284c7', '#e11d48', '#94a3b8']
const DARK   = ['rgba(168,156,255,0.7)', 'rgba(79,195,247,0.6)', 'rgba(108,99,255,0.8)']
const AMBER  = ['#fbbf24', '#f59e0b', '#fde68a', '#d97706']

// ─── DRAW HELPERS ────────────────────────────────────────────────────────────

function drawMiniDrill(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = s * 0.12
  ctx.lineCap = 'round'
  // body
  ctx.beginPath()
  ctx.roundRect(-s * 0.35, -s * 0.18, s * 0.7, s * 0.36, s * 0.08)
  ctx.stroke()
  // handle
  ctx.beginPath()
  ctx.roundRect(-s * 0.2, s * 0.18, s * 0.28, s * 0.38, s * 0.06)
  ctx.stroke()
  // bit
  ctx.beginPath()
  ctx.moveTo(s * 0.35, 0)
  ctx.lineTo(s * 0.58, 0)
  ctx.stroke()
  ctx.restore()
}

function drawMiniWrench(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.strokeStyle = color
  ctx.lineWidth = s * 0.14
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.55)
  ctx.lineTo(0, s * 0.55)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(0, -s * 0.35, s * 0.22, 0.4, Math.PI * 1.4)
  ctx.stroke()
  ctx.restore()
}

function drawMiniHammer(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.rotate(Math.PI / 4)
  ctx.fillStyle = color
  // head
  ctx.beginPath()
  ctx.roundRect(-s * 0.3, -s * 0.55, s * 0.6, s * 0.3, s * 0.06)
  ctx.fill()
  // handle
  ctx.beginPath()
  ctx.roundRect(-s * 0.07, -s * 0.25, s * 0.14, s * 0.7, s * 0.04)
  ctx.fill()
  ctx.restore()
}

function drawMiniShovel(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = s * 0.12
  ctx.lineCap = 'round'
  // handle
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.55)
  ctx.lineTo(0, s * 0.15)
  ctx.stroke()
  // blade
  ctx.beginPath()
  ctx.moveTo(-s * 0.28, s * 0.15)
  ctx.lineTo(s * 0.28, s * 0.15)
  ctx.lineTo(s * 0.18, s * 0.55)
  ctx.arc(0, s * 0.45, s * 0.2, 0.5, Math.PI - 0.5)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawMiniRuler(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.rotate(Math.PI / 6)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.roundRect(-s * 0.55, -s * 0.14, s * 1.1, s * 0.28, s * 0.05)
  ctx.fill()
  // ticks
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  for (let i = -4; i <= 4; i++) {
    const h = i % 2 === 0 ? s * 0.18 : s * 0.12
    ctx.fillRect(i * s * 0.12 - 0.8, -h / 2, 1.5, h)
  }
  ctx.restore()
}

function drawMiniShield(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, -s * 0.55)
  ctx.lineTo(s * 0.42, -s * 0.3)
  ctx.lineTo(s * 0.42, s * 0.1)
  ctx.quadraticCurveTo(s * 0.42, s * 0.55, 0, s * 0.6)
  ctx.quadraticCurveTo(-s * 0.42, s * 0.55, -s * 0.42, s * 0.1)
  ctx.lineTo(-s * 0.42, -s * 0.3)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawMiniStar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.fillStyle = color
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2
    const b = a + Math.PI / 5
    if (i === 0) ctx.moveTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5)
    else ctx.lineTo(Math.cos(a) * s * 0.5, Math.sin(a) * s * 0.5)
    ctx.lineTo(Math.cos(b) * s * 0.22, Math.sin(b) * s * 0.22)
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawMiniCoin(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  // coin face
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(0, 0, s * 0.45, s * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()
  // coin side (3D)
  ctx.fillStyle = color.replace('0.', '0.5').replace('#', '#')
  ctx.beginPath()
  ctx.ellipse(s * 0.06, s * 0.08, s * 0.45, s * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(0, 0, s * 0.45, s * 0.45, 0, 0, Math.PI * 2)
  ctx.fill()
  // € sign
  ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.font = `bold ${s * 0.5}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('€', 0, 0)
  ctx.restore()
}

function drawMiniGraph(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.fillStyle = color
  const bars = [0.4, 0.7, 0.55, 0.9, 0.65]
  const bw = s * 0.15
  const gap = s * 0.05
  const totalW = bars.length * (bw + gap) - gap
  let bx = -totalW / 2
  for (const h of bars) {
    const bh = s * h
    ctx.beginPath()
    ctx.roundRect(bx, -bh / 2, bw, bh, 2)
    ctx.fill()
    bx += bw + gap
  }
  ctx.restore()
}

function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const grd = ctx.createRadialGradient(x, y, 0, x, y, r)
  grd.addColorStop(0, color.replace(')', `, ${alpha})`).replace('rgb', 'rgba'))
  grd.addColorStop(1, color.replace(')', ', 0)').replace('rgb', 'rgba'))
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = grd
  ctx.fill()
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────

export default function SectionCanvas({ variant, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf: number
    let active = true
    let w = 0, h = 0

    const resize = () => {
      w = canvas.width  = canvas.offsetWidth
      h = canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Pause when off-screen
    const obs = new IntersectionObserver(([e]) => { active = e.isIntersecting }, { threshold: 0 })
    obs.observe(canvas)

    // ── Init shapes ──────────────────────────────────────────────────────────
    interface Shape { x: number; y: number; vx: number; vy: number; rot: number; vr: number; s: number; phase: number; colorIdx: number }
    const N = 18
    const shapes: Shape[] = Array.from({ length: N }, (_, i) => ({
      x: Math.random() * 1400,
      y: Math.random() * 800,
      vx: (Math.random() - 0.5) * 0.45,
      vy: (Math.random() - 0.5) * 0.45,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.008,
      s: 14 + Math.random() * 24,
      phase: Math.random() * Math.PI * 2,
      colorIdx: i % 6,
    }))

    // Particles
    interface Pt { x: number; y: number; vx: number; vy: number; r: number; pulse: number; ci: number }
    const pts: Pt[] = Array.from({ length: 28 }, () => ({
      x: Math.random() * 1400, y: Math.random() * 800,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: 1 + Math.random() * 2, pulse: Math.random() * Math.PI * 2,
      ci: Math.floor(Math.random() * 6),
    }))

    let t = 0

    const drawShape = (s: Shape, pal: string[]) => {
      const col = pal[s.colorIdx % pal.length]
      const float = Math.sin(t * 0.8 + s.phase) * 10
      const alpha = 0.18 + 0.12 * Math.sin(t * 0.5 + s.phase)
      const x = s.x, y = s.y + float

      ctx.save()
      ctx.rotate(s.rot)

      switch (variant) {
        case 'stats':
          if (s.colorIdx % 3 === 0) drawMiniDrill(ctx, x, y, s.s, col, alpha)
          else if (s.colorIdx % 3 === 1) drawMiniWrench(ctx, x, y, s.s, col, alpha)
          else drawMiniShield(ctx, x, y, s.s, col, alpha)
          break
        case 'categories':
          if (s.colorIdx % 6 === 0) drawMiniDrill(ctx, x, y, s.s, MULTI[0], alpha)
          else if (s.colorIdx % 6 === 1) drawMiniWrench(ctx, x, y, s.s, MULTI[1], alpha)
          else if (s.colorIdx % 6 === 2) drawMiniShovel(ctx, x, y, s.s, MULTI[2], alpha)
          else if (s.colorIdx % 6 === 3) drawMiniHammer(ctx, x, y, s.s, MULTI[3], alpha)
          else if (s.colorIdx % 6 === 4) drawMiniRuler(ctx, x, y, s.s, MULTI[4], alpha)
          else drawMiniShield(ctx, x, y, s.s, MULTI[5], alpha)
          break
        case 'steps': {
          // flowing dots connected by lines
          ctx.restore()
          ctx.save()
          ctx.globalAlpha = alpha * 1.2
          ctx.fillStyle = col
          ctx.beginPath()
          ctx.arc(x, y, s.s * 0.3, 0, Math.PI * 2)
          ctx.fill()
          ctx.shadowBlur = 10
          ctx.shadowColor = col
          ctx.stroke()
          ctx.shadowBlur = 0
          break
        }
        case 'trust':
          if (s.colorIdx % 3 === 0) drawMiniShield(ctx, x, y, s.s, col, alpha * 1.4)
          else if (s.colorIdx % 3 === 1) drawMiniStar(ctx, x, y, s.s, col, alpha * 1.4)
          else drawMiniWrench(ctx, x, y, s.s, col, alpha * 1.4)
          break
        case 'owners':
          if (s.colorIdx % 2 === 0) drawMiniCoin(ctx, x, y, s.s, col, alpha)
          else drawMiniDrill(ctx, x, y, s.s, col, alpha)
          break
        case 'b2b':
          if (s.colorIdx % 2 === 0) drawMiniGraph(ctx, x, y, s.s, col, alpha * 1.3)
          else drawMiniCoin(ctx, x, y, s.s, col, alpha * 1.3)
          break
      }
      ctx.restore()
    }

    const getColors = (): string[] => {
      switch (variant) {
        case 'stats':      return PURPLE
        case 'categories': return MULTI
        case 'steps':      return PURPLE
        case 'trust':      return DARK
        case 'owners':     return AMBER
        case 'b2b':        return DARK
        default:           return PURPLE
      }
    }

    const isDark = variant === 'trust' || variant === 'b2b'

    const draw = () => {
      if (!active) { raf = requestAnimationFrame(draw); return }
      ctx.clearRect(0, 0, w, h)
      t += 0.01

      const pal = getColors()

      // Particles
      for (const p of pts) {
        p.x += p.vx; p.y += p.vy; p.pulse += 0.025
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        const a = (0.12 + 0.08 * Math.sin(p.pulse)) * (isDark ? 1.8 : 1)
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = pal[p.ci % pal.length]
        ctx.globalAlpha = a
        ctx.fill()
        ctx.globalAlpha = 1
      }

      // Shapes
      for (const s of shapes) {
        s.x += s.vx; s.y += s.vy; s.rot += s.vr
        if (s.x < -80) s.x = w + 80; if (s.x > w + 80) s.x = -80
        if (s.y < -80) s.y = h + 80; if (s.y > h + 80) s.y = -80
        drawShape(s, pal)
      }

      // Ambient glow (subtle, section-specific)
      if (variant === 'categories') {
        drawOrb(ctx, w * 0.85, h * 0.2, 120, 'rgb(108,99,255)', 0.06)
        drawOrb(ctx, w * 0.1, h * 0.8, 100, 'rgb(22,163,74)', 0.05)
      } else if (variant === 'trust' || variant === 'b2b') {
        drawOrb(ctx, w * 0.8, h * 0.3, 160, 'rgb(108,99,255)', 0.12)
        drawOrb(ctx, w * 0.2, h * 0.7, 120, 'rgb(79,195,247)', 0.08)
      } else if (variant === 'owners') {
        drawOrb(ctx, w * 0.9, h * 0.5, 100, 'rgb(251,191,36)', 0.08)
      }

      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      obs.disconnect()
    }
  }, [variant])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none', ...style }}
    />
  )
}
