import { createFileRoute } from '@tanstack/react-router';
// Rendered by the parent /wiki route, which reads documentId from the matched params.
export const Route = createFileRoute('/wiki/$documentId')({component:()=>null});
