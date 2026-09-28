"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type CarouselImage = {
  src: string;
  alt: string;
  title: string;
  description: string;
};

const images: CarouselImage[] = [
  {
    src: "/images/school/hero-placeholder.svg",
    alt: "School campus",
    title: "A campus built for learning",
    description: "Every space designed to help students focus, collaborate, and grow.",
  },
  {
    src: "/images/school/learning-placeholder.svg",
    alt: "Learning environment",
    title: "Learning beyond the classroom",
    description: "Clubs, reading, and thoughtful practice help every learner find their stride.",
  },
  {
    src: "/images/school/campus-placeholder.svg",
    alt: "Campus life",
    title: "Life on campus",
    description: "A vibrant community where students build friendships and memories.",
  },
  {
    src: "/images/school/community-placeholder.svg",
    alt: "Community",
    title: "A community that cares",
    description: "Teachers, students, and families working together for every child's success.",
  },
];

const SLIDE_MS = 5000;

export function ImageCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // Bumped on every manual navigation so auto-advance restarts from the new
  // slide. Without this, clicking a thumbnail mid-interval leaves the timer
  // pointing at the old slide and the next tick skips a frame.
  const [cycle, setCycle] = useState(0);
  const regionRef = useRef<HTMLDivElement>(null);

  const goTo = useCallback((index: number) => {
    setActive(index);
    setCycle((value) => value + 1);
  }, []);

  useEffect(() => {
    if (paused) return;
    // Only advance while the carousel is actually on screen: a hero image
    // that animates in a background tab is wasted work.
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    const timer = setTimeout(() => {
      setActive((current) => (current + 1) % images.length);
    }, SLIDE_MS);
    return () => clearTimeout(timer);
  }, [active, paused, cycle]);

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo((active + 1) % images.length);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo((active - 1 + images.length) % images.length);
    }
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label="School highlights"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
    >
      {/* Main image - fits within viewport */}
      <div className="relative h-[50vh] min-h-[320px] w-full overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] sm:h-[60vh] lg:h-[65vh]">
        {images.map((image, index) => (
          <div
            key={image.src}
            aria-hidden={index !== active}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              index === active ? "opacity-100" : "opacity-0"
            }`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              // The active slide is the LCP element; only it should be eager.
              priority={index === 0}
              sizes="100vw"
              className="object-cover"
            />
          </div>
        ))}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden="true" />

        {/* Text overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
              {String(active + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
            </p>
            <h2 className="font-display mt-1 text-2xl font-semibold text-white sm:text-4xl">
              {images[active].title}
            </h2>
            <p className="mt-2 text-sm text-white/80 sm:text-lg">{images[active].description}</p>
          </div>
        </div>
      </div>

      {/* Thumbnail navigation */}
      <div ref={regionRef} className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
        {images.map((image, index) => (
          <button
            key={image.src}
            type="button"
            onClick={() => goTo(index)}
            aria-label={`Show slide ${index + 1}: ${image.title}`}
            aria-current={index === active ? "true" : undefined}
            className={`relative overflow-hidden rounded-[var(--radius-md)] transition-all duration-300 ${
              index === active
                ? "ring-2 ring-accent ring-offset-2 ring-offset-surface-0"
                : "opacity-40 hover:opacity-70"
            }`}
          >
            <Image
              src={image.src}
              alt=""
              // Thumbnails are decorative duplicates of the hero; the slide
              // buttons carry the accessible name.
              fill
              sizes="(max-width: 640px) 22vw, 20vw"
              className="aspect-[16/9] w-full object-cover"
            />
          </button>
        ))}
      </div>

      {/* Progress bar: a CSS animation keyed to the active slide, so it does
          not fight React over an inline width transition. */}
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
        <div
          key={`${active}-${cycle}`}
          className="h-full w-full rounded-full bg-accent"
          style={
            paused
              ? { transform: "scaleX(1)" }
              : { transformOrigin: "left", animation: `carousel-progress ${SLIDE_MS}ms linear forwards` }
          }
        />
      </div>
    </section>
  );
}
