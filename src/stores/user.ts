// 用户 store(moc阶段只做本地展示)
import { defineStore } from 'pinia'
import type { UserInfo } from '@/types'
import { mockUser } from '@/data/mock'

export const useUserStore = defineStore('user', {
  state: () => ({
    user: mockUser as UserInfo,
  }),
  actions: {
    setUser(u: UserInfo) {
      this.user = u
    },
  },
})