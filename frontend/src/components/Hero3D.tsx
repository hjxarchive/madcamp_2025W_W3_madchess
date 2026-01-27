import Spline from '@splinetool/react-spline'
import { useRef } from 'react'

export default function Hero3D() {
    const containerRef = useRef<HTMLDivElement>(null)

    const handleLoad = () => {
        // HACK: Programmatically remove the Spline watermark
        setTimeout(() => {
            const logo = document.querySelector('a[href^="https://spline.design"]')
            if (logo) {
                logo.remove()
            }

            // Also check inside the container just in case
            if (containerRef.current) {
                const internalLogo = containerRef.current.querySelector('a[href^="https://spline.design"]')
                if (internalLogo) {
                    internalLogo.remove()
                }
            }
        }, 500) // Wait a bit for it to render
    }

    return (
        <div className="w-full h-[500px]" ref={containerRef}>
            <Spline
                scene="https://prod.spline.design/BNDz9QWDD6sx1uxI/scene.splinecode"
                onLoad={handleLoad}
            />
        </div>
    )
}
