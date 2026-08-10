import { useEffect, useRef } from 'react'

interface Particle {
  x: number; y: number; vx: number; vy: number
  size: number; opacity: number; color: string; pulse: number
}

interface FloatingShape {
  x: number; y: number; vx: number; vy: number
  rotation: number; vr: number
  size: number; type: 'orb' | 'ring' | 'cube' | 'drill' | 'wrench'
  color: string; glowColor: string; phase: number
}

const COLORS = ['#6c63ff', '#a89cff', '#7c73ff', '#4fc3f7', '#5a52d5']
const GLOW   = ['rgba(108,99,255,0.6)', 'rgba(168,156,255,0.5)', 'rgba(79,195,247,0.5)']

export default function HeroScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf: number
    let w = 0, h = 0

    const particles: Particle[] = []
    const shapes: FloatingShape[] = []

    const resize = () => {
      w = canvas.width  = canvas.offsetWidth
      h = canvas.height = canvas.offsetHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Init particles
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random() * 1400, y: Math.random() * 900,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2.5 + 0.5,
        opacity: Math.random() * 0.6 + 0.2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        pulse: Math.random() * Math.PI * 2,
      })
    }

    // Init shapes
    const shapeTypes: FloatingShape['type'][] = ['orb', 'ring', 'cube', 'drill', 'wrench', 'orb', 'ring', 'orb']
    for (let i = 0; i < shapeTypes.length; i++) {
      const ci = Math.floor(Math.random() * COLORS.length)
      shapes.push({
        x: 400 + Math.random() * 800,
        y: 80 + Math.random() * 740,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        rotation: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.012,
        size: 28 + Math.random() * 44,
        type: shapeTypes[i],
        color: COLORS[ci],
        glowColor: GLOW[ci % GLOW.length],
        phase: Math.random() * Math.PI * 2,
      })
    }

    let t = 0

    const drawOrb = (s: FloatingShape) => {
      const r = s.size
      const grd = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r)
      grd.addColorStop(0, s.color + 'cc')
      grd.addColorStop(0.5, s.color + '66')
      grd.addColorStop(1, s.color + '00')
      ctx.beginPath()
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2)
      ctx.fillStyle = grd
      ctx.fill()
      // glow
      ctx.shadowBlur = 40
      ctx.shadowColor = s.glowColor
      ctx.beginPath()
      ctx.arc(s.x, s.y, r * 0.5, 0, Math.PI * 2)
      ctx.fillStyle = s.color + '44'
      ctx.fill()
      ctx.shadowBlur = 0
    }

    const drawRing = (s: FloatingShape) => {
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.rotation)
      ctx.scale(1, 0.38)
      ctx.beginPath()
      ctx.arc(0, 0, s.size, 0, Math.PI * 2)
      ctx.strokeStyle = s.color + '99'
      ctx.lineWidth = 3
      ctx.shadowBlur = 16
      ctx.shadowColor = s.glowColor
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()
    }

    const drawCube = (s: FloatingShape) => {
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.rotation)
      const sz = s.size * 0.7
      // front face
      ctx.fillStyle = s.color + 'aa'
      ctx.shadowBlur = 20; ctx.shadowColor = s.glowColor
      ctx.fillRect(-sz / 2, -sz / 2, sz, sz)
      ctx.shadowBlur = 0
      // top face
      ctx.fillStyle = s.color + '66'
      ctx.beginPath()
      ctx.moveTo(-sz / 2, -sz / 2)
      ctx.lineTo(-sz / 2 + sz * 0.4, -sz / 2 - sz * 0.4)
      ctx.lineTo(sz / 2 + sz * 0.4, -sz / 2 - sz * 0.4)
      ctx.lineTo(sz / 2, -sz / 2)
      ctx.closePath()
      ctx.fill()
      // right face
      ctx.fillStyle = s.color + '44'
      ctx.beginPath()
      ctx.moveTo(sz / 2, -sz / 2)
      ctx.lineTo(sz / 2 + sz * 0.4, -sz / 2 - sz * 0.4)
      ctx.lineTo(sz / 2 + sz * 0.4, sz / 2 - sz * 0.4)
      ctx.lineTo(sz / 2, sz / 2)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
    }

    const drawDrill = (s: FloatingShape) => {
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.rotation)
      ctx.shadowBlur = 16; ctx.shadowColor = s.glowColor
      // body
      ctx.fillStyle = s.color + 'bb'
      ctx.beginPath()
      ctx.roundRect(-s.size * 0.18, -s.size * 0.55, s.size * 0.36, s.size * 0.8, 6)
      ctx.fill()
      // bit
      ctx.fillStyle = '#c0bfffcc'
      ctx.beginPath()
      ctx.moveTo(-s.size * 0.08, -s.size * 0.55)
      ctx.lineTo(s.size * 0.08, -s.size * 0.55)
      ctx.lineTo(s.size * 0.04, -s.size * 0.95)
      ctx.lineTo(-s.size * 0.04, -s.size * 0.95)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.restore()
    }

    const drawWrench = (s: FloatingShape) => {
      ctx.save()
      ctx.translate(s.x, s.y)
      ctx.rotate(s.rotation)
      ctx.shadowBlur = 16; ctx.shadowColor = s.glowColor
      ctx.strokeStyle = s.color + 'cc'
      ctx.lineWidth = s.size * 0.18
      ctx.lineCap = 'round'
      // handle
      ctx.beginPath()
      ctx.moveTo(0, s.size * 0.2)
      ctx.lineTo(0, s.size * 0.9)
      ctx.stroke()
      // head arc
      ctx.beginPath()
      ctx.arc(0, 0, s.size * 0.38, 0.3, Math.PI * 1.5)
      ctx.stroke()
      ctx.shadowBlur = 0
      ctx.restore()
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      t += 0.012

      // Particles
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.pulse += 0.03
        if (p.x < 0) p.x = w; if (p.x > w) p.x = 0
        if (p.y < 0) p.y = h; if (p.y > h) p.y = 0
        const a = p.opacity * (0.6 + 0.4 * Math.sin(p.pulse))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color + Math.floor(a * 255).toString(16).padStart(2, '0')
        ctx.fill()
      }

      // Floating shapes
      for (const s of shapes) {
        const float = Math.sin(t + s.phase) * 18
        s.x += s.vx; s.y += s.vy; s.rotation += s.vr
        // bounce
        if (s.x < 300 || s.x > w + 100) s.vx *= -1
        if (s.y < 40  || s.y > h - 40)  s.vy *= -1

        const drawY = s.y + float

        ctx.save()
        switch (s.type) {
          case 'orb':    drawOrb   ({ ...s, y: drawY }); break
          case 'ring':   drawRing  ({ ...s, y: drawY }); break
          case 'cube':   drawCube  ({ ...s, y: drawY }); break
          case 'drill':  drawDrill ({ ...s, y: drawY }); break
          case 'wrench': drawWrench({ ...s, y: drawY }); break
        }
        ctx.restore()
      }

      // Large central glow
      const cx = w * 0.72, cy = h * 0.48
      const pulse = 1 + 0.06 * Math.sin(t * 0.8)
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 280 * pulse)
      gr.addColorStop(0,   'rgba(108,99,255,0.35)')
      gr.addColorStop(0.5, 'rgba(108,99,255,0.12)')
      gr.addColorStop(1,   'rgba(108,99,255,0)')
      ctx.beginPath()
      ctx.arc(cx, cy, 280 * pulse, 0, Math.PI * 2)
      ctx.fillStyle = gr
      ctx.fill()

      // Accent glow bottom-right
      const gr2 = ctx.createRadialGradient(w * 0.85, h * 0.75, 0, w * 0.85, h * 0.75, 180)
      gr2.addColorStop(0, 'rgba(79,195,247,0.2)')
      gr2.addColorStop(1, 'rgba(79,195,247,0)')
      ctx.beginPath()
      ctx.arc(w * 0.85, h * 0.75, 180, 0, Math.PI * 2)
      ctx.fillStyle = gr2
      ctx.fill()

      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block' }}
    />
  )
}
