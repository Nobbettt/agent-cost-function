import { useEffect, useMemo, useRef, useState } from 'react'
import { AdvancedSettings } from './components/AdvancedSettings'
import { BreakdownTable } from './components/BreakdownTable'
import type { ChartSeries } from './components/chartConfig'
import { CostChart } from './components/CostChart'
import { CurrencySelect } from './components/CurrencySelect'
import { Footer } from './components/Footer'
import { NavBar } from './components/NavBar'
import { RateInfo } from './components/RateInfo'
import { RateStatus } from './components/RateStatus'
import { ScrollRegion } from './components/ScrollRegion'
import { SettingsSidebar } from './components/SettingsSidebar'
import { ShareButton } from './components/ShareButton'
import { SetupPanel } from './components/SetupPanel'
import { StepsTable } from './components/StepsTable'
import { SummaryCards } from './components/SummaryCards'
import { CurrencyProvider } from './currency/CurrencyProvider'
import { useCurrency } from './currency/context'
import { MAX_SETUPS, SERIES } from './data/series'
import { useSettingsPanel } from './hooks/useSettingsPanel'
import { buildShareUrl, useShareUrlSync } from './hooks/useShareUrl'
import { compare } from './model/compare'
import { effectiveShared } from './model/normalize'
import { decodeState, encodeState } from './model/shareState'
import { addSetup, canAddSetup, canRemoveSetup, focusAfterRemove, removeSetup } from './model/setups'
import { simulate } from './model/simulate'
import type { Setup, SetupId, Shared } from './model/types'

function Calculator() {
  // The page link may carry a whole comparison; decoded once, strictly (see shareState), and it replaces the defaults.
  const [fromLink] = useState(() => decodeState(window.location.search))
  const [setups, setSetups] = useState<readonly Setup[]>(fromLink.setups)
  // Accordion: at most one panel item (Advanced settings or a setup) is expanded; null means all collapsed.
  const [expandedId, setExpandedId] = useState<'advanced' | SetupId | null>(fromLink.hadParams ? fromLink.setups[0].id : 'A')
  const [shared, setShared] = useState<Shared>(fromLink.shared)
  const panel = useSettingsPanel()
  const { currency, displayCurrency, format, rate } = useCurrency()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const pendingFocus = useRef<SetupId | null>(null)

  const effective = useMemo(() => effectiveShared(shared), [shared])
  const runs = useMemo(() => setups.map((s) => simulate(s, effective)), [setups, effective])
  const comparison = useMemo(() => compare(setups.map((s, i) => ({ id: s.id, run: runs[i] }))), [setups, runs])
  // The address bar always holds the current shareable link.
  const query = useMemo(() => encodeState({ setups, shared, currency }), [setups, shared, currency])
  useShareUrlSync(query)
  const shareUrl = buildShareUrl(query)
  const series = useMemo<ChartSeries[]>(
    () => setups.map((s, i) => ({ id: s.id, ...SERIES[s.id], run: runs[i] })),
    [setups, runs],
  )

  // After adding or removing, move focus to the setup header the change names.
  useEffect(() => {
    const id = pendingFocus.current
    if (!id) return
    pendingFocus.current = null
    document.getElementById(`setup-${id}-toggle`)?.focus()
  }, [setups])

  const updateSetup = (next: Setup) => setSetups((list) => list.map((s) => (s.id === next.id ? next : s)))
  const toggleItem = (id: 'advanced' | SetupId) => setExpandedId((cur) => (cur === id ? null : id))
  const add = () => {
    const next = addSetup(setups)
    const added = next.find((s) => !setups.some((o) => o.id === s.id))
    if (!added) return
    pendingFocus.current = added.id
    setSetups(next)
    setExpandedId(added.id)
  }
  const remove = (id: SetupId) => {
    if (!canRemoveSetup(setups)) return
    pendingFocus.current = focusAfterRemove(setups, id)
    setSetups(removeSetup(setups, id))
    setExpandedId((cur) => (cur === id ? null : cur))
  }

  return (
    <div className="app">
      <NavBar
        page="calculator" settings={{ open: panel.open, onToggle: panel.toggle }} settingsButtonRef={toggleRef}
        controls={<><ShareButton url={shareUrl} /><CurrencySelect /></>}
      />
      <div className="layout" data-open={panel.open}>
        <ScrollRegion className="content">
          <main className="calc">
            <div className="screen">
              <header className="page-header">
                <h1>Agent cost function</h1>
                <p className="lede">What one agent session costs on Claude or OpenAI as its context grows, for up to four setups side by side. Change a setting and the charts update.</p>
                              {fromLink.versionMismatch && (
                  <p className="share-notice" role="status">This link was made with a newer version of the calculator; showing the defaults.</p>
                )}
              </header>

              <section className="results" aria-label="Results">
                <div className="summary-block">
                  <SummaryCards comparison={comparison} setups={setups} format={format} />
                  <RateStatus />
                </div>

                <section className="card">
                  <h2>Cumulative cost vs context size</h2>
                  <CostChart series={series} metric="cum" xMax={effective.session} endLabels label="Cumulative cost per setup as context grows" format={format} currency={displayCurrency} rate={rate} />
                </section>

                <section className="card">
                  <h2>Cost per request vs context size</h2>
                  <CostChart series={series} metric="req" xMax={effective.session} label="Cost of each request per setup as context grows" format={format} currency={displayCurrency} rate={rate} />
                </section>
              </section>
            </div>

            <section className="card">
              <h2>Breakdown at end of session</h2>
              <div className="table-wrap"><BreakdownTable runs={runs} setups={setups} format={format} /></div>
            </section>

            <details className="card">
              <summary>Cumulative cost at regular steps (table view)</summary>
              <div className="table-wrap"><StepsTable runs={runs} ids={setups.map((s) => s.id)} session={effective.session} format={format} /></div>
            </details>

            <RateInfo />
          </main>
          <Footer page="calculator" />
        </ScrollRegion>

        <SettingsSidebar open={panel.open} mode={panel.mode} onClose={panel.close} returnFocusRef={toggleRef}>
          <AdvancedSettings shared={shared} onChange={setShared} expanded={expandedId === 'advanced'} onToggle={() => toggleItem('advanced')} />
          <div className="setups">
            {setups.map((s) => (
              <SetupPanel
                key={s.id} setup={s} expanded={expandedId === s.id}
                onToggle={() => toggleItem(s.id)} onChange={updateSetup}
                onRemove={canRemoveSetup(setups) ? () => remove(s.id) : undefined}
              />
            ))}
          </div>
          <div className="add-setup">
            <button type="button" className="add-setup-btn" onClick={add} disabled={!canAddSetup(setups)}>+ Add setup</button>
            {!canAddSetup(setups) && <span className="add-setup-note">Up to {MAX_SETUPS} setups</span>}
          </div>
        </SettingsSidebar>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <CurrencyProvider>
      <Calculator />
    </CurrencyProvider>
  )
}
