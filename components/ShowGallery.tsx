"use client";

// Photos and official films from a show, as a swipeable carousel. The track
// is a plain scroll-snap row, so it swipes on touch and still works without
// JavaScript; the arrows, dots and counter are added on top.
//
// Photos are free-licence images of the event itself (credited under each
// one). Films are the organiser's own, played through YouTube's embed.
import { useCallback, useEffect, useRef, useState } from "react";

export type GalleryPhoto = { src: string; caption: string; credit: string; source: string; licence: string; licenceUrl: string };
export type GalleryVideo = { id: string; title: string; channel: string; published: string };

export default function ShowGallery({ name, photos, videos }: { name: string; photos: GalleryPhoto[]; videos: GalleryVideo[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const total = videos.length + photos.length;

  const go = useCallback(
    (n: number) => {
      const el = track.current;
      if (!el) return;
      const to = Math.max(0, Math.min(total - 1, n));
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left: to * el.clientWidth, behavior: calm ? "auto" : "smooth" });
    },
    [total]
  );

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setAt(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  if (!total) return null;
  const many = total > 1;
  const videoOnly = !photos.length;

  return (
    <section className={`gal${videoOnly ? " gal--video" : ""}`} aria-roledescription="carousel" aria-label={`${videoOnly ? "Films" : "Photos"} from ${name}`}>
      <div
        className="gal__track"
        ref={track}
        tabIndex={many ? 0 : -1}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(at + 1);
          if (e.key === "ArrowLeft") go(at - 1);
        }}
      >
        {videos.map((v, i) => (
          <figure className="gal__slide" key={v.id} aria-roledescription="slide" aria-label={`${i + 1} of ${total}`}>
            <div className="gal__media gal__media--video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${v.id}?rel=0`}
                title={v.title}
                loading="lazy"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <figcaption>
              {v.title}.{" "}
              <span>
                Official film:{" "}
                <a href={`https://www.youtube.com/watch?v=${v.id}`} target="_blank" rel="noopener nofollow">
                  {v.channel} on YouTube
                </a>
                , {v.published}.
              </span>
            </figcaption>
          </figure>
        ))}
        {photos.map((ph, i) => (
          <figure className="gal__slide" key={ph.src} aria-roledescription="slide" aria-label={`${videos.length + i + 1} of ${total}`}>
            <div className="gal__media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ph.src} alt={ph.caption} loading={i === 0 && !videos.length ? "eager" : "lazy"} referrerPolicy="no-referrer" />
            </div>
            <figcaption>
              {ph.caption}{" "}
              <span>
                Photo:{" "}
                <a href={ph.source} target="_blank" rel="noopener nofollow">
                  {ph.credit}
                </a>
                {ph.licenceUrl ? (
                  <>
                    ,{" "}
                    <a href={ph.licenceUrl} target="_blank" rel="noopener nofollow">
                      {ph.licence}
                    </a>
                  </>
                ) : (
                  `, ${ph.licence}`
                )}
                .
              </span>
            </figcaption>
          </figure>
        ))}
      </div>

      {many && (
        <>
          <div className="gal__nav" aria-hidden="true">
            <button type="button" tabIndex={-1} onClick={() => go(at - 1)} disabled={at === 0}>
              <Arrow dir="left" />
            </button>
            <button type="button" tabIndex={-1} onClick={() => go(at + 1)} disabled={at === total - 1}>
              <Arrow dir="right" />
            </button>
          </div>
          <div className="gal__bar">
            <div className="gal__dots">
              {Array.from({ length: total }, (_, i) => (
                <button
                  type="button"
                  key={i}
                  className={i === at ? "on" : undefined}
                  aria-label={`Show ${i < videos.length ? "film" : "photo"} ${i + 1} of ${total}`}
                  aria-current={i === at}
                  onClick={() => go(i)}
                />
              ))}
            </div>
            <span className="gal__count" aria-live="polite">
              {at + 1} / {total}
            </span>
          </div>
        </>
      )}
    </section>
  );
}

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
    </svg>
  );
}
