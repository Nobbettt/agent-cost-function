import { useId, useMemo, useState } from 'react'
import { CurrencyProvider } from '../currency/CurrencyProvider'
import { useCurrency } from '../currency/context'
import { NAV_WIDE_QUERY } from '../data/breakpoints'
import { DEFAULT_SETUPS, DEFAULT_SHARED } from '../data/defaults'
import { FIELD_HELP } from '../data/fieldHelp'
import { DEFAULT_LONG_PAUSES, DEFAULT_SHORT_PAUSES, DEFAULT_SHOWN, PAUSE_LIMITS, SHARED_LIMITS, SHOWN_LIMITS, TOKENS_PER_K } from '../data/limits'
import { MODELS, modelsOf, reasoningDefault, reasoningOptions } from '../data/pricing'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useToday } from '../hooks/useToday'
import { breakEven, cheaperAt, chartRange, costCurve, costsAt } from '../model/breakEven'
import { cacheBreaks } from '../model/setups'
import { effectiveShared, switchModel } from '../model/normalize'
import type { CacheId, Effort, ReasoningMode, Setup, Shared } from '../model/types'
import { AdvancedSettings } from './AdvancedSettings'
import { BreakEvenChart } from './BreakEvenChart'
import { CurrencyField } from './CurrencyField'
import { CurrencySelect } from './CurrencySelect'
import { Field } from './Field'
import { Footer } from './Footer'
import { NavBar } from './NavBar'
import { NumberField } from './NumberField'
import { RateInfo } from './RateInfo'
import { RateStatus } from './RateStatus'
import { ScrollRegion } from './ScrollRegion'
import { Stat } from './SummaryCards'

/** Interruptions here are pauses of 5 to 60 minutes: they break the 5 minute cache, never the 1 hour cache. */
const START: Setup = { ...DEFAULT_SETUPS.A, id: 'A', cache: '5m' as CacheId, interruptions: 0 }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function Content() {
  const { format, displayCurrency, rate } = useCurrency()
  const wide = useMediaQuery(NAV_WIDE_QUERY, true)
  const uid = useId()
  const today = useToday()
  const [setup, setSetup] = useState<Setup>(START)
  const [shared, setShared] = useState<Shared>(DEFAULT_SHARED)
  const [shown, setShown] = useState(DEFAULT_SHOWN)
  const [short, setShort] = useState(DEFAULT_SHORT_PAUSES)
  const [long, setLong] = useState(DEFAULT_LONG_PAUSES)
  const [advanced, setAdvanced] = useState(false)

  const model = MODELS[setup.model]
  const effective = useMemo(() => effectiveShared(shared), [shared])
  // The chart covers the chosen range, extended when the chosen number of pauses is beyond it.
  const range = chartRange(shown, short, SHOWN_LIMITS.max)
  const curve = useMemo(() => costCurve(setup, effective, range, long, today), [setup, effective, range, long, today])
  const result = useMemo(() => breakEven(curve), [curve])
  const mine = costsAt(curve, short)
  const verdict = cheaperAt(mine)
  const exactText = result.exact === null ? null : result.exact.toFixed(1)
  const markerText = exactText === null || result.exact === 0 ? '' : `break-even ≈ ${exactText}`
  const withLong = `with ${plural(long, 'longer pause')}`

  const card =
    result.exact === null
      ? { value: `None up to ${range}`, sub: '5 min cache stays cheaper' }
      : result.exact === 0
        ? { value: 'From the start', sub: `${withLong}; 1 hour cache cheaper from 0` }
        : { value: `${exactText} pauses of 5–60 min`, sub: `${withLong}; 1 hour cache cheaper from ${result.firstK}` }
  const mineCard =
    verdict.cheaper === null
      ? { value: 'Same cost', sub: 'both caches cost the same' }
      : { value: verdict.cheaper === '1h' ? '1 hour cache' : '5 min cache', sub: `saves ${format(verdict.saving)} (${verdict.percent}%)` }

  return (
    <div className="app">
      <NavBar page="cache-break-even" controls={wide && <CurrencySelect />} />
      <ScrollRegion className="page-scroll">
        <main>
          <h1>When does Claude&apos;s 1-hour cache pay off?</h1>
          <p className="lede">
            The 1-hour cache costs 2× the input price to write instead of 1.25×, but it survives pauses of up to an hour.
            Every pause longer than 5 minutes makes the 5-minute cache write the whole context again; pauses over an hour do the same to the 1-hour cache.
          </p>

          <section className="card be-settings" aria-label="Settings">
            <div className="fields">
              {!wide && <CurrencyField />}
              <Field id={`${uid}-model`} label="Model" help={FIELD_HELP.model}>
                <select id={`${uid}-model`} name="model" value={setup.model} onChange={(e) => setSetup(switchModel(setup, e.target.value))}>
                  {modelsOf('claude').map(([k, m]) => <option key={k} value={k}>{m.name}</option>)}
                </select>
              </Field>
              <Field id={`${uid}-effort`} label="Reasoning effort" help={FIELD_HELP.effort}>
                <select id={`${uid}-effort`} name="effort" value={setup.effort} onChange={(e) => setSetup({ ...setup, effort: e.target.value as Effort })}>
                  {model.efforts.map((e) => <option key={e} value={e}>{e === model.defaultEffort ? `${e} (default)` : e}</option>)}
                </select>
              </Field>
              <Field id={`${uid}-reasoning`} label="Earlier reasoning in context" help={FIELD_HELP.reasoning}>
                <select id={`${uid}-reasoning`} name="reasoning" value={setup.reasoning} onChange={(e) => setSetup({ ...setup, reasoning: e.target.value as ReasoningMode })}>
                  {reasoningOptions(model).map((r) => <option key={r} value={r}>{r === reasoningDefault(model) ? `${r} (default)` : r}</option>)}
                </select>
              </Field>
              <NumberField
                label="Session length (K tokens)" help={FIELD_HELP.session} name="session" {...SHARED_LIMITS.session} scale={TOKENS_PER_K}
                fallback={DEFAULT_SHARED.session} value={shared.session} onChange={(session) => setShared({ ...shared, session })}
              />
              <NumberField
                label="Pauses 5–60 min" help={FIELD_HELP.pausesShort} name="short" {...PAUSE_LIMITS} note="Break the 5 min cache only."
                fallback={DEFAULT_SHORT_PAUSES} value={short} onChange={(v) => setShort(Math.round(v))}
              />
              <NumberField
                label="Pauses over 60 min" help={FIELD_HELP.pausesLong} name="long" {...PAUSE_LIMITS} note="Break both caches."
                fallback={DEFAULT_LONG_PAUSES} value={long} onChange={(v) => setLong(Math.round(v))}
              />
              <NumberField
                label="Chart range (5–60 min pauses)" help={FIELD_HELP.interruptionsShown} name="shown" {...SHOWN_LIMITS}
                note={range > shown ? `Showing up to ${range} so your pauses fit.` : undefined}
                fallback={DEFAULT_SHOWN} value={shown} onChange={(v) => setShown(Math.round(v))}
              />
            </div>
            <AdvancedSettings shared={shared} onChange={setShared} expanded={advanced} onToggle={() => setAdvanced((a) => !a)} omit={['session']} />
          </section>

          <section className="summary wrap-labels" aria-label="Summary" data-count={4}>
            <dl>
              <Stat label="Break-even" value={card.value} sub={card.sub} />
              <Stat label="5 min cache" value={format(mine.cost5)} sub={cacheBreaks({ interruptions: short + long })} />
              <Stat label="1 hour cache" value={format(mine.cost1h)} sub={cacheBreaks({ interruptions: long })} />
              <Stat label="At your pauses" value={mineCard.value} sub={mineCard.sub} />
            </dl>
          </section>
          <RateStatus />

          <section className="card">
            <h2>Session cost vs pauses of 5–60 min</h2>
            <BreakEvenChart
              curve={curve} exact={result.exact} yourK={short} markerText={markerText} format={format} currency={displayCurrency} rate={rate}
              label="Session cost on the 5 minute and the 1 hour cache as pauses of 5 to 60 minutes increase"
            />
          </section>

          <details className="card">
            <summary>Cost at each number of pauses (table view)</summary>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Pauses of 5–60 min</th><th>5 min cache</th><th>1 hour cache</th><th>Cheaper</th></tr></thead>
                <tbody>
                  {curve.map((p) => (
                    <tr key={p.k}>
                      <td>{p.k}</td><td>{format(p.cost5)}</td><td>{format(p.cost1h)}</td>
                      <td>{p.cost5 > p.cost1h ? '1 hour' : p.cost5 < p.cost1h ? '5 min' : 'equal'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <section className="card">
            <h2>How this is calculated</h2>
            <ul className="notes">
              <li>It is the calculator&apos;s model, run once per number of pauses: the same prices, context growth and reasoning assumptions. See <a href="/how-it-works/">how it is calculated</a> and the <a href="/sources/">sources</a>.</li>
              <li>A pause of 5–60 minutes (longer than 5 minutes, up to an hour) breaks only the 5-minute cache: the next request writes the whole context again at 1.25×. A pause over an hour breaks both caches, and the 1-hour cache then pays 2× input for the re-write. (The calculator instead counts every interruption as breaking every cache.)</li>
              <li>Each kind of pause is spread evenly over the session.</li>
            </ul>
          </section>
          <RateInfo />
        </main>
        <Footer page="cache-break-even" />
      </ScrollRegion>
    </div>
  )
}

export function CacheBreakEvenPage() {
  return (
    <CurrencyProvider>
      <Content />
    </CurrencyProvider>
  )
}
