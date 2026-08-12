# Correção do fluxo de confirmação de e-mail

- `signUp` agora envia `emailRedirectTo` para `/confirmar-email`.
- A nova página `/confirmar-email` aceita o retorno de autenticação, conclui PKCE quando houver `code`, aguarda a sessão no fluxo implícito, encerra essa sessão e redireciona para `/entrar?emailConfirmado=1`.
- O login exibe uma confirmação clara para o usuário.
- No Supabase Dashboard, a URL de produção precisa estar configurada em Authentication > URL Configuration e `/confirmar-email` precisa ser permitido como Redirect URL.
