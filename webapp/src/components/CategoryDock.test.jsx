import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import CategoryDock from './CategoryDock.jsx'

describe('CategoryDock', () => {
  it('renders one blob per category', () => {
    render(<CategoryDock categories={['Markets', 'Sports']} active={null} onDragCategory={() => {}} onRelease={() => {}} />)
    expect(screen.getByText('Markets')).toBeInTheDocument()
    expect(screen.getByText('Sports')).toBeInTheDocument()
  })

  it('marks the active category', () => {
    render(<CategoryDock categories={['Markets', 'Sports']} active="Sports" onDragCategory={() => {}} onRelease={() => {}} />)
    expect(screen.getByText('Sports')).toHaveClass('active')
    expect(screen.getByText('Markets')).not.toHaveClass('active')
  })
})
