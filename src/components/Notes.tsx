export function Notes() {
  return (
    <section className="card">
      <ul className="notes">
        <li>Every request sends the whole context. The part sent before is a cache read; the new part (tool results, user text, the last reply) is a cache write. Each cache hit restarts the cache lifetime on both providers.</li>
        <li>Output per request is the visible output plus the reasoning tokens for the chosen effort; both providers bill reasoning as output. When earlier reasoning stays in context, those tokens also join the context and are read back as input on later requests, so the session reaches its size in fewer requests.</li>
        <li>Requests run back to back. Interruptions are spread evenly over the session. If a pause is longer than the cache lifetime, the whole context is written again (filled marker); a shorter pause keeps the cache (hollow marker).</li>
        <li>OpenAI's older cache modes have no fixed lifetime: <code>in_memory</code> lasts about 5–10 minutes idle and <code>24h</code> typically about 30 minutes. This page uses 5 and 30 minutes.</li>
        <li>Long prompts: Claude Haiku 5.5 bills a request at 5× once its prompt passes 100K tokens. OpenAI models bill 2× input and cache and 1.5× output for the whole request once the prompt passes 272K tokens.</li>
        <li>Reasoning tokens per effort level are not published by either provider. The numbers in Shared assumptions are guesses, the same for every model, and the levels do not mean the same amount of work across models.</li>
        <li>Not modelled: compaction, subagents, fast/priority/flex/batch pricing, regional pricing, reasoning kept only within the current turn (treated as dropped), and effort changing how many requests a task takes.</li>
      </ul>
    </section>
  )
}
