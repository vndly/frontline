import {doc,
  onSnapshot,
  runTransaction,
  serverTimestamp} from 'firebase/firestore'
import type {DocumentReference, Unsubscribe} from 'firebase/firestore'
import {nextSeat} from '@/game/rules'
import {createMatchCode} from '@/match/codes'
import {currentPlayerId, firestore} from '@/match/firebase'
import {parseMatchState} from '@/match/match_state'
import type {MatchPlayer, MatchState} from '@/match/match_state'

const MATCHES = 'matches'
const CODE_ATTEMPTS = 8

/**
 * Manages one player's active session and Firestore synchronization for a match.
 */
export class MatchClient {
  private readonly code: string
  private readonly playerId: string
  private readonly reference: DocumentReference
  private readonly unsubscribers: Unsubscribe[] = []

  private constructor(code: string, playerId: string) {
    this.code = code
    this.playerId = playerId
    this.reference = doc(firestore, MATCHES, code)
  }

  /** The identifier this browser plays under. */
  get uid(): string {
    return this.playerId
  }

  /**
   * Opens a match connection for an existing match code.
   * @param code - 4-character room code
   * @returns MatchClient instance ready to listen
   */
  static async open(code: string): Promise<MatchClient> {
    const playerId = await currentPlayerId()

    return new MatchClient(code, playerId)
  }

  /**
   * Creates a new match in Firestore.
   * If vsBot is true, immediately fills Seat 2 with a bot and starts the game.
   * @param name - Creator's player name
   * @param vsBot - Whether to fill Seat 2 with an automated bot
   * @returns The claimed room code
   */
  static async create(name: string, vsBot: boolean): Promise<string> {
    const playerId = await currentPlayerId()

    const creator: MatchPlayer = {
      uid: playerId,
      name: name.trim() || 'Player 1',
      bot: false,
    }

    const seats: MatchPlayer[] = [creator]

    if (vsBot) {
      seats.push({
        uid: 'bot_' + Math.random().toString(36).slice(2, 9),
        name: 'Frontline Bot',
        bot: true,
      })
    }

    const started = vsBot

    for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
      const code = createMatchCode()
      const reference = doc(firestore, MATCHES, code)

      const claimed = await runTransaction(firestore, async (transaction) => {
        const existing = await transaction.get(reference)

        if (existing.exists()) {
          return false
        }

        transaction.set(reference, {
          phase: started ? 'playing' : 'lobby',
          players: seats,
          turnIndex: 0,
          turnCount: 1,
          winner: null,
          createdAt: serverTimestamp(),
        })

        return true
      })

      if (claimed) {
        return code
      }
    }

    throw new Error('Could not find an available match code. Please try again.')
  }

  /**
   * Joins an existing match as Player 2.
   * @param code - Room code to join
   * @param name - Joining player's display name
   */
  static async join(code: string, name: string): Promise<void> {
    const playerId = await currentPlayerId()
    const reference = doc(firestore, MATCHES, code)

    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(reference)

      if (!snapshot.exists()) {
        throw new Error('No match found with that code.')
      }

      const state = parseMatchState(code, snapshot.data())

      if (state === null) {
        throw new Error('This match document could not be read.')
      }

      const alreadySeated = state.players.some((player) => player.uid === playerId)

      if (alreadySeated) {
        // Player already occupies a seat
        return
      }

      if (state.phase !== 'lobby' || state.players.length >= 2) {
        throw new Error('This match is already full or in progress.')
      }

      const updatedPlayers: MatchPlayer[] = [
        ...state.players,
        {
          uid: playerId,
          name: name.trim() || 'Player 2',
          bot: false,
        },
      ]

      transaction.update(reference, {
        players: updatedPlayers,
        phase: 'playing',
        turnIndex: 0,
        turnCount: 1,
      })
    })
  }

  /**
   * Subscribes to document updates for this match.
   * @param onState - Callback receiving the parsed state and server confirmation flag
   * @param onLost - Callback invoked on terminal network/read errors
   */
  listen(
    onState: (state: MatchState, confirmed: boolean) => void,
    onLost: (reason: unknown) => void,
  ): void {
    const unsubscribe = onSnapshot(this.reference, (snapshot) => {
      const confirmed = !snapshot.metadata.fromCache

      if (!snapshot.exists()) {
        if (confirmed) {
          onLost(new Error('No match found with that code.'))
        }

        return
      }

      const state = parseMatchState(this.code, snapshot.data())

      if (state === null) {
        if (confirmed) {
          onLost(new Error('This match payload is corrupted.'))
        }

        return
      }

      onState(state, confirmed)
    }, onLost)

    this.unsubscribers.push(unsubscribe)
  }

  /**
   * Advances the turn to the other player via a Firestore transaction.
   * @param expectedTurnCount - The turn count observed by the caller to avoid stale writes
   */
  async passTurn(expectedTurnCount: number): Promise<void> {
    await runTransaction(firestore, async (transaction) => {
      const snapshot = await transaction.get(this.reference)
      const state = parseMatchState(this.code, snapshot.data())

      if (state === null || state.phase !== 'playing') {
        return
      }

      // Ignore if another transaction already moved the turn
      if (state.turnCount !== expectedTurnCount) {
        return
      }

      const nextTurnIndex = nextSeat(state.turnIndex)

      transaction.update(this.reference, {
        turnIndex: nextTurnIndex,
        turnCount: state.turnCount + 1,
      })
    })
  }

  /** Stops all Firestore subscriptions. */
  dispose(): void {
    for (const unsubscribe of this.unsubscribers) {
      unsubscribe()
    }

    this.unsubscribers.length = 0
  }
}
