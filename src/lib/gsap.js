'use client';
// GSAP, registered once for the whole app (all plugins ship free in the public `gsap` package).
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';

if (typeof window !== 'undefined') gsap.registerPlugin(useGSAP, DrawSVGPlugin);

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export { DrawSVGPlugin, gsap, useGSAP };
