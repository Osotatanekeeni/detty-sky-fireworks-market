import { createFileRoute, Link, Outlet, redirect, useLocation, useNavigate, useRouter } from "@tanstack/react-router";
import {
  Ban,
  Boxes,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquareQuote,
  Package,
  ShoppingCart,
  Sparkles,
  Star,
  Truck,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { listQuotes, listReviews } from "@/lib/admin.functions";
import { getViewer } from "@/lib/auth.functions";
import { supabaseBrowser } from "@/lib/supabase.browser";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin — Detty Sky" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  // Server-checked on every navigation into /admin. RLS enforces the same rule on the data.
  beforeLoad: async ({ location }) => {
    if (location.pathname === "/admin/login") return { viewer: null };
    const viewer = await getViewer();
    if (viewer?.role !== "admin")
      throw redirect({ to: "/admin/login", search: viewer ? { denied: true } : {} });
    return { viewer };
  },
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes },
  { to: "/admin/quotes", label: "Bulk quotes", icon: MessageSquareQuote },
  { to: "/admin/delivery", label: "Delivery zones", icon: Truck },
  { to: "/admin/availability", label: "State availability", icon: Ban },
  { to: "/admin/marketing", label: "Marketing", icon: Megaphone },
  { to: "/admin/reviews", label: "Reviews", icon: Star },
] as const;

function AdminLayout() {
  const { viewer } = Route.useRouteContext();
  const { pathname } = useLocation();
  const nav = useNavigate();
  const router = useRouter();
  const isLogin = pathname === "/admin/login";
  const signedIn = !isLogin && !!viewer;
  const { data: quotes = [] } = useQuery({
    queryKey: ["admin", "quotes"],
    queryFn: () => listQuotes(),
    enabled: signedIn,
  });
  const { data: reviews = [] } = useQuery({
    queryKey: ["admin", "reviews"],
    queryFn: () => listReviews(),
    enabled: signedIn,
  });
  const pendingReviews = reviews.filter((r) => r.status === "pending").length;

  const signOut = async () => {
    await supabaseBrowser().auth.signOut();
    await router.invalidate();
    nav({ to: "/admin/login" });
  };

  if (isLogin) return <Outlet />;
  if (!viewer)
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Checking access…
      </div>
    );

  const badges: Partial<Record<string, number>> = {
    "/admin/quotes": quotes.filter((q) => q.status === "New").length,
    "/admin/reviews": pendingReviews,
  };

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[240px_1fr]">
      <div className="border-b border-border bg-sidebar lg:border-b-0 lg:border-r">
        <aside className="lg:sticky lg:top-0 lg:h-screen">
          <div className="flex items-center justify-between gap-2 p-4 lg:block">
            <Link to="/admin" className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-gold" />
              <span className="font-display font-bold">
                Detty<span className="text-gold-gradient">Sky</span>
              </span>
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Admin
              </span>
            </Link>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-gold lg:mt-3"
            >
              <ExternalLink className="h-3 w-3" /> View store
            </a>
          </div>
          <nav
            aria-label="Admin"
            className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0"
          >
            {NAV.map((n) => {
              const active =
                "exact" in n
                  ? pathname === n.to || pathname === `${n.to}/`
                  : pathname.startsWith(n.to);
              const badge = badges[n.to];
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${active ? "bg-sidebar-accent font-semibold text-gold" : "text-sidebar-foreground hover:bg-sidebar-accent"}`}
                >
                  <n.icon className="h-4 w-4" />
                  <span className="flex-1">{n.label}</span>
                  {badge ? (
                    <span className="rounded-full bg-magenta px-1.5 text-[10px] font-bold text-foreground">
                      {badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <div className="hidden space-y-1 p-3 lg:absolute lg:bottom-0 lg:block lg:w-full">
            <p className="truncate px-3 text-xs text-muted-foreground">{viewer.email}</p>
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </aside>
      </div>
      <main className="min-w-0 p-4 sm:p-6 lg:p-8">
        <Outlet />
        <div className="mt-10 flex gap-2 lg:hidden">
          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </main>
    </div>
  );
}
