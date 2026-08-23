import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MarkdownPreview } from '@/components/markdown/markdown-preview';

describe('MarkdownPreview', () => {
  it('renders [text]{color=#hex} as an inline coloured span', () => {
    render(<MarkdownPreview markdown={'Hello [world]{color=#ff4444}'} />);

    const span = screen.getByText('world');
    expect(span.tagName).toBe('SPAN');
    expect(span.getAttribute('style')).toContain('rgb(255, 68, 68)');
  });

  it('renders [text]{badge=Tag} as a badge span', () => {
    render(<MarkdownPreview markdown={'[MVP]{badge=Gold}'} />);

    const span = screen.getByText('MVP');
    expect(span.className).toContain('badge');
    expect(span.getAttribute('data-badge')).toBe('Gold');
  });

  it('strips script tags and dangerous attributes (sanitization)', () => {
    render(
      <MarkdownPreview
        markdown={'<script>window.pwned=1</script><img src="x" onerror="alert(1)"><b>safe</b>'}
      />,
    );

    expect(document.querySelector('script')).toBeNull();
    expect(screen.getByText('safe')).toBeInTheDocument();
    const img = document.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('onerror')).toBeNull();
    expect(img!.getAttribute('src')).toBe('x');
  });

  it('keeps allowlisted iframe embeds and strips unlisted sources', () => {
    render(
      <MarkdownPreview
        markdown={
          '<iframe src="https://open.spotify.com/embed/track/abc"></iframe>' +
          '<iframe src="https://evil.example.com/pwn"></iframe>'
        }
      />,
    );

    const frames = Array.from(document.querySelectorAll('iframe'));
    expect(frames).toHaveLength(2);
    const allowlisted = frames.find((f) => f.getAttribute('src'));
    expect(allowlisted?.getAttribute('src')).toBe('https://open.spotify.com/embed/track/abc');
    const stripped = frames.filter((f) => !f.getAttribute('src'));
    expect(stripped).toHaveLength(1);
  });

  it('renders callout directives as styled blockquotes', () => {
    render(<MarkdownPreview markdown={'> [!WARNING]\n> Watch out!'} />);

    expect(screen.getByText('Watch out!')).toBeInTheDocument();
    const callout = document.querySelector('.callout-warning');
    expect(callout).not.toBeNull();
    expect(callout!.textContent).toContain('Aviso');
  });

  it('opens links in a new tab with rel=noopener', () => {
    render(<MarkdownPreview markdown={'[Docs](https://example.com)'} />);

    const link = screen.getByRole('link', { name: 'Docs' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });
});
