import { useState, useEffect } from 'react'

interface Team {
  id: string
  name: string
  flag_emoji: string
  fifa_ranking: number
  group?: { name: string }
}

interface ParticipantWithTeams {
  name: string
  teams: Team[]
}

interface DrawRevealProps {
  participants: ParticipantWithTeams[]
  onComplete: () => void
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

export default function DrawReveal({ participants, onComplete }: DrawRevealProps) {
  const [phase, setPhase] = useState<'start' | 'revealing' | 'done'>('start')
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [cardState, setCardState] = useState<'hidden' | 'entering' | 'visible' | 'exiting'>('hidden')
  const [revealedTeams, setRevealedTeams] = useState<boolean[]>(new Array(participants[0]?.teams.length ?? 0).fill(false))

  const current = participants[currentIndex]

  useEffect(() => {
    if (cardState !== 'visible' || !current) return
    setRevealedTeams(new Array(current.teams.length).fill(false))
    current.teams.forEach((_, i) => {
      setTimeout(() => {
        setRevealedTeams(prev => {
          const next = [...prev]
          next[i] = true
          return next
        })
      }, 300 + i * 250)
    })
  }, [cardState, currentIndex])

  const advance = async () => {
    if (currentIndex === -1) {
      setPhase('revealing')
      setCurrentIndex(0)
      setRevealedTeams(new Array(participants[0].teams.length).fill(false))
      setCardState('entering')
      setTimeout(() => setCardState('visible'), 50)
      return
    }
    setCardState('exiting')
    await sleep(350)
    const next = currentIndex + 1
    if (next >= participants.length) {
      setPhase('done')
      setCardState('hidden')
      return
    }
    setCurrentIndex(next)
    setRevealedTeams(new Array(participants[next].teams.length).fill(false))
    setCardState('entering')
    setTimeout(() => setCardState('visible'), 50)
  }

  const initials = (name: string) =>
    name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  const cardClass = () => {
    if (cardState === 'entering') return 'scale-75 opacity-0 translate-y-8'
    if (cardState === 'visible')  return 'scale-100 opacity-100 translate-y-0'
    if (cardState === 'exiting')  return 'scale-90 opacity-0 -translate-y-6'
    return 'scale-75 opacity-0'
  }

  if (phase === 'done') {
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center gap-4">
        <div className="text-5xl">🎉</div>
        <h2 className="text-2xl font-medium text-white">All draws revealed!</h2>
        <p className="text-slate-400 text-sm">Everyone knows their teams</p>
        <button
          onClick={onComplete}
          className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-medium transition-colors"
        >
          View results
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">

      <div className="flex gap-2 mb-8">
        {participants.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-colors duration-300 ${
              i < currentIndex ? 'bg-slate-500' :
              i === currentIndex ? 'bg-orange-500' :
              'bg-slate-700'
            }`}
          />
        ))}
      </div>

      {phase === 'revealing' && (
        <p className="text-slate-500 text-xs mb-4 uppercase tracking-widest">
          {currentIndex + 1} / {participants.length}
        </p>
      )}

      {phase === 'start' && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-slate-400 text-sm">Ready to reveal {participants.length} draws?</p>
          <button
            onClick={advance}
            className="bg-orange-500 hover:bg-orange-600 text-white px-10 py-3 rounded-lg font-medium text-lg transition-colors"
          >
            Start reveal ✨
          </button>
        </div>
      )}

      {phase === 'revealing' && current && (
        <div
          className={`transition-all duration-[400ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] bg-slate-800 border border-orange-500 rounded-2xl p-6 w-80 max-w-[90vw] text-center ${cardClass()}`}
        >
          <div className="w-14 h-14 rounded-full bg-orange-500 flex items-center justify-center text-white font-medium text-xl mx-auto mb-3">
            {initials(current.name)}
          </div>

          <h3 className="text-white text-xl font-medium mb-1">{current.name}</h3>
          <p className="text-slate-500 text-xs uppercase tracking-wider mb-5">their teams</p>

          <div className="flex flex-col gap-2 mb-5">
            {current.teams.map((team, i) => (
              <div
                key={team.id}
                className={`bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 flex items-center gap-3 transition-all duration-300 ${
                  revealedTeams[i] ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-3'
                }`}
              >
                <span className="text-xl leading-none">{team.flag_emoji}</span>
                <span className="text-slate-200 text-sm font-medium text-left flex-1">{team.name}</span>
                {team.group && (
                  <span className="text-xs text-slate-500">Group {team.group.name}</span>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={advance}
            className={`w-full py-2.5 rounded-lg font-medium text-white transition-colors ${
              currentIndex < participants.length - 1
                ? 'bg-slate-700 hover:bg-slate-600'
                : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            {currentIndex < participants.length - 1 ? 'Next →' : 'Finish reveal 🎉'}
          </button>
        </div>
      )}
    </div>
  )
}