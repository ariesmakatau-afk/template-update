import Link from "next/link";
import CoalBed from "../fire/CoalBed";
import EmberCanvas from "../fire/EmberCanvas";

/** Dark, fire-lit page header for inner pages (header turns white over it). */
export default function PageHero({
  crumb,
  title,
  lede,
  children,
  image,
  compact = false,
}: {
  compact?: boolean;
  crumb: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
  image?: React.ReactNode;
}) {
  return (
    <section className="surface-dark grain relative overflow-hidden" data-tone="dark" data-header-dark>
      {image && <div className="absolute inset-0 opacity-45">{image}</div>}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,12,16,.96)_0%,rgba(11,12,16,.72)_22%,rgba(11,12,16,.45)_55%,rgba(11,12,16,.92)_100%)]"
      />
      <CoalBed />
      <EmberCanvas tone="dark" rate={32} band={0.12} motes={10} stokeOnPointer />
      <div
        className={`container-x relative z-10 ${
          compact ? "pb-[clamp(5.5rem,9vw,7rem)] pt-[clamp(8.5rem,13vw,10rem)]" : "pb-[clamp(7rem,14vw,11rem)] pt-[clamp(10rem,18vw,13rem)]"
        }`}
      >
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.24em] text-white/55 fade-up">
          <Link href="/" className="hover:text-amber">
            Home
          </Link>
          <span className="mx-2 text-amber">/</span>
          {crumb}
        </p>
        <h1 className={`${compact ? "h-lg mt-4" : "h-xl mt-6"} max-w-4xl text-white`}>{title}</h1>
        {lede && (
          <p className="lede fade-up mt-6 max-w-2xl" style={{ "--d": "250ms" } as React.CSSProperties}>
            {lede}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
