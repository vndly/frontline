import {createRouter, createWebHistory} from 'vue-router'
import LobbyScreen from '@/components/screens/lobby_screen.vue'
import MatchScreen from '@/components/screens/match_screen.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'lobby',
      component: LobbyScreen,
    },
    {
      path: '/match/:code',
      name: 'match',
      component: MatchScreen,
    },
  ],
})

export default router
