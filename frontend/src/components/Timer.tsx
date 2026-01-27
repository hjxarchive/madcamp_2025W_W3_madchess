import { useEffect, useState } from 'react'

interface TimerProps {
    initialTime: number // ms
    isActive: boolean
    onTimeout?: () => void
}

export function Timer({ initialTime, isActive, onTimeout }: TimerProps) {
    const [time, setTime] = useState(initialTime)

    useEffect(() => {
        setTime(initialTime)
    }, [initialTime])

    useEffect(() => {
        let interval: NodeJS.Timeout
        if (isActive && time > 0) {
            interval = setInterval(() => {
                setTime((prev) => {
                    if (prev <= 1000) {
                        clearInterval(interval)
                        if (onTimeout) onTimeout()
                        return 0
                    }
                    return prev - 1000
                })
            }, 1000)
        }
        return () => clearInterval(interval)
    }, [isActive, onTimeout]) // remove 'time' from deps to avoid re-interval on every tick? No, interval closure needs time? 
    // Actually, functional update setTime(prev => ...) doesn't need 'time' dependency.
    // So [isActive, onTimeout] is safest if we want stable interval.

    const formatTime = (ms: number) => {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000))
        const minutes = Math.floor(totalSeconds / 60)
        const seconds = totalSeconds % 60
        return `${minutes}:${seconds.toString().padStart(2, '0')}`
    }

    return (
        <div className={`font-mono text-3xl font-bold ${time < 20000 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
            {formatTime(time)}
        </div>
    )
}
