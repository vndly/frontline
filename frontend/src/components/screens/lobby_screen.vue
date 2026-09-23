<script setup lang="ts">
import {onMounted, ref} from 'vue'
import {useRouter} from 'vue-router'
import {MatchClient} from '@/match/match_client'

const PLAYER_NAME_STORAGE_KEY = 'frontline.player-name'

const router = useRouter()
const playerName = ref('')
const creating = ref(false)
const errorMessage = ref<string | null>(null)

onMounted(() => {
  const remembered = localStorage.getItem(PLAYER_NAME_STORAGE_KEY)

  if (remembered !== null && remembered.trim() !== '') {
    playerName.value = remembered.trim()
  }
})

function saveName(): string {
  const trimmed = playerName.value.trim() || 'Operative'

  localStorage.setItem(PLAYER_NAME_STORAGE_KEY, trimmed)

  return trimmed
}

async function handleCreateMatch(): Promise<void> {
  if (creating.value) {
    return
  }

  creating.value = true
  errorMessage.value = null

  try {
    const name = saveName()
    const code = await MatchClient.create(name, false)

    await router.push({
      name: 'match',
      params: {
        code: code,
      },
    })
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'Failed to create match.'
    creating.value = false
  }
}

async function handlePlayWithBots(): Promise<void> {
  if (creating.value) {
    return
  }

  creating.value = true
  errorMessage.value = null

  try {
    const name = saveName()
    const code = await MatchClient.create(name, true)

    await router.push({
      name: 'match',
      params: {
        code: code,
      },
    })
  } catch (err: unknown) {
    errorMessage.value = err instanceof Error ? err.message : 'Failed to launch bot match.'
    creating.value = false
  }
}
</script>

<template>
  <main class="lobby">
    <div class="lobby-card">
      <header class="lobby-header">
        <div class="lobby-badge">PHASE 1 // DEPLOYMENT</div>
        <h1 class="lobby-title">FRONTLINE</h1>
        <p class="lobby-subtitle">Turn-based tactical 2-player arena</p>
      </header>

      <form class="lobby-form" @submit.prevent="handleCreateMatch">
        <div class="field-group">
          <label for="callsign" class="field-label">CALLSIGN</label>
          <input
            id="callsign"
            v-model="playerName"
            type="text"
            maxlength="20"
            placeholder="Enter player name"
            autocomplete="off"
            spellcheck="false"
            class="callsign-input"
            :disabled="creating"
          >
        </div>

        <div v-if="errorMessage" class="error-banner">
          {{ errorMessage }}
        </div>

        <div class="actions">
          <button
            type="submit"
            class="btn btn-primary"
            :disabled="creating"
          >
            <span v-if="creating">CONNECTING...</span>
            <span v-else>CREATE MATCH</span>
          </button>

          <button
            type="button"
            class="btn btn-secondary"
            :disabled="creating"
            @click="handlePlayWithBots"
          >
            PLAY WITH BOTS
          </button>
        </div>
      </form>
    </div>
  </main>
</template>

<style scoped>
.lobby {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: radial-gradient(circle at 50% 20%, rgba(20, 25, 32, 0.8), rgba(13, 17, 21, 1));
}

.lobby-card {
  width: 100%;
  max-width: 440px;
  background-color: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 2.5rem 2rem;
  box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
}

.lobby-header {
  text-align: center;
  margin-bottom: 2rem;
}

.lobby-badge {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.15em;
  color: var(--accent-amber);
  margin-bottom: 0.75rem;
  padding: 0.2rem 0.6rem;
  background-color: var(--accent-amber-glow);
  border-radius: var(--radius-sm);
}

.lobby-title {
  font-family: var(--font-display);
  font-size: 2.25rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.lobby-subtitle {
  color: var(--text-secondary);
  font-size: 0.9rem;
}

.lobby-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.field-label {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
}

.callsign-input {
  background-color: var(--bg-surface-elevated);
  border: 1px solid var(--border-prominent);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  color: var(--text-primary);
  font-size: 1rem;
  transition: border-color var(--transition-fast);
}

.callsign-input:hover:not(:disabled) {
  border-color: var(--text-secondary);
}

.callsign-input:focus {
  border-color: var(--accent-amber);
}

.callsign-input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-banner {
  padding: 0.75rem 1rem;
  background-color: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #fca5a5;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.85rem 1.25rem;
  border-radius: var(--radius-md);
  font-weight: 600;
  letter-spacing: 0.04em;
  transition: transform var(--transition-fast), background-color var(--transition-fast), border-color var(--transition-fast);
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
  background-color: var(--border-subtle);
  border-color: var(--text-secondary);
}
</style>
