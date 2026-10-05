import type { WallPhoto } from "@/lib/content-store";

/** Staff portraits in arched frames. Only real uploads — never empty slots. */
export default function TeamGrid({ photos, limit, compact = false }: { photos: WallPhoto[]; limit?: number; compact?: boolean }) {
  const list = (limit ? photos.slice(0, limit) : photos).filter((p) => p.url);
  if (list.length === 0) return null;
  return (
    <ul className={`grid grid-cols-2 gap-5 ${compact ? "" : "sm:grid-cols-3 lg:grid-cols-4"}`}>
      {list.map((p, i) => (
        <li key={p.id} data-reveal style={{ "--d": `${i * 80}ms` } as React.CSSProperties}>
          <div className="arch-frame !p-2">
            <div className="arch aspect-[4/5]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.name ? `${p.name}, ${p.caption}` : p.caption} className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
            </div>
          </div>
          {p.name && <p className="mt-4 text-center font-serif text-2xl leading-none text-blue-navy">{p.name}</p>}
          <p className="mt-1.5 text-center text-sm text-muted">{p.caption}</p>
        </li>
      ))}
    </ul>
  );
}
