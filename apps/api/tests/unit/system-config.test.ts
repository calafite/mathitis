import { describe, expect, it } from 'vitest';
import {
  isSystemConfigKey,
  SYSTEM_CONFIG_DEFAULTS,
  validateConfigValue,
} from '../../src/config/system-config.js';
import { ValidationError } from '../../src/errors.js';

describe('system config definitions', () => {
  it('provides defaults for every known key', () => {
    expect(SYSTEM_CONFIG_DEFAULTS).toMatchObject({
      REQUIRE_ADMIN_REQUEST_APPROVAL: false,
      REGISTRATION_ENABLED: true,
      DISCOVERY_ACTIVE: true,
      EMAIL_NOTIFICATIONS_ENABLED: true,
      MAX_FRESHMAN_REQUESTS: 3,
      MAX_SENIOR_MENTEES: 3,
    });
  });

  it('recognises known keys', () => {
    expect(isSystemConfigKey('DISCOVERY_ACTIVE')).toBe(true);
    expect(isSystemConfigKey('MAX_FRESHMAN_REQUESTS')).toBe(true);
    expect(isSystemConfigKey('NOT_A_KEY')).toBe(false);
  });

  it('accepts valid boolean values', () => {
    expect(() => validateConfigValue('REGISTRATION_ENABLED', false)).not.toThrow();
    expect(() => validateConfigValue('REGISTRATION_ENABLED', true)).not.toThrow();
  });

  it('rejects wrong types for boolean keys', () => {
    expect(() => validateConfigValue('REGISTRATION_ENABLED', 'yes')).toThrow(ValidationError);
    expect(() => validateConfigValue('REGISTRATION_ENABLED', 1)).toThrow(ValidationError);
  });

  it('accepts bounded integers for numeric keys', () => {
    expect(() => validateConfigValue('MAX_FRESHMAN_REQUESTS', 5)).not.toThrow();
  });

  it('rejects out-of-range or non-integer numeric values', () => {
    expect(() => validateConfigValue('MAX_FRESHMAN_REQUESTS', 0)).toThrow(ValidationError);
    expect(() => validateConfigValue('MAX_FRESHMAN_REQUESTS', 101)).toThrow(ValidationError);
    expect(() => validateConfigValue('MAX_FRESHMAN_REQUESTS', 1.5)).toThrow(ValidationError);
    expect(() => validateConfigValue('MAX_FRESHMAN_REQUESTS', 'many')).toThrow(ValidationError);
  });

  it('rejects unknown keys', () => {
    expect(() => validateConfigValue('MADE_UP_KEY', true)).toThrow(ValidationError);
  });
});