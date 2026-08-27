import { visit, type Visitor } from 'unist-util-visit';
import type { Root, Text } from 'mdast';

const COLOR_SPAN_RE = /\[([^\]]+)\]\{color=#([0-9a-fA-F]{6})\}/g;
const BADGE_SPAN_RE = /\[([^\]]+)\]\{badge=([^}]+)\}/g;

function splitText(
  text: string,
  pattern: RegExp,
  tag: string,
  valueFor: (m: RegExpMatchArray) => string | null,
): Text[] {
  pattern.lastIndex = 0;
  const nodes: Text[] = [];
  const matches = [...text.matchAll(pattern)];
  if (matches.length === 0) return nodes;

  let cursor = 0;
  for (const match of matches) {
    if (match.index !== undefined && match.index > cursor) {
      nodes.push({ type: 'text', value: text.slice(cursor, match.index) });
    }
    const attr = valueFor(match);
    nodes.push({
      type: 'text',
      value: match[1] ?? '',
      data: {
        hName: 'span',
        hProperties: attr ? { [tag]: attr } : {},
      },
    });
    cursor = (match.index ?? 0) + match[0].length;
  }
  if (cursor < text.length) {
    nodes.push({ type: 'text', value: text.slice(cursor) });
  }
  return nodes;
}

/**
 * Remark plugin supporting Mathitis-specific inline syntax:
 * - `[text]{color=#ff4444}` renders a coloured `<span data-color="#ff4444">`
 * - `[text]{badge=Tag}` renders a `<span class="badge" data-badge="Tag">`
 * Colours are restricted to strict 6-digit hex so rehype-sanitise never sees
 * arbitrary CSS or javascript: payloads.
 */
export function remarkMathitisExtensions() {
  return (tree: Root) => {
    const visitor: Visitor<Text> = (node, index, parent) => {
      if (!parent || index === undefined) return;

      const colorNodes = splitText(node.value, COLOR_SPAN_RE, 'data-color', (m) => `#${m[2]}`);
      const parts = colorNodes.length > 0 ? colorNodes : [node];

      const final = parts.flatMap((item) => {
        if (!item.value) return [item];
        const badgeNodes = splitText(item.value, BADGE_SPAN_RE, 'data-badge', (m) => m[2] ?? null);
        return badgeNodes.length > 0 ? badgeNodes : [item];
      });

      parent.children.splice(index, 1, ...final);
    };
    visit(tree, 'text', visitor);
  };
}
