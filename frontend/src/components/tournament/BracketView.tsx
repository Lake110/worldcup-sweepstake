import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'

const LEFT_R32 = [
  { home: '1A', away: '2C', num: 1  },
  { home: '1C', away: '2A', num: 2  },
  { home: '1E', away: '2G', num: 3  },
  { home: '1G', away: '2E', num: 4  },
  { home: '1I', away: '2K', num: 5  },
  { home: '1K', away: '2I', num: 6  },
  { home: '1B', away: '2D', num: 7  },
  { home: '1D', away: '2B', num: 8  },
]
const LEFT_R16 = [
  { home: 'W M1',  away: 'W M2',  num: 17 },
  { home: 'W M3',  away: 'W M4',  num: 18 },
  { home: 'W M5',  away: 'W M6',  num: 19 },
  { home: 'W M7',  away: 'W M8',  num: 20 },
]
const LEFT_QF = [
  { home: 'W M17', away: 'W M18', num: 25 },
  { home: 'W M19', away: 'W M20', num: 26 },
]
const LEFT_SF  = [{ home: 'W M25', away: 'W M26', num: 29 }]
const RIGHT_SF  = [{ home: 'W M27', away: 'W M28', num: 30 }]
const RIGHT_QF  = [
  { home: 'W M21', away: 'W M22', num: 27 },
  { home: 'W M23', away: 'W M24', num: 28 },
]
const RIGHT_R16 = [
  { home: 'W M9',  away: 'W M10', num: 21 },
  { home: 'W M11', away: 'W M12', num: 22 },
  { home: 'W M13', away: 'W M14', num: 23 },
  { home: 'W M15', away: 'W M16', num: 24 },
]
const RIGHT_R32 = [
  { home: '1F',  away: '2H',  num: 9  },
  { home: '1H',  away: '2F',  num: 10 },
  { home: '1J',  away: '2L',  num: 11 },
  { home: '1L',  away: '2J',  num: 12 },
  { home: '3rd', away: '3rd', num: 13 },
  { home: '3rd', away: '3rd', num: 14 },
  { home: '3rd', away: '3rd', num: 15 },
  { home: '3rd', away: '3rd', num: 16 },
]
const FINAL = { home: 'W M29', away: 'W M30', num: 31 }

const COL_W   = 96
const CURVE_W = 16
const STEP    = COL_W + CURVE_W
const SLOT_H  = 68
const N       = 8
const HEADER  = 36
const MATCH_H = 46
const TOTAL_H = SLOT_H * N
const COLS    = 9
const PADDING = 8

function getTop(roundIdx: number, matchIdx: number): number {
  if (roundIdx >= 4) return (TOTAL_H / 2) - (MATCH_H / 2)
  const spacing = SLOT_H * Math.pow(2, roundIdx)
  const offset  = (spacing - MATCH_H) / 2
  return matchIdx * spacing + offset
}

function makeColX(totalW: number) {
  return (i: number) => PADDING + (i / (COLS - 1)) * (totalW - COL_W - PADDING * 2 - 40)
}

function getColour(label: string): string {
  const m = label.match(/[A-L]/)
  return m ? `group-${m[0]}` : 'bg-gray-800 border-gray-700 text-gray-400'
}

function CurvedConnectors({
  count, fromRound, toRound, fromCol, goRight, totalH, totalW,
}: {
  count: number; fromRound: number; toRound: number
  fromCol: number; goRight: boolean; totalH: number; totalW: number
}) {
  const ref = useRef<SVGSVGElement>(null)
  const colX = makeColX(totalW)

  useEffect(() => {
    if (!ref.current) return
    const svg = d3.select(ref.current)
    svg.selectAll('*').remove()

    for (let i = 0; i < count; i++) {
      const fromY = HEADER + getTop(fromRound, i) + MATCH_H / 2
      const toY   = HEADER + getTop(toRound, Math.floor(i / 2)) + MATCH_H / 2
      const dy    = toY - fromY

      if (goRight) {
        svg.append('line')
          .attr('x1', 0).attr('y1', fromY)
          .attr('x2', CURVE_W / 2).attr('y2', fromY)
          .attr('stroke', '#4B5563').attr('stroke-width', 1.5)
        svg.append('path')
          .attr('d', `M${CURVE_W / 2} ${fromY} c${CURVE_W / 2},0 ${CURVE_W / 2},${dy} ${CURVE_W},${dy}`)
          .attr('fill', 'none').attr('stroke', '#4B5563').attr('stroke-width', 1.5)
      } else {
        svg.append('line')
          .attr('x1', CURVE_W).attr('y1', fromY)
          .attr('x2', CURVE_W / 2).attr('y2', fromY)
          .attr('stroke', '#4B5563').attr('stroke-width', 1.5)
        svg.append('path')
          .attr('d', `M${CURVE_W / 2} ${fromY} c${-CURVE_W / 2},0 ${-CURVE_W / 2},${dy} ${-CURVE_W},${dy}`)
          .attr('fill', 'none').attr('stroke', '#4B5563').attr('stroke-width', 1.5)
      }
    }
  }, [count, fromRound, toRound, goRight, totalW])

  const x = goRight
    ? colX(fromCol) + COL_W
    : colX(fromCol) - CURVE_W

  return (
    <svg ref={ref} style={{
      position: 'absolute', left: x, top: 0,
      width: CURVE_W, height: totalH + HEADER + 20,
      overflow: 'visible', pointerEvents: 'none',
    }} />
  )
}

function MatchCard({ home, away, num, flip = false }: {
  home: string; away: string; num: number; flip?: boolean
}) {
  return (
    <div style={{ width: COL_W }}>
      <div className={`text-gray-600 mb-0.5 ${flip ? 'text-right' : 'text-left'}`} style={{ fontSize: 9 }}>
        M{num}
      </div>
      <div className={`border rounded-t px-1.5 py-1 font-medium flex items-center gap-1 ${getColour(home)} ${flip ? 'flex-row-reverse' : ''}`} style={{ fontSize: 10 }}>
        <span className="text-gray-500" style={{ fontSize: 8 }}>1</span>
        <span className="truncate">{home}</span>
      </div>
      <div className="h-px bg-gray-700" />
      <div className={`border rounded-b px-1.5 py-1 font-medium flex items-center gap-1 ${getColour(away)} ${flip ? 'flex-row-reverse' : ''}`} style={{ fontSize: 10 }}>
        <span className="text-gray-500" style={{ fontSize: 8 }}>2</span>
        <span className="truncate">{away}</span>
      </div>
    </div>
  )
}

export default function BracketView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const MIN_W = COLS * STEP + 80
  const [containerW, setContainerW] = useState(MIN_W)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      setContainerW(Math.max(entries[0].contentRect.width, MIN_W))
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  const totalW = containerW
  const totalH = TOTAL_H + HEADER + 20
  const colX   = makeColX(totalW)

  function renderRound(
    matches: { home: string; away: string; num: number }[],
    col: number, roundIdx: number, flip = false,
    label?: string, highlight = false,
  ) {
    return matches.map((m, mi) => (
      <div key={m.num}>
        {mi === 0 && label && (
          <div style={{ position: 'absolute', left: colX(col), top: 0, width: COL_W }}
            className={`text-center py-1 rounded text-xs font-bold ${highlight ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-300'}`}>
            {label}
          </div>
        )}
        <div style={{ position: 'absolute', left: colX(col), top: HEADER + getTop(roundIdx, mi), width: COL_W }}>
          <MatchCard home={m.home} away={m.away} num={m.num} flip={flip} />
        </div>
      </div>
    ))
  }

  const GROUP_LEGEND: Record<string, string> = {
    A: 'group-A', B: 'group-B', C: 'group-C', D: 'group-D',
    E: 'group-E', F: 'group-F', G: 'group-G', H: 'group-H',
    I: 'group-I', J: 'group-J', K: 'group-K', L: 'group-L',
  }

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-4">
        {Object.entries(GROUP_LEGEND).map(([g, c]) => (
          <div key={g} className={`text-xs px-2 py-1 rounded border font-medium ${c}`}>
            Group {g}
          </div>
        ))}
      </div>

      <div className="overflow-x-auto">
        <div ref={containerRef} style={{ minWidth: MIN_W }} className="bg-gray-900 border border-gray-800 rounded-xl p-4 pr-8 overflow-hidden">
          <div style={{ position: 'relative', width: '100%', height: totalH }}>

          {renderRound(LEFT_R32, 0, 0, false, 'R32')}
          {renderRound(LEFT_R16, 1, 1, false, 'R16')}
          {renderRound(LEFT_QF,  2, 2, false, 'QF')}
          {renderRound(LEFT_SF,  3, 3, false, 'SF')}

          <CurvedConnectors count={8} fromRound={0} toRound={1} fromCol={0} goRight={true}  totalH={totalH} totalW={totalW} />
          <CurvedConnectors count={4} fromRound={1} toRound={2} fromCol={1} goRight={true}  totalH={totalH} totalW={totalW} />
          <CurvedConnectors count={2} fromRound={2} toRound={3} fromCol={2} goRight={true}  totalH={totalH} totalW={totalW} />
          <CurvedConnectors count={1} fromRound={3} toRound={4} fromCol={3} goRight={true}  totalH={totalH} totalW={totalW} />

          <div style={{ position: 'absolute', left: colX(4), top: 0, width: COL_W }}
            className="text-center py-1 rounded text-xs font-bold bg-orange-500 text-white">
            ⚽ Final
          </div>
          <div style={{ position: 'absolute', left: colX(4), top: HEADER + getTop(4, 0), width: COL_W }}>
            <MatchCard home={FINAL.home} away={FINAL.away} num={FINAL.num} />
          </div>

          {renderRound(RIGHT_SF,  5, 3, true, 'SF')}
          {renderRound(RIGHT_QF,  6, 2, true, 'QF')}
          {renderRound(RIGHT_R16, 7, 1, true, 'R16')}
          {renderRound(RIGHT_R32, 8, 0, true, 'R32')}

          <CurvedConnectors count={8} fromRound={0} toRound={1} fromCol={8} goRight={false} totalH={totalH} totalW={totalW} />
          <CurvedConnectors count={4} fromRound={1} toRound={2} fromCol={7} goRight={false} totalH={totalH} totalW={totalW} />
          <CurvedConnectors count={2} fromRound={2} toRound={3} fromCol={6} goRight={false} totalH={totalH} totalW={totalW} />
          <CurvedConnectors count={1} fromRound={3} toRound={4} fromCol={5} goRight={false} totalH={totalH} totalW={totalW} />

        </div>
        </div>
      </div>
      <p className="text-xs text-gray-600 mt-3">
        * 8 best 3rd place teams also advance to R32. Bracket positions confirmed after group stage.
      </p>

      {/* Tailwind safelist */}
      <div className="hidden">
        <div className="bg-lime-900/40 border-lime-700 text-lime-300" />
        <div className="bg-indigo-900/40 border-indigo-700 text-indigo-300" />
        <div className="bg-rose-900/40 border-rose-700 text-rose-300" />
        <div className="bg-teal-900/40 border-teal-700 text-teal-300" />
      </div>
    </div>
  )
}