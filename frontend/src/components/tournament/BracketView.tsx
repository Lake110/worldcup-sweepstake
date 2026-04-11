import { useQuery } from '@tanstack/react-query'
import api from '../../services/api'

interface BracketParticipant {
  id: string; name: string; resultText: string | null; isWinner: boolean; status: string | null
}
interface BracketMatch {
  id: string; nextMatchId: string | null; tournamentRoundText: string
  startTime: string | null; state: string; participants: BracketParticipant[]
}

// ── Layout ─────────────────────────────────────────────────────────────────
const CW  = 110   // card width
const CH  = 44    // card height
const GAP = 20    // gap between rounds (connector width)
const COL = CW + GAP
const N   = 8     // R32 matches per side
const H   = 560   // total canvas height
const LH  = 24    // label height above canvas

function fmt(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// Top of match card for index i in a round with count matches
function top(count: number, i: number) {
  const spacing = H / count
  return i * spacing + (spacing - CH) / 2
}

// ── Match card ─────────────────────────────────────────────────────────────
function Card({ m, x, y, flip = false }: { m: BracketMatch; x: number; y: number; flip?: boolean }) {
  const [home, away] = m.participants
  function Slot({ p, isTop }: { p: BracketParticipant; isTop: boolean }) {
    const tbd = p.id === 'tbd'
    const won = p.isWinner
    const r   = isTop ? 'rounded-t' : 'rounded-b'
    const bg  = won ? 'bg-orange-500/25 border-orange-400 text-white'
              : tbd ? 'bg-gray-800 border-orange-900/50 text-gray-500'
              :       'bg-gray-800 border-orange-800/40 text-gray-200'
    return (
      <div className={`border px-1.5 flex items-center justify-between gap-1 ${r} ${bg}`}
           style={{ height: CH / 2, fontSize: 10 }}>
        {flip
          ? <><span className={`font-bold flex-shrink-0 text-[9px] ${won ? 'text-orange-400' : 'text-gray-600'}`}>{p.resultText ?? ''}</span><span className="truncate flex-1 text-right">{p.name}</span></>
          : <><span className="truncate flex-1">{p.name}</span><span className={`font-bold flex-shrink-0 text-[9px] ${won ? 'text-orange-400' : 'text-gray-600'}`}>{p.resultText ?? ''}</span></>
        }
      </div>
    )
  }
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: CW }}>
      <div className={`text-gray-600 mb-0.5 ${flip ? 'text-right' : ''}`} style={{ fontSize: 9 }}>{fmt(m.startTime)}</div>
      <Slot p={home} isTop={true} />
      <div className="h-px bg-orange-900/40" />
      <Slot p={away} isTop={false} />
    </div>
  )
}

// ── Connectors ─────────────────────────────────────────────────────────────
// Draws bracket connector lines between two adjacent rounds.
// x = left edge of the GAP between the two rounds
// dir = 'right' for left half of bracket (lines go rightward to next round)
//       'left'  for right half of bracket (lines go leftward to next round)
function Conn({ fromCount, x, dir }: { fromCount: number; x: number; dir: 'right' | 'left' }) {
  const lines: React.ReactNode[] = []
  const mid = GAP / 2

  // Special case: 1-to-1 straight connector (Final ↔ SF)
  if (fromCount === 1) {
    const y = top(1, 0) + CH / 2
    lines.push(<g key={0}>
      <line x1={0} y1={y} x2={GAP} y2={y} stroke="#f97316" strokeWidth="1.5" opacity="0.6" />
    </g>)
  } else {
    const toCount = fromCount / 2
    for (let i = 0; i < fromCount; i++) {
      const fy = top(fromCount, i) + CH / 2
      const ty = top(toCount, Math.floor(i / 2)) + CH / 2

      if (dir === 'right') {
        lines.push(<g key={i}>
          <line x1={0}   y1={fy} x2={mid} y2={fy} stroke="#f97316" strokeWidth="1.5" opacity="0.6" />
          <line x1={mid} y1={fy} x2={mid} y2={ty} stroke="#f97316" strokeWidth="1.5" opacity="0.6" />
          <line x1={mid} y1={ty} x2={GAP} y2={ty} stroke="#f97316" strokeWidth="1.5" opacity="0.6" />
        </g>)
      } else {
        lines.push(<g key={i}>
          <line x1={GAP} y1={fy} x2={mid} y2={fy} stroke="#f97316" strokeWidth="1.5" opacity="0.6" />
          <line x1={mid} y1={fy} x2={mid} y2={ty} stroke="#f97316" strokeWidth="1.5" opacity="0.6" />
          <line x1={mid} y1={ty} x2={0}   y2={ty} stroke="#f97316" strokeWidth="1.5" opacity="0.6" />
        </g>)
      }
    }
  }
  return (
    <svg style={{ position: 'absolute', left: x, top: 0, width: GAP, height: H, overflow: 'visible' }} overflow="visible">
      {lines}
    </svg>
  )
}

// ── Label ──────────────────────────────────────────────────────────────────
function Label({ text, x, orange = false }: { text: string; x: number; orange?: boolean }) {
  return (
    <div style={{ position: 'absolute', left: x, top: 0, width: CW }}
         className={`text-center text-xs font-bold py-1 ${orange ? 'text-orange-400' : 'text-gray-400'}`}>
      {text}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
export default function BracketView() {
  const { data: raw, isLoading, error } = useQuery({
    queryKey: ['knockout-bracket'],
    queryFn:  async () => (await api.get('/matches/knockout/bracket')).data as BracketMatch[],
    staleTime: 30_000, refetchInterval: 60_000,
  })

  if (isLoading) return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Loading bracket…</div>
  if (error || !raw) return <div className="flex items-center justify-center h-48 text-red-400 text-sm">Failed to load bracket.</div>

  const by = (s: string) => raw.filter(m => m.tournamentRoundText === s).sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))

  const r32 = by('R32'); const r16 = by('R16'); const qf = by('QF')
  const sf  = by('SF');  const fin = by('Final'); const trd = by('3rd')

  // Left half  → feeds into Final from left
  const r32L = r32.slice(0, 8); const r16L = r16.slice(0, 4)
  const qfL  = qf.slice(0, 2);  const sfL  = sf.slice(0, 1)
  // Right half → feeds into Final from right (rendered mirror)
  const sfR  = sf.slice(1, 2);  const qfR  = qf.slice(2, 4)
  const r16R = r16.slice(4, 8); const r32R = r32.slice(8, 16)

  // ── X positions ───────────────────────────────────────────────────────
  // Left side columns (0..3 = R32L, R16L, QFL, SFL)
  // Then Final at col 4
  // Right side mirrors outward from Final
  const lx = (col: number) => col * COL                        // left side card x
  const FINAL_X = 4 * COL                                      // Final card x
  const rx = (col: number) => FINAL_X + CW + col * COL + GAP  // right side card x (col 0=SF, 1=QF, 2=R16, 3=R32)

  // Total canvas width: left 4 cols + Final + right 4 cols
  const TW = FINAL_X + CW + 4 * COL + GAP
  const CH_TOTAL = H + LH + 8

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto pb-2">
        <div className="relative bg-gray-900 border border-gray-800 rounded-xl"
             style={{ width: TW, height: CH_TOTAL, minWidth: TW }}>

          {/* Canvas offset by LH for labels */}
          <div style={{ position: 'absolute', top: LH, left: 0, width: TW, height: H }}>

            {/* ── LEFT SIDE ── */}
            {r32L.map((m, i) => <Card key={m.id} m={m} x={lx(0)} y={top(8, i)} />)}
            <Conn fromCount={8} x={lx(0) + CW} dir="right" />
            {r16L.map((m, i) => <Card key={m.id} m={m} x={lx(1)} y={top(4, i)} />)}
            <Conn fromCount={4} x={lx(1) + CW} dir="right" />
            {qfL.map((m, i)  => <Card key={m.id} m={m} x={lx(2)} y={top(2, i)} />)}
            <Conn fromCount={2} x={lx(2) + CW} dir="right" />
            {sfL.map((m, i)  => <Card key={m.id} m={m} x={lx(3)} y={top(1, i)} />)}
            <Conn fromCount={1} x={lx(3) + CW} dir="right" />

            {/* ── FINAL ── */}
            {fin[0] && <Card m={fin[0]} x={FINAL_X} y={top(1, 0)} />}

            {/* ── RIGHT SIDE (mirror) ── */}
            {/* SF-R is at rx(0), connector goes FROM Final right edge TO SF-R left edge */}
            <Conn fromCount={1} x={FINAL_X + CW} dir="left" />
            {sfR.map((m, i)  => <Card key={m.id} m={m} x={rx(0)} y={top(1, i)}  flip />)}
            <Conn fromCount={2} x={rx(0) + CW}   dir="left" />
            {qfR.map((m, i)  => <Card key={m.id} m={m} x={rx(1)} y={top(2, i)}  flip />)}
            <Conn fromCount={4} x={rx(1) + CW}   dir="left" />
            {r16R.map((m, i) => <Card key={m.id} m={m} x={rx(2)} y={top(4, i)}  flip />)}
            <Conn fromCount={8} x={rx(2) + CW}   dir="left" />
            {r32R.map((m, i) => <Card key={m.id} m={m} x={rx(3)} y={top(8, i)}  flip />)}

          </div>

          {/* ── Labels ── */}
          <Label text="R32"      x={lx(0)} />
          <Label text="R16"      x={lx(1)} />
          <Label text="QF"       x={lx(2)} orange />
          <Label text="SF"       x={lx(3)} orange />
          <Label text="⚽ Final" x={FINAL_X} orange />
          <Label text="SF"       x={rx(0)} orange />
          <Label text="QF"       x={rx(1)} orange />
          <Label text="R16"      x={rx(2)} />
          <Label text="R32"      x={rx(3)} />

        </div>
      </div>

      {trd[0] && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="text-xs font-bold text-gray-400 mb-3">🥉 Third Place · 18 Jul · Miami</div>
          <div style={{ position: 'relative', height: CH + 20, width: CW }}>
            <Card m={trd[0]} x={0} y={16} />
          </div>
        </div>
      )}

      <p className="text-xs text-gray-600">
        * TBD until group stage results are entered · auto-updates as results come in
      </p>
    </div>
  )
}
