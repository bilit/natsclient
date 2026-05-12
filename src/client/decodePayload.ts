// Tries to fully decode a payload by detecting and stripping base64 encoding,
// zlib/gzip/deflate compression, and JSON formatting — in whatever combination
// is present.  Returns null when the payload is already plain text or empty.

export interface DecodeResult {
  display: string;
  steps: string[];
}

async function decompress(
  data: Uint8Array,
): Promise<{ data: Uint8Array; format: string } | null> {
  if (typeof DecompressionStream === "undefined") return null;

  // Magic-byte heuristic to order format attempts
  const formats: CompressionFormat[] =
    data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b
      ? ["gzip", "deflate", "deflate-raw"]
      : data.length >= 2 && data[0] === 0x78
      ? ["deflate", "deflate-raw", "gzip"]
      : ["deflate-raw", "deflate", "gzip"];

  for (const fmt of formats) {
    try {
      const ds = new DecompressionStream(fmt);
      const writer = ds.writable.getWriter();
      const reader = ds.readable.getReader();
      writer.write(data);
      writer.close();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
      let off = 0;
      for (const c of chunks) {
        out.set(c, off);
        off += c.length;
      }
      return { data: out, format: fmt };
    } catch {
      // try next format
    }
  }
  return null;
}

function toUtf8(data: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(data);
  } catch {
    return null;
  }
}

function prettyJson(s: string): string | null {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return null;
  }
}

function toHexDump(data: Uint8Array): string {
  const lines: string[] = [];
  for (let i = 0; i < data.length; i += 16) {
    const row = data.slice(i, i + 16);
    const hex = Array.from(row)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    const ascii = Array.from(row)
      .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."))
      .join("");
    lines.push(`${i.toString(16).padStart(6, "0")}  ${hex.padEnd(47)}  ${ascii}`);
  }
  return lines.join("\n");
}

// Returns null when the string isn't plausibly base64/base64url
function fromBase64(s: string): Uint8Array | null {
  const t = s.trim();
  if (t.length < 16) return null;
  const b64 = t.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  if (!/^[A-Za-z0-9+/]+=*$/.test(padded)) return null;
  try {
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

// Recursively decode bytes, trying every layer in order:
//   1. decompress (gzip / zlib / raw-deflate) — covers "zlib then base64" when
//      we arrive here after a base64 decode, and "base64 then zlib" when the
//      outer caller decoded base64 first and passed the raw compressed bytes
//   2. UTF-8 text → JSON
//   3. detect inner base64/base64url layer and recurse (handles double-encoding
//      and any combination: base64→zlib→base64→json etc.)
async function decodeBytes(
  bytes: Uint8Array,
  steps: string[],
  depth: number,
): Promise<DecodeResult> {
  if (depth > 4) {
    return { display: toHexDump(bytes), steps: [...steps, "hex"] };
  }

  // Attempt decompression first — magic bytes guide format priority so the
  // right format is almost always tried first.
  const dc = await decompress(bytes);
  if (dc) {
    return decodeBytes(dc.data, [...steps, dc.format], depth + 1);
  }

  // Attempt UTF-8 decode
  const text = toUtf8(bytes);
  if (text !== null) {
    const json = prettyJson(text);
    if (json) return { display: json, steps: [...steps, "json"] };

    // Detect a further base64/base64url layer and recurse.
    // Guard is depth < 4 (not 2) so long chains like
    // base64 → gzip → base64 → gzip → json are fully unwound.
    if (depth < 4) {
      const inner = fromBase64(text);
      if (inner) {
        const inner2 = await decodeBytes(inner, [...steps, "base64"], depth + 1);
        // Only accept if we decoded past a bare hex dump (i.e. something useful)
        if (inner2.steps[inner2.steps.length - 1] !== "hex") return inner2;
      }
    }

    return { display: text, steps };
  }

  // Nothing worked — hex dump as last resort
  return { display: toHexDump(bytes), steps: [...steps, "hex"] };
}

export async function decodePayload(
  payload: string,
  encoding: "text" | "base64",
): Promise<DecodeResult | null> {
  if (!payload) return null;

  if (encoding === "base64") {
    const bytes = fromBase64(payload);
    if (!bytes) return null;
    return decodeBytes(bytes, ["base64"], 0);
  }

  // Text path: fast-check JSON first
  const json = prettyJson(payload);
  if (json) return { display: json, steps: ["json"] };

  // Check if the text itself is base64-encoded
  const bytes = fromBase64(payload);
  if (bytes) {
    const result = await decodeBytes(bytes, ["base64"], 0);
    // Skip if decoding produced nothing better than hex of seemingly random bytes —
    // only surface it when we achieved a real transform (compression or text decode)
    const last = result.steps[result.steps.length - 1];
    if (last !== "hex") return result;
    // For long strings that really look like base64, show the hex anyway
    if (payload.trim().length >= 64) return result;
  }

  return null; // already plain text, shown as-is by the caller
}

// Human-readable label for a compression format string
export function formatLabel(step: string): string {
  if (step === "deflate") return "zlib";
  if (step === "deflate-raw") return "deflate";
  return step;
}
