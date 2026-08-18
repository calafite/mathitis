import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { SystemConfig } from '@mathitis/schemas';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';

const configLabels: Record<keyof SystemConfig, { label: string; hint: string }> = {
  REQUIRE_ADMIN_REQUEST_APPROVAL: {
    label: 'Require admin approval for requests',
    hint: 'When enabled, senior accepts are held until an administrator signs off.',
  },
  REGISTRATION_ENABLED: {
    label: 'Allow new registrations',
    hint: 'When disabled, the sign-up flow silently stops accepting new accounts.',
  },
  DISCOVERY_ACTIVE: {
    label: 'Discovery season active',
    hint: 'Opens or closes the senior discovery catalog for the matching season.',
  },
  EMAIL_NOTIFICATIONS_ENABLED: {
    label: 'Email notifications enabled',
    hint: 'Master switch for transactional email delivery.',
  },
  MAX_FRESHMAN_REQUESTS: {
    label: 'Max requests per freshman',
    hint: 'Simultaneous active requests a freshman may have (1–100).',
  },
  MAX_SENIOR_MENTEES: {
    label: 'Default mentee capacity per senior',
    hint: 'Global default for how many freshmen a senior can mentor (1–100).',
  },
};

const booleanKeys: Array<keyof SystemConfig> = [
  'REQUIRE_ADMIN_REQUEST_APPROVAL',
  'REGISTRATION_ENABLED',
  'DISCOVERY_ACTIVE',
  'EMAIL_NOTIFICATIONS_ENABLED',
];
const numberKeys: Array<keyof SystemConfig> = ['MAX_FRESHMAN_REQUESTS', 'MAX_SENIOR_MENTEES'];

export function AdminConfigPage() {
  const configQuery = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: () => adminApi.getConfig(),
  });

  const [draft, setDraft] = useState<Partial<SystemConfig>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (configQuery.data) {
      setDraft(configQuery.data.config);
    }
  }, [configQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<SystemConfig>) => adminApi.updateConfig(patch),
    onSuccess: () => {
      setSaved(true);
      setError('');
      window.setTimeout(() => setSaved(false), 2000);
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    },
  });

  const dirty = JSON.stringify(draft) !== JSON.stringify(configQuery.data?.config ?? {});

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">System configuration</h1>
        <p className="mt-1 text-sm text-slate-600">
          Dynamic settings applied at runtime. Every change is recorded in the audit log with a
          before/after diff.
        </p>
      </div>

      {configQuery.isLoading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="max-w-2xl space-y-3">
          {booleanKeys.map((key) => (
            <label
              key={key}
              className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span>
                <span className="block font-medium text-slate-900">{configLabels[key].label}</span>
                <span className="block text-xs text-slate-500">{configLabels[key].hint}</span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-indigo-600"
                checked={Boolean(draft[key])}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })}
              />
            </label>
          ))}

          {numberKeys.map((key) => (
            <label
              key={key}
              className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <span>
                <span className="block font-medium text-slate-900">{configLabels[key].label}</span>
                <span className="block text-xs text-slate-500">{configLabels[key].hint}</span>
              </span>
              <input
                type="number"
                min={1}
                max={100}
                className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={typeof draft[key] === 'number' ? (draft[key] as number) : 1}
                onChange={(e) =>
                  setDraft({ ...draft, [key]: Math.max(1, Number(e.target.value)) })
                }
              />
            </label>
          ))}

          <div className="flex items-center gap-3 pt-2">
            <Button
              disabled={!dirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate(draft)}
            >
              {saveMutation.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            {saved && <span className="text-sm text-emerald-600">Saved.</span>}
            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}