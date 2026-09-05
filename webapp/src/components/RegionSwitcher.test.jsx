import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RegionSwitcher from './RegionSwitcher.jsx'

describe('RegionSwitcher', () => {
  it('renders all three regions with the active one marked', () => {
    render(<RegionSwitcher region="markets" onSwitch={() => {}} />)
    expect(screen.getByRole('button', { name: /news/i })).not.toHaveClass('on')
    expect(screen.getByRole('button', { name: /markets/i })).toHaveClass('on')
    expect(screen.getByRole('button', { name: /glossary/i })).not.toHaveClass('on')
  })

  it('calls onSwitch with the clicked region', () => {
    const onSwitch = vi.fn()
    render(<RegionSwitcher region="news" onSwitch={onSwitch} />)
    fireEvent.click(screen.getByRole('button', { name: /glossary/i }))
    expect(onSwitch).toHaveBeenCalledWith('glossary')
  })
})
