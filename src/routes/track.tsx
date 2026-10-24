import { createFileRoute } from "@tanstack/react-router";
import { TrackForm } from "@/components/site/TrackForm";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track Your Order — Detty Sky" },
      {
        name: "description",
        content: "Track your Detty Sky fireworks delivery with your order number and phone.",
      },
    ],
  }),
  component: () => <TrackForm />,
});
