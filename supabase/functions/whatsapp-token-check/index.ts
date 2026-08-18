// Função TEMPORÁRIA: valida o token do WhatsApp Cloud API (somente leitura).
Deno.serve(async () => {
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (!token || !phoneId) {
    return new Response(JSON.stringify({ ok: false, error: 'Secrets ausentes', hasToken: !!token, hasPhoneId: !!phoneId }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const url = `https://graph.facebook.com/v21.0/${phoneId}?fields=id,display_phone_number,verified_name,quality_rating`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return new Response(JSON.stringify({ ok: res.ok, status: res.status, data }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
