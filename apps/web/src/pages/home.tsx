import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { discoveryApi } from '@/lib/discovery-api';
import { requestsApi } from '@/lib/requests-api';
import { usePageMeta } from '@/lib/use-page-meta';
import { MentorProfileModal } from '@/components/profile/mentor-profile-modal';

/* Brutalist poster primitives ---------------------------------------- */

const CARD_BG = '#d3d7de';
const CARD_TEXT = '#0b0b0e';
const VERMILLION = '#ff4d14';

function PosterCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-none border-2 border-black p-5 ${className}`}
      style={{
        backgroundColor: CARD_BG,
        color: CARD_TEXT,
        boxShadow: '8px 8px 0 0 rgba(201, 206, 216, 0.14), 0 0 0 1px rgba(255,255,255,0.06)',
      }}
    >
      {children}
    </div>
  );
}

function MonoButton({
  to,
  children,
  onClick,
}: {
  to?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const cls =
    'inline-block rounded-none border-2 border-black px-4 py-2 font-mono text-xs font-bold uppercase tracking-widest transition-transform hover:-translate-y-0.5 active:translate-y-0';
  const style = {
    backgroundColor: CARD_BG,
    color: CARD_TEXT,
    boxShadow: '4px 4px 0 0 #26262b, 0 0 0 1px rgba(255,255,255,0.08)',
  };
  if (to) {
    return (
      <Link to={to} className={cls} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={style}>
      {children}
    </button>
  );
}

/* Signature lineage tree (monochrome, vermillion for "you") ----------- */

type TreeNode = { label: string; sub?: string; tone: 'lineage' | 'solid' | 'ghost' };

function LineageTree({ up, me, down }: { up: TreeNode[]; me: TreeNode; down: TreeNode[] }) {
  const W = 360;
  const H = 250;
  const nodeR = 22;
  const xs = (i: number, n: number) => (W / (n + 1)) * (i + 1);

  const node = (t: TreeNode, cx: number, cy: number, key: string) => {
    const isGhost = t.tone === 'ghost';
    const isMe = t.tone === 'lineage';
    return (
      <g key={key}>
        <circle
          cx={cx}
          cy={cy}
          r={nodeR}
          fill={isMe ? VERMILLION : isGhost ? 'none' : CARD_BG}
          stroke={isMe ? VERMILLION : '#c9ced8'}
          strokeWidth={1.5}
          strokeDasharray={isGhost ? '4 3' : undefined}
        />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fontSize="13"
          fontWeight="700"
          fill={isMe ? '#ffffff' : isGhost ? '#6b7280' : CARD_TEXT}
        >
          {t.label}
        </text>
        {t.sub && (
          <text x={cx} y={cy + nodeR + 14} textAnchor="middle" fontSize="9" fill="#8b93a1">
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
      stroke={dashed ? '#3a3f4b' : VERMILLION}
      strokeWidth={1.5}
      strokeDasharray={dashed ? '4 3' : undefined}
    />
  );

  const upY = 52;
  const meY = 125;
  const downY = 200;
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
      className="h-auto w-40 shrink-0"
      role="img"
      aria-label="Galho vazio aguardando uma conexão"
    >
      <path
        d="M 20 100 C 70 96, 90 80, 110 60 C 128 42, 150 34, 196 30"
        fill="none"
        stroke={VERMILLION}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M 110 60 C 116 48, 118 40, 118 28"
        fill="none"
        stroke="#3a3f4b"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        strokeLinecap="round"
      />
      <path
        d="M 150 34 C 158 28, 166 26, 178 26"
        fill="none"
        stroke="#3a3f4b"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        strokeLinecap="round"
      />
      <circle cx="20" cy="100" r="5" fill={VERMILLION} />
      <circle cx="196" cy="30" r="4" fill="none" stroke="#6b7280" strokeDasharray="3 2" />
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
  const { user, logout } = useAuth();
  usePageMeta(
    'Início',
    'Portal de apadrinhamento acadêmico de Ciência da Computação: encontre um padrinho, construa sua linhagem.',
  );
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

  const treeUp: TreeNode[] = isFreshman
    ? activeMentorships.slice(0, 1).map((r) => ({
        label: (r.senior?.socialName ?? r.senior?.handle ?? '?').charAt(0).toUpperCase(),
        sub: `@${r.senior?.handle ?? ''}`,
        tone: 'lineage',
      }))
    : [];
  const treeDown: TreeNode[] = isSenior
    ? activeMentorships.slice(0, 3).map((r) => ({
        label: (r.freshman?.socialName ?? r.freshman?.handle ?? '?').charAt(0).toUpperCase(),
        sub: `@${r.freshman?.handle ?? ''}`,
        tone: 'solid',
      }))
    : [
        { label: '?', tone: 'ghost' },
        { label: '?', tone: 'ghost' },
      ];

  return (
    <div className="relative">
      {/* Blueprint grid backdrop */}
      <div
        className="pointer-events-none absolute inset-0 -mx-4 -my-8 opacity-[0.13]"
        aria-hidden
        style={{
          backgroundImage:
            'linear-gradient(#c9ced8 1px, transparent 1px), linear-gradient(90deg, #c9ced8 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
        }}
      />

      <div className="relative">
        {/* --- Hero --- */}
        <section className="flex flex-col items-start justify-between gap-10 lg:flex-row lg:items-center">
          <div className="max-w-2xl space-y-6">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-[#c9ced8]">
              Portal de apadrinhamento de Ciência da Computação
            </p>
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-[#8f95a3]">
              {ROLE_LABEL[user?.role ?? ''] ?? user?.role} · Período {user?.semester}
            </p>
            <h1 className="font-sans text-5xl font-bold uppercase leading-[0.95] tracking-tight text-[#c9ced8] sm:text-6xl lg:text-7xl">
              🐈‍⬛ Unindo
              <br />
              gerações de
              <br />
              alunos
            </h1>
            <p className="text-sm text-muted-foreground">
              {isFreshman
                ? `Bem-vindo(a), ${displayName}. Todos nós já estivemos no marco zero...`
                : `Bem-vindo(a), ${displayName}. Asídesiples.`}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <MonoButton to={isFreshman ? '/discovery' : '/requests'}>
                {isFreshman ? 'Explorar padrinhos' : 'Revisar pedidos'}
              </MonoButton>
              <MonoButton to="/lineage">Ver linhagem</MonoButton>
              {user?.role === 'administrator' && <MonoButton to="/admin">Administração</MonoButton>}
              <button
                type="button"
                onClick={logout}
                className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                Sair
              </button>
            </div>
          </div>

          <div className="flex w-full justify-center lg:w-auto">
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
        </section>

        {/* --- Active connections --- */}
        <PosterCard className="mt-12">
          <div className="flex items-center justify-between">
            <h2 className="font-sans text-xl font-bold uppercase tracking-tight">
              {isFreshman ? 'Seu padrinho' : 'Seus ferinhas'}
            </h2>
            <Link
              to="/requests"
              className="font-mono text-[11px] font-bold uppercase tracking-widest underline hover:no-underline"
            >
              Gerenciar
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
                      className="flex items-center gap-3 border-2 border-black bg-white/40 p-3"
                    >
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center font-sans text-sm font-bold text-white"
                        style={{ backgroundColor: VERMILLION }}
                      >
                        {(counterpart?.socialName ?? counterpart?.handle ?? '?')
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">
                          {counterpart?.socialName ?? counterpart?.handle}
                        </p>
                        <p className="text-xs opacity-70">
                          @{counterpart?.handle} · Período {counterpart?.semester}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-5 border-2 border-dashed border-black/40 p-8 sm:flex-row">
                <EmptyBranch />
                <div className="space-y-3">
                  <p className="font-sans text-lg font-bold uppercase">
                    {isFreshman ? 'Sua árvore ainda não tem galhos' : 'Nenhum ramo brotou ainda'}
                  </p>
                  <p className="max-w-md text-sm opacity-80">
                    {isFreshman
                      ? 'Um apadrinhamento é uma amizade terrívelmente longa. Escolha um padrinho e não pense mais sobre isso.'
                      : 'Quando você aceita um ferinha, ele(a) não pode ser devolvido(a).'}
                  </p>
                  <MonoButton to={isFreshman ? '/discovery' : '/requests'}>
                    {isFreshman ? 'Descobrir padrinhos' : 'Revisar pedidos recebidos'}
                  </MonoButton>
                </div>
              </div>
            )}
          </div>
        </PosterCard>

        {/* --- Launchpad --- */}
        <section className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <PosterCard className="flex flex-col">
            <div className="mb-4 flex h-14 w-14 items-center justify-center border-2 border-black">
              <span className="text-2xl" aria-hidden>
                ◈
              </span>
            </div>
            <h3 className="font-sans text-lg font-bold uppercase leading-tight">
              Descoberta de Padrinhos
            </h3>
            <p className="mt-1 flex-1 text-xs opacity-80">
              Encontre veteranos alinhados com os seus interesses e projetos.
            </p>
            <div className="mt-4">
              <MonoButton to="/discovery">Explorar</MonoButton>
            </div>
          </PosterCard>

          <PosterCard className="flex flex-col">
            <div className="mb-4 flex h-14 w-14 items-center justify-center border-2 border-black">
              <span className="relative text-2xl" aria-hidden>
                ✉
                {pendingRequests.length > 0 && (
                  <span
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: VERMILLION }}
                  >
                    {pendingRequests.length}
                  </span>
                )}
              </span>
            </div>
            <h3 className="font-sans text-lg font-bold uppercase leading-tight">Pedidos</h3>
            <p className="mt-1 flex-1 text-xs opacity-80">
              Cartas, respostas e admissões em um só lugar.
            </p>
            <div className="mt-4">
              <MonoButton to="/requests">Caixa de entrada</MonoButton>
            </div>
          </PosterCard>

          <PosterCard className="flex flex-col">
            <div className="mb-4 flex h-14 w-14 items-center justify-center border-2 border-black">
              <span className="text-2xl" aria-hidden>
                ⑃
              </span>
            </div>
            <h3 className="font-sans text-lg font-bold uppercase leading-tight">Linhagem</h3>
            <p className="mt-1 flex-1 text-xs opacity-80">
              A genealogia completa do CI, turma a turma.
            </p>
            <div className="mt-4">
              <MonoButton to="/lineage">Ver a árvore</MonoButton>
            </div>
          </PosterCard>

          <PosterCard className="flex flex-col">
            <div className="mb-4 flex h-14 w-14 items-center justify-center border-2 border-black">
              <span className="text-2xl" aria-hidden>
                ✎
              </span>
            </div>
            <h3 className="font-sans text-lg font-bold uppercase leading-tight">
              Estúdio de Perfil
            </h3>
            <p className="mt-1 flex-1 text-xs opacity-80">
              Conte a sua história com cartões, banners e temas.
            </p>
            <div className="mt-4">
              <MonoButton to="/profile/studio">Personalizar</MonoButton>
            </div>
          </PosterCard>
        </section>

        {/* --- Recommendations (freshmen) --- */}
        {isFreshman && (
          <PosterCard className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="font-sans text-xl font-bold uppercase tracking-tight">
                Padrinhos sugeridos
              </h2>
              <Link
                to="/discovery"
                className="font-mono text-[11px] font-bold uppercase tracking-widest underline hover:no-underline"
              >
                Ver catálogo
              </Link>
            </div>

            <div className="mt-5 divide-y-2 divide-black/20">
              {recommendationsQuery.isLoading && (
                <p className="py-6 text-center text-sm opacity-70">
                  Buscando compatibilidades no CI…
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
                        className="h-12 w-12 rounded-none object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center border-2 border-black font-sans text-lg font-bold">
                        {(senior.socialName ?? senior.handle).charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setProfileModalHandle(senior.handle)}
                          className="font-bold underline hover:no-underline"
                        >
                          {senior.socialName ?? senior.handle}
                        </button>
                        <span className="border-2 border-black px-2 py-0.5 text-[11px] font-bold">
                          {senior.score}%
                        </span>
                      </div>
                      <p className="text-xs opacity-70">
                        @{senior.handle} · Período {senior.semester}
                      </p>
                      {senior.matchReasons && senior.matchReasons.length > 0 && (
                        <p className="mt-1 text-xs opacity-70">✦ {senior.matchReasons[0]}</p>
                      )}
                    </div>
                  </div>
                  <MonoButton onClick={() => setProfileModalHandle(senior.handle)}>
                    Ver perfil
                  </MonoButton>
                </div>
              ))}
              {recommendationsQuery.data?.length === 0 && (
                <p className="py-6 text-center text-sm opacity-70">
                  Ainda não há sugestões. Explore o catálogo completo na Descoberta de Padrinhos!
                </p>
              )}
            </div>
          </PosterCard>
        )}
      </div>

      <MentorProfileModal
        open={profileModalHandle !== null}
        onOpenChange={(open) => !open && setProfileModalHandle(null)}
        seniorHandle={profileModalHandle ?? ''}
      />
    </div>
  );
}
