// Shared Prisma `select` shapes for nested User relations. Never spread a raw
// `user: true`/`{ include: { user: true } }` in an API response — the User
// model carries passwordHash and mfaSecret, and Prisma's `include` returns
// every scalar column unless a `select` narrows it.
export const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  status: true,
} as const;
