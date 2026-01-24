/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean
  readonly PROD: boolean
  readonly MODE: string
  readonly BASE_URL: string
  readonly VITE_API_URL?: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_WS_URL: string
  // 필요한 환경 변수를 여기에 추가
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
