/**
 * What the builder runs on, in our own words.
 *
 * The API returns provider-qualified model ids like `z-ai/glm-5.3-flash` or
 * `deepseek/deepseek-v4.1-flash`. Those name a vendor, which is not ours to
 * advertise — the guide says as much for errors ("never show vendor names from
 * errors; the backend scrubs them") and the same reasoning applies to a usage
 * footer. It also means a model swap on the backend silently changes our UI.
 *
 * The speed tier survives because it is ours to describe and it explains why
 * one turn was quicker than another. The vendor does not.
 */
const VIVID = "Vivid 2.1";

export function modelLabel(model: string | null | undefined): string {
  if (!model) return VIVID;
  return /flash|mini|lite|haiku|turbo/i.test(model) ? `${VIVID} Flash` : VIVID;
}
