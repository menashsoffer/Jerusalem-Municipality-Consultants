// The home screen and registry verification calls (25.11), kept apart so rpc.ts stays in size.
export interface RegistryRpc {
  home_overview: Record<string, never>;
  registry_reviews: Record<string, never>;
  registry_review: { version: string };
  set_registry_validity: { version: string; valid_until: string | null };
  decide_membership: { membership: string; approve: boolean; note: string | null };
}

declare module '../database.types.ts' {
  interface PublicFunctions {
    home_overview: { Args: RegistryRpc['home_overview']; Returns: unknown };
    registry_reviews: { Args: RegistryRpc['registry_reviews']; Returns: unknown };
    registry_review: { Args: RegistryRpc['registry_review']; Returns: unknown };
    set_registry_validity: { Args: RegistryRpc['set_registry_validity']; Returns: null };
    decide_membership: { Args: RegistryRpc['decide_membership']; Returns: null };
  }
}
