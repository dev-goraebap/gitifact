import { QueryClient } from '@tanstack/react-query';

// Local Git observations must retain visible failures, rather than retrying writes.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});
