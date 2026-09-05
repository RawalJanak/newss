import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import OnboardingHint from './OnboardingHint.jsx'

describe('OnboardingHint', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the hint on first visit', () => {
    render(<OnboardingHint />)
    expect(screen.getByText(/drag a category/i)).toBeInTheDocument()
  })

  it('dismisses and persists the flag when the user closes it', () => {
    render(<OnboardingHint />)
    fireEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(screen.queryByText(/drag a category/i)).not.toBeInTheDocument()
    expect(localStorage.getItem('mynews-onboarded')).toBe('1')
  })

  it('does not show on a later mount once onboarded', () => {
    localStorage.setItem('mynews-onboarded', '1')
    render(<OnboardingHint />)
    expect(screen.queryByText(/drag a category/i)).not.toBeInTheDocument()
  })
})
