import {initializeApp} from 'firebase/app'
import {getAuth, onAuthStateChanged, signInAnonymously} from 'firebase/auth'
import type {Unsubscribe} from 'firebase/auth'
import {getFirestore} from 'firebase/firestore'

/**
 * The Firebase project every match is synchronised through.
 *
 * Public identifiers configured for frontline-game.
 * Anonymous authentication is used so players take stable seats without account setup.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyCCsE_krJmRPDnatuE3ypo-Q1nmhdTKQtA',
  authDomain: 'frontline-game.firebaseapp.com',
  projectId: 'frontline-game',
  storageBucket: 'frontline-game.firebasestorage.app',
  messagingSenderId: '540712260365',
  appId: '1:540712260365:web:09a1e098edd439daf79644',
  measurementId: 'G-71R96Y5LK5',
}

const app = initializeApp(firebaseConfig)

export const firestore = getFirestore(app)

/**
 * Signs this browser in anonymously and returns its stable UID.
 * @returns The player's anonymous identifier
 */
export async function currentPlayerId(): Promise<string> {
  const auth = getAuth(app)

  await auth.authStateReady()

  if (auth.currentUser !== null) {
    return auth.currentUser.uid
  }

  const credential = await signInAnonymously(auth)

  return credential.user.uid
}

/**
 * Observes the current authentication status without forcing sign-in.
 * @param onChange - Callback receiving the UID or null
 * @returns Unsubscribe function
 */
export function watchPlayerId(onChange: (playerId: string | null) => void): Unsubscribe {
  return onAuthStateChanged(getAuth(app), (user) => {
    onChange(user?.uid ?? null)
  })
}
