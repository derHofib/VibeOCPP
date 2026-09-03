// Mirrors the Prisma `Role` enum. Driver is modeled but not wired to any
// guard or endpoint yet — reserved for the future driver portal.
export enum Role {
  SuperAdmin = 'SuperAdmin',
  Admin = 'Admin',
  Mitarbeiter = 'Mitarbeiter',
  Driver = 'Driver',
}
