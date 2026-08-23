import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Compass,
  GitBranch,
  Palette,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Send,
  UserCheck,
  GraduationCap,
  BookOpen,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { discoveryApi } from '@/lib/discovery-api';
import { requestsApi } from '@/lib/requests-api';
import { profileApi } from '@/lib/profile-api';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { Settings, Shield } from 'lucide-react';
import { MentorProfileModal } from '@/components/profile/mentor-profile-modal';

export function HomePage() {
  const { user } = useAuth();
  const isFreshman = user?.role === 'freshman';
  const isSenior = user?.role === 'senior';
  const [profileModalHandle, setProfileModalHandle] = useState<string | null>(null);

  // Fetch quick telemetry for the dashboard
  const profileQuery = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: () => profileApi.getMe().then((r) => r.profile),
    enabled: Boolean(user),
  });

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

  const profile = profileQuery.data;
  const requests = requestsQuery.data ?? [];
  const pendingRequests = requests.filter(
    (r) => r.status === 'pending' || r.status === 'pending_admin_approval',
  );
  const activeMentorships = requests.filter((r) => r.status === 'accepted');

  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-slate-950 text-slate-100">
      {/* --- Ambient Cosmic Gradient Background --- */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.25),rgba(255,255,255,0))]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-fuchsia-500/15 blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute top-1/2 -left-40 h-96 w-96 rounded-full bg-cyan-500/10 blur-[140px]"
        aria-hidden
      />

      {/* --- Constellation / Architectural Dot Grid --- */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-20 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* --- Header with Theme Toggle --- */}
        <header className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="text-lg font-semibold text-foreground">
              Mathitis
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {user?.role === 'administrator' && (
              <Link
                to="/admin"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white"
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
            <Link
              to="/settings"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white"
            >
              <Settings className="h-4 w-4" />
              Configurações
            </Link>
            <ThemeToggle />
          </div>
        </header>

        {/* --- Hero Greeting Banner --- */}
        <section className="relative overflow-hidden rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/60 via-slate-900/80 to-slate-950/90 p-8 shadow-2xl backdrop-blur-xl sm:p-10">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold tracking-wide text-indigo-300">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Linhagem de apadrinhamento acadêmico
                </span>
                <span className="rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-xs font-medium text-slate-300 capitalize">
                  {user?.role} · Período {user?.semester}
                </span>
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Bem-vindo(a),{' '}
                <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                  {user?.socialName ?? user?.handle}
                </span>
              </h1>

              <p className="max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
                {isFreshman
                  ? 'Conecte-se com veteranos, explore suas trajetórias e descubra um guia para iluminar seu caminho acadêmico.'
                  : 'Transmita sua experiência, oriente a próxima geração de alunos e construa um legado duradouro no departamento.'}
              </p>
            </div>

            {/* Standing Status Pill Card */}
            <div className="flex shrink-0 flex-col gap-2.5 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Situação de apadrinhamento
              </div>
              <div className="flex items-center gap-4">
                {isFreshman && (
                  <div>
                    <div className="text-2xl font-bold text-white">
                      {3 - pendingRequests.length}{' '}
                      <span className="text-xs font-normal text-slate-400">/ 3 vagas</span>
                    </div>
                    <div className="text-[11px] text-slate-400">Pedidos abertos</div>
                  </div>
                )}
                {isSenior && (
                  <div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {activeMentorships.length}{' '}
                      <span className="text-xs font-normal text-slate-400">
                        / {profile?.maxMentees ?? 3}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400">Alunos ativos</div>
                  </div>
                )}
                <div className="h-8 w-px bg-white/10" />
                <div>
                  <div className="text-2xl font-bold text-indigo-400">
                    {profile?.effortScore ?? 0}
                    <span className="text-xs font-normal text-slate-400"> pts</span>
                  </div>
                  <div className="text-[11px] text-slate-400">Riqueza do perfil</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- Quick Launchpad Cards --- */}
        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            to="/discovery"
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/50 hover:bg-slate-900 hover:shadow-xl hover:shadow-indigo-500/10"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 transition group-hover:bg-indigo-500 group-hover:text-white">
              <Compass className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-white group-hover:text-indigo-300">
              Descoberta de mentores
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Encontre mentores alinhados com seus interesses e projetos acadêmicos.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-indigo-400 group-hover:translate-x-1 transition-transform">
              Explorar mentores <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>

          <Link
            to="/requests"
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-purple-500/50 hover:bg-slate-900 hover:shadow-xl hover:shadow-purple-500/10"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 transition group-hover:bg-purple-500 group-hover:text-white">
              <Send className="h-5 w-5" />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-white group-hover:text-purple-300">
                Pedidos de apadrinhamento
              </h3>
              {pendingRequests.length > 0 && (
                <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs font-semibold text-purple-300">
                  {pendingRequests.length} pendentes
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Revise as cartas dos candidatos, os objetivos propostos e gerencie as admissões.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-purple-400 group-hover:translate-x-1 transition-transform">
              Ver caixa de entrada <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>

          <Link
            to="/lineage"
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-cyan-500/50 hover:bg-slate-900 hover:shadow-xl hover:shadow-cyan-500/10"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 transition group-hover:bg-cyan-500 group-hover:text-white">
              <GitBranch className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-white group-hover:text-cyan-300">
              Árvore de linhagem
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Explore a ancestralidade acadêmica, as árvores de mentoria e os círculos de colegas entre turmas.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-cyan-400 group-hover:translate-x-1 transition-transform">
              Explorar genealogia <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>

          <Link
            to="/profile/studio"
            className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-pink-500/50 hover:bg-slate-900 hover:shadow-xl hover:shadow-pink-500/10"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400 transition group-hover:bg-pink-500 group-hover:text-white">
              <Palette className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-white group-hover:text-pink-300">
              Estúdio de perfil
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Crie sua história com cartões ricos em mídia, banners personalizados e temas.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-pink-400 group-hover:translate-x-1 transition-transform">
              Personalizar vitrine <ArrowRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </section>

        {/* --- Main Dashboard Sections --- */}
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Left Column: Recommendations / Active Connections */}
          <div className="space-y-6 lg:col-span-2">
            {isFreshman && (
              <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-400" />
                    <h2 className="text-lg font-bold text-white">Mentores sugeridos para você</h2>
                  </div>
                  <Link to="/discovery" className="text-xs font-semibold text-indigo-400 hover:underline">
                    Ver catálogo
                  </Link>
                </div>

                <div className="mt-4 divide-y divide-slate-800/80">
                  {recommendationsQuery.isLoading && (
                    <p className="py-6 text-center text-sm text-slate-500">
                      Buscando mentores compatíveis no departamento…
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
                            className="h-12 w-12 rounded-full object-cover ring-2 ring-indigo-500/20"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-lg font-bold text-indigo-400 ring-2 ring-indigo-500/20">
                            {(senior.socialName ?? senior.handle).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setProfileModalHandle(senior.handle)}
                              className="font-semibold text-white hover:underline focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded"
                            >
                              {senior.socialName ?? senior.handle}
                            </button>
                            <span className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-300">
                              {senior.score}% de compatibilidade
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">
                            @{senior.handle} · Período {senior.semester}
                          </p>
                          {senior.matchReasons && senior.matchReasons.length > 0 && (
                            <p className="mt-1 text-xs text-slate-500">
                              ✦ {senior.matchReasons[0]}
                            </p>
                          )}
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-slate-700 sm:w-auto"
                        onClick={() => setProfileModalHandle(senior.handle)}
                      >
                        Ver perfil
                      </Button>
                    </div>
                  ))}
                  {recommendationsQuery.data?.length === 0 && (
                    <p className="py-6 text-center text-sm text-slate-500">
                      Nenhum mentor encontrado ainda. Explore o catálogo completo na Descoberta!
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Active Relationships Card */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">
                    {isFreshman ? 'Seu mentor veterano' : 'Alunos conectados'}
                  </h2>
                </div>
                <Link to="/requests" className="text-xs font-semibold text-indigo-400 hover:underline">
                  Gerenciar
                </Link>
              </div>

              <div className="mt-4">
                {activeMentorships.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {activeMentorships.map((req) => {
                      const counterpart = isFreshman ? req.senior : req.freshman;
                      return (
                        <div
                          key={req.id}
                          className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-3.5"
                        >
                          <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">
                              {counterpart?.socialName ?? counterpart?.handle}
                            </p>
                            <p className="text-xs text-slate-400">
                              @{counterpart?.handle} · Período {counterpart?.semester}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-800 py-8 text-center">
                    <p className="text-sm text-slate-500">
                      {isFreshman
                        ? 'Você ainda não se conectou com um mentor nesta turma.'
                        : 'Nenhum aluno ativo confirmado para este período.'}
                    </p>
                    <Link to={isFreshman ? '/discovery' : '/requests'}>
                      <Button size="sm" className="mt-3">
                        {isFreshman ? 'Encontrar um mentor' : 'Revisar pedidos recebidos'}
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column: Platform Lore & Quick Activity */}
          <div className="space-y-6">
            {/* Quick Status / Application Tracker */}
            <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur-md">
              <h2 className="text-sm font-bold tracking-wider text-slate-300 uppercase">
                Atividade e pedidos
              </h2>

              <div className="mt-4 space-y-3">
                {pendingRequests.slice(0, 3).map((req) => (
                  <div key={req.id} className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <Clock className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-white">
                        {isFreshman ? `Para @${req.senior?.handle}` : `De @${req.freshman?.handle}`}
                      </p>
                      <p className="line-clamp-1 text-[11px] text-slate-400">{req.message}</p>
                    </div>
                    <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                      Pendente
                    </span>
                  </div>
                ))}

                {pendingRequests.length === 0 && (
                  <p className="py-4 text-center text-xs text-slate-500">
                    Nenhum pedido em análise no momento.
                  </p>
                )}
              </div>
            </section>

            {/* Lineage Philosophy Banner */}
            <section className="relative overflow-hidden rounded-2xl border border-indigo-500/20 bg-gradient-to-br from-indigo-900/30 to-purple-900/20 p-6">
              <BookOpen className="absolute -bottom-2 -right-2 h-20 w-20 text-indigo-500/10" />
              <h3 className="text-sm font-bold text-indigo-300">O espírito do Mathitis</h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                A mentoria aqui não é um bilhete temporário — é um vínculo permanente de conhecimento compartilhado. Cada conexão constrói a nossa duradoura árvore de família do departamento.
              </p>
              <Link to="/lineage" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300">
                Ver genealogia acadêmica <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </section>
          </div>
        </div>
      </div>
      <MentorProfileModal
        open={profileModalHandle !== null}
        onOpenChange={(open) => !open && setProfileModalHandle(null)}
        seniorHandle={profileModalHandle ?? ''}
      />
    </div>
  );
}
