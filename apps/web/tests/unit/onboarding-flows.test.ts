import { describe, expect, it } from 'vitest';
import { FRESHMAN_FLOW, SENIOR_FLOW } from '@/lib/onboarding-flows';
import type { OnboardingFlow, OnboardingStep } from '@/lib/onboarding-engine';

function ids(flow: OnboardingFlow) {
  return flow.map((s) => s.id);
}

describe('onboarding flows', () => {
  it('freshman flow teaches discovery, bumps and the 4-bump limit in order', () => {
    const order = ids(FRESHMAN_FLOW);

    expect(order).toContain('what-is-discovery');
    expect(order).toContain('bump-explained');
    expect(order.indexOf('what-is-discovery')).toBeLessThan(order.indexOf('bump-explained'));
    expect(order.indexOf('bump-explained')).toBeLessThan(order.indexOf('four-bump-limit'));

    const limit = FRESHMAN_FLOW.find((s) => s.id === 'four-bump-limit');
    expect(limit?.description).toMatch(/4 impulsos/);
  });

  it('every step references a known block type', () => {
    const known = ['info_slide', 'profile_input', 'theme_picker', 'tag_selector', 'avatar_upload'];
    for (const flow of [FRESHMAN_FLOW, SENIOR_FLOW]) {
      for (const step of flow) {
        expect(known).toContain(step.type);
      }
    }
  });

  it('raises collected profile fields for both roles', () => {
    for (const flow of [FRESHMAN_FLOW, SENIOR_FLOW]) {
      expect(flow.some((s) => s.type === 'profile_input')).toBe(true);
      expect(flow.some((s) => s.type === 'theme_picker')).toBe(true);
      expect(flow.some((s) => s.type === 'tag_selector')).toBe(true);
    }
  });

  it('senior flow ends with a mentor-ready completion slide', () => {
    const last: OnboardingStep | undefined = SENIOR_FLOW[SENIOR_FLOW.length - 1];
    expect(last?.type).toBe('info_slide');
    expect(last?.ctaText).toBe('ABRIR MEU PERFIL');
  });

  it('both flows require a real photo of yourself (no cartoons)', () => {
    for (const flow of [FRESHMAN_FLOW, SENIOR_FLOW]) {
      const avatarStep = flow.find((s) => s.type === 'avatar_upload');
      expect(avatarStep).toBeDefined();
      expect(avatarStep?.config?.required).toBe(true);
      expect(avatarStep?.title).toMatch(/Mostre quem você é/);
    }
  });
});
