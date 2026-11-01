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
 * Detection: a coarse pointer alone isn't enough — touchscreen Windows
 * laptops report it too, and there `tel:` opens the Windows "choose an app"
 * dialog (beta feedback). So the tel: link is reserved for phones and tablets
 * (Android / iOS / iPadOS); everything else gets the copy button. Read via
 * useSyncExternalStore so the server snapshot (desktop) matches the first
 * client render and hydration stays clean.
 */

import { useState, useSyncExternalStore } from 'react';

const COARSE = '(pointer: coarse)';

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mql = window.matchMedia(COARSE);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

function isMobileOs(): boolean {
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS reports itself as a Mac; tell it apart by its touch points.
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}

function getSnapshot(): boolean {
  return window.matchMedia(COARSE).matches && isMobileOs();
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
      setTimeout(() => setCopied(false), 3000);
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
        title="Nummer kopieren und selbst anrufen"
        className="rounded border border-neutral-300 bg-white px-1.5 py-0.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
      >
        {copied ? 'kopiert – bitte selbst anrufen' : 'kopieren'}
      </button>
    </span>
  );
}
