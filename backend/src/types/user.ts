// This file is a module because of the export
export interface User {
    id: number
    email: string
    name: string
    picture?: string
    googleId: string
    rating?: number
    rd?: number
    volatility?: number
}

declare global {
    namespace Express {
        interface User {
            id: number
            email: string
            name: string
            picture?: string
            googleId: string
            rating?: number
            rd?: number
            volatility?: number
        }
    }
}
