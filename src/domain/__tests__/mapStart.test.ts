import { describe, it, expect } from 'vitest'
import { mapStart, zoneCorners, PILOT_CENTER, MAP_POINT_ZOOM } from '../region'

// Карта витрины открывается там, где есть что снять (аудит 04.10): до этого
// без «À proximité» она стояла на Брюсселе — в 40 км от зоны пилота.
describe('вид карты при открытии', () => {
  it('без вещей и без «À proximité» — вся зона пилота вокруг Gembloux', () => {
    const start = mapStart([], null)
    expect(start).toEqual({ kind: 'bounds', corners: zoneCorners() })
    const [[s, w], [n, e]] = zoneCorners()
    expect(s).toBeLessThan(PILOT_CENTER[0])
    expect(n).toBeGreaterThan(PILOT_CENTER[0])
    expect(w).toBeLessThan(PILOT_CENTER[1])
    expect(e).toBeGreaterThan(PILOT_CENTER[1])
    // 30 км в каждую сторону: ~0.27° широты, ~0.42° долготы на этой широте.
    expect(n - s).toBeCloseTo(60 / 111, 3)
    expect(e - w).toBeGreaterThan(0.8)
    // Брюссель (50.85, 4.35) в рамку не попадает.
    expect(50.85).toBeGreaterThan(n)
  })

  it('есть вещи с координатами — рамка по ним', () => {
    const start = mapStart([[50.6236, 4.6981], [50.4669, 4.8675]], null)
    expect(start).toEqual({ kind: 'bounds', corners: [[50.4669, 4.6981], [50.6236, 4.8675]] })
  })

  it('«À proximité» — на человеке, масштаб улицы', () => {
    const start = mapStart([[50.4669, 4.8675]], { lat: 50.5, lng: 4.7 })
    expect(start).toEqual({ kind: 'point', center: [50.5, 4.7], zoom: MAP_POINT_ZOOM })
  })
})
