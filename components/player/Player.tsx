"use client";

interface PlayerProps {
  src: string;
  title?: string;
}

export function Player({ src, title }: PlayerProps) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10">
      <iframe
        key={src}
        src={src}
        title={title ?? "Player"}
        className="absolute inset-0 h-full w-full border-0"
        allowFullScreen
        allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *"
        referrerPolicy="origin"
      />
    </div>
  );
}
