/**
 * Core domain types for the 2-player card game.
 *
 * Kept strictly pure with no dependencies on Firestore, Vue, or the network.
 */

/** Player seat index in a 2-player match: 0 (Seat 1) or 1 (Seat 2). */
export type PlayerSeat = 0 | 1

/** The lifecycle phase of the game session. */
export type SessionPhase = 'lobby' | 'playing' | 'finished'

/** Minimal game domain state for turn-based tracking. */
export interface GameSessionState {
  turnIndex: PlayerSeat
  turnCount: number
  phase: SessionPhase
  winner: string | null
}
