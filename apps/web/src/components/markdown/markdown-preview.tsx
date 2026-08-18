import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema, type Options } from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { remarkMathitisExtensions } from '@/lib/markdown-extensions';

const sanitizeSchema: Options = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'span', 'div', 'iframe'],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    span: ['className', 'data*'],
    div: ['className'],
    iframe: [
      [
        'src',
        /^https:\/\/open\.spotify\.com\/embed\//,
        /^https:\/\/w\.soundcloud\.com\/player\//,
        /^https:\/\/www\.youtube\.com\/embed\//,
        /^https:\/\/www\.youtube-nocookie\.com\/embed\//,
        /^https:\/\/player\.vimeo\.com\/video\//,
      ],
      'width',
      'height',
      'title',
      'loading',
      'allow',
      'allowFullScreen',
      'sandbox',
    ],
  },
};

function textOf(node: { children?: unknown } | undefined | null): string {
  if (!node) return '';
  const children = node.children as unknown[];
  if (!Array.isArray(children)) return '';
  return children
    .map((child) => {
      if (typeof child === 'string') return child;
      if (typeof child === 'object' && child !== null && 'value' in child) {
        return String((child as { value: unknown }).value);
      }
      if (typeof child === 'object' && child !== null && 'children' in child) {
        return textOf(child as { children?: unknown });
      }
      return '';
    })
    .join('');
}

function stripMarker(children: ReactNode, marker: string): ReactNode {
  return Children.map(children, (child) => {
    if (typeof child === 'string') {
      return child.replace(marker, '');
    }
    if (isValidElement(child) && child.props?.children) {
      return cloneElement(child as ReactElement<{ children?: ReactNode }>, {
        children: stripMarker(child.props.children, marker),
      });
    }
    return child;
  });
}

const CALLOUT_STYLES: Record<string, { className: string; label: string }> = {
  NOTE: { className: 'callout callout-note', label: 'Note' },
  TIP: { className: 'callout callout-tip', label: 'Tip' },
  WARNING: { className: 'callout callout-warning', label: 'Warning' },
  QUOTE: { className: 'callout callout-quote', label: 'Quote' },
};

function CalloutBlock({ type, children }: { type: string; children: ReactNode }) {
  const meta = CALLOUT_STYLES[type];
  if (!meta) return <blockquote>{children}</blockquote>;
  const marker = `[!${type}]`;
  return (
    <blockquote className={meta.className}>
      <div className="callout-title">{meta.label}</div>
      {stripMarker(children, marker)}
    </blockquote>
  );
}

const MarkdownBlockquote: Components['blockquote'] = ({ node, children }) => {
  const text = textOf(node);
  const match = text.match(/^\s*\[!(NOTE|TIP|WARNING|QUOTE)\]\s*/);
  if (!match) return <blockquote>{children}</blockquote>;
  return <CalloutBlock type={match[1] ?? ''} children={children} />;
};

const components: Components = {
  a: ({ node: _node, href, children, ...props }) => (
    <a href={href ?? undefined} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
  img: ({ node: _node, src, alt, ...props }) => (
    <img src={src} alt={alt ?? ''} loading="lazy" {...props} />
  ),
  span: ({ node, children, ...props }) => {
    const attrs = (node?.properties ?? {}) as Record<string, string>;
    const dataBadge = attrs['data-badge'] ?? attrs.dataBadge;
    const dataColor = attrs['data-color'] ?? attrs.dataColor;
    if (dataBadge) {
      return (
        <span className="badge" data-badge={dataBadge} {...props}>
          {children}
        </span>
      );
    }
    return (
      <span style={dataColor ? { color: dataColor } : undefined} data-color={dataColor} {...props}>
        {children}
      </span>
    );
  },
  iframe: ({ node: _node, ...props }) => (
    <iframe
      {...props}
      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"
      loading="lazy"
    />
  ),
  blockquote: MarkdownBlockquote,
};

export interface MarkdownPreviewProps {
  markdown: string | null | undefined;
  className?: string;
}

export function MarkdownPreview({ markdown, className }: MarkdownPreviewProps) {
  return (
    <div className={`markdown-body ${className ?? ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMathitisExtensions]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema], rehypeHighlight]}
        components={components}
      >
        {markdown ?? ''}
      </ReactMarkdown>
    </div>
  );
}
