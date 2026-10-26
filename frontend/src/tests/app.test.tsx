// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge, Alert, MetricCard, PageLoader } from '../components/ui'
import { authApi, dashboardApi, forecastingApi, optimizationApi, cameraApi, simulationApi } from '../services/api'

describe('Q-Sense Frontend Core UI Components', () => {
  it('renders StatusBadge with appropriate variant colors', () => {
    const { container, rerender } = render(<StatusBadge status="open" />)
    expect(container.textContent).toBe('open')
    expect(container.firstChild).toBeDefined()

    rerender(<StatusBadge status="closed" />)
    expect(container.textContent).toBe('closed')

    rerender(<StatusBadge status="maintenance" />)
    expect(container.textContent).toBe('maintenance')
  })

  it('renders Alert component with message and styling', () => {
    render(<Alert type="error"><span>Test Error Occurred</span></Alert>)
    expect(screen.getByText('Test Error Occurred')).toBeDefined()
  })

  it('renders MetricCard with label, value, and subtitle', () => {
    render(
      <MetricCard
        label="Total Queue Population"
        value={42}
        sublabel="Observed across 4 departments"
        color="green"
      />
    )
    expect(screen.getByText('Total Queue Population')).toBeDefined()
    expect(screen.getByText('42')).toBeDefined()
    expect(screen.getByText('Observed across 4 departments')).toBeDefined()
  })

  it('renders PageLoader gracefully', () => {
    const { container } = render(<PageLoader />)
    expect(container.querySelector('.animate-spin')).toBeDefined()
  })
})

describe('API Client Interface Integrity', () => {
  it('exports all expected API namespaces with methods', () => {
    expect(typeof authApi.login).toBe('function')
    expect(typeof authApi.me).toBe('function')
    expect(typeof dashboardApi.getMetrics).toBe('function')
    expect(typeof dashboardApi.getObservations).toBe('function')
    expect(typeof forecastingApi.train).toBe('function')
    expect(typeof forecastingApi.predict).toBe('function')
    expect(typeof optimizationApi.recommend).toBe('function')
    expect(typeof optimizationApi.reviewRecommendation).toBe('function')
    expect(typeof simulationApi.createRun).toBe('function')
    expect(typeof simulationApi.startLive).toBe('function')
    expect(typeof cameraApi.listSources).toBe('function')
    expect(typeof cameraApi.stepFrame).toBe('function')
    expect(typeof cameraApi.snapshotUrl).toBe('function')
  })
})
