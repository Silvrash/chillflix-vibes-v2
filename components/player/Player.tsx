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
        allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
        referrerPolicy="origin"
        // Block the provider iframe from spawning pop-up/pop-under ad windows while
        // still letting its player scripts and fullscreen work.
        sandbox="allow-same-origin allow-scripts allow-forms allow-presentation allow-orientation-lock"
      />
    </div>
  );
}
