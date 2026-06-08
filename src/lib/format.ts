// Shared formatting helpers for tool output.

export function money(n: number): string {
  if (n >= 1_000_000)
    return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 2)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

export function moneyRange(min: number, max: number): string {
  return min === max ? money(min) : `${money(min)}–${money(max)}`;
}

/** Standard MCP text-content result. */
export function text(body: string): {
  content: { type: "text"; text: string }[];
} {
  return { content: [{ type: "text", text: body }] };
}

/** MCP error result (kept for genuinely-failed tools, not stale data). */
export function errorText(body: string): {
  content: { type: "text"; text: string }[];
  isError: true;
} {
  return { content: [{ type: "text", text: body }], isError: true };
}
