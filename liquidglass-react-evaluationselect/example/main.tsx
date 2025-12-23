import { useEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"
import LiquidGlass from "../src/index"

type MousePos = { x: number; y: number }

function App() {
  const containerRef = useRef<HTMLDivElement>(null)

  const initialMouse = useMemo<MousePos>(
    () => ({ x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) }),
    [],
  )

  const [mouse, setMouse] = useState<MousePos>(initialMouse)
  const [buttonPos, setButtonPos] = useState<MousePos>(initialMouse)

  useEffect(() => {
    let raf = 0
    const onMove = (e: MouseEvent) => {
      if (raf) cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setMouse({ x: e.clientX, y: e.clientY }))
    }

    window.addEventListener("mousemove", onMove, { passive: true })
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener("mousemove", onMove)
    }
  }, [])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      setButtonPos((current) => {
        const follow = 0.14
        return {
          x: current.x + (mouse.x - current.x) * follow,
          y: current.y + (mouse.y - current.y) * follow,
        }
      })
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [mouse.x, mouse.y])

  return (
    <div ref={containerRef} style={{ position: "fixed", inset: 0 }}>
      <video
        src="./evaluation_select.mp4"
        autoPlay
        muted
        loop
        playsInline
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          pointerEvents: "none",
          filter: "saturate(1.1) contrast(1.05)",
        }}
      />

      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "radial-gradient(circle at 50% 50%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.6) 100%)",
          pointerEvents: "none",
        }}
      />

      <LiquidGlass
        mouseContainer={containerRef}
        globalMousePos={mouse}
        mode="polar"
        displacementScale={120}
        blurAmount={0.0}
        saturation={140}
        aberrationIntensity={2}
        elasticity={1}
        cornerRadius={30}
        width={800}
        height={600}
        padding="0px"
        contentAlignment="center"
        onClick={() => console.log("Glass button clicked")}
        style={{
          position: "fixed",
          left: buttonPos.x,
          top: buttonPos.y,
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <span style={{ color: "white", fontWeight: 600, letterSpacing: 0.2 }}>Liquid Glass Button</span>
      </LiquidGlass>

      <div
        style={{
          position: "fixed",
          left: 16,
          bottom: 16,
          color: "rgba(255,255,255,0.8)",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
          fontSize: 12,
          pointerEvents: "none",
        }}
      >
        Move the mouse — the glass button follows.
      </div>
    </div>
  )
}

createRoot(document.getElementById("root")!).render(<App />)
