"use client";

import { useEffect, useState } from "react";

const phrases = [
  "The digital heartbeat of your school community.",
  "Where every school day finds its rhythm.",
  "Bringing school life into focus.",
  "Your school, beautifully connected.",
  "The rhythm of school life, captured.",
];

export function RotatingHeadline() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIndex((current) => (current + 1) % phrases.length);
        setVisible(true);
      }, 500);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <h1
      className={`font-display mt-5 min-h-[3.5em] text-5xl font-semibold leading-[1.02] tracking-tight transition-all duration-500 sm:text-7xl ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      {phrases[index]}
    </h1>
  );
}
