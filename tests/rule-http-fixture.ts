import { trackerRuleSchema } from '../src/shared/api/trackingContracts.ts';
import type { TrackerRule } from '../src/shared/api/trackingContracts.ts';
export class RuleHttpFixture {
  rules: TrackerRule[] = [];
  revision = 1;
  writes = 0;
  conflict: TrackerRule | undefined;
  unavailable = false;
  fetch = (_url: string | URL | Request, input?: RequestInit): Promise<Response> => {
    if (this.unavailable) return Promise.reject(new Error('Offline'));
    if (input?.method !== 'PUT')
      return Promise.resolve(
        new Response(JSON.stringify(this.rules), {
          headers: { ETag: this.tag() },
        }),
      );
    return this.write(input);
  };
  tag(): string {
    return '"' + String(this.revision).padStart(64, '0') + '"';
  }
  write(input: RequestInit): Promise<Response> {
    this.writes++;
    if (this.conflict) {
      this.rules.push(this.conflict);
      this.conflict = undefined;
      this.revision++;
      return Promise.resolve(new Response('{}', { status: 409 }));
    }
    const tag = new Headers(input.headers).get('if-match');
    if (tag !== this.tag()) return Promise.resolve(new Response('{}', { status: 409 }));
    if (typeof input.body !== 'string') throw new Error('Expected typed HTTP body');
    this.rules = trackerRuleSchema.array().parse(JSON.parse(input.body));
    this.revision++;
    return Promise.resolve(new Response('{"ok":true}'));
  }
}
export async function withRuleHttp(
  operation: (fixture: RuleHttpFixture) => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch,
    fixture = new RuleHttpFixture();
  globalThis.fetch = fixture.fetch;
  try {
    await operation(fixture);
  } finally {
    globalThis.fetch = original;
  }
}
