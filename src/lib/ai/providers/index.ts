/**
 * Provider registry. The API-key providers are built in; the local CLI bridge
 * ('cli') is registered at startup by ACORN-6 via registerProvider().
 */
import { AIError, type AIProvider, type ProviderId } from '../types';
import { anthropicProvider } from './anthropic';
import { openaiProvider } from './openai';
import { openrouterProvider } from './openrouter';

const registry = new Map<ProviderId, AIProvider>(
  [openaiProvider, anthropicProvider, openrouterProvider].map((p) => [p.id, p])
);

/** Adds or replaces the provider for `provider.id`. */
export function registerProvider(provider: AIProvider): void {
  registry.set(provider.id, provider);
}

/** Throws AIError('not_configured') when no provider is registered for `id`. */
export function getProvider(id: ProviderId): AIProvider {
  const provider = registry.get(id);
  if (!provider) throw new AIError('not_configured', `Provider "${id}" is not available`, id);
  return provider;
}
