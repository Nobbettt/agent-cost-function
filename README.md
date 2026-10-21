# Agent cost function

Models what one long-running LLM agent session costs as its context grows to 1M tokens. Two setups (Claude or OpenAI, each with model, prompt cache, reasoning effort, and cache breaking interruptions) are compared side by side on cumulative cost and cost per request.

Live: https://agent-cost-function.norbertlaszlo.com

## Local development

```
npm ci
npm run dev
```

Checks:

```
npm run lint && npm run typecheck && npm test && npm run build
```

`npm run test:coverage` enforces 80% coverage over `src/model/**`, `src/format.ts` and `src/data/**`.

## Prices

The calculation is explained on the `/how-it-works/` page, and every model's prices and settings are listed on the `/sources/` page.

Prices, cache rules and model limits live in `src/data/pricing.ts` (verified 2026-10-20) and come from:

- https://platform.claude.com/docs/en/about-claude/pricing
- https://platform.claude.com/docs/en/about-claude/models/overview
- https://platform.claude.com/docs/en/build-with-claude/effort
- https://platform.claude.com/docs/en/build-with-claude/thinking
- https://developers.openai.com/api/docs/pricing
- https://developers.openai.com/api/docs/guides/prompt-caching
- https://developers.openai.com/api/docs/guides/reasoning

## Display currency

All maths is in USD, which is the default and makes no network request. Picking another currency fetches the daily ECB reference rates once (cached for 24h in `localStorage`) from [Frankfurter](https://frankfurter.dev); the URL is `FX_URL` in `src/data/fx.ts`.

## Deploy

Deploys go out via GitHub Actions on merge to main.
