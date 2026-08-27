import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard';
import type { OnboardingDraft } from '@/lib/onboarding-engine';
import { emptyOnboardingDraft } from '@/lib/onboarding-engine';

function makeDraft(): OnboardingDraft {
  return emptyOnboardingDraft();
}

const infoFlow = [
  { id: 's1', type: 'info_slide' as const, title: 'Passo um' },
  { id: 's2', type: 'info_slide' as const, title: 'Passo dois', description: 'Texto do passo dois' },
];

describe('OnboardingWizard', () => {
  it('renders the first step and advances on continue', async () => {
    const user = userEvent.setup();
    render(
      <OnboardingWizard
        flow={infoFlow}
        draft={makeDraft()}
        setDraft={() => {}}
        onComplete={() => {}}
      />,
    );

    expect(screen.getByText('Passo um')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'CONTINUAR' }));
    expect(screen.getByText('Passo dois')).toBeInTheDocument();
    expect(screen.getByText('Texto do passo dois')).toBeInTheDocument();
  });

  it('calls onComplete when advancing past the last step', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(
      <OnboardingWizard
        flow={infoFlow}
        draft={makeDraft()}
        setDraft={() => {}}
        onComplete={onComplete}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'CONTINUAR' }));
    await user.click(screen.getByRole('button', { name: 'CONTINUAR' }));

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('keeps profile input values in sync with the draft', () => {
    const setDraft = vi.fn();
    const flow = [
      {
        id: 'name',
        type: 'profile_input' as const,
        title: 'Como podemos te chamar?',
        config: { field: 'socialName', required: true, placeholder: 'Nome social' },
      },
    ];

    render(
      <OnboardingWizard flow={flow} draft={makeDraft()} setDraft={setDraft} onComplete={() => {}} />,
    );

    const input = screen.getByPlaceholderText('Nome social');
    fireEvent.change(input, { target: { value: 'Ana' } });

    expect(setDraft).toHaveBeenCalledWith({ socialName: 'Ana' });
  });
});
