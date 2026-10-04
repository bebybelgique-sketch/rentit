// src/domain/region.ts
//
// Зона пилота — ГЕОМЕТРИЯ. Имя региона живёт в словарях (region.name,
// region.in, region.of), и тексты ссылаются на него вложением $t(region.in);
// здесь — центр и радиус, по которым открывается карта витрины.
//
// Решение 04.10.2026: Brabant wallon и Namurois, центр — Gembloux, 30 км.
// Круг покрывает Walhain, Wavre, Louvain-la-Neuve, Namur, Rhisnes, Jodoigne.
// Продукт открыт везде: зона задаёт, куда смотрит карта по умолчанию и о
// чём говорят тексты, а не где можно выкладывать вещи.
//
// До этого карта без «À proximité» открывалась на Брюсселе (50.85, 4.35) с
// масштабом 13 — в 40 км от зоны и без единой вещи в кадре.

export const PILOT_CENTER: [number, number] = [50.5614, 4.6914] // Gembloux
export const PILOT_RADIUS_KM = 30

// С какого вида открывается карта витрины.
//  - Человек нажал «À proximité» — на нём самом, масштаб улицы.
//  - Есть вещи с координатами — рамка по ним: карта показывает то, что
//    можно снять, а не пустую местность.
//  - Иначе — вся зона пилота.
export type MapStart =
  | { kind: 'point'; center: [number, number]; zoom: number }
  | { kind: 'bounds'; corners: [[number, number], [number, number]] }

export const MAP_POINT_ZOOM = 13

export function mapStart(
  points: Array<[number, number]>,
  userPos: { lat: number; lng: number } | null,
): MapStart {
  if (userPos) return { kind: 'point', center: [userPos.lat, userPos.lng], zoom: MAP_POINT_ZOOM }
  if (points.length > 0) {
    const lats = points.map(p => p[0])
    const lngs = points.map(p => p[1])
    return {
      kind: 'bounds',
      corners: [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
    }
  }
  return { kind: 'bounds', corners: zoneCorners() }
}

// Квадрат, описанный вокруг круга зоны. Градус широты — ~111 км, градус
// долготы короче в cos(широты) раз.
export function zoneCorners(): [[number, number], [number, number]] {
  const [lat, lng] = PILOT_CENTER
  const dLat = PILOT_RADIUS_KM / 111
  const dLng = PILOT_RADIUS_KM / (111 * Math.cos((lat * Math.PI) / 180))
  return [[lat - dLat, lng - dLng], [lat + dLat, lng + dLng]]
}
