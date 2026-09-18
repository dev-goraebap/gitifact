import { createFileRoute } from '@tanstack/react-router';
// Rendered by the parent /wiki route; this entry only gives the folder view its own path.
export const Route = createFileRoute('/wiki/')({component:()=>null});
