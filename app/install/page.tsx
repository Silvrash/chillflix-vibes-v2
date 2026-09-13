import type { Metadata } from "next";
import { statSync } from "node:fs";
import path from "node:path";
import { Laptop, Smartphone, Tv } from "lucide-react";
import { pageMetadata } from "@/lib/seo";

/**
 * Where every build of ChillFlixVibes is downloaded from.
 *
 * None of them come from a store, so this page carries the instructions too —
 * and on each platform the hard part is a different thing. On a television it
 * is knowing that a separate app is how you get a URL onto the box at all; on a
 * Mac it is getting past Gatekeeper, which refuses anything not notarised.
 */
export const metadata: Metadata = pageMetadata({
  title: "Install",
  description: "Download ChillFlixVibes for Android TV, Google TV and macOS, or install the web app on your phone.",
  path: "/install",
});

const APK_FILE = "chillflixvibes-tv.apk";
const MAC_FILE = "ChillFlixVibes-mac.zip";

/** Read at build time so the page can't advertise a size the file doesn't have. */
function fileSize(name: string): string {
  try {
    const bytes = statSync(path.join(process.cwd(), "public", name)).size;
    return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  } catch {
    return "—";
  }
}

export default function InstallPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-24 sm:px-6 sm:pt-28 lg:px-10">
      <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Install ChillFlixVibes</h1>
      <p className="mt-3 max-w-2xl text-muted">
        Native apps for the television and the Mac, and the web app itself on a phone. Nothing here comes from a store, so each
        one has a note about what its platform will ask you first.
      </p>

      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <PlatformCard
          icon={<Tv className="h-5 w-5" />}
          name="Android TV"
          requirement="Android 6.0+ · Google TV, Fire TV, Android TV"
          blurb="Built for the remote: the D-pad moves a focus ring through posters and rows, so there is no cursor to drag around."
          href={`/${APK_FILE}`}
          action="Download APK"
          meta={`${fileSize(APK_FILE)} · sideloaded`}
        />
        <PlatformCard
          icon={<Laptop className="h-5 w-5" />}
          name="macOS"
          requirement="macOS 13 Ventura or later · Apple silicon"
          blurb="A real Mac app — sidebar, native materials, and playback in the same window rather than a browser tab."
          href={`/${MAC_FILE}`}
          action="Download for Mac"
          meta={`${fileSize(MAC_FILE)} · unsigned`}
        />
        <PlatformCard
          icon={<Smartphone className="h-5 w-5" />}
          name="Android & iPhone"
          requirement="Any modern mobile browser"
          /* There is no phone build, and saying so beats a button that goes
             nowhere. The site is a PWA — app/manifest.ts gives it a name, an
             icon and a start URL — so "Add to Home Screen" installs the real
             thing rather than a bookmark. */
          blurb="No separate app to download. Open the site in your browser and choose Add to Home Screen — it installs with its own icon and opens without browser chrome."
          meta="Progressive web app"
        />
      </div>

      <MacSteps />
    </div>
  );
}

function PlatformCard({
  icon,
  name,
  requirement,
  blurb,
  href,
  action,
  meta,
}: {
  icon: React.ReactNode;
  name: string;
  requirement: string;
  blurb: string;
  href?: string;
  action?: string;
  meta: string;
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-surface/60 p-6">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white">
        {icon}
      </span>
      <h2 className="mt-4 text-lg font-semibold">{name}</h2>
      <p className="mt-1 text-xs text-muted">{requirement}</p>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{blurb}</p>

      {href && action ? (
        <a
          href={href}
          download
          className="mt-6 rounded-xl bg-white px-5 py-3 text-center text-sm font-semibold text-black transition hover:bg-white/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {action}
        </a>
      ) : (
        <span className="mt-6 rounded-xl border border-white/10 px-5 py-3 text-center text-sm font-medium text-muted">
          Nothing to download
        </span>
      )}
      <p className="mt-3 text-center text-xs text-muted">{meta}</p>
    </div>
  );
}

function MacSteps() {
  return (
    <section className="mt-14">
      <h2 className="text-2xl font-bold">Opening it on a Mac</h2>
      {/* Gatekeeper is the whole of the difficulty here. The app is ad-hoc signed
          rather than notarised, so the first launch is refused outright with a
          message about the developer being unverified — and the Finder route
          below is the one that offers an override at all. Double-clicking never
          will, however many times it is tried. */}
      <p className="mt-2 max-w-2xl text-muted">
        The app isn&apos;t notarised by Apple, so the first launch is refused. Right-click the app and choose Open — that dialog
        has an Open button, where double-clicking gives you no way through. You only have to do this once.
      </p>
      <p className="mt-4 text-sm text-muted">
        Unzip it, drag ChillFlixVibes to your Applications folder, then right-click → Open.
      </p>
    </section>
  );
}
