/**
 * Server-sent events parser (WHATWG HTML "event stream interpretation"):
 * CRLF/LF/CR line endings split across chunks, multi-line `data`, comments
 * (": OPENROUTER PROCESSING") and unknown fields.
 */

export interface SSEMessage {
  /** `event:` field, or "message" when absent. */
  event: string;
  /** `data:` lines joined with "\n". */
  data: string;
}

export class SSEParser {
  private buffer = '';
  private dataLines: string[] = [];
  private eventName = '';

  /** Feeds decoded text; returns the messages completed by it. */
  push(chunk: string): SSEMessage[] {
    this.buffer += chunk;
    const out: SSEMessage[] = [];
    let start = 0;
    for (;;) {
      const lf = this.buffer.indexOf('\n', start);
      const cr = this.buffer.indexOf('\r', start);
      let end: number;
      let next: number;
      if (cr !== -1 && (lf === -1 || cr < lf)) {
        // A trailing CR may be the first half of a CRLF split across chunks.
        if (cr === this.buffer.length - 1) break;
        end = cr;
        next = this.buffer[cr + 1] === '\n' ? cr + 2 : cr + 1;
      } else if (lf !== -1) {
        end = lf;
        next = lf + 1;
      } else {
        break;
      }
      this.processLine(this.buffer.slice(start, end), out);
      start = next;
    }
    this.buffer = this.buffer.slice(start);
    return out;
  }

  /**
   * Ends the stream. A trailing CR held back by push() still ends its line,
   * but an unterminated line and an event without its blank line are
   * discarded (WHATWG: incomplete events are not dispatched at end of file),
   * so a truncated stream is reported as ended early, not as a short event.
   */
  end(): SSEMessage[] {
    const out: SSEMessage[] = [];
    if (this.buffer.endsWith('\r')) this.processLine(this.buffer.slice(0, -1), out);
    this.buffer = '';
    this.dataLines = [];
    this.eventName = '';
    return out;
  }

  private processLine(line: string, out: SSEMessage[]): void {
    if (line === '') {
      this.dispatch(out);
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') this.dataLines.push(value);
    else if (field === 'event') this.eventName = value;
  }

  private dispatch(out: SSEMessage[]): void {
    if (this.dataLines.length > 0) {
      out.push({ event: this.eventName || 'message', data: this.dataLines.join('\n') });
    }
    this.dataLines = [];
    this.eventName = '';
  }
}

/**
 * Iterates SSE messages from a fetch body. Stopping early (break/throw)
 * cancels the underlying stream so the connection is released.
 */
export async function* readSSE(body: ReadableStream<Uint8Array>): AsyncGenerator<SSEMessage> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = new SSEParser();
  let finished = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      yield* parser.push(decoder.decode(value, { stream: true }));
    }
    finished = true;
    yield* parser.push(decoder.decode());
    yield* parser.end();
  } finally {
    if (!finished) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
