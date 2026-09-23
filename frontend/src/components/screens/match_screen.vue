<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {isBotTurn} from '@/match/bots'
import {isMatchCode, normaliseMatchCode} from '@/match/codes'
import {MatchClient} from '@/match/match_client'
import type {MatchPlayer, MatchState} from '@/match/match_state'

const PLAYER_NAME_STORAGE_KEY = 'frontline.player-name'

const route = useRoute()
const router = useRouter()

const code = computed<string>(() => normaliseMatchCode(String(route.params.code ?? '')))
const matchState = ref<MatchState | null>(null)
const clientUid = ref<string>('')
const loading = ref(true)
const joining = ref(false)
const passingTurn = ref(false)
const copied = ref(false)
const errorMessage = ref<string | null>(null)
const joinNameInput = ref('')

let client: MatchClient | null = null
let botTurnInProgress = false
let botTimer = 0

function clearBotTimer(): void {
  if (botTimer !== 0) {
    window.clearTimeout(botTimer)
    botTimer = 0
  }
}

const isCodeValid = computed<boolean>(() => isMatchCode(code.value))

const isSeated = computed<boolean>(() => {
  if (matchState.value === null || clientUid.value === '') {
    return false
  }

  return matchState.value.players.some((player) => player.uid === clientUid.value)
})

const mySeatIndex = computed<number>(() => {
  if (matchState.value === null || clientUid.value === '') {
    return -1
  }

  return matchState.value.players.findIndex((player) => player.uid === clientUid.value)
})

const myPlayer = computed<MatchPlayer | null>(() => {
  if (matchState.value === null || mySeatIndex.value === -1) {
    return null
  }

  return matchState.value.players[mySeatIndex.value] ?? null
})

const opponentPlayer = computed<MatchPlayer | null>(() => {
  if (matchState.value === null) {
    return null
  }

  return matchState.value.players.find((player) => player.uid !== clientUid.value) ?? null
})

const isMyTurn = computed<boolean>(() => {
  if (matchState.value === null || matchState.value.phase !== 'playing') {
    return false
  }

  return matchState.value.turnIndex === mySeatIndex.value
})

const activePlayer = computed<MatchPlayer | null>(() => {
  if (matchState.value === null || matchState.value.phase !== 'playing') {
    return null
  }

  return matchState.value.players[matchState.value.turnIndex] ?? null
})

async function connectToMatch(): Promise<void> {
  if (!isCodeValid.value) {
    errorMessage.value = 'Invalid match room code format.'
    loading.value = false

    return
  }

  try {
    const activeClient = await MatchClient.open(code.value)

    client = activeClient
    clientUid.value = activeClient.uid

    activeClient.listen((state) => {
      loading.value = false
      matchState.value = state

      // If user is not yet seated and in lobby, check if we can auto-join
      if (state.phase === 'lobby' && !state.players.some((p) => p.uid === activeClient.uid)) {
        const remembered = localStorage.getItem(PLAYER_NAME_STORAGE_KEY)

        if (remembered !== null && remembered.trim() !== '') {
          void attemptJoin(remembered.trim())
        }
      }
    }, (err: unknown) => {
      loading.value = false
      errorMessage.value = err instanceof Error ? err.message : 'Connection to match lost.'
    })
  } catch (err: unknown) {
    loading.value = false
    errorMessage.value = err instanceof Error ? err.message : 'Failed to connect to match.'
  }
}

async function attemptJoin(name: string): Promise<void> {
  if (joining.value) {
    return
  }

  joining.value = true
  errorMessage.value = null

  try {
    const trimmed = name.trim() || 'Player 2'

    localStorage.setItem(PLAYER_NAME_STORAGE_KEY, trimmed)
    await MatchClient.join(code.value, trimmed)
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'Failed to join match.'
  } finally {
    joining.value = false
  }
}

async function handlePassTurn(): Promise<void> {
  if (!isMyTurn.value || passingTurn.value || client === null || matchState.value === null) {
    return
  }

  passingTurn.value = true

  try {
    await client.passTurn(matchState.value.turnCount)
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'Failed to pass turn.'
  } finally {
    passingTurn.value = false
  }
}

async function copyInviteLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch {
    // Fallback if clipboard API restricted
    copied.value = false
  }
}

function returnToLobby(): void {
  void router.push({
    name: 'lobby',
  })
}

// Watch for bot turns and trigger simulated bot action
watch(matchState, (state) => {
  if (state === null || client === null || botTurnInProgress) {
    return
  }

  if (isBotTurn(state) && mySeatIndex.value === 0) {
    botTurnInProgress = true
    clearBotTimer()

    botTimer = window.setTimeout(() => {
      if (client === null || matchState.value === null) {
        botTurnInProgress = false

        return
      }

      client.passTurn(state.turnCount).catch((err: unknown) => {
        errorMessage.value = err instanceof Error ? err.message : 'Bot turn execution failed.'
      }).finally(() => {
        botTurnInProgress = false
        botTimer = 0
      })
    }, 1000)
  }
})

onMounted(() => {
  void connectToMatch()
})

onBeforeUnmount(() => {
  clearBotTimer()
  client?.dispose()
  client = null
})
</script>

<template>
  <main class="match-container">
    <!-- Header / Navigation -->
    <header class="match-navbar">
      <div class="brand-group">
        <button class="nav-back-btn" @click="returnToLobby">
          &larr; LEAVE
        </button>
        <span class="room-code-tag">ROOM: {{ code }}</span>
      </div>

      <div v-if="matchState?.phase === 'playing'" class="turn-counter">
        TURN {{ matchState.turnCount }}
      </div>
    </header>

    <!-- Error State -->
    <div v-if="errorMessage" class="state-card error-card">
      <h2>TACTICAL ADVISORY</h2>
      <p>{{ errorMessage }}</p>
      <button class="btn btn-primary" @click="returnToLobby">
        RETURN TO LOBBY
      </button>
    </div>

    <!-- Loading State -->
    <div v-else-if="loading" class="state-card loading-card">
      <div class="pulse-radar" />
      <p>ESTABLISHING SECURE UPLINK...</p>
    </div>

    <!-- Lobby: Unseated Player 2 prompt -->
    <div v-else-if="matchState?.phase === 'lobby' && !isSeated" class="state-card join-prompt-card">
      <div class="card-badge">DIRECT INVITATION</div>
      <h2>JOIN OPERATION</h2>
      <p>You have been invited to engage by {{ matchState.players[0]?.name }}.</p>

      <form class="join-form" @submit.prevent="attemptJoin(joinNameInput)">
        <div class="field-group">
          <label for="joinCallsign" class="field-label">YOUR CALLSIGN</label>
          <input
            id="joinCallsign"
            v-model="joinNameInput"
            type="text"
            maxlength="20"
            placeholder="Enter your name"
            class="callsign-input"
            autocomplete="off"
            spellcheck="false"
            :disabled="joining"
          >
        </div>

        <button type="submit" class="btn btn-primary" :disabled="joining">
          <span v-if="joining">TAKING SEAT...</span>
          <span v-else>ENGAGE</span>
        </button>
      </form>
    </div>

    <!-- Lobby: Waiting for Opponent -->
    <div v-else-if="matchState?.phase === 'lobby' && isSeated" class="state-card waiting-card">
      <div class="pulse-radar" />
      <h2>AWAITING OPPONENT</h2>
      <p>Share this match code or transmission link with Player 2.</p>

      <div class="share-box">
        <span class="share-code">{{ code }}</span>
        <button class="btn btn-secondary copy-btn" @click="copyInviteLink">
          <span v-if="copied">COPIED!</span>
          <span v-else>COPY LINK</span>
        </button>
      </div>
    </div>

    <!-- Occupied / In-progress match for unseated viewer -->
    <div v-else-if="matchState?.phase !== 'lobby' && !isSeated" class="state-card error-card">
      <div class="card-badge">SEATS OCCUPIED</div>
      <h2>OPERATION IN PROGRESS</h2>
      <p>This match is already in progress between two operatives.</p>
      <button class="btn btn-primary" @click="returnToLobby">
        RETURN TO LOBBY
      </button>
    </div>

    <!-- Active Match Screen -->
    <div v-else-if="matchState?.phase === 'playing'" class="match-arena">
      <!-- Opponent Seat -->
      <section class="seat-panel opponent-seat" :class="{ 'is-active': !isMyTurn }">
        <div class="seat-info">
          <div class="seat-role">OPPONENT // SEAT {{ mySeatIndex === 0 ? '2' : '1' }}</div>
          <div class="seat-name">
            {{ opponentPlayer?.name }}
            <span v-if="opponentPlayer?.bot" class="bot-badge">AI BOT</span>
          </div>
        </div>
        <div class="seat-status">
          <span v-if="!isMyTurn" class="status-indicator active-indicator">DECIDING</span>
          <span v-else class="status-indicator waiting-indicator">STANDBY</span>
        </div>
      </section>

      <!-- Center Board / Action Zone -->
      <section class="board-center">
        <div class="turn-banner" :class="{ 'my-turn-banner': isMyTurn }">
          <div class="banner-eyebrow">
            {{ isMyTurn ? 'YOUR TURN' : 'OPPONENT TURN' }}
          </div>
          <h2 class="banner-title">
            {{ isMyTurn ? 'Orders Awaited' : `${activePlayer?.name ?? 'Opponent'} is playing...` }}
          </h2>
        </div>

        <div class="tactical-actions">
          <button
            class="btn btn-turn-action"
            :class="{ 'btn-ready': isMyTurn }"
            :disabled="!isMyTurn || passingTurn"
            @click="handlePassTurn"
          >
            <span v-if="passingTurn">COMMITTING...</span>
            <span v-else-if="isMyTurn">PASS TURN &rarr;</span>
            <span v-else>WAITING FOR OPPONENT...</span>
          </button>
        </div>
      </section>

      <!-- Player Seat -->
      <section class="seat-panel my-seat" :class="{ 'is-active': isMyTurn }">
        <div class="seat-info">
          <div class="seat-role">YOU // SEAT {{ mySeatIndex + 1 }}</div>
          <div class="seat-name">{{ myPlayer?.name }}</div>
        </div>
        <div class="seat-status">
          <span v-if="isMyTurn" class="status-indicator active-indicator">YOUR MOVE</span>
          <span v-else class="status-indicator waiting-indicator">STANDBY</span>
        </div>
      </section>
    </div>
  </main>
</template>

<style scoped>
.match-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-primary);
  color: var(--text-primary);
}

.match-navbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-subtle);
  background-color: var(--bg-surface);
}

.brand-group {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.nav-back-btn {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-sm);
  background-color: var(--bg-surface-elevated);
  transition: color var(--transition-fast), background-color var(--transition-fast);
}

.nav-back-btn:hover {
  color: var(--text-primary);
  background-color: var(--border-prominent);
}

.room-code-tag {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  color: var(--accent-amber);
  background-color: var(--accent-amber-glow);
  padding: 0.25rem 0.6rem;
  border-radius: var(--radius-sm);
}

.turn-counter {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--accent-cyan);
}

.state-card {
  margin: auto;
  max-width: 460px;
  width: calc(100% - 3rem);
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 2.5rem 2rem;
  text-align: center;
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
}

.state-card h2 {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
}

.state-card p {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-bottom: 1.5rem;
}

.card-badge {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  color: var(--accent-cyan);
  background-color: var(--accent-cyan-glow);
  padding: 0.2rem 0.6rem;
  border-radius: var(--radius-sm);
  margin-bottom: 1rem;
}

.pulse-radar {
  width: 48px;
  height: 48px;
  margin: 0 auto 1.5rem;
  border-radius: 50%;
  border: 2px solid var(--accent-amber);
  box-shadow: 0 0 15px var(--accent-amber-glow);
  animation: pulse-ring 1.8s infinite ease-out;
}

@keyframes pulse-ring {
  0% {
    transform: scale(0.9);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.15);
    opacity: 0.4;
  }
  100% {
    transform: scale(0.9);
    opacity: 0.8;
  }
}

.share-box {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--bg-surface-elevated);
  border: 1px solid var(--border-prominent);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
}

.share-code {
  font-family: var(--font-mono);
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text-primary);
}

.join-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  text-align: left;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.callsign-input {
  background-color: var(--bg-surface-elevated);
  border: 1px solid var(--border-prominent);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  color: var(--text-primary);
  font-size: 1rem;
}

.callsign-input:focus {
  border-color: var(--accent-amber);
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.8rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  letter-spacing: 0.04em;
  transition: transform var(--transition-fast), background-color var(--transition-fast);
}

.btn:active:not(:disabled) {
  transform: scale(0.98);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background-color: var(--accent-amber);
  color: #0b0e11;
}

.btn-primary:hover:not(:disabled) {
  background-color: #f0b54e;
}

.btn-secondary {
  background-color: var(--bg-surface-elevated);
  border: 1px solid var(--border-prominent);
  color: var(--text-primary);
}

.btn-secondary:hover:not(:disabled) {
  border-color: var(--text-secondary);
}

/* Match Arena Layout */
.match-arena {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1.5rem;
  max-width: 680px;
  width: 100%;
  margin: 0 auto;
}

.seat-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: border-color var(--transition-base), box-shadow var(--transition-base);
}

.seat-panel.is-active {
  border-color: var(--accent-amber);
  box-shadow: 0 0 20px var(--accent-amber-glow);
}

.seat-role {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-tertiary);
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.seat-name {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bot-badge {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  padding: 0.15rem 0.4rem;
  background-color: rgba(148, 163, 184, 0.15);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
}

.status-indicator {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.3rem 0.6rem;
  border-radius: var(--radius-sm);
}

.active-indicator {
  background-color: var(--accent-amber-glow);
  color: var(--accent-amber);
  border: 1px solid var(--accent-amber);
}

.waiting-indicator {
  background-color: rgba(100, 116, 139, 0.15);
  color: var(--text-tertiary);
}

.board-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  padding: 2rem 0;
  text-align: center;
}

.turn-banner {
  padding: 1.5rem 2rem;
  background-color: var(--bg-surface-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  width: 100%;
  max-width: 440px;
  transition: border-color var(--transition-base);
}

.turn-banner.my-turn-banner {
  border-color: var(--accent-amber);
}

.banner-eyebrow {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.1em;
  color: var(--text-tertiary);
  margin-bottom: 0.4rem;
}

.my-turn-banner .banner-eyebrow {
  color: var(--accent-amber);
}

.banner-title {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
}

.tactical-actions {
  width: 100%;
  max-width: 320px;
}

.btn-turn-action {
  width: 100%;
  padding: 1rem 1.5rem;
  font-family: var(--font-mono);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  background-color: var(--bg-surface-elevated);
  border: 1px solid var(--border-prominent);
  color: var(--text-tertiary);
}

.btn-turn-action.btn-ready {
  background-color: var(--accent-amber);
  color: #0b0e11;
  border-color: var(--accent-amber);
  box-shadow: 0 4px 15px var(--accent-amber-glow);
}

.btn-turn-action.btn-ready:hover:not(:disabled) {
  background-color: #f0b54e;
  transform: translateY(-2px);
}
</style>
