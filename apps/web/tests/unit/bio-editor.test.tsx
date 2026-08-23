import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BioEditor } from '@/components/profile/bio-editor';

describe('BioEditor', () => {
  it('renders the current markdown value in the textarea', () => {
    render(<BioEditor value="Hello world" onChange={() => {}} />);

    expect(screen.getByPlaceholderText(/Conte sua história/)).toHaveValue('Hello world');
  });

  it('emits typed changes', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BioEditor value="" onChange={onChange} />);

    await user.type(screen.getByPlaceholderText(/Conte sua história/), 'abc');
    expect(onChange).toHaveBeenCalled();
  });

  it('wraps the selection with bold markers', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BioEditor value="some important text" onChange={onChange} />);

    const textarea = screen.getByPlaceholderText(/Conte sua história/) as HTMLTextAreaElement;
    textarea.setSelectionRange(5, 14);
    await user.click(screen.getByTitle('Negrito'));

    expect(onChange).toHaveBeenCalledWith('some **important** text');
  });

  it('inserts a badge with a placeholder when nothing is selected', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BioEditor value="bio" onChange={onChange} />);

    const textarea = screen.getByPlaceholderText(/Conte sua história/) as HTMLTextAreaElement;
    textarea.setSelectionRange(1, 1);
    await user.click(screen.getByTitle('Emblema'));

    expect(onChange).toHaveBeenCalledWith('b[etiqueta]{badge=Etiqueta}io');
  });

  it('prepends a header marker at the current line', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<BioEditor value={'first line\nsecond line'} onChange={onChange} />);

    const textarea = screen.getByPlaceholderText(/Conte sua história/) as HTMLTextAreaElement;
    textarea.setSelectionRange(11, 11);
    await user.click(screen.getByTitle('Cabeçalho'));

    expect(onChange).toHaveBeenCalledWith('first line\n## second line');
  });
});
