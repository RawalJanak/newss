import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import MobileList from './MobileList.jsx'

const articles = [
  { url: 'a1', title: 'Story One', category: 'Sports', source: 'ET', published: new Date().toISOString() },
  { url: 'a2', title: 'Story Two', category: 'AI', source: 'Mint', published: new Date().toISOString() },
]

describe('MobileList', () => {
  it('renders a card per article', () => {
    render(<MobileList articles={articles} briefs={[]} categories={['Sports', 'AI']} activeCategory={null} onSelectCategory={() => {}} onOpenArticle={() => {}} />)
    expect(screen.getByText('Story One')).toBeInTheDocument()
    expect(screen.getByText('Story Two')).toBeInTheDocument()
  })

  it('calls onOpenArticle with the url when a card is clicked', () => {
    const onOpen = vi.fn()
    render(<MobileList articles={articles} briefs={[]} categories={['Sports', 'AI']} activeCategory={null} onSelectCategory={() => {}} onOpenArticle={onOpen} />)
    fireEvent.click(screen.getByText('Story One'))
    expect(onOpen).toHaveBeenCalledWith('a1')
  })

  it('calls onSelectCategory when a chip is tapped', () => {
    const onSelect = vi.fn()
    render(<MobileList articles={articles} briefs={[]} categories={['Sports', 'AI']} activeCategory={null} onSelectCategory={onSelect} onOpenArticle={() => {}} />)
    fireEvent.click(screen.getByText('Sports'))
    expect(onSelect).toHaveBeenCalledWith('Sports')
  })
})
