"use client";

// The hero: an illustrated night journey through every city on the map
// (drawn by scripts/hero-film), with a chip naming the city in view. The poster shows
// until the film is playing; visitors who ask for reduced motion or data
// saving get the poster only, and the film pauses when it is off screen.
import { useEffect, useRef, useState } from "react";
import { PROFILE as p } from "@/lib/content";

export default function HeroFilm() {
  const hero = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [film, setFilm] = useState(true);
  const [city, setCity] = useState(0);
  const order = p.heroVideo.order;
  const here = p.cities.find((c) => c.name === order[city]) ?? p.cities[0];

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
    const s = p.heroVideo.sources;
    v.src = w < 768 ? s.mobile : s.desktop;
    // The camera settles on a city for the first part of each segment and
    // travels for the rest; name the next city once it is past half way.
    const seg = p.heroVideo.segment;
    const onTime = () => setCity(Math.floor((v.currentTime + seg * 0.22) / seg) % order.length);
    v.addEventListener("timeupdate", onTime);
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
      v.removeEventListener("timeupdate", onTime);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [order.length]);

  return (
    <section className={`hero${ready ? " video-ready" : ""}`} aria-label="Introduction" ref={hero}>
      <div className="hero__media" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="hero__poster" src={p.heroVideo.poster} alt="" />
        {film && <video className="hero__video" ref={video} muted playsInline loop preload="metadata" />}
        <div className="hero__shade" />
      </div>
      <div className="wrap">
        <p className="hero__city" aria-hidden="true" key={here.name}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/img/flags/${here.flag}.svg`} alt="" width={24} height={16} />
          {here.name}
          <span>{here.country}</span>
        </p>
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
