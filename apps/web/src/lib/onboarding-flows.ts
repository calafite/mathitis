import type { OnboardingFlow } from '@/lib/onboarding-engine';

export const FRESHMAN_FLOW: OnboardingFlow = [
  {
    id: 'freshman-welcome',
    type: 'info_slide',
    title: 'Bem-vindo(a) à Mathitis!',
    description:
      'Você é o primeiro a chegar em muitos lugares por aqui. Vamos te mostrar rapidinho como descobrir padrinhos incríveis e crescer na sua jornada matemática.',
    ctaText: 'BORA COMEÇAR',
  },
  {
    id: 'what-is-discovery',
    type: 'info_slide',
    title: 'O que é a Descoberta?',
    description:
      'A **Descoberta** é o seu radar de padrinhos. Lá você navega por perfis de pessoas veteranas afinadas com seus interesses e impulsiona quem quiser conhecer melhor.',
    ctaText: 'SACANDO',
  },
  {
    id: 'bump-explained',
    type: 'info_slide',
    title: 'Impulsionar (Bump)',
    description:
      'Quando você **impulsiona** alguém, esse perfil aparece no topo da sua Descoberta e a pessoa recebe um aviso de que você está interessada(o). É o seu sinal de "oi, bora conversar?"',
    ctaText: 'ENTENDI',
  },
  {
    id: 'four-bump-limit',
    type: 'info_slide',
    title: 'O limite de 4 impulsos',
    description:
      'Você pode manter no máximo **4 impulsos ativos** por vez. Se já tiver 4 perfis impulsionados, remova um impulso antigo para liberar espaço e impulsionar alguém novo.',
    ctaText: 'FECHADO',
  },
  {
    id: 'freshman-name',
    type: 'profile_input',
    title: 'Como podemos te chamar?',
    description: 'Seu nome social',
    config: { field: 'socialName', required: true, placeholder: 'Ex.: Isa da Silva' },
    ctaText: 'CONTINUAR',
  },
  {
    id: 'freshman-tagline',
    type: 'profile_input',
    title: 'Seu slogan',
    description: 'Uma frase curta que te define (opcional, mas deixa seu perfil mais vivo)',
    config: { field: 'tagline', placeholder: 'Ex.: Fascinada por álgebra linear' },
    ctaText: 'CONTINUAR',
  },
  {
    id: 'freshman-bio',
    type: 'profile_input',
    title: 'Conte um pouco sobre você',
    description: 'Escreva sua biografia em markdown — os padrinhos adoram saber sua trajetória.',
    config: { field: 'biographyMarkdown', multiline: true },
    ctaText: 'PRÓXIMO PASSO',
  },
  {
    id: 'freshman-tags',
    type: 'tag_selector',
    title: 'Quais são seus interesses?',
    description:
      'Escolha ao menos 1 interesse agora. Você pode adicionar mais depois no estúdio de perfil.',
    config: { minTags: 1 },
    ctaText: 'VOU EXPLORAR',
  },
  {
    id: 'freshman-avatar',
    type: 'avatar_upload',
    title: 'Mostre quem você é',
    description: 'Sua foto de perfil',
    config: { required: true },
    ctaText: 'CONTINUAR',
  },
  {
    id: 'freshman-theme',
    type: 'theme_picker',
    title: 'Escolha seu visual',
    description: 'Deixe seu perfil com a sua cara — você pode ajustar tudo depois.',
    ctaText: 'FICOU LINDO',
  },
  {
    id: 'freshman-done',
    type: 'info_slide',
    title: 'Você está pronta(o)!',
    description:
      'Sua base está montada. Agora é só partir para a Descoberta, impulsionar até 4 padrinhos e começar sua jornada. Boa sorte!',
    ctaText: 'COMEÇAR A JORNADA',
  },
];

export const SENIOR_FLOW: OnboardingFlow = [
  {
    id: 'senior-welcome',
    type: 'info_slide',
    title: 'Veterana(o), bem-vindo(a)!',
    description:
      'Como veterana(o), seu perfil é a porta de entrada para quem está chegando. Vamos garantir que ele esteja completo e mostre o melhor de você.',
    ctaText: 'BORA',
  },
  {
    id: 'senior-why-profile',
    type: 'info_slide',
    title: 'Perfil completo = mais visibilidade',
    description:
      'Calouros encontram padrinhos na **Descoberta**. Um perfil com nome social, biografia, interesses e visual marcante aparece com muito mais destaque e atrai quem combina com você.',
    ctaText: 'ENTENDI',
  },
  {
    id: 'senior-name',
    type: 'profile_input',
    title: 'Seu nome social',
    description: 'Como os calouros devem te chamar',
    config: { field: 'socialName', required: true, placeholder: 'Ex.: Carlos Menezes' },
    ctaText: 'CONTINUAR',
  },
  {
    id: 'senior-tagline',
    type: 'profile_input',
    title: 'Seu slogan de padrinho',
    description: 'Uma frase curta que mostre sua área (opcional)',
    config: {
      field: 'tagline',
      placeholder: 'Ex.: Especialista em cálculo e mentoria de calouros',
    },
    ctaText: 'CONTINUAR',
  },
  {
    id: 'senior-bio',
    type: 'profile_input',
    title: 'Compartilhe sua trajetória',
    description: 'Uma boa biografia conquista padrinho antes mesmo do primeiro papo.',
    config: { field: 'biographyMarkdown', multiline: true },
    ctaText: 'PRÓXIMO PASSO',
  },
  {
    id: 'senior-tags',
    type: 'tag_selector',
    title: 'Com o que você ajuda?',
    description: 'Escolha os assuntos que você domina — é assim que os calouros te encontram.',
    config: { minTags: 1 },
    ctaText: 'TÁ BOM',
  },
  {
    id: 'senior-avatar',
    type: 'avatar_upload',
    title: 'Mostre quem você é',
    description: 'Sua foto de perfil',
    config: { required: true },
    ctaText: 'CONTINUAR',
  },
  {
    id: 'senior-theme',
    type: 'theme_picker',
    title: 'Seu visual, sua marca',
    description: 'Deixe seu perfil com a sua cara para se destacar na Descoberta.',
    ctaText: 'FICOU ÓTIMO',
  },
  {
    id: 'senior-done',
    type: 'info_slide',
    title: 'Perfil pronto para mentoria!',
    description:
      'Sua base está montada. Ajuste mais detalhes quando quiser no estúdio de perfil e fique de olho nos pedidos de apadrinhamento.',
    ctaText: 'ABRIR MEU PERFIL',
  },
];
