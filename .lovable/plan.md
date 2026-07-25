## Plano: Configurar secrets do Google Agenda e republicar funções

### Secrets a configurar

Valores fixos (via `set_secret`, sem interação):
- `GOOGLE_REDIRECT_URI` = `https://zcdqmusmgefxxkkrjgad.supabase.co/functions/v1/google-calendar-auth`
- `APP_URL` = `https://gestaoprospeccao.lovable.app`
- `GOOGLE_OAUTH_STATE_SECRET` = `crm_google_agenda_2026_chave_segura_everton`

Credenciais do Google (via `add_secret`, formulário seguro — os placeholders `COLE_AQUI_...` não são valores reais):
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### Republicação

Após os secrets estarem salvos, redeploy de:
- `google-calendar-auth`
- `google-calendar-events`

### Observação

Confirme que o Redirect URI acima está autorizado no OAuth client do Google Cloud Console; caso contrário o callback falhará com `redirect_uri_mismatch`.
