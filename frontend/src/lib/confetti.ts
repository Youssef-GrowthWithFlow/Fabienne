/** Dependency-free confetti burst — the small dopamine hit when a task gets
 *  done. Draws on a throwaway full-screen canvas and removes itself. */

const COLORS = [
  '#7c3aed', // violet — Fabienne
  '#22c55e',
  '#f59e0b',
  '#0ea5e9',
  '#ec4899',
  '#eab308',
]

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  rotation: number
  vr: number
  life: number
}

let activeCanvas: HTMLCanvasElement | null = null

export function fireConfetti(intensity: 'small' | 'big' = 'small'): void {
  if (typeof window === 'undefined') return
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  // One canvas at a time — a rapid double fire just replaces the burst.
  activeCanvas?.remove()
  const canvas = document.createElement('canvas')
  activeCanvas = canvas
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  canvas.style.cssText =
    'position:fixed;inset:0;pointer-events:none;z-index:9999'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    canvas.remove()
    return
  }

  const w = canvas.width
  const h = canvas.height
  const count = intensity === 'big' ? 160 : 70
  const particles: Particle[] = []

  // Two cannons firing up and inward from the bottom corners.
  const cannons: Array<{ x: number; y: number; angle: number }> = [
    { x: w * 0.12, y: h * 0.95, angle: -Math.PI / 3 },
    { x: w * 0.88, y: h * 0.95, angle: (-2 * Math.PI) / 3 },
  ]
  for (let i = 0; i < count; i++) {
    const c = cannons[i % cannons.length]
    const speed = 11 + Math.random() * (intensity === 'big' ? 12 : 8)
    const angle = c.angle + (Math.random() - 0.5) * 0.9
    particles.push({
      x: c.x,
      y: c.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 5 + Math.random() * 5,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 90 + Math.random() * 50,
    })
  }

  let frame = 0
  const tick = () => {
    frame += 1
    ctx.clearRect(0, 0, w, h)
    let alive = 0
    for (const p of particles) {
      if (frame > p.life) continue
      alive += 1
      p.vy += 0.32 // gravity
      p.vx *= 0.985
      p.vy *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.rotation += p.vr
      const fade = Math.max(0, 1 - frame / p.life)
      ctx.save()
      ctx.globalAlpha = fade
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rotation)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
      ctx.restore()
    }
    if (alive > 0) {
      requestAnimationFrame(tick)
    } else {
      canvas.remove()
      if (activeCanvas === canvas) activeCanvas = null
    }
  }
  requestAnimationFrame(tick)
}
