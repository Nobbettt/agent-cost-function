import { useMemo, useRef, useState } from 'react'
import { BreakdownTable } from './components/BreakdownTable'
import { CostChart } from './components/CostChart'
import { Footer } from './components/Footer'
import { Headline } from './components/Headline'
import { NavBar } from './components/NavBar'
import { SettingsSidebar } from './components/SettingsSidebar'
import { SetupPanel } from './components/SetupPanel'
import { SharedAssumptions } from './components/SharedAssumptions'
import { StepsTable } from './components/StepsTable'
import { DEFAULT_SETUPS, DEFAULT_SHARED } from './data/defaults'
import { useSettingsPanel } from './hooks/useSettingsPanel'
import { compare } from './model/compare'
import { effectiveShared } from './model/normalize'
import { simulate } from './model/simulate'
import type { Run, Setup, Shared } from './model/types'

export default function App() {
  const [setupA, setSetupA] = useState<Setup>(DEFAULT_SETUPS.A)
  const [setupB, setSetupB] = useState<Setup>(DEFAULT_SETUPS.B)
  const [shared, setShared] = useState<Shared>(DEFAULT_SHARED)
  const panel = useSettingsPanel()
  const toggleRef = useRef<HTMLButtonElement>(null)

  const effective = useMemo(() => effectiveShared(shared), [shared])
  const runs = useMemo<[Run, Run]>(
    () => [simulate(setupA, effective), simulate(setupB, effective)],
    [setupA, setupB, effective],
  )
  const comparison = useMemo(() => compare(runs[0], runs[1]), [runs])

  return (
    <>
      <NavBar page="calculator" settings={{ open: panel.open, onToggle: panel.toggle }} settingsButtonRef={toggleRef} />
      <div className="layout" data-open={panel.open}>
        <div className="content">
          <main className="calc">
            <div className="screen">
              <header className="page-header">
                <h1>Agent cost function</h1>
                <p className="lede">What one agent session costs on Claude or OpenAI as its context grows, for two setups side by side. Change a setting and the charts update.</p>
              </header>

              <section className="results" aria-label="Results">
                <Headline comparison={comparison} />

                <section className="card">
                  <h2>Cumulative cost (USD) vs context size</h2>
                  <CostChart runs={runs} metric="cum" xMax={effective.session} endLabels label="Cumulative cost per setup as context grows" />
                </section>

                <section className="card">
                  <h2>Cost per request (USD) vs context size</h2>
                  <CostChart runs={runs} metric="req" xMax={effective.session} label="Cost of each request per setup as context grows" />
                </section>
              </section>
            </div>

            <section className="card">
              <h2>Breakdown at end of session</h2>
              <div className="table-wrap"><BreakdownTable runs={runs} setups={[setupA, setupB]} /></div>
            </section>

            <details className="card">
              <summary>Cumulative cost at regular steps (table view)</summary>
              <div className="table-wrap"><StepsTable runs={runs} session={effective.session} /></div>
            </details>
          </main>
          <Footer page="calculator" />
        </div>

        <SettingsSidebar open={panel.open} mode={panel.mode} onClose={panel.close} returnFocusRef={toggleRef}>
          <div className="setups">
            <SetupPanel id="A" setup={setupA} onChange={setSetupA} />
            <SetupPanel id="B" setup={setupB} onChange={setSetupB} />
          </div>
          <SharedAssumptions shared={shared} onChange={setShared} />
        </SettingsSidebar>
      </div>
    </>
  )
}
