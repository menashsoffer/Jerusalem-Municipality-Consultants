-- Security Advisor: an event-trigger function must not be callable through the API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
