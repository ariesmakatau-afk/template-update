import type { WallPhoto } from "@/lib/content-store";

const tilt = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "rotate-0", "-rotate-1"];

/** Customer photos pinned up like prints on the shop wall. Uploads only. */
export default function CustomerWall({ photos, limit, compact = false }: { photos: WallPhoto[]; limit?: number; compact?: boolean }) {
  const list = (limit ? photos.slice(0, limit) : photos).filter((p) => p.url);
  if (list.length === 0) return null;
  return (
    <ul className={`grid grid-cols-2 gap-x-5 gap-y-8 ${compact ? "" : "sm:grid-cols-3 lg:grid-cols-4"}`}>
      {list.map((p, i) => (
        <li key={p.id} className={`${tilt[i % tilt.length]} transition duration-500 hover:rotate-0 hover:scale-[1.03]`} data-reveal="fade">
          <figure className="relative bg-white p-2.5 pb-4 shadow-[0_18px_40px_-18px_rgba(11,20,40,.55)]">
            <span aria-hidden="true" className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full shadow-[0_2px_4px_rgba(0,0,0,.35)]" style={{ background: "var(--fire-btn)" }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt={p.caption} className="aspect-square w-full object-cover" loading="lazy" />
            <figcaption className="mt-3 px-1 font-serif text-[1.15rem] leading-snug text-blue-navy">
              {p.caption}
              {p.name && <span className="mt-1 block font-sans text-xs font-bold text-muted">— {p.name}</span>}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}
