import Image from "next/image";
import donateImage from "@/assets/donate.webp";
import { cx } from "@/components/ui/primitives";

/** Optional donation request, shown while a form is being created and after it succeeds. */
export function DonationCard({
  heading = "Support underprivileged students",
  message = "This tool is free. If it saved you time, please consider a small donation.",
  className,
}: {
  heading?: string;
  message?: string;
  className?: string;
}) {
  return (
    <section aria-labelledby="donate-heading" className={cx("overflow-hidden rounded-2xl border border-line bg-white", className)} data-testid="donation">
      <div className="px-5 pt-5 text-center">
        <h2 id="donate-heading" className="text-lg font-bold text-ink">
          {heading}
        </h2>
        <p className="mt-1 text-sm text-muted">{message}</p>
      </div>
      <Image
        src={donateImage}
        alt="Donate to Satyam Education Charitable Trust to support underprivileged students. Scan the UPI QR code with any UPI app."
        sizes="(min-width: 672px) 448px, 100vw"
        className="mx-auto mt-3 h-auto w-full max-w-md"
        placeholder="blur"
      />
      <p className="px-5 pb-5 text-center text-xs text-muted">
        Scan with any UPI app.{" "}
        <a href={donateImage.src} download="donate-satyam-education-trust.webp" className="font-semibold text-brand-700 underline">
          Save the QR image
        </a>{" "}
        to pay from this phone.
      </p>
    </section>
  );
}
