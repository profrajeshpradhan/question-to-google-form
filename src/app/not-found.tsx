import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { buttonClass } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <LogoMark size={52} />
      <h1 className="mt-6 text-2xl font-extrabold text-ink">Page not found</h1>
      <p className="mt-2 text-muted">The page you’re looking for doesn’t exist.</p>
      <Link href="/" className={buttonClass("primary", "md", "mt-6")}>
        Back to home
      </Link>
    </main>
  );
}
