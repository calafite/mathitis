import { describe, expect, it } from 'vitest';
import type { Root, Text } from 'mdast';
import { remarkMathitisExtensions } from '@/lib/markdown-extensions';

function transform(input: string): Text[] {
  const tree: Root = { type: 'root', children: [{ type: 'text', value: input }] };
  remarkMathitisExtensions()(tree);
  return tree.children as Text[];
}

describe('remarkMathitisExtensions', () => {
  it('renders [text]{color=#hex} as a coloured span', () => {
    const nodes = transform('Hello [world]{color=#ff4444}!');

    expect(nodes).toHaveLength(3);
    expect(nodes[0]).toMatchObject({ type: 'text', value: 'Hello ' });
    expect(nodes[1]).toMatchObject({
      type: 'text',
      value: 'world',
      data: { hName: 'span', hProperties: { 'data-color': '#ff4444' } },
    });
    expect(nodes[2]).toMatchObject({ type: 'text', value: '!' });
  });

  it('renders [text]{badge=Tag} as a badge span', () => {
    const nodes = transform('[MVP]{badge=Top 10}');

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      type: 'text',
      value: 'MVP',
      data: { hName: 'span', hProperties: { 'data-badge': 'Top 10' } },
    });
  });

  it('combines colour and badge syntax within a single text node', () => {
    const nodes = transform('[A]{color=#0ea5e9} and [B]{badge=Gold}');

    expect(nodes).toHaveLength(3);
    expect(nodes[0]!.data?.hProperties).toEqual({ 'data-color': '#0ea5e9' });
    expect(nodes[1]).toMatchObject({ type: 'text', value: ' and ' });
    expect(nodes[2]!.data?.hProperties).toEqual({ 'data-badge': 'Gold' });
  });

  it('splits multiple occurrences into ordered nodes', () => {
    const nodes = transform('[x]{color=#111111}[y]{color=#222222}');

    expect(nodes).toHaveLength(2);
    expect(nodes[0]!.data?.hProperties).toEqual({ 'data-color': '#111111' });
    expect(nodes[1]!.data?.hProperties).toEqual({ 'data-color': '#222222' });
  });

  it('ignores non-hex or malformed colours', () => {
    const inputs = [
      '[x]{color=red}',
      '[x]{color=#f44}',
      '[x]{color=#gggggg}',
      '[x]{color=#12345}',
      '[x]{color=#1234567}',
    ];
    for (const input of inputs) {
      const nodes = transform(input);
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toMatchObject({ type: 'text', value: input });
      expect(nodes[0]!.data).toBeUndefined();
    }
  });

  it('leaves plain text untouched when no syntax is present', () => {
    const nodes = transform('Just some plain text with {braces} and [brackets]');

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      type: 'text',
      value: 'Just some plain text with {braces} and [brackets]',
    });
  });
});
