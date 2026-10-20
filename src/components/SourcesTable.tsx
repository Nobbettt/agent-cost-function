import { DOCS, MODELS, openaiPage, reasoningDefault, reasoningOptions } from '../data/pricing'
import { fmtPrice, fmtTokens } from '../format'
import type { ModelId, ModelSpec } from '../model/types'

const COLS = ['Model', 'Input', 'Cache read', 'Output', 'Prompt cache', 'Long prompt', 'Max input', 'Effort (default)', 'Earlier reasoning', 'Source']

const longRule = (m: ModelSpec) =>
  m.longPrompt ? `>${fmtTokens(m.longPrompt.above)}: in ${m.longPrompt.inMult}×, out ${m.longPrompt.outMult}×` : '—'

function ExternalLink({ href, children }: { href: string; children: string }) {
  return <a href={href} target="_blank" rel="noopener">{children}</a>
}

function Row({ id, m }: { id: ModelId; m: ModelSpec }) {
  const source = m.provider === 'openai'
    ? <ExternalLink href={openaiPage(id)}>model page</ExternalLink>
    : <ExternalLink href={DOCS.claudePricing.url}>pricing</ExternalLink>
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
        {Object.values(DOCS).map((d) => (
          <li key={d.url}><ExternalLink href={d.url}>{d.url}</ExternalLink>{`: ${d.proves}`}</li>
        ))}
      </ul>
    </section>
  )
}
