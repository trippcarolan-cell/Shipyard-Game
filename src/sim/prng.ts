const STREAM_NAMES = [
  'contracts',
  'defects',
  'events',
  'seaTrials',
  'steelPrice',
  'walkoffs',
] as const

export type StreamName = (typeof STREAM_NAMES)[number]

export function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function streamSeed(runSeed: string, name: StreamName): number {
  return hashString(`${runSeed}::${name}`)
}

export function nextFloat(state: number): { state: number; value: number } {
  let a = state >>> 0
  a = (a + 0x6d2b79f5) >>> 0
  let t = a
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { state: a, value }
}

export function nextUniform(
  state: number,
  min: number,
  max: number,
): { state: number; value: number } {
  const r = nextFloat(state)
  return { state: r.state, value: min + r.value * (max - min) }
}

export function makeStreams(runSeed: string): Record<StreamName, number> {
  return {
    contracts: streamSeed(runSeed, 'contracts'),
    defects: streamSeed(runSeed, 'defects'),
    events: streamSeed(runSeed, 'events'),
    seaTrials: streamSeed(runSeed, 'seaTrials'),
    steelPrice: streamSeed(runSeed, 'steelPrice'),
    walkoffs: streamSeed(runSeed, 'walkoffs'),
  }
}
