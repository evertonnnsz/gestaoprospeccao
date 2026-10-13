// Itens do checklist manual de otimização do Perfil da Empresa no Google.
// Os ids são gravados no banco (gbp_checklists.items): não renomeie um id existente.

export type ChecklistEntry = { done_at: string; note?: string };
export type ChecklistState = Record<string, ChecklistEntry>;

export type ChecklistItemDef = {
  id: string;
  title: string;
  why: string;
  how: string;
  // Atalho para uma ferramenta do CRM que ajuda no item.
  tool?: { label: string; path: string };
};

export type ChecklistSection = { id: string; title: string; items: ChecklistItemDef[] };

export const CHECKLIST_SECTIONS: ChecklistSection[] = [
  {
    id: 'basico',
    title: 'Informações básicas',
    items: [
      {
        id: 'nome',
        title: 'Nome igual ao da fachada',
        why: 'Palavras-chave extras no nome violam as diretrizes do Google e podem suspender o perfil.',
        how: 'Use exatamente o nome usado na fachada, no site e nas redes sociais, sem cidade ou serviço junto.',
      },
      {
        id: 'endereco',
        title: 'Endereço completo e PIN no lugar certo',
        why: 'O endereço define em quais buscas da região o perfil aparece e leva o cliente até a porta.',
        how: 'Confira rua, número, complemento e CEP, e arraste o PIN no mapa até a entrada. Quem atende só no cliente deve ocultar o endereço e usar área de atendimento.',
      },
      {
        id: 'telefone',
        title: 'Telefone principal com DDD',
        why: 'Ligar direto da busca é uma das ações que mais geram clientes.',
        how: 'Cadastre um número que sempre atenda (de preferência com WhatsApp). Use o mesmo número do site.',
      },
      {
        id: 'site',
        title: 'Site com link rastreável',
        why: 'O clique no site leva visitas qualificadas e, com UTM, você mede quantas vêm do Google.',
        how: 'Use o link do site com UTM, ex.: ?utm_source=google&utm_medium=organic&utm_campaign=gbp.',
      },
      {
        id: 'horario',
        title: 'Horário de funcionamento completo',
        why: 'Perfis sem horário perdem cliques e geram visitas com a porta fechada.',
        how: 'Preencha todos os dias, inclusive os fechados, e confira o horário de almoço se houver.',
      },
      {
        id: 'horario_especial',
        title: 'Horários especiais de feriados',
        why: 'O Google pede confirmação em feriados; perfis atualizados transmitem confiança.',
        how: 'Antes de cada feriado, cadastre o horário especial (ou marque como fechado).',
      },
      {
        id: 'descricao',
        title: 'Descrição completa (até 750 caracteres)',
        why: 'Explica o que a empresa faz e reforça as palavras-chave do segmento.',
        how: 'Fale dos serviços, diferenciais e região atendida, com palavras-chave de forma natural. Sem links, telefones ou promoções.',
      },
      {
        id: 'links_acao',
        title: 'Links de agendamento, pedido ou cardápio',
        why: 'Botões de ação reduzem atrito: o cliente agenda ou compra sem sair do Google.',
        how: 'Adicione os links que fizerem sentido para o negócio (agenda online, delivery, cardápio).',
      },
      {
        id: 'data_abertura',
        title: 'Data de abertura',
        why: 'Mostra tempo de mercado e completa as informações do perfil.',
        how: 'Informe o mês e o ano de abertura da empresa.',
      },
    ],
  },
  {
    id: 'categorias',
    title: 'Categorias, serviços e produtos',
    items: [
      {
        id: 'cat_principal',
        title: 'Categoria principal mais específica',
        why: 'A categoria principal é o fator que mais pesa no ranqueamento local.',
        how: 'Escolha a categoria mais específica do negócio, conferindo a que os concorrentes mais fortes usam.',
        tool: { label: 'Pesquisa de categorias', path: '/categorias' },
      },
      {
        id: 'cat_adicionais',
        title: 'Categorias adicionais relevantes',
        why: 'Fazem o perfil aparecer em mais buscas relacionadas.',
        how: 'Adicione as categorias que descrevem outros serviços reais da empresa (até 9).',
        tool: { label: 'Pesquisa de categorias', path: '/categorias' },
      },
      {
        id: 'servicos',
        title: 'Serviços cadastrados com descrição',
        why: 'Serviços com descrição ajudam o Google a entender o negócio e aparecem no perfil.',
        how: 'Cadastre cada serviço com uma descrição curta e, se fizer sentido, o preço.',
      },
      {
        id: 'produtos',
        title: 'Produtos ou destaques com foto',
        why: 'Produtos aparecem em destaque no perfil e no celular.',
        how: 'Cadastre os principais produtos/serviços com foto, preço ou faixa de preço e link.',
      },
      {
        id: 'atributos',
        title: 'Atributos marcados',
        why: 'Atributos (acessibilidade, Wi-Fi, formas de pagamento) fazem o perfil aparecer em buscas específicas.',
        how: 'Marque todos os atributos que se aplicam ao negócio.',
      },
      {
        id: 'area_atendimento',
        title: 'Área de atendimento',
        why: 'Para quem atende fora do endereço, define as cidades e bairros em que o perfil aparece.',
        how: 'Liste as cidades/bairros atendidos. Se o negócio só atende no local, marque como concluído.',
      },
    ],
  },
  {
    id: 'fotos',
    title: 'Fotos e vídeos',
    items: [
      {
        id: 'logo',
        title: 'Logo',
        why: 'Ajuda o cliente a reconhecer a marca nos resultados.',
        how: 'Envie o logo em boa resolução, quadrado.',
      },
      {
        id: 'capa',
        title: 'Foto de capa',
        why: 'É a primeira imagem que o cliente vê no perfil.',
        how: 'Use uma foto bonita e atual que represente o negócio.',
      },
      {
        id: 'fotos_fachada',
        title: 'Fotos da fachada e do interior',
        why: 'Ajudam o cliente a encontrar o local e passam confiança.',
        how: 'Envie fotos da fachada (de dia), da entrada e do ambiente interno.',
      },
      {
        id: 'fotos_equipe',
        title: 'Fotos da equipe trabalhando',
        why: 'Humanizam a marca e aumentam a confiança.',
        how: 'Fotos reais da equipe atendendo, sem banco de imagens.',
      },
      {
        id: 'fotos_servicos',
        title: 'Fotos dos produtos e serviços',
        why: 'Mostram o resultado e influenciam a decisão de compra.',
        how: 'Envie fotos dos principais serviços/produtos, de preferência antes e depois quando fizer sentido.',
      },
      {
        id: 'videos',
        title: 'Pelo menos 1 vídeo curto',
        why: 'Vídeos aumentam o tempo no perfil e se destacam entre as fotos.',
        how: 'Vídeo de 10 a 30 segundos mostrando o ambiente ou um serviço.',
      },
      {
        id: 'fotos_rotina',
        title: 'Rotina de fotos novas todo mês',
        why: 'Perfis com fotos recentes mostram ao Google que o negócio está ativo.',
        how: 'Combine com o cliente o envio de 3 a 5 fotos novas por mês.',
      },
    ],
  },
  {
    id: 'avaliacoes',
    title: 'Avaliações',
    items: [
      {
        id: 'link_avaliacao',
        title: 'Cartão e link de avaliação entregues',
        why: 'Facilitar o caminho até a avaliação aumenta muito o volume de avaliações.',
        how: 'Gere o cartão com QR Code para o balcão e o link para enviar no WhatsApp após o atendimento.',
        tool: { label: 'Cartões de avaliação', path: '/cartoes-avaliacao' },
      },
      {
        id: 'rotina_avaliacoes',
        title: 'Rotina para pedir avaliações',
        why: 'Volume e frequência de avaliações são sinais de relevância do Google.',
        how: 'Defina quem pede e quando (ex.: mensagem no WhatsApp no dia seguinte ao atendimento).',
      },
      {
        id: 'responder_todas',
        title: 'Responder todas as avaliações',
        why: 'Responder melhora a reputação e é um sinal positivo para o Google.',
        how: 'Responda todas em até 48 horas, personalizando com o nome do cliente.',
      },
      {
        id: 'responder_negativas',
        title: 'Responder as negativas com cuidado',
        why: 'Quem está decidindo lê como a empresa reage às críticas.',
        how: 'Agradeça, peça desculpas pelo ocorrido e ofereça um canal para resolver, sem discutir.',
      },
    ],
  },
  {
    id: 'postagens',
    title: 'Postagens',
    items: [
      {
        id: 'postagens_semanais',
        title: 'Postagem toda semana',
        why: 'Postagens frequentes mantêm o perfil ativo e destacam novidades.',
        how: 'Publique ao menos 1 postagem por semana com foto, texto curto e palavras-chave.',
      },
      {
        id: 'postagens_cta',
        title: 'Postagens com botão de ação',
        why: 'O botão (Ligar, Saiba mais, Reservar) transforma a postagem em contato.',
        how: 'Use sempre um botão de ação nas postagens.',
      },
      {
        id: 'ofertas',
        title: 'Ofertas e eventos sazonais',
        why: 'Ofertas aparecem com destaque e aproveitam datas comemorativas.',
        how: 'Crie postagens de oferta/evento nas datas importantes do segmento.',
      },
    ],
  },
  {
    id: 'manutencao',
    title: 'Segurança e manutenção',
    items: [
      {
        id: 'verificado',
        title: 'Perfil verificado e em dia',
        why: 'Sem verificação o perfil perde alcance e pode ser suspenso.',
        how: 'Confirme que o perfil está verificado e atenda às revalidações que o Google pedir.',
      },
      {
        id: 'acessos',
        title: 'Acessos organizados',
        why: 'O dono precisa ser o proprietário principal; a agência entra como administradora.',
        how: 'Confira os usuários em Configurações do perfil e remova acessos antigos.',
      },
      {
        id: 'revisar_edicoes',
        title: 'Revisar edições sugeridas por terceiros',
        why: 'Qualquer pessoa pode sugerir mudanças, e o Google às vezes aplica sem avisar.',
        how: 'Uma vez por mês, confira se nome, horário, telefone e categorias continuam corretos.',
      },
      {
        id: 'nap_consistente',
        title: 'Nome, endereço e telefone iguais em todo lugar',
        why: 'Informações iguais no site, redes e diretórios reforçam a confiança do Google.',
        how: 'Compare o perfil com o site, Instagram, Facebook e diretórios e corrija divergências.',
      },
      {
        id: 'metricas',
        title: 'Acompanhar as métricas todo mês',
        why: 'Ligações, rotas e cliques mostram o resultado do trabalho para o cliente.',
        how: 'Registre mensalmente as métricas do perfil e compare com o mês anterior.',
      },
    ],
  },
];

export const ALL_ITEMS = CHECKLIST_SECTIONS.flatMap((s) => s.items);

export function checklistProgress(state: ChecklistState) {
  const done = ALL_ITEMS.filter((i) => state[i.id]?.done_at).length;
  return {
    done,
    total: ALL_ITEMS.length,
    percent: Math.round((done / ALL_ITEMS.length) * 100),
    sections: CHECKLIST_SECTIONS.map((s) => {
      const sectionDone = s.items.filter((i) => state[i.id]?.done_at).length;
      return { id: s.id, title: s.title, done: sectionDone, total: s.items.length };
    }),
  };
}
