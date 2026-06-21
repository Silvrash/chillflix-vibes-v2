import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-extrabold text-primary">404</p>
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="max-w-md text-muted">The page you’re looking for doesn’t exist or has moved.</p>
      <Link
        href="/movies"
        className="rounded-lg bg-primary-dark px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark/90"
      >
        Back to Movies
      </Link>
    </div>
  );
}
