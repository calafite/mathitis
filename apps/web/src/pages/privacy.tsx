import { Link } from 'react-router-dom';
import { usePageMeta } from '@/lib/use-page-meta';

export function PrivacyPage() {
  usePageMeta(
    'Política de Privacidade',
    'Como o Mathitis coleta, usa e protege os dados pessoais dos estudantes, em estrita conformidade com a LGPD.',
  );

  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-12">
      <header className="space-y-2 border-b-2 border-foreground/20 pb-6">
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight">
          Política de Privacidade
        </h1>
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Última atualização: Agosto de 2026 · Versão 2.0 · Plataforma Mathitis
        </p>
      </header>

      <div className="space-y-10 text-justify font-sans text-sm leading-relaxed text-foreground/90">
        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold uppercase text-foreground">
            1. Nosso Compromisso
          </h2>
          <p>
            O Mathitis leva a sua privacidade a sério. Esta política explica como coletamos, usamos,
            armazenamos, compartilhamos e eliminamos seus dados pessoais, em conformidade com a Lei
            Geral de Proteção de Dados (LGPD, Lei nº 13.709/2018) e o Marco Civil da Internet (Lei
            nº 12.965/2014). O uso da plataforma pressupõe ciência das práticas descritas neste
            documento. Se você não concordar com algum ponto, não utilize a plataforma e entre em
            contato com o encarregado (seção 13) para esclarecimentos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold uppercase text-foreground">
            2. Quem é o Controlador dos Dados
          </h2>
          <p>
            Para os fins da LGPD (Art. 5º, VI), o controlador dos dados tratados nesta plataforma é
            o Centro Acadêmico do Bacharelado em Ciência da Computação (CACIC), da Universidade
            Federal da Paraíba (UFPB), responsável pelas decisões sobre o tratamento de dados
            pessoais. Os canais de contato do controlador e do encarregado de proteção de dados
            (DPO) estão na seção 13.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold uppercase text-foreground">
            3. Quais Dados Coletamos
          </h2>
          <p>
            Coletamos dados cadastrais obrigatórios: nome de usuário (handle), e-mail, senha
            armazenada apenas como hash e período acadêmico. Coletamos também dados de perfil
            voluntários: nome social, pronomes, biografia, links de contato (Discord, GitHub,
            LinkedIn), cartões de vitrine (livros, jogos, músicas), imagens de avatar e banner e
            preferências da conta. O fornecimento desses dados é opcional e pode ser alterado ou
            removido nas áreas correspondentes da plataforma.
          </p>
          <p>
            Registramos ainda dados de interação, como pedidos de apadrinhamento, aceites, recusas e
            impulsos (bumps) e visualizações de perfil gerados por você, além de dados técnicos de
            acesso que podem incluir endereço IP e data e hora da requisição. A retenção desses
            registros depende da infraestrutura de hospedagem e das obrigações legais aplicáveis.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold uppercase text-foreground">
            4. Finalidade e Bases Legais
          </h2>
          <p>
            Tratamos seus dados apenas para propósitos específicos, amparados pela LGPD. Usamos a
            execução de contrato (Art. 7º, V) para operar a plataforma, viabilizar o envio e o
            aceite de pedidos de apadrinhamento e disponibilizar as funcionalidades essenciais do
            serviço e tratar os dados de perfil fornecidos por você conforme suas escolhas de
            visibilidade. Usamos o legítimo interesse (Art. 7º, IX) para calcular o Match Score,
            recomendar padrinhos compatíveis e gerar estatísticas internas de uso, sempre de forma
            proporcional e sem prejudicar seus direitos e liberdades fundamentais; você pode se opor
            a esse tratamento a qualquer momento (seção 8). Usamos a obrigação legal (Art. 7º, II),
            quando aplicável, para atender a determinações de autoridade competente e incidentes de
            segurança.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold uppercase text-foreground">
            5. Prazo de Retenção e Descarte
          </h2>
          <p>
            Não mantemos dados pessoais por prazo indeterminado. Dados cadastrais e de perfil ficam
            retidos enquanto sua conta estiver ativa e, quando você solicita a anonimização, os
            dados de perfil são removidos ou anonimizados durante o processamento da solicitação,
            ressalvadas as hipóteses do Art. 16 da LGPD. Registros técnicos e de acesso, quando
            mantidos pela infraestrutura, seguem os prazos operacionais e legais aplicáveis. Dados
            retidos para cumprimento de obrigação legal ou defesa em processo judicial,
            administrativo ou arbitral (Art. 16, I e II) são conservados apenas pelo tempo
            estritamente necessário a essa finalidade.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold uppercase text-foreground">
            6. Privacidade por Design
          </h2>
          <p>
            A plataforma foi construída com a privacidade como configuração padrão. Perfis de
            calouros ficam ocultos por padrão e só são revelados a um veterano específico quando um
            pedido de apadrinhamento é enviado. As informações de contato direto e as imagens de
            perfil são opcionais e controladas por você a qualquer momento.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold uppercase text-foreground">
            7. A Árvore de Linhagem e a Anonimização
          </h2>
          <p>
            Os vínculos de apadrinhamento formam a árvore genealógica do departamento. Por design
            estrutural, essas conexões são permanentes, refletindo um histórico acadêmico coletivo e
            não apenas um dado individual.
          </p>
          <p>
            Caso você solicite a exclusão da sua conta pela zona de risco, aplicamos a anonimização,
            nos termos do Art. 12 da LGPD. Seus dados pessoais diretos (e-mail, nome, bio, links,
            imagens) são removidos ou substituídos por valores técnicos, e seu handle é substituído
            por um identificador irreversível, gerado de forma que não seja possível, por meios
            técnicos razoáveis disponíveis no momento do tratamento, associá-lo a você. A partir da
            anonimização, o nó da árvore deixa de ser considerado dado pessoal para os fins da LGPD
            (Art. 12, §1º), permanecendo apenas como registro estrutural do histórico acadêmico da
            comunidade.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold uppercase text-foreground">
            8. Seus Direitos como Titular
          </h2>
          <p>
            Pelo menu de configurações da plataforma, ou mediante contato com o encarregado (seção
            13), você pode exercer os direitos previstos no Art. 18 da LGPD, de forma gratuita. Você
            pode confirmar a existência de tratamento e acessar todos os dados associados à sua
            conta; retificar dados incompletos, inexatos ou desatualizados; solicitar a
            anonimização, o bloqueio ou a eliminação de dados desnecessários, excessivos ou tratados
            em desconformidade com a LGPD; exportar um arquivo estruturado em JSON com os dados,
            histórico e linhagem disponíveis; solicitar a eliminação dos dados de perfil voluntários
            fornecidos por você; e obter informação sobre as entidades públicas e privadas com as
            quais realizamos uso compartilhado de dados (seção 9).
          </p>
          <p>
            Você também pode se opor a tratamentos baseados em legítimo interesse, inclusive quanto
            ao cálculo do Match Score; e a solicitar a revisão, por pessoa natural, de recomendações
            de Match Score geradas de forma automatizada que afetem seus interesses, com informações
            claras sobre os critérios e procedimentos utilizados, resguardado o segredo comercial
            (Art. 20). Por fim, você pode apresentar reclamação sobre o tratamento de seus dados à
            Autoridade Nacional de Proteção de Dados (ANPD), sem prejuízo do exercício direto dos
            direitos acima.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold uppercase text-foreground">
            9. Compartilhamento de Dados e Transferência Internacional
          </h2>
          <p>
            Não vendemos, alugamos ou monetizamos seus dados pessoais. O compartilhamento ocorre
            apenas com operadores de infraestrutura técnica, como provedores de banco de dados,
            armazenamento de imagens, envio de e-mails e monitoramento de erros, quando
            configurados, estritamente necessários para manter a plataforma em funcionamento, ou
            mediante requisição de autoridade judicial ou administrativa competente.
          </p>
          <p>
            Caso algum desses operadores mantenha servidores fora do território nacional, a
            transferência internacional de dados observará uma das hipóteses do Art. 33 da LGPD,
            como cláusulas contratuais específicas, cláusulas-padrão contratuais ou garantias de
            proteção equivalentes exigidas pela ANPD, garantindo grau de proteção adequado aos seus
            dados.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold uppercase text-foreground">
            10. Segurança da Informação e Resposta a Incidentes
          </h2>
          <p>
            Adotamos padrões de segurança ofensiva e defensiva: senhas são armazenadas apenas como
            hash usando o algoritmo Argon2id, sessões são mantidas por cookies HttpOnly,
            inacessíveis a scripts maliciosos, todo o tráfego é forçado em TLS 1.3, imagens passam
            por sanitização server side para remoção de metadados EXIF e GPS, e ações
            administrativas geram registros de auditoria.
          </p>
          <p>
            Em caso de incidente de segurança que possa causar risco ou dano relevante aos
            titulares, comunicaremos o ocorrido à ANPD e aos titulares afetados em prazo razoável,
            conforme o Art. 48 da LGPD, informando a natureza dos dados afetados, as medidas de
            segurança adotadas e as providências tomadas para reverter ou mitigar os efeitos do
            incidente.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold uppercase text-foreground">
            11. Idade Mínima de Uso
          </h2>
          <p>
            O Mathitis é destinado a estudantes regularmente matriculados na instituição e não é
            direcionado a crianças. O cadastro pressupõe capacidade civil ou, quando aplicável,
            autorização de responsável legal, nos termos do Art. 14 da LGPD. Se identificarmos conta
            de titular menor de idade cadastrada sem a devida autorização, podemos suspendê-la até a
            regularização.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-xl font-bold uppercase text-foreground">
            12. Alterações a Esta Política
          </h2>
          <p>
            Esta política pode ser atualizada periodicamente para refletir mudanças legais, técnicas
            ou operacionais. Alterações materiais serão comunicadas com antecedência razoável, por
            aviso na plataforma ou por e-mail, indicando a data de vigência da nova versão. O uso
            continuado da plataforma após essa data constitui ciência das alterações.
          </p>
        </section>

        <section className="space-y-3 border-t-2 border-foreground/20 pt-6">
          <h2 className="font-display text-xl font-bold uppercase text-foreground">
            13. Fale com o Encarregado (DPO) e com a ANPD
          </h2>
          <p>
            Para exercer seus direitos, tirar dúvidas sobre o tratamento de dados ou relatar um
            possível incidente de segurança, contate nosso encarregado de proteção de dados (DPO)
            pelo e-mail walter.linhares@academico.ufpb.br. Caso não obtenha resposta satisfatória,
            você também pode registrar reclamação diretamente junto à Autoridade Nacional de
            Proteção de Dados (ANPD), pelo site gov.br/anpd.
          </p>
        </section>
      </div>

      <div className="mt-10">
        <Link
          to="/"
          className="inline-block border-2 border-foreground bg-foreground px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-background transition-transform hover:-translate-y-0.5"
        >
          ← Voltar ao Início
        </Link>
      </div>
    </article>
  );
}
