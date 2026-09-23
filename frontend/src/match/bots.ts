import type {MatchClient} from '@/match/match_client'
import type {MatchState} from '@/match/match_state'

/** Minimum thinking delay before bot passes the turn (ms). */
const BOT_MIN_DELAY_MS = 800

/** Maximum thinking delay before bot passes the turn (ms). */
const BOT_MAX_DELAY_MS = 1400

/**
 * Checks whether the current turn belongs to an automated bot.
 * @param state - Current match state
 * @returns True if active player is a bot
 */
export function isBotTurn(state: MatchState): boolean {
  if (state.phase !== 'playing') {
    return false
  }

  const activePlayer = state.players[state.turnIndex]

  return activePlayer?.bot === true
}

/**
 * Executes a simulated bot turn after a human-like pause.
 * @param client - Active MatchClient instance
 * @param state - Current match state
 * @returns Promise resolving when turn pass has been submitted
 */
export async function scheduleBotTurn(
  client: MatchClient,
  state: MatchState,
): Promise<void> {
  const delay = Math.floor(
    BOT_MIN_DELAY_MS + Math.random() * (BOT_MAX_DELAY_MS - BOT_MIN_DELAY_MS),
  )

  await new Promise((resolve) => setTimeout(resolve, delay))

  await client.passTurn(state.turnCount)
}
