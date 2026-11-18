/**
 * Text to 360 (beta): describe a place and DiT360 paints it as an
 * equirectangular panorama, which then becomes your own background.
 *
 * DiT360 (Insta360 Research, MIT licence, built on FLUX.1-dev) runs as a free
 * public Hugging Face Space on shared GPUs, so a generation takes about a
 * minute and can fail when the Space is busy or its free quota is used up.
 * It uses Gradio's queue protocol (POST /gradio_api/queue/join, then the
 * /gradio_api/queue/data event stream), which, unlike /call, carries the
 * Space's error text (for example "ZeroGPU quota exceeded") so we can say why.
 */

const DIT360 = 'https://insta360-research-dit360.hf.space';
/** The Space, or (dev builds only) a local stand-in set by the tests. */
function space(): string {
  const test = import.meta.env.DEV ? (globalThis as { __hoamDit360Base?: string }).__hoamDit360Base : undefined;
  return test ?? DIT360;
}
const STEPS = 28; // the Space's minimum: fastest, still a clean panorama
const TIMEOUT_MS = 4 * 60 * 1000;

function imageUrl(item: unknown): string | undefined {
  if (typeof item === 'string') return item.startsWith('http') ? item : `${space()}/gradio_api/file=${item}`;
  if (item && typeof item === 'object') {
    const o = item as { url?: string; path?: string };
    if (o.url) return o.url;
    if (o.path) return `${space()}/gradio_api/file=${o.path}`;
  }
  return undefined;
}

/** The Space's own id for its "infer" function (looked up, not hard-coded). */
async function inferIndex(signal: AbortSignal): Promise<number> {
  try {
    const res = await fetch(`${space()}/config`, { signal });
    const config = (await res.json()) as { dependencies?: { api_name?: string; id?: number }[] };
    const dep = config.dependencies?.find((d) => d.api_name === 'infer');
    if (dep && typeof dep.id === 'number') return dep.id;
  } catch {
    if (signal.aborted) throw new Error('aborted');
  }
  return 2;
}

/** A short, human reason from the Space's error (quota, busy, ...). */
function reason(output: { error?: string | null; title?: string } | undefined): string {
  const text = output?.error ?? '';
  const wait = /Try again in (\d+):(\d+)/.exec(text);
  if (/quota/i.test(text)) {
    const when = wait ? ` Try again in about ${Number(wait[1]) > 0 ? `${Number(wait[1])} h` : `${Number(wait[2])} min`}.` : '';
    return `the free AI painter's daily quota for your connection is used up.${when}`;
  }
  return text ? text.slice(0, 160) : 'the free AI painter is busy right now. Try again in a minute.';
}

export async function generatePano(prompt: string, onStatus: (s: string) => void): Promise<File> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  const t0 = performance.now();
  let stage = 'Waiting for the AI painter';
  const tick = setInterval(() => {
    const s = Math.round((performance.now() - t0) / 1000);
    onStatus(`${stage}... ${s} s (usually about a minute)`);
  }, 1000);
  try {
    const fnIndex = await inferIndex(abort.signal);
    const session = Math.random().toString(36).slice(2, 12);
    const seed = Math.floor(Math.random() * 1e6);
    const join = await fetch(`${space()}/gradio_api/queue/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [prompt, seed, STEPS], fn_index: fnIndex, session_hash: session }),
      signal: abort.signal,
    });
    if (!join.ok) throw new Error(`the AI painter answered ${join.status}`);

    const stream = await fetch(`${space()}/gradio_api/queue/data?session_hash=${session}`, { signal: abort.signal });
    if (!stream.ok || !stream.body) throw new Error(`the AI painter answered ${stream.status}`);
    const reader = stream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let url: string | undefined;
    let failure: string | undefined;
    read: for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const msg = JSON.parse(line.slice(5)) as {
          msg?: string;
          success?: boolean;
          output?: { data?: unknown[]; error?: string | null; title?: string };
        };
        if (msg.msg === 'process_starts') stage = 'Painting your place in 360';
        if (msg.msg === 'process_completed') {
          if (msg.success) url = imageUrl(msg.output?.data?.[0]);
          else failure = reason(msg.output);
          break read;
        }
        if (msg.msg === 'close_stream') break read;
      }
    }
    void reader.cancel().catch(() => undefined);
    if (failure) throw new Error(failure);
    if (!url) throw new Error('no image came back');
    stage = 'Downloading your panorama';
    const img = await fetch(url, { signal: abort.signal });
    if (!img.ok) throw new Error(`the image download answered ${img.status}`);
    const blob = await img.blob();
    return new File([blob], 'text-to-360.webp', { type: blob.type || 'image/webp' });
  } catch (error) {
    if (abort.signal.aborted) throw new Error('it took longer than 4 minutes. Try again later.');
    throw error;
  } finally {
    clearTimeout(timer);
    clearInterval(tick);
  }
}
