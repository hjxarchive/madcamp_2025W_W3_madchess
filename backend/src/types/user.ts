export interface User {
    id: number
    email: string
    name: string
    picture?: string
    googleId: string
}

declare global {
    namespace Express {
        interface User {
            id: number
            email: string
            name: string
            picture?: string
            googleId: string
        }
    }
}
