import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.js';

// Domain views land in later increments (docs/architecture-proposal.md §11 —
// this is the frontend foundation: routing, auth, RBAC-gated nav, i18n,
// theming). Kept as real routes now rather than 404s so the shell/nav/guard
// wiring is exercised end to end.
export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-text-muted">Coming soon.</CardContent>
    </Card>
  );
}
