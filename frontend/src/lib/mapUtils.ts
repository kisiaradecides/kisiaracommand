import { WARD_BOUNDARY } from './mapData'

// Compute ward centroid
export function computeCentroid(): [number, number] {
  let sumLat = 0, sumLng = 0
  for (const [lat, lng] of WARD_BOUNDARY) { sumLat += lat; sumLng += lng }
  return [sumLat / WARD_BOUNDARY.length, sumLng / WARD_BOUNDARY.length]
}

// Convert lat/lng to local Cartesian metres relative to centroid
function toMetres(lat: number, lng: number, cLat: number, cLng: number) {
  return {
    x: (lng - cLng) * 111320 * Math.cos(cLat * Math.PI / 180),
    y: (lat - cLat) * 111320,
  }
}

function triArea(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
  return Math.abs(ax * (by - cy) + bx * (cy - ay) + cx * (ay - by)) / 2
}

// Compute equal-area region polygons (pie-slice from centroid)
export function buildRegionPolygons(): { coords: [number, number][]; area: number }[] {
  const [cLat, cLng] = computeCentroid()
  const N = WARD_BOUNDARY.length
  const edgeAreas: number[] = []
  let totalArea = 0

  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N
    const a = toMetres(WARD_BOUNDARY[i][0], WARD_BOUNDARY[i][1], cLat, cLng)
    const b = toMetres(WARD_BOUNDARY[j][0], WARD_BOUNDARY[j][1], cLat, cLng)
    const area = triArea(0, 0, a.x, a.y, b.x, b.y)
    edgeAreas.push(area)
    totalArea += area
  }

  const targetArea = totalArea / 5
  const divPts: [number, number][] = [[WARD_BOUNDARY[0][0], WARD_BOUNDARY[0][1]]]
  const divIdx: number[] = [0]
  let cum = 0

  for (let r = 1; r < 5; r++) {
    let found = false
    for (let i = divIdx[r - 1]; i < N && !found; i++) {
      const ea = edgeAreas[i]
      if (cum + ea >= targetArea) {
        const frac = ea > 0 ? (targetArea - cum) / ea : 0.5
        const j = (i + 1) % N
        divIdx.push(i)
        divPts.push([
          WARD_BOUNDARY[i][0] + frac * (WARD_BOUNDARY[j][0] - WARD_BOUNDARY[i][0]),
          WARD_BOUNDARY[i][1] + frac * (WARD_BOUNDARY[j][1] - WARD_BOUNDARY[i][1]),
        ])
        cum = 0
        found = true
      } else {
        cum += ea
      }
    }
    if (!found) { divIdx.push(N - 1); divPts.push(WARD_BOUNDARY[N - 1]) }
  }
  divIdx.push(0)
  divPts.push([WARD_BOUNDARY[0][0], WARD_BOUNDARY[0][1]])

  const regions: { coords: [number, number][]; area: number }[] = []

  for (let r = 1; r <= 5; r++) {
    const i1 = divIdx[r - 1]
    const i2 = divIdx[r % 5]
    const coords: [number, number][] = [[cLat, cLng], divPts[r - 1]]
    if (i2 >= i1) {
      for (let i = i1; i <= i2; i++) coords.push(WARD_BOUNDARY[i])
    } else {
      for (let i = i1; i < N; i++) coords.push(WARD_BOUNDARY[i])
      for (let i = 0; i <= i2; i++) coords.push(WARD_BOUNDARY[i])
    }
    coords.push(divPts[r % 5], [cLat, cLng])
    regions.push({ coords, area: targetArea / 1e6 })
  }

  return regions
}

// Point-in-polygon test
export function pointInPolygon(lat: number, lng: number, polygon: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i][0], xi = polygon[i][1]
    const yj = polygon[j][0], xj = polygon[j][1]
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

// Assign a region (1-5) to a lat/lng point
export function assignRegion(lat: number, lng: number, regions: { coords: [number, number][] }[]): number {
  for (let r = 0; r < regions.length; r++) {
    if (pointInPolygon(lat, lng, regions[r].coords)) return r + 1
  }
  return 1
}

// Compute total ward area in km²
export function computeWardArea(): number {
  const [cLat, cLng] = computeCentroid()
  const N = WARD_BOUNDARY.length
  let total = 0
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N
    const a = toMetres(WARD_BOUNDARY[i][0], WARD_BOUNDARY[i][1], cLat, cLng)
    const b = toMetres(WARD_BOUNDARY[j][0], WARD_BOUNDARY[j][1], cLat, cLng)
    total += triArea(0, 0, a.x, a.y, b.x, b.y)
  }
  return total / 1e6
}
