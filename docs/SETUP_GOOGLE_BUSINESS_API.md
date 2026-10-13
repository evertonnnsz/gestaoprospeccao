# API oficial do Google Business Profile

Necessária para a parte de **gerenciamento dos clientes ativos** do módulo Google Meu Negócio:
- insights: visualizações, ligações, rotas e cliques no site;
- palavras-chave que acionam o perfil;
- responder avaliações (com IA);
- postagens;
- análise completa do perfil;
- relatório automático.

O diagnóstico de leads (dados públicos) **não** depende disso.

O Google libera essa API só depois de aprovar um pedido, o que costuma levar de alguns dias a algumas semanas. Por isso o pedido deve ser feito já.

## 1. Projeto no Google Cloud

Use o mesmo projeto do Google Cloud que o CRM já usa para o Google Agenda (o do `GOOGLE_CLIENT_ID`).
Anote o **número do projeto** (Google Cloud Console > página inicial do projeto > "Número do projeto").

## 2. Pedir acesso à API

1. Acesse https://developers.google.com/my-business/content/prereqs e abra o **formulário de solicitação de acesso** (GBP API contact form).
2. Escolha **"Application for Basic API Access"**.
3. Preencha:
   - **Número do projeto** do passo 1.
   - **E-mail:** o mesmo que é dono do projeto no Google Cloud.
   - **Site da agência:** precisa estar no ar e representar a empresa.
   - **Uso:** "Agência que gerencia perfis de clientes (dono/administrador): leitura de métricas, respostas a avaliações e postagens."
4. Requisito do Google: o perfil da sua própria empresa no Google precisa estar **verificado e ativo há pelo menos 60 dias**.

Para saber se foi aprovado: em **APIs e serviços > Cotas**, a cota da "My Business Business Information API" deixa de ser 0. O Google também avisa por e-mail.

## 3. Depois da aprovação: ativar as APIs

Em **APIs e serviços > Biblioteca**, ative:

- My Business Account Management API
- My Business Business Information API
- Business Profile Performance API
- Google My Business API (avaliações, postagens e fotos)

## 4. Tela de consentimento OAuth

Em **APIs e serviços > Tela de consentimento OAuth**:

1. Adicione o escopo `https://www.googleapis.com/auth/business.manage`.
2. Deixe o app **"Em produção"**. Em modo de teste, o Google desconecta a cada 7 dias.
3. Como o uso é interno, não precisa passar pela verificação do Google. Ao conectar, vai aparecer o aviso "app não verificado": clique em **Avançado > Continuar**.

## 5. URL de retorno

Quando a conexão estiver pronta no CRM, adicione em **Credenciais > ID do cliente OAuth > URIs de redirecionamento autorizados**:

```
https://<PROJECT_REF>.supabase.co/functions/v1/google-business-auth
```

Depois, conecte no CRM com a conta Google que é **dona ou administradora** dos perfis dos clientes.
