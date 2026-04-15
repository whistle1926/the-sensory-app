"use client";

interface Props {
  url: string;
  title?: string;
  onEnded?: () => void;
}

function toEmbed(url: string): { type: "iframe" | "video"; src: string } {
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  if (yt) return { type: "iframe", src: `https://www.youtube.com/embed/${yt[1]}` };
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return { type: "iframe", src: `https://player.vimeo.com/video/${vimeo[1]}` };
  return { type: "video", src: url };
}

export function VideoPlayer({ url, title, onEnded }: Props) {
  const video = toEmbed(url);
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-black shadow-[var(--shadow-sm)]">
      {video.type === "iframe" ? (
        <iframe
          src={video.src}
          className="aspect-video w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title ?? "Lesson video"}
        />
      ) : (
        <video
          src={video.src}
          controls
          onEnded={onEnded}
          className="aspect-video w-full"
        />
      )}
    </div>
  );
}
