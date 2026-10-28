import { Fragment, useId, useMemo, useState } from 'react'
import { CACHE_INFO } from '../data/cacheNotes'
import { CurrencyProvider } from '../currency/CurrencyProvider'
import { useCurrency } from '../currency/context'
import { NAV_WIDE_QUERY } from '../data/breakpoints'
import { DEFAULT_SETUPS } from '../data/defaults'
import { FIELD_HELP } from '../data/fieldHelp'
import { KEEP_ALIVE_DEFAULTS, KEEP_ALIVE_LIMITS } from '../data/limits'
import { MODELS, PROVIDERS } from '../data/pricing'
import { fmtDuration, fmtTokens } from '../format'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useToday } from '../hooks/useToday'
import { defaultInterval, hasKnownTtl, keepAlive, keepAliveCurve } from '../model/keepAlive'
import { switchModel, switchProvider } from '../model/normalize'
import type { CacheId, ModelId, ModelSpec, Provider, Setup } from '../model/types'
import { Chevron } from './Chevron'
import { CurrencyField } from './CurrencyField'
import { CurrencySelect } from './CurrencySelect'
import { Field } from './Field'
import { InfoTip } from './InfoTip'
import { Footer } from './Footer'
import { KeepAliveChart } from './KeepAliveChart'
import { NavBar } from './NavBar'
import { NumberField } from './NumberField'
import { RateInfo } from './RateInfo'
import { RateStatus } from './RateStatus'
import { ReadOnlyField } from './ReadOnlyField'
import { ScrollRegion } from './ScrollRegion'
import { Stat } from './SummaryCards'

/** Opus 5.5 on the 5 minute cache, Claude's default TTL on an API key. */
const START: Setup = DEFAULT_SETUPS.A
/** This page's model on switching provider, where it differs from the provider's default elsewhere on the site. */
const PAGE_DEFAULT_MODEL: Partial<Record<Provider, ModelId>> = { openai: 'gpt-6.1-sol' }

const switchPageProvider = (setup: Setup, provider: Provider): Setup => {
  const next = switchProvider(setup, provider)
  const model = PAGE_DEFAULT_MODEL[provider]
  return model ? switchModel(next, model) : next
}
/** The plugin's cap on prolongCount. */
const PLUGIN_MAX_PROLONG = 24
/** The small context the story compares against, to show the count barely moves with size. */
const SMALL_CONTEXT = 20000

/** Models whose caches all have a known lifetime: pings can only be timed against those. xAI and Gemini have none. */
const PING_MODELS: [ModelId, ModelSpec][] = Object.entries(MODELS).filter(([, m]) => m.cache.every(hasKnownTtl))
const PING_PROVIDERS = (Object.keys(PROVIDERS) as Provider[]).filter((p) => PING_MODELS.some(([, m]) => m.provider === p))

/** The interval's "-" and "+": 30 s below 10 min, a whole minute from there up (so "-" from 10 lands on 9.5). */
const intervalStep = (value: number, dir: 1 | -1) => ((dir === 1 ? value < 10 : value <= 10) ? 0.5 : 1)

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const times = (n: number) => `${+n.toFixed(3)}×`

function Content() {
  const { format, displayCurrency, rate } = useCurrency()
  const wide = useMediaQuery(NAV_WIDE_QUERY, true)
  const uid = useId()
  const today = useToday()
  const [setup, setSetup] = useState<Setup>(START)
  const [context, setContext] = useState<number>(KEEP_ALIVE_DEFAULTS.context)
  const [pingIn, setPingIn] = useState<number>(KEEP_ALIVE_DEFAULTS.pingIn)
  const [pingOut, setPingOut] = useState<number>(KEEP_ALIVE_DEFAULTS.pingOut)
  const [chance, setChance] = useState<number>(KEEP_ALIVE_DEFAULTS.returnChance)
  // null: the cache's default interval. A typed interval is kept until the model or cache changes.
  const [chosenInterval, setChosenInterval] = useState<number | null>(null)
  const [advanced, setAdvanced] = useState(false)

  const model = MODELS[setup.model]
  const cache = model.cache.find((c) => c.id === setup.cache) ?? model.cache[0]
  const interval = chosenInterval ?? defaultInterval(cache)
  const changeSetup = (next: Setup) => {
    setSetup(next)
    setChosenInterval(null)
  }

  // The slider snaps to 10K steps, so its max is the model's max input rounded down to a step (922K shows as 920K).
  const contextMax = Math.floor(model.maxInput / KEEP_ALIVE_LIMITS.context.step) * KEEP_ALIVE_LIMITS.context.step
  const shownContext = Math.min(context, contextMax)
  const input = { model: setup.model, cache: cache.id, context: shownContext, interval, pingIn, pingOut, returnChance: chance / 100 }
  const r = keepAlive(input, today)
  const curve = keepAliveCurve(r, Math.max(r.covers * 2, r.lifetime * 3))
  const small = keepAlive({ ...input, context: SMALL_CONTEXT }, today)
  const large = keepAlive({ ...input, context: model.maxInput }, today)

  const everyModel = useMemo(
    () => PING_MODELS.flatMap(([id, m]) => m.cache.map((c) => ({
      id: `${id}-${c.id}`, model: m.name, cache: c,
      r: keepAlive({ model: id, cache: c.id, context, interval: defaultInterval(c), pingIn, pingOut, returnChance: chance / 100 }, today),
    }))),
    [context, pingIn, pingOut, chance, today],
  )

  const prolong = Math.min(r.pings, PLUGIN_MAX_PROLONG)

  return (
    <div className="app">
      <NavBar page="cache-keep-alive" controls={wide && <CurrencySelect />} />
      <ScrollRegion className="page-scroll">
        <main>
          <h1>How long is a warm cache worth keeping?</h1>
          <p className="lede">
            A keep-alive ping (like cache-saver-handoff&apos;s) re-reads the cached conversation so its lifetime restarts.
            Pings are cheap; letting the cache die costs one full re-write when you return. How many pings is that re-write worth?
          </p>

          <section className="card be-settings" aria-label="Settings">
            <div className="provider-field">
              <div className="field-head">
                <span className="field-label">Provider</span>
                <InfoTip label="Provider" text={FIELD_HELP.keepAliveProvider} />
              </div>
              <div className="toggle" role="radiogroup" aria-label="Provider">
                {PING_PROVIDERS.map((k) => (
                  <Fragment key={k}>
                    <input
                      type="radio" name={`${uid}-provider`} id={`${uid}-provider-${k}`} value={k}
                      checked={setup.provider === k} onChange={() => changeSetup(switchPageProvider(setup, k))}
                    />
                    <label htmlFor={`${uid}-provider-${k}`}>{PROVIDERS[k].name}</label>
                  </Fragment>
                ))}
              </div>
            </div>
            <div className="fields">
              {!wide && <CurrencyField />}
              <Field id={`${uid}-model`} label="Model" help={FIELD_HELP.model}>
                <select id={`${uid}-model`} name="model" value={setup.model} onChange={(e) => changeSetup(switchModel(setup, e.target.value))}>
                  {PING_MODELS.filter(([, m]) => m.provider === setup.provider).map(([k, m]) => <option key={k} value={k}>{m.name}</option>)}
                </select>
              </Field>
              {model.cache.length > 1 ? (
                <Field id={`${uid}-cache`} label={CACHE_INFO[cache.id].label} help={FIELD_HELP.cache} note={CACHE_INFO[cache.id].note}>
                  <select id={`${uid}-cache`} name="cache" value={cache.id} onChange={(e) => changeSetup({ ...setup, cache: e.target.value as CacheId })}>
                    {model.cache.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </Field>
              ) : (
                <ReadOnlyField id={`${uid}-cache`} label={CACHE_INFO[cache.id].label} help={FIELD_HELP.cache} value={CACHE_INFO[cache.id].fixedValue} note={CACHE_INFO[cache.id].note} />
              )}
              <Field id={`${uid}-context`} label="Context so far" help={FIELD_HELP.context}>
                <div className="slider">
                  {/* Up to the model's max input; a larger context chosen on another model shows (and counts) as that max. */}
                  <input
                    type="range" id={`${uid}-context`} name="context" min={KEEP_ALIVE_LIMITS.context.min} max={contextMax} step={KEEP_ALIVE_LIMITS.context.step}
                    value={shownContext} aria-valuetext={`${fmtTokens(shownContext)} tokens`} onChange={(e) => setContext(Number(e.target.value))}
                  />
                  <output htmlFor={`${uid}-context`}>{fmtTokens(shownContext)}</output>
                </div>
              </Field>
              <Field id={`${uid}-chance`} label="Chance you come back" help={FIELD_HELP.returnChance}>
                <div className="slider">
                  <input
                    type="range" id={`${uid}-chance`} name="returnChance" {...KEEP_ALIVE_LIMITS.returnChance}
                    value={chance} aria-valuetext={`${chance}%`} onChange={(e) => setChance(Number(e.target.value))}
                  />
                  <output htmlFor={`${uid}-chance`}>{chance}%</output>
                </div>
              </Field>
            </div>
            {/* The calculator's Advanced settings look; its component is bound to the calculator's shared settings. */}
            <div className="setup advanced ka-advanced" role="group" aria-labelledby={`${uid}-advanced-title`}>
              <div className="setup-head">
                <button
                  type="button" className="setup-toggle" aria-expanded={advanced} aria-controls={`${uid}-advanced-body`}
                  onClick={() => setAdvanced((a) => !a)}
                >
                  <Chevron />
                  <span className="setup-title"><span id={`${uid}-advanced-title`}>Advanced settings</span></span>
                </button>
              </div>
              <div className="setup-body" id={`${uid}-advanced-body`} hidden={!advanced}>
                <div className="fields">
                  <NumberField
                    // Remounts on a model or cache change, so the box shows the reset default (the field keeps its own text).
                    key={`${setup.model}-${cache.id}`}
                    label="Ping every (min)" help={FIELD_HELP.pingInterval} name="interval" min={1} max={cache.minutes} step={0.5} clickStep={intervalStep}
                    note={`At most ${cache.minutes}: the cache lifetime.`}
                    fallback={defaultInterval(cache)} value={interval} onChange={setChosenInterval}
                  />
                  <NumberField
                    label="Ping input tokens" help={FIELD_HELP.pingIn} name="pingIn" {...KEEP_ALIVE_LIMITS.pingIn}
                    fallback={KEEP_ALIVE_DEFAULTS.pingIn} value={pingIn} onChange={(v) => setPingIn(Math.round(v))}
                  />
                  <NumberField
                    label="Ping output tokens" help={FIELD_HELP.pingOut} name="pingOut" {...KEEP_ALIVE_LIMITS.pingOut}
                    fallback={KEEP_ALIVE_DEFAULTS.pingOut} value={pingOut} onChange={(v) => setPingOut(Math.round(v))}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="summary wrap-labels" aria-label="Summary" data-count={5}>
            <dl>
              <Stat label="Keep pinging for" value={fmtDuration(r.covers)} sub={`${plural(r.pings, 'ping')}, one every ${r.interval} min`} />
              <Stat label="Break-even" value={`${r.breakEven.toFixed(1)} pings`} sub="cost as much as one cold re-write" />
              <Stat label="One ping" value={format(r.ping)} sub={`reads ${fmtTokens(shownContext)} at ${times(model.read)} input`} />
              <Stat label="Prolonging cost" value={format(r.pings * r.ping)} sub={`${plural(r.pings, 'ping')} × ${format(r.ping)}`} />
              <Stat label="Cold re-write" value={format(r.rewrite)} sub={chance < 100 ? `${format(r.expected)} at ${chance}% chance` : 'extra on your next message'} />
            </dl>
          </section>
          <RateStatus />

          <section className="card">
            <h2>The story at your settings</h2>
            <ol className="story">
              <li>{fmtTokens(shownContext)} tokens sit in {model.name}&apos;s {fmtDuration(r.lifetime)} cache. Each read restarts its {fmtDuration(r.lifetime)} clock.</li>
              <li>
                A ping reads them at {times(model.read)} input, plus {pingIn} + {pingOut} tokens of its own: <strong>{format(r.ping)}</strong>, every {r.interval} min.
              </li>
              <li>
                Letting it die makes your next message write them at {times(cache.write)} instead: <strong>{format(r.rewrite)}</strong> extra, once.
                {chance < 100 && ` At ${chance}% chance of coming back, ${format(r.expected)}.`}
              </li>
              {r.pings === 0 ? (
                <li>That doesn&apos;t cover one ping. <strong>Let it die.</strong></li>
              ) : (
                <li>
                  That buys {r.breakEven.toFixed(1)} pings: warm for <strong>{fmtDuration(r.covers)}</strong> after your last message. Away longer? Let it die.
                </li>
              )}
              <li>
                Context size sets the dollars, not the count: {small.breakEven.toFixed(1)} pings at {fmtTokens(SMALL_CONTEXT)}, {large.breakEven.toFixed(1)} at {fmtTokens(model.maxInput)}.
              </li>
              {setup.provider === 'claude' && (
                <li>
                  cache-saver-handoff: {r.pings === 0
                    ? <>keep <code>prolongCount</code> at 1, the handoff alone.</>
                    : <>set <code>prolongCount</code> to {prolong}{r.pings > PLUGIN_MAX_PROLONG ? ', its maximum (still short of break-even).' : '.'}</>}
                </li>
              )}
            </ol>
          </section>

          <section className="card">
            <h2>Ping or let it die?</h2>
            <p className="chart-note">
              The stairs are what the pings have cost by the time you come back. The flat line is the re-write you pay once the cache has died
              {chance < 100 ? `, at your ${chance}% chance of coming back` : ''}. Where they cross, stop pinging.
            </p>
            <KeepAliveChart
              curve={curve} stopAt={r.covers} format={format} currency={displayCurrency} rate={rate}
              label="What keep-alive pings have cost by the time you come back, against the cost of re-writing the cache once it has died"
            />
          </section>

          <section className="card">
            <h2>Every model at this context</h2>
            <p className="chart-note">Your context, ping tokens and chance of coming back; each cache pinged a minute before it would expire (30 s before on the 5 min cache).</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Model</th><th>Cache</th><th>Ping every</th><th>One ping</th><th>Cold re-write</th><th>Break-even</th><th>Keep pinging for</th></tr></thead>
                <tbody>
                  {everyModel.map((row) => (
                    <tr key={row.id}>
                      <td>{row.model}</td>
                      <td>{CACHE_INFO[row.cache.id].fixedValue}</td>
                      <td>{row.r.interval} min</td>
                      <td>{format(row.r.ping)}</td>
                      <td>{format(row.r.rewrite)}</td>
                      <td>{row.r.breakEven.toFixed(1)} pings</td>
                      <td>{fmtDuration(row.r.covers)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="card">
            <h2>How this is calculated</h2>
            <ul className="notes">
              <li>One ping costs context × input price × the cache-read multiplier, plus its own input tokens at the normal input price (a fork never caches its own tail) and its output tokens at the output price. Above a model&apos;s long-prompt threshold both sides use the higher rate. Prices are those in force today; see the <a href="/sources/">sources</a>.</li>
              <li>Letting the cache die costs context × input price × (write − read) once, on your next message. That message&apos;s own new tokens cost the same either way.</li>
              <li>Break-even pings = that re-write × your chance of coming back ÷ one ping. The pings are paid whether or not you come back.</li>
              <li>Each ping restarts the cache lifetime, so n pings keep it warm for n × the interval + the lifetime after your last message.</li>
              <li>Only caches with a known lifetime that every read restarts are here: Claude&apos;s 5 minute and 1 hour caches and OpenAI&apos;s 30 minute cache. xAI, Gemini and the OpenAI models with in_memory or 24h retention cache best-effort, with no lifetime to time a ping against.</li>
              <li>Not counted: the slower first response on a cold cache, the handoff&apos;s longer output when it is the first extension, and starting a fresh session from the handoff instead of resuming, which skips the re-write altogether.</li>
            </ul>
          </section>
          <RateInfo />
        </main>
        <Footer page="cache-keep-alive" />
      </ScrollRegion>
    </div>
  )
}

export function KeepAlivePage() {
  return (
    <CurrencyProvider>
      <Content />
    </CurrencyProvider>
  )
}
