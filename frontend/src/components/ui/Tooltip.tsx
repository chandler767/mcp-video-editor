import { ReactNode, useState, useRef, useEffect } from 'react'

interface TooltipProps {
  content: string
  children: ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export default function Tooltip({
  content,
  children,
  placement = 'top',
  delay = 300,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()

        let x = 0
        let y = 0

        switch (placement) {
          case 'top':
            x = rect.left + rect.width / 2
            y = rect.top - 8
            break
          case 'bottom':
            x = rect.left + rect.width / 2
            y = rect.bottom + 8
            break
          case 'left':
            x = rect.left - 8
            y = rect.top + rect.height / 2
            break
          case 'right':
            x = rect.right + 8
            y = rect.top + rect.height / 2
            break
        }

        setPosition({ x, y })
        setIsVisible(true)
      }
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const getTransformOrigin = () => {
    switch (placement) {
      case 'top':
        return 'bottom center'
      case 'bottom':
        return 'top center'
      case 'left':
        return 'right center'
      case 'right':
        return 'left center'
    }
  }

  const getTransform = () => {
    switch (placement) {
      case 'top':
        return 'translate(-50%, -100%)'
      case 'bottom':
        return 'translate(-50%, 0)'
      case 'left':
        return 'translate(-100%, -50%)'
      case 'right':
        return 'translate(0, -50%)'
    }
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-block"
      >
        {children}
      </div>

      {isVisible && (
        <div
          className="fixed z-[9999] px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg pointer-events-none whitespace-nowrap"
          style={{
            left: position.x,
            top: position.y,
            transform: getTransform(),
            transformOrigin: getTransformOrigin(),
            maxWidth: '300px',
          }}
        >
          {content}
          <div
            className="absolute w-2 h-2 bg-gray-900 transform rotate-45"
            style={{
              ...(placement === 'top' && {
                bottom: '-4px',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
              }),
              ...(placement === 'bottom' && {
                top: '-4px',
                left: '50%',
                transform: 'translateX(-50%) rotate(45deg)',
              }),
              ...(placement === 'left' && {
                right: '-4px',
                top: '50%',
                transform: 'translateY(-50%) rotate(45deg)',
              }),
              ...(placement === 'right' && {
                left: '-4px',
                top: '50%',
                transform: 'translateY(-50%) rotate(45deg)',
              }),
            }}
          />
        </div>
      )}
    </>
  )
}
