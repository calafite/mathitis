import type { SystemConfig, SystemConfigKey } from '@mathitis/schemas';
import { ValidationError } from '../errors.js';

export interface SystemConfigDefinition {
  type: 'boolean' | 'number';
  default: boolean | number;
  description: string;
}

export const SYSTEM_CONFIG_DEFINITIONS: Record<SystemConfigKey, SystemConfigDefinition> = {
  REQUIRE_ADMIN_REQUEST_APPROVAL: {
    type: 'boolean',
    default: false,
    description: 'When true, senior accepts require an administrator sign-off.',
  },
  REGISTRATION_ENABLED: {
    type: 'boolean',
    default: true,
    description: 'Whether new accounts may be registered.',
  },
  DISCOVERY_ACTIVE: {
    type: 'boolean',
    default: true,
    description: 'Matching season window: closes the discovery catalog once finalized.',
  },
  EMAIL_NOTIFICATIONS_ENABLED: {
    type: 'boolean',
    default: true,
    description: 'Whether transactional emails are sent.',
  },
  MAX_FRESHMAN_REQUESTS: {
    type: 'number',
    default: 3,
    description: 'Maximum simultaneous active mentorship requests per freshman.',
  },
  MAX_SENIOR_MENTEES: {
    type: 'number',
    default: 3,
    description: 'Global default mentee capacity for seniors.',
  },
};

export const SYSTEM_CONFIG_DEFAULTS: SystemConfig = Object.fromEntries(
  Object.entries(SYSTEM_CONFIG_DEFINITIONS).map(([key, def]) => [key, def.default]),
) as SystemConfig;

export function isSystemConfigKey(key: string): key is SystemConfigKey {
  return key in SYSTEM_CONFIG_DEFINITIONS;
}

/**
 * Validates a single incoming config value against its declared type.
 * Throws a ValidationError for unknown keys or mismatched types.
 */
export function validateConfigValue(key: string, value: unknown): void {
  const definition = SYSTEM_CONFIG_DEFINITIONS[key as SystemConfigKey];
  if (!definition) {
    throw new ValidationError(`Unknown configuration key: ${key}`);
  }
  if (definition.type === 'boolean' && typeof value !== 'boolean') {
    throw new ValidationError(`Configuration "${key}" expects a boolean value`);
  }
  if (definition.type === 'number') {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 100) {
      throw new ValidationError(
        `Configuration "${key}" expects an integer between 1 and 100`,
      );
    }
  }
}