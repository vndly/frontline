import type {GameSessionState, PlayerSeat} from '@/game/types'

/** Fixed player count for Frontline matches. */
export const REQUIRED_PLAYERS = 2

/** Seat 1 starts by default. */
export const STARTING_SEAT: PlayerSeat = 0

/**
 * Returns the opposing player's seat.
 * @param seat - Current player's seat (0 or 1)
 * @returns Next player's seat
 */
export function nextSeat(seat: PlayerSeat): PlayerSeat {
  return seat === 0 ? 1 : 0
}

/**
 * Creates the initial active game session state when both seats are filled.
 * @returns Fresh playing session state
 */
export function createInitialSessionState(): GameSessionState {
  return {
    turnIndex: STARTING_SEAT,
    turnCount: 1,
    phase: 'playing',
    winner: null,
  }
}

/**
 * Pure transition that advances the active turn to the opponent.
 * @param state - Current game session state
 * @returns Updated session state with incremented turn count and flipped seat
 */
export function advanceTurn(state: GameSessionState): GameSessionState {
  if (state.phase !== 'playing') {
    return state
  }

  return {
    ...state,
    turnIndex: nextSeat(state.turnIndex),
    turnCount: state.turnCount + 1,
  }
}
