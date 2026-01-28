import { useRef, useEffect, useState, type ReactNode } from 'react'

interface Tab {
  id: string
  label: string
  disabled?: boolean
}

interface TabContainerProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
  className?: string
  children?: ReactNode
}

export function TabContainer({ tabs, activeTab, onTabChange, className = '' }: TabContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [gradientStyle, setGradientStyle] = useState<string>('')

  useEffect(() => {
    const updateGradient = () => {
      const container = containerRef.current
      const activeBtn = buttonRefs.current.get(activeTab)

      if (!container || !activeBtn) return

      const containerWidth = container.offsetWidth
      const btnLeft = activeBtn.offsetLeft
      const btnWidth = activeBtn.offsetWidth
      const btnCenter = btnLeft + btnWidth / 2
      const centerPercent = (btnCenter / containerWidth) * 100

      // Gradient fades from transparent -> purple at center -> transparent
      setGradientStyle(
        `linear-gradient(to right, transparent 0%, #5631ad ${centerPercent}%, transparent 100%)`
      )
    }

    updateGradient()
    window.addEventListener('resize', updateGradient)
    return () => window.removeEventListener('resize', updateGradient)
  }, [activeTab])

  return (
    <div className={`tab-container ${className}`} ref={containerRef}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(el) => {
            if (el) buttonRefs.current.set(tab.id, el)
          }}
          className={`tab-button ${activeTab === tab.id ? 'tab-button-active' : ''}`}
          onClick={() => onTabChange(tab.id)}
          disabled={tab.disabled}
        >
          {tab.label}
        </button>
      ))}
      <div
        className="tab-divider"
        style={{ background: gradientStyle }}
      />
    </div>
  )
}
