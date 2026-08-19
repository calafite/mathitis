import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearDevMailbox,
  latestDevLink,
  listDevEmails,
  recordDevEmail,
} from '../../src/lib/dev-mailbox.js';

const VERIFY_PATTERN = /https?:\/\/\S*\/verify-email\?token=[a-f0-9]+/;

describe('dev-mailbox', () => {
  beforeEach(() => {
    clearDevMailbox();
  });

  it('records and lists emails newest first', () => {
    recordDevEmail({ to: 'a@cs.uni.edu', subject: 'First', text: 'hello a' });
    recordDevEmail({ to: 'b@cs.uni.edu', subject: 'Second', text: 'hello b' });

    const all = listDevEmails();
    expect(all).toHaveLength(2);
    expect(all[0]!.subject).toBe('Second');
    expect(all[1]!.subject).toBe('First');
    expect(all[0]!.to).toBe('b@cs.uni.edu');
    expect(typeof all[0]!.sentAt).toBe('string');
  });

  it('filters by recipient and honors the limit', () => {
    recordDevEmail({ to: 'a@cs.uni.edu', subject: '1', text: 'x' });
    recordDevEmail({ to: 'b@cs.uni.edu', subject: '2', text: 'x' });
    recordDevEmail({ to: 'a@cs.uni.edu', subject: '3', text: 'x' });

    const filtered = listDevEmails({ to: 'a@cs.uni.edu' });
    expect(filtered.map((e) => e.subject)).toEqual(['3', '1']);

    const limited = listDevEmails({ limit: 1 });
    expect(limited.map((e) => e.subject)).toEqual(['3']);
  });

  it('returns the latest matching link for a recipient', () => {
    recordDevEmail({
      to: 'user@cs.uni.edu',
      subject: 'Verify',
      text: 'Welcome!\nhttp://localhost:5173/verify-email?token=abc123',
    });
    recordDevEmail({
      to: 'user@cs.uni.edu',
      subject: 'Verify',
      text: 'Welcome!\nhttp://localhost:5173/verify-email?token=def456',
    });

    expect(latestDevLink({ to: 'user@cs.uni.edu', pattern: VERIFY_PATTERN })).toBe(
      'http://localhost:5173/verify-email?token=def456',
    );
    expect(latestDevLink({ to: 'nobody@cs.uni.edu', pattern: VERIFY_PATTERN })).toBeNull();
  });

  it('caps the mailbox size', () => {
    for (let i = 0; i < 250; i += 1) {
      recordDevEmail({ to: `user${i}@cs.uni.edu`, subject: `s${i}`, text: 'x' });
    }
    expect(listDevEmails()).toHaveLength(200);
  });
});
