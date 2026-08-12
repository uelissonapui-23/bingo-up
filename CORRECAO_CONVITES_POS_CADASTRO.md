# Correção de convites após cadastro/login

Corrige a perda do link de convite quando um vendedor ou operador ainda não possui conta.

Fluxo corrigido:
1. abre convite;
2. login detecta a rota pendente;
3. se precisar criar conta, a rota do convite acompanha o cadastro;
4. `emailRedirectTo` mantém o convite durante a confirmação de e-mail;
5. após confirmar, o login retorna ao convite;
6. o usuário aceita explicitamente;
7. só então o evento aparece em `/venda` ou `/operador`.

Não exige migration Supabase. A Fase 15 deve estar previamente aplicada no banco.
