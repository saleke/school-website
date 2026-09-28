"use client";

import { useEffect, useState } from "react";

type CarouselImage = {
  src: string;
  alt: string;
  title: string;
  description: string;
};

const images: CarouselImage[] = [
  { src: "/images/school/hero-placeholder.svg", alt: "School campus", title: "A campus built for learning", description: "Every space designed to help students focus, collaborate, and grow." },
  { src: "/images/school/learning-placeholder.svg", alt: "Learning environment", title: "Learning beyond the classroom", description: "Clubs, reading, and thoughtful practice help every learner find their stride." },
  { src: "/images/school/campus-placeholder.svg", alt: "Campus life", title: "Life on campus", description: "A vibrant community where students build friendships and memories." },
  { src: "/images/school/community-placeholder.svg", alt: "Community", title: "A community that cares", description: "Teachers, students, and families working together for every child's success." },
];

export function ImageCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setActive((current) => (current + 1) % images.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [paused]);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Main image - fits within viewport */}
      <div className="relative h-[50vh] min-h-[320px] w-full overflow-hidden rounded-[var(--radius-xl)] shadow-[var(--shadow-lg)] sm:h-[60vh] lg:h-[65vh]">
        {images.map((image, index) => (
          <div
            key={image.src}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
              index === active
                ? "opacity-100 scale-100"
                : "opacity-0 scale-105"
            }`}
          >
            <img
              src={image.src}
              alt={image.alt}
              className="h-full w-full object-cover"
            />
          </div>
        ))}

        {/* Gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden="true" />

        {/* Text overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-10">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl font-semibold text-white sm:text-4xl">
              {images[active].title}
            </h2>
            <p className="mt-2 text-sm text-white/80 sm:text-lg">
              {images[active].description}
            </p>
          </div>
        </div>

        {/* Image counter */}
        <div className="absolute right-4 top-4 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm sm:right-6 sm:top-6">
          {active + 1} / {images.length}
        </div>
      </div>

      {/* Thumbnail navigation */}
      <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
        {images.map((image, index) => (
          <button
            key={image.src}
            type="button"
            onClick={() => setActive(index)}
            aria-label={`View ${image.alt}`}
            aria-current={index === active}
            className={`relative overflow-hidden rounded-[var(--radius-md)] transition-all duration-300 ${
              index === active
                ? "ring-2 ring-accent ring-offset-2 ring-offset-surface-0"
                : "opacity-40 hover:opacity-70"
            }`}
          >
            <img
              src={image.src}
              alt=""
              className="aspect-[16/9] w-full object-cover"
            />
          </button>
        ))}
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent transition-all ease-linear"
          style={{
            width: paused ? "0%" : "100%",
            transitionDuration: paused ? "0ms" : "5000ms",
          }}
        />
      </div>
    </div>
  );
}
