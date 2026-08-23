import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, Clock, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { discoveryApi } from '@/lib/discovery-api';
import { requestsApi } from '@/lib/requests-api';
import { Button } from '@/components/ui/button';
import { MentorProfileModal } from '@/components/profile/mentor-profile-modal';
import { usePageMeta } from '@/lib/use-page-meta';

type TreeNode = {
  label: string;
  sub?: string;
  tone: 'lineage' | 'solid' | 'ghost';
};

/**
 * The signature element: a small genealogical tree rendered as SVG.
 * Mentor(s) above, you in the middle, future/present mentees below —
 * the permanent family structure that Mathitis is about.
 */
function LineageTree({ up, me, down }: { up: TreeNode[]; me: TreeNode; down: TreeNode[] }) {
  const W = 340;
  const H = 240;
  const nodeR = 22;

  const xs = (i: number, n: number) => (W / (n + 1)) * (i + 1);

  const node = (t: TreeNode, cx: number, cy: number, key: string) => {
    const fill =
      t.tone === 'lineage'
        ? 'var(--color-lineage)'
        : t.tone === 'solid'
          ? 'var(--color-primary)'
          : 'none';
    const stroke =
      t.tone === 'ghost' ? 'var(--color-border)' : 'var(--color-foreground)';
    const textFill =
      t.tone === 'ghost'
        ? 'var(--color-muted-foreground)'
        : t.tone === 'solid'
          ? 'var(--color-primary-foreground)'
          : 'var(--color-lineage-foreground)';
    return (
      <g key={key}>
        <circle
          cx={cx}
          cy={cy}
          r={nodeR}
          fill={fill}
          stroke={stroke}
          strokeWidth={1.5}
          strokeDasharray={t.tone === 'ghost' ? '4 3' : undefined}
        />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize="13"
          fontWeight="600"
          fill={textFill}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t.label}
        </text>
        {t.sub && (
          <text
            x={cx}
            y={cy + nodeR + 14}
            textAnchor="middle"
            fontSize="9"
            fill="var(--color-muted-foreground)"
          >
            {t.sub}
          </text>
        )}
      </g>
    );
  };

  const edge = (x1: number, y1: number, x2: number, y2: number, key: string, dashed = false) => (
    <path
      key={key}
      d={`M ${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}`}
      fill="none"
      stroke={dashed ? 'var(--color-border)' : 'var(--color-lineage)'}
      strokeWidth={1.5}
      strokeDasharray={dashed ? '4 3' : undefined}
      opacity={dashed ? 0.8 : 0.9}
    />
  );

  const upY = 52;
  const meY = 120;
  const downY = 192;
  const meX = W / 2;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full max-w-sm"
      role="img"
      aria-label="Sua posição na árvore de linhagem acadêmica"
    >
      {up.map((t, i) => {
        const cx = xs(i, Math.max(up.length, 1));
        return (
          <g key={`up-${i}`}>
            {edge(cx, upY + nodeR, meX, meY - nodeR, `e-up-${i}`)}
            {node(t, cx, upY, `n-up-${i}`)}
          </g>
        );
      })}
      {down.map((t, i) => {
        const cx = xs(i, Math.max(down.length, 1));
        return (
          <g key={`down-${i}`}>
            {edge(meX, meY + nodeR, cx, downY - nodeR, `e-down-${i}`, t.tone === 'ghost')}
            {node(t, cx, downY, `n-down-${i}`)}
          </g>
        );
      })}
      {node(me, meX, meY, 'n-me')}
    </svg>
  );
}

/** Empty-state illustration: a bare branch waiting for its first connection. */
function EmptyBranch() {
  return (
    <svg
      viewBox="0 0 220 120"
      className="h-auto w-44 shrink-0"
      role="img"
      aria-label="Galho vazio aguardando uma conexão"
    >
      <path
        d="M 20 100 C 70 96, 90 80, 110 60 C 128 42, 150 34, 196 30"
        fill="none"
        stroke="var(--color-lineage)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M 110 60 C 116 48, 118 40, 118 28"
        fill="none"
        stroke="var(--color-border)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        strokeLinecap="round"
      />
      <path
        d="M 150 34 C 158 28, 166 26, 178 26"
        fill="none"
        stroke="var(--color-border)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        strokeLinecap="round"
      />
      <circle cx="20" cy="100" r="5" fill="var(--color-lineage)" />
      <circle cx="196" cy="30" r="4" fill="none" stroke="var(--color-border)" strokeDasharray="3 2" />
    </svg>
  );
}

const ROLE_LABEL: Record<string, string> = {
  freshman: 'Calouro',
  senior: 'Veterano',
  administrator: 'Administração',
  developer: 'Desenvolvedor',
};

export function HomePage() {
  usePageMeta('Início', 'Plataforma de apadrinhamento acadêmico do departamento de matemática: encontre um padrinho, construa sua linhagem.');
  const { user, logout } = useAuth();
  const isFreshman = user?.role === 'freshman';
  const isSenior = user?.role === 'senior';
  const [profileModalHandle, setProfileModalHandle] = useState<string | null>(null);

  const recommendationsQuery = useQuery({
    queryKey: ['recommendations', 'home-preview'],
    queryFn: () => discoveryApi.recommendations(3).then((r) => r.recommendations),
    enabled: isFreshman,
  });

  const requestsQuery = useQuery({
    queryKey: ['requests', 'home-preview'],
    queryFn: () =>
      requestsApi.list({ inbox: isFreshman ? 'sent' : 'incoming' }).then((r) => r.requests),
    enabled: Boolean(user),
  });

  const requests = requestsQuery.data ?? [];
  const pendingRequests = requests.filter(
    (r) => r.status === 'pending' || r.status === 'pending_admin_approval',
  );
  const activeMentorships = requests.filter((r) => r.status === 'accepted');

  const displayName = user?.socialName ?? user?.handle ?? '';

  // Real lineage data for the signature tree — no abstract points.
  const treeUp: TreeNode[] = isFreshman
    ? activeMentorships.slice(0, 1).map((r) => ({
        label: (r.senior?.socialName ?? r.senior?.handle ?? '?').charAt(0).toUpperCase(),
        sub: `@${r.senior?.handle ?? ''}`,
        tone: 'lineage' as const,
      }))
    : [];
  const treeDown: TreeNode[] = isFreshman
    ? [
        { label: '?', tone: 'ghost' },
        { label: '?', tone: 'ghost' },
      ]
    : activeMentorships.slice(0, 3).map((r) => ({
        label: (r.freshman?.socialName ?? r.freshman?.handle ?? '?').charAt(0).toUpperCase(),
        sub: `@${r.freshman?.handle ?? ''}`,
        tone: 'solid' as const,
      }));
  if (isSenior && treeDown.length === 0) {
    treeDown.push({ label: '?', tone: 'ghost' }, { label: '?', tone: 'ghost' });
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* --- Hero: greeting + signature lineage tree --- */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-10">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-1"
          style={{ background: 'var(--color-lineage)' }}
          aria-hidden
        />
        <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div className="max-w-xl space-y-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold tracking-wide"
                style={{
                  background: 'color-mix(in srgb, var(--color-lineage) 12%, transparent)',
                  color: 'var(--color-lineage)',
                }}
              >
                Linhagem de apadrinhamento acadêmico
              </span>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {ROLE_LABEL[user?.role ?? ''] ?? user?.role} · Período {user?.semester}
              </span>
            </div>

            <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
              Bem-vindo(a),{' '}
              <span style={{ color: 'var(--color-lineage)' }}>{displayName}</span>
            </h1>

            <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
              {isFreshman
                ? 'Todo matemático teve alguém que abriu o caminho. Encontre o seu veterano e comece o seu ramo na árvore do departamento.'
                : 'Você já foi calouro um dia. Agora é a sua vez de abrir caminhos — cada pupilo carrega a sua marca para as próximas gerações.'}
            </p>

            {user?.role === 'administrator' && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <Shield className="h-4 w-4" />
                Central administrativa
              </Link>
            )}
            <div>
              <button
                type="button"
                onClick={logout}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Sair
              </button>
            </div>
          </div>

          <div className="flex w-full justify-center md:w-auto">
            <LineageTree
              up={treeUp}
              me={{
                label: displayName.charAt(0).toUpperCase() || '?',
                sub: 'você',
                tone: 'lineage',
              }}
              down={treeDown}
            />
          </div>
        </div>
      </section>

      {/* --- Active connections: the thing that matters most gets real estate --- */}
      <section className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-semibold">
            {isFreshman ? 'Seu padrinho' : 'Seus pupilos'}
          </h2>
          <Link
            to="/requests"
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
          >
            Gerenciar <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-5">
          {activeMentorships.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {activeMentorships.map((req) => {
                const counterpart = isFreshman ? req.senior : req.freshman;
                return (
                  <div
                    key={req.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-background p-4"
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-display text-sm font-semibold"
                      style={{ background: 'var(--color-lineage)', color: 'var(--color-lineage-foreground)' }}
                    >
                      {(counterpart?.socialName ?? counterpart?.handle ?? '?')
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {counterpart?.socialName ?? counterpart?.handle}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        @{counterpart?.handle} · Período {counterpart?.semester}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-border bg-background/50 p-8 text-center sm:flex-row sm:text-left">
              <EmptyBranch />
              <div className="space-y-3">
                <p className="font-display text-lg font-medium">
                  {isFreshman
                    ? 'Sua árvore ainda não tem galhos.'
                    : 'Nenhum ramo brotou ainda.'}
                </p>
                <p className="max-w-md text-sm text-muted-foreground">
                  {isFreshman
                    ? 'Um apadrinhamento é um vínculo para a vida acadêmica inteira. Escolha um padrinho e plante a primeira conexão.'
                    : 'Quando você aceitar um calouro, ele se torna um ramo permanente da sua linhagem — e da do departamento.'}
                </p>
                <Link to={isFreshman ? '/discovery' : '/requests'}>
                  <Button size="sm">
                    {isFreshman ? 'Descobrir padrinhos' : 'Revisar pedidos recebidos'}
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* --- Launchpad --- */}
      <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          to="/discovery"
          className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/60"
        >
          <h3 className="font-display text-lg font-medium">Descoberta de Padrinhos</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Encontre veteranos alinhados com os seus interesses.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary transition-transform group-hover:translate-x-1">
            Explorar <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>

        <Link
          to="/requests"
          className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/60"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-medium">Pedidos</h3>
            {pendingRequests.length > 0 && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                {pendingRequests.length}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Cartas, respostas e admissões em um só lugar.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary transition-transform group-hover:translate-x-1">
            Caixa de entrada <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>

        <Link
          to="/lineage"
          className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/60"
        >
          <h3 className="font-display text-lg font-medium">Linhagem</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            A genealogia completa do departamento, turma a turma.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary transition-transform group-hover:translate-x-1">
            Ver a árvore <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>

        <Link
          to="/profile/studio"
          className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/60"
        >
          <h3 className="font-display text-lg font-medium">Estúdio de Perfil</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Conte a sua história com cartões, banners e temas.
          </p>
          <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary transition-transform group-hover:translate-x-1">
            Personalizar <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </Link>
      </section>

      {/* --- Recommendations (freshmen) --- */}
      {isFreshman && (
        <section className="mt-6 rounded-3xl border border-border bg-card p-6 sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">Padrinhos sugeridos para você</h2>
            <Link
              to="/discovery"
              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
            >
              Ver catálogo <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-5 divide-y divide-border">
            {recommendationsQuery.isLoading && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Buscando compatibilidades no departamento…
              </p>
            )}
            {recommendationsQuery.data?.slice(0, 3).map((senior) => (
              <div
                key={senior.userId}
                className="flex flex-col gap-3 py-4 first:pt-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  {senior.avatarThumbnailUrl ? (
                    <img
                      src={senior.avatarThumbnailUrl}
                      alt=""
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent font-display text-lg font-semibold text-accent-foreground">
                      {(senior.socialName ?? senior.handle).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setProfileModalHandle(senior.handle)}
                        className="rounded font-semibold text-foreground hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {senior.socialName ?? senior.handle}
                      </button>
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {senior.score}% de compatibilidade
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      @{senior.handle} · Período {senior.semester}
                    </p>
                    {senior.matchReasons && senior.matchReasons.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        ✦ {senior.matchReasons[0]}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setProfileModalHandle(senior.handle)}
                >
                  Ver perfil
                </Button>
              </div>
            ))}
            {recommendationsQuery.data?.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Ainda não há sugestões. Explore o catálogo completo na Descoberta de Padrinhos!
              </p>
            )}
          </div>
        </section>
      )}

      {/* --- Activity + spirit --- */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-3xl border border-border bg-card p-6 lg:col-span-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Atividade e pedidos
          </h2>
          <div className="mt-4 space-y-3">
            {pendingRequests.slice(0, 3).map((req) => (
              <div
                key={req.id}
                className="flex items-start gap-3 rounded-xl border border-border bg-background p-3"
              >
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-foreground">
                    {isFreshman ? `Para @${req.senior?.handle}` : `De @${req.freshman?.handle}`}
                  </p>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">{req.message}</p>
                </div>
                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                  Pendente
                </span>
              </div>
            ))}
            {pendingRequests.length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Nenhum pedido em análise no momento.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-6">
          <h3 className="font-display text-base font-semibold">O espírito do Mathitis</h3>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground italic">
            …
          </p>
          <Link
            to="/lineage"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold hover:underline"
            style={{ color: 'var(--color-lineage)' }}
          >
            Ver a genealogia acadêmica <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      </div>

      <MentorProfileModal
        open={profileModalHandle !== null}
        onOpenChange={(open) => !open && setProfileModalHandle(null)}
        seniorHandle={profileModalHandle ?? ''}
      />
    </div>
  );
}
