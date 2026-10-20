import { MODELS, PROVIDERS, reasoningDefault, reasoningOptions } from '../data/pricing'
import type { ModelId, ModelSpec, Provider, Setup, Shared } from './types'

/** Wanted value if allowed, else the fallback if allowed, else the first option (mirrors the prototype's fillSelect). */
function pick<T>(values: readonly T[], wanted?: T | null, fallback?: T | null): T {
  if (wanted != null && values.includes(wanted)) return wanted
  if (fallback != null && values.includes(fallback)) return fallback
  return values[0]
}

/**
 * Makes setup.cache, effort and reasoning valid for `model`. The current values are kept when the model
 * allows them. Otherwise effort falls back to the model's default (or 'medium'), cache to the first
 * option, reasoning to the model's default. setup.model itself is left to the caller.
 */
export function normalizeSetup(setup: Setup, model: ModelSpec): Setup {
  return {
    ...setup,
    cache: pick(model.cache.map((c) => c.id), setup.cache),
    effort: pick(model.efforts, setup.effort, model.defaultEffort ?? 'medium'),
    reasoning: pick(reasoningOptions(model), setup.reasoning, reasoningDefault(model)),
  }
}

/** Model switch: keeps cache, effort and reasoning where the new model allows them. */
export function switchModel(setup: Setup, model: ModelId): Setup {
  return normalizeSetup({ ...setup, model }, MODELS[model])
}

/** Provider switch: that provider's default model, with cache, effort and reasoning reset to its defaults. */
export function switchProvider(setup: Setup, provider: Provider): Setup {
  const model = PROVIDERS[provider].defaultModel
  const spec = MODELS[model]
  return {
    ...setup,
    provider,
    model,
    cache: pick(spec.cache.map((c) => c.id)),
    effort: pick(spec.efforts, null, spec.defaultEffort ?? 'medium'),
    reasoning: pick(reasoningOptions(spec), null, reasoningDefault(spec)),
  }
}

/** Parses a number input's text: clamped to [min, max], or `fallback` when empty or not a number. */
export function clampValue(text: string, min: number, max: number, fallback: number): number {
  const v = Number(text)
  return Number.isFinite(v) && text !== '' ? Math.min(max, Math.max(min, v)) : fallback
}

/** The base prompt can never exceed the session length. */
export const effectiveShared = (shared: Shared): Shared => ({ ...shared, base: Math.min(shared.base, shared.session) })
