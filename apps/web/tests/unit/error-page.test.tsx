import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ErrorPage } from '@/pages/error-page';
import { ApiError } from '@/lib/api';

function renderErrorPage(props: Parameters<typeof ErrorPage>[0]) {
  return render(
    <MemoryRouter>
      <ErrorPage {...props} />
    </MemoryRouter>,
  );
}

describe('ErrorPage', () => {
  it('renders ApiError status, code and message with a collapsible debug box', async () => {
    const user = userEvent.setup();
    renderErrorPage({
      error: new ApiError(404, 'NOT_FOUND', 'Recurso não encontrado'),
    });

    expect(screen.getByRole('heading', { name: /algo deu errado/i })).toBeInTheDocument();
    expect(screen.getByText('Recurso não encontrado')).toBeInTheDocument();

    const summary = screen.getByText(/\[\+\] Detalhes técnicos do erro/i);
    await user.click(summary);

    const pre = screen.getByText(/"statusCode": 404/);
    expect(pre).toBeInTheDocument();
    expect(pre.textContent).toContain('"code": "NOT_FOUND"');
  });

  it('supports custom title, message and retry action', async () => {
    const onRetry = vi.fn();
    renderErrorPage({
      error: new Error('boom'),
      title: 'Falha na verificação',
      message: 'Token inválido ou expirado',
      onRetry,
    });

    expect(screen.getByRole('heading', { name: /falha na verificação/i })).toBeInTheDocument();
    expect(screen.getByText(/token inválido ou expirado/i)).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
