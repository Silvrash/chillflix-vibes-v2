import type { Metadata } from "next";
import { statSync } from "node:fs";
import path from "node:path";

/**
 * Download page for the Android TV app.
 *
 * The app is sideloaded rather than installed from a store, so the page has to
 * carry the instructions too — on a TV the hard part isn't the download, it's
 * knowing that the Downloader app is how you get a URL onto the box at all.
 */
const APK_FILE = "chillflixvibes-tv.apk";
const APK_HREF = `/${APK_FILE}`;
const APP_VERSION = "2.0";

export const metadata: Metadata = {
  title: "ChillFlixVibes for Android TV",
  description: "Download the ChillFlixVibes app for Android TV and Google TV — built for the remote, no cursor required.",
};

/** Read at build time so the page can't drift from the file it links to. */
function apkSize(): string {
  try {
    const bytes = statSync(path.join(process.cwd(), "public", APK_FILE)).size;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  } catch {
    return "—";
  }
}

const STEPS = [
  {
    title: "Install Downloader on your TV",
    body: "Search the Play Store on your TV for “Downloader” (by AFTVnews) and install it. It's the standard way to open a link on a television.",
  },
  {
    title: "Enter this address",
    body: "Open Downloader and type the short link below. It fetches the same file as the button above.",
  },
  {
    title: "Allow the install",
    body: "Android will ask permission to install from Downloader the first time. Accept, then choose Install. ChillFlixVibes appears in your apps row.",
  },
];

export default function TvAppPage() {
  const size = apkSize();

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-10">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-surface-light via-surface to-background ring-1 ring-white/10">
        <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              Android TV · Google TV
            </span>
            <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">
              ChillFlixVibes
              <span className="block text-primary">on the big screen</span>
            </h1>
            <p className="mt-4 max-w-lg text-muted">
              A native app built for the remote — the D-pad moves a focus ring through posters and rows, so there is no cursor to
              drag around. Continue watching, search, seasons and episodes, all a click away.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href={APK_HREF}
                download
                className="rounded-xl bg-primary-dark px-7 py-4 text-lg font-semibold text-white transition hover:bg-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Download APK
              </a>
              <span className="text-sm text-muted">
                v{APP_VERSION} · {size} · Android 6.0+
              </span>
            </div>
          </div>

          {/* A suggestion of the app on a screen, rather than a screenshot that
              would go stale with every UI change. */}
          <div aria-hidden className="hidden lg:block">
            <div className="rounded-xl bg-background p-3 ring-1 ring-white/10">
              <div className="aspect-video overflow-hidden rounded-lg bg-gradient-to-tr from-surface via-surface-light to-primary/30 p-4">
                <div className="h-3 w-24 rounded bg-white/25" />
                <div className="mt-6 h-2.5 w-40 rounded bg-white/15" />
                <div className="mt-2 h-2.5 w-28 rounded bg-white/10" />
                <div className="mt-6 flex gap-2">
                  <div className="h-14 w-10 rounded bg-primary/70 ring-2 ring-white/70" />
                  <div className="h-14 w-10 rounded bg-white/10" />
                  <div className="h-14 w-10 rounded bg-white/10" />
                  <div className="h-14 w-10 rounded bg-white/10" />
                </div>
              </div>
            </div>
            <p className="mt-3 text-center text-xs text-muted">Focus ring, not a mouse pointer</p>
          </div>
        </div>
      </div>

      {/* Install steps */}
      <h2 className="mt-14 text-2xl font-bold">Installing on your TV</h2>
      <p className="mt-2 text-muted">
        Downloading on this device? Move the file to the TV, or follow these steps on the TV itself.
      </p>

      <ol className="mt-6 grid gap-4 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-xl bg-surface p-6 ring-1 ring-white/5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-dark text-sm font-bold text-white">
              {index + 1}
            </span>
            <h3 className="mt-4 font-semibold">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>

      {/* The address to type on the TV — the fiddliest part of the whole flow,
          so it gets its own block in a monospace face. */}
      <div className="mt-6 rounded-xl bg-surface-light p-6 ring-1 ring-white/5">
        <p className="text-sm font-semibold text-accent">Type this into Downloader</p>
        <p className="mt-2 break-all font-mono text-lg text-white">chillflixvibes.vercel.app{APK_HREF}</p>
      </div>

      <p className="mt-8 text-sm text-muted">
        The app is signed for sideloading and isn&apos;t distributed through the Play Store. Your TV may warn about installing
        from an unknown source — that warning is expected for any app installed this way.
      </p>
    </div>
  );
}
