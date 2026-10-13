import { Link } from 'react-router-dom';
import { Target } from 'lucide-react';

// Páginas públicas (sem login) exigidas pelo Google para a tela de consentimento OAuth.
const COMPANY = 'Fature Marketing';
const CONTACT_EMAIL = 'faturemarketing2022@gmail.com';
const SITE = 'https://trafegopagoemrecife.com.br/';
const UPDATED_AT = '13 de outubro de 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyContent() {
  return (
    <>
      <Section title="1. Quem somos">
        <p>
          Este sistema (CRM) é de uso interno da {COMPANY}, agência de marketing digital em Recife/PE ({SITE}). Ele é
          usado pela equipe da agência para gerenciar leads, clientes e os perfis digitais dos clientes.
        </p>
      </Section>
      <Section title="2. Dados de usuários do Google que acessamos">
        <p>Quando um usuário conecta a própria Conta Google ao CRM, solicitamos apenas as permissões necessárias:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>
            <strong>Google Agenda</strong> (calendar.events): criar e atualizar os eventos de reuniões agendadas no CRM.
          </li>
          <li>
            <strong>Perfil da Empresa no Google</strong> (business.manage): ler as informações, métricas de desempenho,
            avaliações e postagens dos perfis que o usuário gerencia, responder avaliações e publicar postagens quando o
            usuário solicitar.
          </li>
        </ul>
      </Section>
      <Section title="3. Como usamos esses dados">
        <p>
          Os dados são usados exclusivamente para exibir informações e executar ações solicitadas pelo próprio usuário
          dentro do CRM, como relatórios de desempenho dos perfis dos clientes da agência. Não vendemos, alugamos nem
          compartilhamos esses dados com terceiros, e não os usamos para publicidade.
        </p>
        <p>
          O uso e a transferência de informações recebidas das APIs do Google seguem a{' '}
          <a
            className="underline"
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
          >
            Política de Dados do Usuário dos Serviços de API do Google
          </a>
          , incluindo os requisitos de Uso Limitado.
        </p>
      </Section>
      <Section title="4. Armazenamento e segurança">
        <p>
          Os dados ficam armazenados em banco de dados com acesso restrito por usuário autenticado (Supabase), com
          comunicação criptografada (HTTPS). Os tokens de acesso do Google ficam guardados apenas no servidor e nunca são
          expostos no navegador.
        </p>
      </Section>
      <Section title="5. Revogação e exclusão">
        <p>
          O usuário pode desconectar o CRM da sua Conta Google a qualquer momento em{' '}
          <a className="underline" href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">
            myaccount.google.com/permissions
          </a>
          . Para pedir a exclusão dos dados armazenados, basta enviar um e-mail para {CONTACT_EMAIL}; a exclusão é feita
          em até 30 dias.
        </p>
      </Section>
      <Section title="6. Contato">
        <p>
          Dúvidas sobre esta política: {CONTACT_EMAIL}. Esta política pode ser atualizada; a data da última atualização
          aparece no topo da página.
        </p>
      </Section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <Section title="1. Uso do sistema">
        <p>
          Este CRM é uma ferramenta de uso interno da {COMPANY} ({SITE}). O acesso é restrito a usuários aprovados pela
          agência, que se comprometem a usá-lo apenas para as atividades da agência e de seus clientes.
        </p>
      </Section>
      <Section title="2. Integrações com o Google">
        <p>
          Ao conectar uma Conta Google, o usuário autoriza o CRM a acessar os dados descritos na{' '}
          <Link className="underline" to="/privacidade">
            Política de Privacidade
          </Link>{' '}
          e declara ter permissão para gerenciar os perfis e agendas conectados. A conexão pode ser removida a qualquer
          momento.
        </p>
      </Section>
      <Section title="3. Responsabilidades">
        <p>
          O usuário é responsável pelas ações que executar no sistema, como respostas a avaliações e postagens. A agência
          mantém o sistema com cuidado, mas não garante disponibilidade ininterrupta.
        </p>
      </Section>
      <Section title="4. Contato">
        <p>Dúvidas sobre estes termos: {CONTACT_EMAIL}.</p>
      </Section>
    </>
  );
}

export default function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const title = kind === 'privacy' ? 'Política de Privacidade' : 'Termos de Uso';
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Target className="w-5 h-5" />
            CRM {COMPANY}
          </div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="text-sm text-muted-foreground">Última atualização: {UPDATED_AT}</p>
        </header>
        {kind === 'privacy' ? <PrivacyContent /> : <TermsContent />}
        <footer className="pt-6 border-t text-sm text-muted-foreground flex gap-4">
          <Link className="underline" to="/privacidade">
            Política de Privacidade
          </Link>
          <Link className="underline" to="/termos">
            Termos de Uso
          </Link>
        </footer>
      </div>
    </div>
  );
}
