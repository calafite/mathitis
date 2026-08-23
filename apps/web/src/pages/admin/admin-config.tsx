import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { SystemConfig } from '@mathitis/schemas';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';

const configLabels: Record<keyof SystemConfig, { label: string; hint: string }> = {
  REQUIRE_ADMIN_REQUEST_APPROVAL: {
    label: 'Exigir aprovação administrativa para pedidos',
    hint: 'Quando ativado, os aceites de veteranos ficam retidos até a validação de um administrador.',
  },
  REGISTRATION_ENABLED: {
    label: 'Permitir novos registros',
    hint: 'Quando desativado, o fluxo de cadastro deixa de aceitar novas contas silenciosamente.',
  },
  DISCOVERY_ACTIVE: {
    label: 'Temporada de descoberta ativa',
    hint: 'Abre ou fecha o catálogo de descoberta de veteranos para a temporada correspondente.',
  },
  EMAIL_NOTIFICATIONS_ENABLED: {
    label: 'Notificações por e-mail ativadas',
    hint: 'Interruptor mestre para o envio de e-mails transacionais.',
  },
  MAX_FRESHMAN_REQUESTS: {
    label: 'Máx. de pedidos por calouro',
    hint: 'Pedidos ativos simultâneos que um calouro pode ter (1–100).',
  },
  MAX_SENIOR_MENTEES: {
    label: 'Capacidade padrão de mentorados por veterano',
    hint: 'Padrão global de quantos calouros um veterano pode orientar (1–100).',
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
      setError(err instanceof Error ? err.message : 'Falha ao salvar a configuração');
    },
  });

  const dirty = JSON.stringify(draft) !== JSON.stringify(configQuery.data?.config ?? {});

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Configuração do sistema</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configurações dinâmicas aplicadas em tempo de execução. Cada alteração é registrada no
          registro de auditoria com um diff de antes/depois.
        </p>
      </div>

      {configQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : (
        <div className="max-w-2xl space-y-3">
          {booleanKeys.map((key) => (
            <label
              key={key}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <span>
                <span className="block font-medium text-foreground">{configLabels[key].label}</span>
                <span className="block text-xs text-muted-foreground">{configLabels[key].hint}</span>
              </span>
              <input
                type="checkbox"
                className="h-5 w-5 accent-primary"
                checked={Boolean(draft[key])}
                onChange={(e) => setDraft({ ...draft, [key]: e.target.checked })}
              />
            </label>
          ))}

          {numberKeys.map((key) => (
            <label
              key={key}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm"
            >
              <span>
                <span className="block font-medium text-foreground">{configLabels[key].label}</span>
                <span className="block text-xs text-muted-foreground">{configLabels[key].hint}</span>
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
              {saveMutation.isPending ? 'Salvando…' : 'Salvar alterações'}
            </Button>
            {saved && <span className="text-sm text-emerald-600 dark:text-emerald-400">Salvo.</span>}
            {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
          </div>
        </div>
      )}
    </div>
  );
}