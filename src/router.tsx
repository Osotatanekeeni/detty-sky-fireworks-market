import { QueryClient, dehydrate, hydrate } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // Ship the server's query cache (the catalogue) with the HTML so the browser hydrates with
    // the same data instead of refetching and flashing. (Stringified: the catalogue is plain JSON.)
    dehydrate: () => ({ queryClientState: JSON.stringify(dehydrate(queryClient)) }),
    hydrate: (d: { queryClientState: string }) =>
      hydrate(queryClient, JSON.parse(d.queryClientState)),
  });

  return router;
};
