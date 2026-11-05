# Supabase

O banco deste site não é versionado aqui. O Usibar usa o projeto Supabase central da Noden:
schema `usibar` (tabelas `site_content` e `site_content_history`, com RLS) e bucket público
`usibar`. As tabelas, políticas, gatilhos e a Edge Function `site-admins` são mantidos no
projeto central. Este repositório usa apenas a chave publicável; nunca a service role.
