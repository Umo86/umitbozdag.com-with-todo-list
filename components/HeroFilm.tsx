"use client";

// The hero: the London film behind the name, tinted blue. The poster shows
// until the film is playing; visitors who ask for reduced motion or data
// saving get the poster only, and the film pauses when it is off screen.
import { useEffect, useRef, useState } from "react";
import { PROFILE as p } from "@/lib/content";

export default function HeroFilm() {
  const hero = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [film, setFilm] = useState(true);

  useEffect(() => {
    const v = video.current;
    const h = hero.current;
    if (!v || !h) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (reduced || conn?.saveData) {
      setFilm(false);
      return;
    }
    const w = window.innerWidth;
    const dpr = window.devicePixelRatio || 1;
    const s = p.heroVideo.sources;
    v.src = w < 768 ? s.mobile : w * dpr > 2300 ? s.large : s.desktop;
    const onPlaying = () => setReady(true);
    const onError = () => setFilm(false);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("error", onError);
    v.play().catch(() => {});
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.02 }
    );
    io.observe(h);
    const onVis = () => (document.hidden ? v.pause() : v.play().catch(() => {}));
    document.addEventListener("visibilitychange", onVis);
    return () => {
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("error", onError);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return (
    <section className={`hero${ready ? " video-ready" : ""}`} aria-label="Introduction" ref={hero}>
      <div className="hero__media" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero__poster" src={p.heroVideo.poster} alt="" />
        {film && <video className="hero__video" ref={video} muted playsInline loop preload="metadata" />}
        <div className="hero__tint" />
        <div className="hero__lift" />
        <div className="hero__shade" />
      </div>
      <div className="wrap">
        <p className="hero__eyebrow">
          {p.title}, {p.company}, London
        </p>
        <h1>
          {p.firstName}
          <br />
          {p.lastName}
        </h1>
      </div>
    </section>
  );
}
