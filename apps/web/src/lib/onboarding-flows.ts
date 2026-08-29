import type { OnboardingFlow } from '@/lib/onboarding-engine';

export const FRESHMAN_FLOW: OnboardingFlow = [
  {
    id: 'freshman-welcome',
    type: 'info_slide',
    title: 'Configure seu perfil',
    description:
      'Preencha algumas informações para encontrar veteranos com interesses parecidos e receber pedidos de mentoria.',
    ctaText: 'CONTINUAR',
  },
  {
    id: 'what-is-discovery',
    type: 'info_slide',
    title: 'O que é a Descoberta?',
    description:
      'Na Descoberta, você encontra perfis de pessoas veteranas e pode filtrá-los por interesse.',
    ctaText: 'CONTINUAR',
  },
  {
    id: 'bump-explained',
    type: 'info_slide',
    title: 'Impulsionar (Bump)',
    description:
      'Ao impulsionar um perfil, ele fica no topo da sua Descoberta e a outra pessoa recebe uma notificação. Você pode manter até 4 impulsos ativos.',
    ctaText: 'CONTINUAR',
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
    id: 'freshman-bio',
    type: 'profile_input',
    title: 'Conte um pouco sobre você',
    description: 'Escreva uma breve biografia. Você poderá atualizá-la depois no seu perfil.',
    config: { field: 'biographyMarkdown', multiline: true },
    ctaText: 'CONTINUAR',
  },
  {
    id: 'freshman-tags',
    type: 'tag_selector',
    title: 'Quais são seus interesses?',
    description:
      'Selecione pelo menos um interesse. Você poderá adicionar outros depois no estúdio de perfil.',
    config: { minTags: 1 },
    ctaText: 'CONTINUAR',
  },
  {
    id: 'freshman-avatar',
    type: 'avatar_upload',
    title: 'Adicione uma foto',
    description: 'Sua foto de perfil',
    config: { required: true },
    ctaText: 'CONTINUAR',
  },
  {
    id: 'freshman-theme',
    type: 'theme_picker',
    title: 'Escolha seu visual',
    description: 'Escolha as cores do seu perfil. Você poderá alterá-las depois.',
    ctaText: 'CONTINUAR',
  },
  {
    id: 'freshman-done',
    type: 'info_slide',
    title: 'Perfil configurado',
    description:
      'Seu perfil está pronto. Acesse a Descoberta para conhecer veteranos e enviar um impulso quando quiser.',
    ctaText: 'IR PARA A DESCOBERTA',
  },
];

export const SENIOR_FLOW: OnboardingFlow = [
  {
    id: 'senior-welcome',
    type: 'info_slide',
    title: 'Configure seu perfil de mentoria',
    description:
      'Preencha suas informações para que estudantes encontrem você na Descoberta e entendam como você pode ajudar.',
    ctaText: 'CONTINUAR',
  },
  {
    id: 'senior-why-profile',
    type: 'info_slide',
    title: 'Como você aparece na Descoberta',
    description:
      'Estudantes encontram mentores na Descoberta. Nome, biografia, interesses e foto ajudam a explicar sua experiência.',
    ctaText: 'CONTINUAR',
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
    id: 'senior-bio',
    type: 'profile_input',
    title: 'Compartilhe sua trajetória',
    description:
      'Escreva uma breve biografia com sua experiência e os assuntos em que pode ajudar.',
    config: { field: 'biographyMarkdown', multiline: true },
    ctaText: 'CONTINUAR',
  },
  {
    id: 'senior-tags',
    type: 'tag_selector',
    title: 'Com o que você ajuda?',
    description: 'Selecione os assuntos em que você pode orientar estudantes.',
    config: { minTags: 1 },
    ctaText: 'CONTINUAR',
  },
  {
    id: 'senior-avatar',
    type: 'avatar_upload',
    title: 'Adicione uma foto',
    description: 'Sua foto de perfil',
    config: { required: true },
    ctaText: 'CONTINUAR',
  },
  {
    id: 'senior-theme',
    type: 'theme_picker',
    title: 'Escolha seu visual',
    description: 'Escolha as cores do seu perfil. Você poderá alterá-las depois.',
    ctaText: 'CONTINUAR',
  },
  {
    id: 'senior-done',
    type: 'info_slide',
    title: 'Perfil configurado',
    description:
      'Seu perfil está pronto. Ajuste mais detalhes quando quiser no estúdio de perfil e acompanhe os pedidos de mentoria.',
    ctaText: 'ABRIR MEU PERFIL',
  },
];
