import type {PlayerSeat, SessionPhase} from '@/game/types'

/**
 * Shape of a match player seat in Firestore.
 */
export interface MatchPlayer {
  uid: string
  name: string
  bot: boolean
}

/**
 * Shape of the authoritative match document stored under matches/{code}.
 */
export interface MatchState {
  code: string
  phase: SessionPhase
  players: MatchPlayer[]
  turnIndex: PlayerSeat
  turnCount: number
  winner: string | null
}

/**
 * Validates a single player object read from Firestore.
 * @param raw - Candidate player value
 * @returns Parsed MatchPlayer or null
 */
function parsePlayer(raw: unknown): MatchPlayer | null {
  if (typeof raw !== 'object' || raw === null) {
    return null
  }

  const candidate = raw as Record<string, unknown>

  if (typeof candidate.uid !== 'string' || candidate.uid.trim() === '') {
    return null
  }

  if (typeof candidate.name !== 'string' || candidate.name.trim() === '') {
    return null
  }

  if (typeof candidate.bot !== 'boolean') {
    return null
  }

  return {
    uid: candidate.uid,
    name: candidate.name,
    bot: candidate.bot,
  }
}

/**
 * Parses and validates an unknown Firestore document payload into a typed MatchState.
 * Refuses malformed or partial payloads without throwing.
 * @param code - Match room code
 * @param raw - Raw Firestore document data
 * @returns Parsed MatchState or null if invalid
 */
export function parseMatchState(code: string, raw: unknown): MatchState | null {
  if (typeof raw !== 'object' || raw === null) {
    return null
  }

  const record = raw as Record<string, unknown>

  if (record.phase !== 'lobby' && record.phase !== 'playing' && record.phase !== 'finished') {
    return null
  }

  if (!Array.isArray(record.players)) {
    return null
  }

  const players: MatchPlayer[] = []

  for (const entry of record.players) {
    const player = parsePlayer(entry)

    if (player === null) {
      return null
    }

    players.push(player)
  }

  if (record.phase === 'lobby' && players.length !== 1) {
    return null
  }

  if (record.phase !== 'lobby' && players.length !== 2) {
    return null
  }

  const turnIndex = record.turnIndex === 1 ? 1 : 0
  const turnCount = typeof record.turnCount === 'number' && record.turnCount >= 1 ? record.turnCount : 1
  const winner = typeof record.winner === 'string' ? record.winner : null

  return {
    code: code,
    phase: record.phase,
    players: players,
    turnIndex: turnIndex,
    turnCount: turnCount,
    winner: winner,
  }
}
