import Spline from '@splinetool/react-spline'
import { useRef, useEffect } from 'react'

export default function Hero3D() {
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        // Aggressively try to remove the watermark
        const removeWatermark = () => {
            const selectors = [
                'a[href^="https://spline.design"]',
                '#spline-watermark',
                '[class*="watermark"]',
                '[class*="logo"]'
            ]

            selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector)
                elements.forEach(node => {
                    const el = node as HTMLElement
                    if (el && el.parentElement && el.textContent?.toLowerCase().includes('spline')) {
                        el.style.display = 'none'
                        el.remove()
                    }
                })
            })

            // Also search within the specific container
            if (containerRef.current) {
                const internalElements = containerRef.current.querySelectorAll('a')
                internalElements.forEach(el => {
                    if (el.href.includes('spline.design')) {
                        el.style.display = 'none'
                        el.style.visibility = 'hidden'
                        el.style.opacity = '0'
                        el.remove()
                    }
                })
            }
        }

        // Run immediately and on interval
        removeWatermark()
        const intervalId = setInterval(removeWatermark, 100)

        // Also use MutationObserver to catch it when it's added
        const observer = new MutationObserver(removeWatermark)
        if (containerRef.current) {
            observer.observe(containerRef.current, { childList: true, subtree: true })
        }

        return () => {
            clearInterval(intervalId)
            observer.disconnect()
        }
    }, [])

    return (
        <div className="w-full h-[500px] relative" ref={containerRef}>
            <Spline
                scene="https://prod.spline.design/BNDz9QWDD6sx1uxI/scene.splinecode"
            />
            {/* Fail-safe Masking Div: Covers the bottom right corner */}
            <div className="absolute bottom-4 right-4 w-[160px] h-[40px] bg-[#050505] z-50 pointer-events-none" />
        </div>
    )
}
