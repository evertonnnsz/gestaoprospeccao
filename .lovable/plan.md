## Plano

A função `supabase/functions/google-calendar-events/index.ts` **já contém** a lógica solicitada:

- `buildEvent` retorna `attendees: agendaEvent.guest_email ? [{ email: agendaEvent.guest_email }] : undefined`.
- A requisição para Google Calendar inclui `attendees: eventPayload.attendees` no body.
- A URL adiciona `?sendUpdates=all` quando `eventPayload.attendees` está presente.

Portanto, a única ação necessária é **republicar a função de borda** para garantir que a versão atual com suporte a `guest_email` esteja ativa no Lovable Cloud.

### Passos

1. Verificar rapidamente o estado atual da função (já confirmado: lógica correta).
2. Executar o deploy da edge function `google-calendar-events`.
3. Validar que o deploy foi bem-sucedido (logs/status).

### Resultado esperado

Eventos criados no Google Agenda a partir da aba Agenda do CRM enviarão convite por e-mail para o `guest_email` quando preenchido, graças ao `sendUpdates=all`.