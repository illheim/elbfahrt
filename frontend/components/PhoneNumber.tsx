'use client';

/**
 * Renders a phone number in a way that suits the device:
 *   - Touch devices (phones, tablets): a `tel:` link, so tapping starts a call.
 *   - Desktop (fine pointer): plain, selectable text with a "kopieren" button.
 *
 * Why: on a Mac a `tel:` link is routed to FaceTime by the OS (the site can't
 * override that), which throws a confusing "Open FaceTime?" prompt. Desktop
 * users copy the number anyway, so we skip the link there.
 *
 * Detection uses the coarse-pointer media query rather than user-agent
 * sniffing, read via useSyncExternalStore so the server snapshot (desktop)
 * matches the first client render and hydration stays clean.
 */

import { useState, useSyncExternalStore } from 'react';

const COARSE = '(pointer: coarse)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(COARSE);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(COARSE).matches;
}

// SSR and the first client render assume desktop (false); touch devices
// re-render to the tel: link once hydrated.
const getServerSnapshot = () => false;

export function PhoneNumber({ value }: { value: string }) {
  const isTouch = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [copied, setCopied] = useState(false);

  if (isTouch) {
    return (
      <a href={`tel:${value}`} className="text-accent-700 underline">
        {value}
      </a>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable (e.g. non-secure context) — the number stays
      // selectable, so the user can still copy it by hand.
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="select-all text-neutral-900">{value}</span>
      <button
        type="button"
        onClick={copy}
        aria-label="Telefonnummer kopieren"
        className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
      >
        {copied ? 'kopiert' : 'kopieren'}
      </button>
    </span>
  );
}
