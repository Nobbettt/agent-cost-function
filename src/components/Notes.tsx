export function Notes() {
  return (
    <section className="card">
      <ul className="notes">
        <li>Every request sends the whole context. The part sent before is a cache read; the new part (tool results, user text, the last reply) is a cache write. Each cache hit restarts the cache lifetime on Claude and OpenAI.</li>
        <li>Output per request is the visible output plus the reasoning tokens for the chosen effort; Claude, OpenAI and Google bill reasoning as output. When earlier reasoning stays in context, those tokens also join the context and are read back as input on later requests, so the session reaches its size in fewer requests.</li>
        <li>Requests run back to back. Cache breaking interruptions are spread evenly over the session; each one outlasts the cache, so the next request writes the whole context again (marked on the charts).</li>
        <li>Long prompts: Haiku 5.5 bills a request at 5× once its prompt passes 100K tokens. OpenAI models bill 2× input and cache and 1.5× output for the whole request once the prompt passes 272K tokens. xAI models bill 2× input, cached input and output for the whole request once the prompt reaches 200K tokens. Gemini 3.1 Pro Preview bills 2× input and cached input and 1.5× output for the whole request once the prompt passes 200K tokens.</li>
        <li>Reasoning tokens per effort level are not published by any provider. The numbers in Advanced settings are guesses, the same for every model, and the levels do not mean the same amount of work across models.</li>
        <li>xAI caches automatically with no documented lifetime and no write fee; entries can be evicted at any time. Here every cache break means the next request pays the full input price for the whole context. Reasoning tokens are assumed to cost the output rate.</li>
        <li>Google caches implicitly by default (no lifetime, no write fee, no guarantee). Optionally an explicit cache keeps the prompt and tools cached for a set time, guaranteed, for an hourly storage fee; after a cache break only the conversation is written again.</li>
        <li>Costs are calculated in USD and converted for display at the daily ECB reference rate (via Frankfurter). USD is the default and needs no network request; the rate is only fetched when another currency is selected. Where a provider has announced a price change, the site uses the price in force on the day you view it.</li>
        <li>Not modelled: compaction, subagents, fast/priority/flex/batch pricing, regional pricing, reasoning kept only within the current turn (treated as dropped), and effort changing how many requests a task takes.</li>
      </ul>
    </section>
  )
}
