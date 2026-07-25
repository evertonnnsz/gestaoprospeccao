## Plano

Sincronizar o projeto com o GitHub e aplicar migrations pendentes envolve duas ações separadas:

### 1. Sincronização com GitHub (main)

A sincronização de código entre o repositório GitHub e o Lovable é feita automaticamente pela integração nativa de Git sync do Lovable — não é algo que eu execute via comandos no chat. Se algum commit da `main` ainda não apareceu no projeto, isso é resolvido no painel do próprio Lovable (workspace → Git settings) ou aguardando o sync automático.

### 2. Migrations pendentes

Vou verificar a pasta `supabase/migrations/` e comparar com o que já foi aplicado no banco para identificar arquivos SQL ainda não executados. Para cada migration pendente encontrada, aplico via a ferramenta de migration (com aprovação sua a cada uma).

### Passos

1. Listar arquivos em `supabase/migrations/`.
2. Consultar o histórico de migrations aplicadas no banco.
3. Para cada arquivo pendente: apresentar o SQL e aplicar após aprovação.
4. Informar sobre o status do Git sync (que é gerenciado pela plataforma, não por mim).

### Observação

Se você quer que eu foque só nas migrations (assumindo que o Git sync já está funcionando), confirme e eu sigo direto para o passo 1.
