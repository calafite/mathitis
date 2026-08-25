import { Link } from 'react-router-dom';
import { usePageMeta } from '@/lib/use-page-meta';

export function PrivacyPage() {
  usePageMeta(
    'Política de Privacidade',
    'Como o Mathitis coleta, usa e protege os dados pessoais dos estudantes, em conformidade com a LGPD.',
  );

  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header className="space-y-2">
        <h1 className="font-display text-4xl font-semibold">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground">
          Última atualização: agosto de 2026 · Plataforma de apadrinhamento acadêmico..
        </p>
      </header>

      <section className="space-y-3 text-sm leading-relaxed text-foreground/90">
        <h2 className="font-display text-xl font-semibold">1. Dados que coletamos</h2>
        <p>
          Coletamos os dados fornecidos no cadastro (nome de usuário, e-mail universitário,
          período), o conteúdo que você publica no seu perfil (nome social, pronomes, biografia,
          links de contato opcionais, cartões de vitrine e imagens de avatar/banner) e os
          registros necessários à operação do programa (pedidos de apadrinhamento, impulsos e
          vínculos de mentoria).
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-foreground/90">
        <h2 className="font-display text-xl font-semibold">2. Como usamos</h2>
        <p>
          Os dados são usados exclusivamente para operar a plataforma: exibir perfis na{' '}
          <em>Descoberta de Padrinhos</em>, calcular recomendações de compatibilidade, gerenciar
          pedidos de apadrinhamento e preservar a árvore de linhagem do CI. Não
          vendemos nem compartilhamos dados pessoais com terceiros.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-foreground/90">
        <h2 className="font-display text-xl font-semibold">3. Contato é opcional</h2>
        <p>
          Informações de contato direto (e-mail pessoal, Discord, GitHub, LinkedIn) só aparecem
          publicamente se você as adicionar ao seu perfil. Perfis de calouros ficam ocultos do
          catálogo por padrão e só são revelados ao veterano escolhido quando um pedido de
          apadrinhamento é enviado.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-foreground/90">
        <h2 className="font-display text-xl font-semibold">4. Vínculos permanentes</h2>
        <p>
          Por design, vínculos de apadrinhamento são permanentes: mesmo se você desativar sua
          conta, um nó anonimizado permanece na árvore de linhagem para manter a genealogia
          acadêmica íntegra. Nenhum conteúdo seu é mantido além desse registro estrutural.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-foreground/90">
        <h2 className="font-display text-xl font-semibold">5. Seus direitos (LGPD)</h2>
        <p>
          Você pode solicitar a qualquer momento: acesso aos seus dados, correção, portabilidade
          (exportação completa em JSON em <em>Configurações → Dados e Linhagem</em>) e a
          anonimização da sua conta (Zona de Risco). Requisições podem ser feitas diretamente na
          plataforma ou com o encarregado do tratamento (DPO) do programa.
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-foreground/90">
        <h2 className="font-display text-xl font-semibold">6. Segurança</h2>
        <p>
          Senhas são armazenadas com Argon2id, sessões usam cookies assinados e inacessíveis ao
          JavaScript, todo o tráfego é criptografado (TLS 1.3) e acessos administrativos são
          registrados em logs de auditoria imutáveis.
        </p>
      </section>

      <p className="text-sm text-muted-foreground">
        Dúvidas sobre esta política? Fale com a administração pelo canal oficial do programa.
      </p>

      <Link to="/" className="inline-block text-sm font-semibold text-primary hover:underline">
        ← Voltar ao início
      </Link>
    </article>
  );
}
