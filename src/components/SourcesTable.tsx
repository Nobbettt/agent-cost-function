import { DOCS, MODELS, googlePage, openaiPage, reasoningDefault, reasoningOptions } from '../data/pricing'
import { fmtPrice, fmtTokens } from '../format'
import type { ModelId, ModelSpec } from '../model/types'

const COLS = ['Model', 'Input', 'Cache read', 'Output', 'Prompt cache', 'Long prompt', 'Max input', 'Effort (default)', 'Earlier reasoning', 'Source']

const longRule = (m: ModelSpec) =>
  m.longPrompt ? `${m.longPrompt.inclusive ? '≥' : '>'}${fmtTokens(m.longPrompt.above)}: in ${m.longPrompt.inMult}×, out ${m.longPrompt.outMult}×` : '—'

function ExternalLink({ href, children }: { href: string; children: string }) {
  return <a href={href} target="_blank" rel="noopener">{children}</a>
}

function Row({ id, m }: { id: ModelId; m: ModelSpec }) {
  const source = m.provider === 'openai' || m.provider === 'google'
    ? <ExternalLink href={(m.provider === 'google' ? googlePage : openaiPage)(id)}>model page</ExternalLink>
    : <ExternalLink href={(m.provider === 'xai' ? DOCS.xaiPricing : DOCS.claudePricing).url}>pricing</ExternalLink>
  const cells = [
    `${m.name} (${id})`, fmtPrice(m.in), `${fmtPrice(m.in * m.read)} (${m.read}×)`, fmtPrice(m.out),
    m.cache.map((c) => `${c.id} ${c.write}×`).join(', '), longRule(m), fmtTokens(m.maxInput),
    m.efforts.map((e) => (e === m.defaultEffort ? `${e}*` : e)).join(' '),
    reasoningOptions(m).map((r) => (r === reasoningDefault(m) ? `${r}*` : r)).join(' '),
  ]
  return <tr>{cells.map((c, i) => <td key={i}>{c}</td>)}<td>{source}</td></tr>
}

export function SourcesTable() {
  return (
    <section className="card">
      <div className="table-wrap">
        <table className="sources">
          <thead><tr>{COLS.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>{Object.entries(MODELS).map(([id, m]) => <Row key={id} id={id} m={m} />)}</tbody>
        </table>
      </div>
      <ul className="notes" style={{ marginTop: 12 }}>
        <li>Prices are USD per million tokens, standard tier. Cache column "write" is the multiplier on input for writing to the cache. * marks a documented default; where none is marked the docs do not state one.</li>
        <li>Model prices are in USD, as the providers publish them. The display currency only converts the calculated costs, using the Frankfurter rates listed below.</li>
        <li>xAI lists one context size per model; it is used as the max input, because the docs do not separate input and output limits. xAI reasoning tokens are assumed to cost the output rate (the docs only say they are billed as part of total consumption).</li>
        <li>Google prices are the current ones; scheduled increases: Gemini 4 Argon rises to $4 input, $0.20 cached input and $20 output from 2026-12-01; Gemini 3.8 Flash and 3.6 Flash rise to $1.50, $0.15 and $7.50 from 2027-01-01.</li>
        <li>Google caching is implicit only: on by default, automatic, with no stated lifetime, no write or storage fee and no guarantee of savings. Explicit caches (a TTL and an hourly storage fee) are not modelled. Thinking tokens are billed with output, and Gemini keeps earlier thoughts in context. Gemini 4 Argon shares one 1,048,576-token limit between input and output; it is used as the max input for all Gemini models.</li>
        <li>Gemini's `minimal` thinking level isn't offered here, so Gemini 3.5 Flash-Lite, whose default is minimal, has no default marked and falls back to low.</li>
        <li>Not included: Gemini 2.5 models (access limited to earlier users), Gemini 3 Flash Preview and Gemini 3.1 Flash-Lite (not checked).</li>
        <li>Not included: grok-4.3, grok-4.20 reasoning and multi-agent, grok-build-0.1 (reasoning behaviour not documented).</li>
        {Object.values(DOCS).map((d) => (
          <li key={d.url}><ExternalLink href={d.url}>{d.url}</ExternalLink>{`: ${d.proves}`}</li>
        ))}
      </ul>
    </section>
  )
}
