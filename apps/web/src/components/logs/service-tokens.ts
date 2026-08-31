// @service: values are resolved to service IDs before anything reaches the API,
// so the token in the search bar only has to be readable and unambiguous — it
// does not have to be the literal service name.
//
// The replaced set is the grammar's AttrValue exclusion set (see
// log-search.grammar); a space, a quote and a colon all end the token equally.
// Uses relative imports so it can run under `node --test`.

const unsafeCharacters = /[\s":]+/g;

export type TServiceToken = {
  id: string;
  name: string;
  token: string;
};

export function toServiceToken(name: string): string {
  return name.replace(unsafeCharacters, "-").replace(/^-+|-+$/g, "");
}

/**
 * Assigns every service a unique token, suffixing duplicates so a token never
 * resolves to more than one service.
 */
export function buildServiceTokens(
  services: readonly { id: string; name: string }[],
): TServiceToken[] {
  const used = new Set<string>();
  return services.map((service) => {
    const base = toServiceToken(service.name) || "service";
    let token = base;
    let suffix = 1;
    while (used.has(token.toLowerCase())) {
      suffix++;
      token = `${base}-${suffix}`;
    }
    used.add(token.toLowerCase());
    return { id: service.id, name: service.name, token };
  });
}

export function findServiceByToken(
  tokens: readonly TServiceToken[],
  value: string,
): TServiceToken | null {
  const wanted = value.toLowerCase();
  return tokens.find((t) => t.token.toLowerCase() === wanted) ?? null;
}
