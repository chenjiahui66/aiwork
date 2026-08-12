// AiWork 项目共用的 TS 类型定义

export interface AiApp {
  /** 应用 ID,用于路由跳转 */
  id: string
  /** 应用名称(中文) */
  name: string
  /** 应用描述(简短一句话) */
  description: string
  /** Element Plus icon 组件名,如 ChatDotRound */
  icon: string
  /** 图标卡片背景渐变 */
  bgGradient: string
  /** 分类:communication / productivity / data / creative */
  category: 'communication' | 'productivity' | 'data' | 'creative'
  /** 标签:热门 / 新上线 / 即将推出 */
  tags: ('热门' | '新上线' | '即将推出')[]
  /** 当前状态:online / beta / coming */
  status: 'online' | 'beta' | 'coming'
}

export interface UserInfo {
  id: number
  username: string
  nickname: string
  avatar?: string
  department: string
  role: 'admin' | 'member' | 'guest'
}