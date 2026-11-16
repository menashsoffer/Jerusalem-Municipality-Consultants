import { z } from 'zod';

// Our CSP forbids dynamic scripts. Zod's JIT capability probe itself violates Trusted Types.
z.config({ jitless: true });
export { z };
