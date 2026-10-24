import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Baby,
  Ban,
  Car,
  CheckCircle2,
  Droplets,
  Flame,
  Hand,
  Ruler,
  ShieldAlert,
  Timer,
  Wind,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/safety")({
  head: () => ({
    meta: [
      { title: "Fireworks Safety Guide — Detty Sky" },
      {
        name: "description",
        content:
          "How to set up, light and dispose of fireworks safely. Do's and don'ts for Christmas, crossover and owambe celebrations.",
      },
      { property: "og:title", content: "Fireworks Safety Guide — Detty Sky" },
      { property: "og:description", content: "Celebrate loud, stay safe." },
    ],
  }),
  component: Safety,
});

const DOS = [
  {
    icon: Ruler,
    title: "Give it space",
    body: "Set up on flat, firm ground, well away from people, cars, generators and buildings. Aerial cakes need at least 20m clear in every direction.",
  },
  {
    icon: Hand,
    title: "One adult lights",
    body: "Choose one sober adult (18+) to light. Use the long fuse, light at arm's length, then walk back immediately.",
  },
  {
    icon: Droplets,
    title: "Keep water close",
    body: "Have a bucket of water or sand and a hose ready before you light anything.",
  },
  {
    icon: Wind,
    title: "Check the wind",
    body: "Angle the audience upwind so sparks and smoke blow away from people.",
  },
  {
    icon: Timer,
    title: "Wait out duds",
    body: "If something doesn't go off, wait at least 20 minutes, then soak it in water. Never go back to it early.",
  },
  {
    icon: CheckCircle2,
    title: "Read the label",
    body: "Every product has its own distance and setup instructions. They're printed on the box and on each product page.",
  },
];

const DONTS = [
  {
    icon: Baby,
    title: "No children handling fireworks",
    body: "Kids watch from behind the safety line. Sparklers only with close adult supervision — and never for under-5s.",
  },
  {
    icon: Flame,
    title: "Never relight",
    body: "A firework that fizzles can still go off. Don't relight it, shake it or look inside the tube.",
  },
  {
    icon: Ban,
    title: "No alcohol and fireworks",
    body: "The person lighting stays sober. Save the celebration drinks for after the show.",
  },
  {
    icon: Car,
    title: "Not near vehicles or fuel",
    body: "Keep well away from parked cars, generators, fuel containers and gas cylinders.",
  },
  {
    icon: XCircle,
    title: "Don't hold aerials",
    body: "Cakes, rockets and fountains are lit on the ground and never held in the hand.",
  },
  {
    icon: ShieldAlert,
    title: "Respect local rules",
    body: "Some states restrict bangers or loud fireworks at certain times. We only ship what's allowed where you are.",
  },
];

function Safety() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-magenta">Safety guide</p>
        <h1 className="mx-auto mt-2 max-w-3xl text-4xl sm:text-5xl">
          Celebrate loud. <span className="text-gold-gradient">Stay safe.</span>
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">
          Fireworks are for adults 18+. Two minutes with this guide keeps the owambe about the show
          — not the emergency room.
        </p>
      </div>

      <section className="mt-14" aria-labelledby="dos-h">
        <h2 id="dos-h" className="mb-6 flex items-center gap-3 text-2xl">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald/20 text-emerald">
            <CheckCircle2 className="h-5 w-5" />
          </span>{" "}
          Do
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DOS.map((d) => (
            <article key={d.title} className="glass rounded-3xl border-emerald/30 p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald/15">
                <d.icon className="h-6 w-6 text-emerald" />
              </span>
              <h3 className="mt-4 font-sans text-base font-bold">{d.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="donts-h">
        <h2 id="donts-h" className="mb-6 flex items-center gap-3 text-2xl">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/20 text-destructive">
            <XCircle className="h-5 w-5" />
          </span>{" "}
          Don't
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DONTS.map((d) => (
            <article key={d.title} className="glass rounded-3xl border-destructive/30 p-6">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15">
                <d.icon className="h-6 w-6 text-destructive" />
              </span>
              <h3 className="mt-4 font-sans text-base font-bold">{d.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{d.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section
        className="glass mt-14 grid gap-6 rounded-3xl p-6 sm:p-8 md:grid-cols-3"
        aria-labelledby="after-h"
      >
        <div className="md:col-span-1">
          <h2 id="after-h" className="text-2xl">
            After the show
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Used fireworks stay hot for a long time.
          </p>
        </div>
        <ol className="space-y-3 text-sm md:col-span-2">
          {[
            "Wait 20 minutes before going near spent fireworks.",
            "Soak everything — cases, tubes and duds — in a bucket of water overnight.",
            "Bag the soaked waste and put it in the bin the next day. Never burn it.",
            "Store unused fireworks in their box, somewhere cool, dry and locked away from children.",
          ].map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-gradient text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-14 rounded-3xl border border-destructive/40 bg-destructive/10 p-6 text-center">
        <p className="font-display text-lg">
          In an emergency, call{" "}
          <a href="tel:112" className="text-gold underline">
            112
          </a>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          For burns, cool with clean running water for 20 minutes and get medical help.
        </p>
      </div>

      <div className="mt-10 text-center">
        <Button asChild variant="gold" size="lg">
          <Link to="/shop">Shop with confidence</Link>
        </Button>
      </div>
    </div>
  );
}
