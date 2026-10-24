import { Play } from "lucide-react";
import { useState } from "react";

/** A customer photo or video thumbnail. Videos don't download until tapped (mobile data). */
export function ReviewMediaThumb({
  m,
  poster,
  className = "h-20 w-20",
}: {
  m: { type: "photo" | "video"; src: string };
  poster?: string | undefined;
  className?: string;
}) {
  const [playing, setPlaying] = useState(false);
  if (m.type === "photo")
    return (
      <a
        href={m.src}
        target="_blank"
        rel="noreferrer"
        className={`block overflow-hidden rounded-lg ${className}`}
      >
        <img
          src={m.src}
          alt="Customer photo"
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </a>
    );
  return (
    <div className={`relative overflow-hidden rounded-lg bg-night ${className}`}>
      {playing ? (
        <video src={m.src} autoPlay playsInline controls className="h-full w-full object-cover" />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label="Play customer video"
          className="h-full w-full"
        >
          {poster && (
            <img
              src={poster}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover opacity-70"
            />
          )}
          <Play className="absolute inset-0 m-auto h-6 w-6" />
        </button>
      )}
    </div>
  );
}
