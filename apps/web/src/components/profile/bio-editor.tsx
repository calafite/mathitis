import { useRef } from 'react';

export interface BioEditorProps {
  value: string;
  onChange: (value: string) => void;
}

interface ToolButton {
  label: string;
  title: string;
  insert: (current: string, start: number, end: number) => string;
  selectAfter?: (inserted: string) => [number, number];
}

const TOOLS: ToolButton[] = [
  {
    label: 'B',
    title: 'Negrito',
    insert: (c, s, e) => `${c.slice(0, s)}**${c.slice(s, e)}**${c.slice(e)}`,
    selectAfter: (ins) => [ins.indexOf('**') + 2, ins.indexOf('**', 2)],
  },
  {
    label: 'I',
    title: 'Itálico',
    insert: (c, s, e) => `${c.slice(0, s)}*${c.slice(s, e)}*${c.slice(e)}`,
    selectAfter: (ins) => [ins.indexOf('*') + 1, ins.indexOf('*', 1)],
  },
  {
    label: 'H',
    title: 'Cabeçalho',
    insert: (c, s, _e) => {
      const lineStart = c.lastIndexOf('\n', s - 1) + 1;
      return `${c.slice(0, lineStart)}## ${c.slice(lineStart)}`;
    },
    selectAfter: (ins) => [ins.lastIndexOf('## ') + 3, ins.length],
  },
  {
    label: '</>',
    title: 'Bloco de código',
    insert: (c, s, e) => `${c.slice(0, s)}\n\`\`\`\n${c.slice(s, e)}\n\`\`\`\n${c.slice(e)}`,
    selectAfter: (ins) => [ins.lastIndexOf('```\n') + 4, ins.lastIndexOf('\n```')],
  },
  {
    label: 'Clr',
    title: 'Texto colorido',
    insert: (c, s, e) => `${c.slice(0, s)}[${c.slice(s, e) || 'texto colorido'}]{color=#ec4899}${c.slice(e)}`,
    selectAfter: (ins) => [ins.lastIndexOf('{color=') - 0, ins.lastIndexOf('}')],
  },
  {
    label: 'Emblema',
    title: 'Emblema',
    insert: (c, s, e) => `${c.slice(0, s)}[${c.slice(s, e) || 'etiqueta'}]{badge=Etiqueta}${c.slice(e)}`,
    selectAfter: (ins) => [ins.lastIndexOf('{badge=') , ins.lastIndexOf('}')],
  },
  {
    label: 'Nota',
    title: 'Destaque',
    insert: (c, s, e) => {
      const before = c.slice(0, s);
      const after = c.slice(e);
      const block = `> [!NOTE]\n> ${c.slice(s, e) || 'Uma nota que vale a pena compartilhar.'}`;
      return `${before}${block}${after}`;
    },
    selectAfter: (ins) => [ins.lastIndexOf('> '), ins.length],
  },
  {
    label: '•',
    title: 'Lista',
    insert: (c, s, e) => `${c.slice(0, s)}- ${c.slice(s, e)}${c.slice(e)}`,
    selectAfter: (ins) => [ins.lastIndexOf('- ') + 2, ins.length],
  },
];

export function BioEditor({ value, onChange }: BioEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function applyTool(tool: ToolButton) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const inserted = tool.insert(value, start, end);
    onChange(inserted);

    requestAnimationFrame(() => {
      textarea.focus();
      const [selStart, selEnd] = tool.selectAfter?.(inserted) ?? [inserted.length, inserted.length];
      textarea.setSelectionRange(selStart, selEnd);
    });
  }

  return (
    <div className="overflow-hidden rounded-md border border-input bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-1.5">
        {TOOLS.map((tool) => (
          <button
            key={tool.title}
            type="button"
            title={tool.title}
            onClick={() => applyTool(tool)}
            className="rounded px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            {tool.label}
          </button>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        placeholder={'Conte sua história em markdown…\n\n[Destaque-me]{color=#ec4899}  [fã de matemática]{badge=Álgebra}\n\n> [!TIP]\n> Uma dica que vale a pena compartilhar.'}
        className="w-full resize-y bg-white px-3 py-2 font-mono text-sm text-slate-800 outline-none"
      />
    </div>
  );
}