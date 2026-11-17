import z from '@deepseek-ai/schemastery';

/**
 * One configured provider instance. `id` is this instance's own identity — it
 * names its credential record — and `provider` is the vendor it talks to. Two
 * instances may use the same vendor with different keys, which is why identity
 * cannot be the vendor id.
 */
export const slotSchema = z.object({
  /** Instance id, unique across both chains; also the credential record id. */
  id: z.string().required(),
  /** Vendor id: `tavily`, `firecrawl`, `tinyfish`, or `exa`. */
  provider: z.string().required(),
});

/**
 * Two independent ordered chains of provider instances. An instance lives in
 * exactly one chain and carries its own key, so removing or re-keying one never
 * touches a sibling that happens to use the same vendor.
 *
 * Only instance ids and vendor ids live here: API keys resolve through the
 * credentials center and never enter the settings document.
 */
export const configFields = {
  webSearchEnabled: z.boolean().default(false).volatile(),
  webSearchChain: z.array(z.union([z.string(), slotSchema])).default([]).volatile(),
  webFetchChain: z.array(z.union([z.string(), slotSchema])).default([]).volatile(),
};
