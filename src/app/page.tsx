import Link from "next/link";

/**
 * The entry router. Deliberately not a landing page — lasertopia.ca is the
 * marketing site and links here. This screen exists to get someone into the
 * correct booking flow in one tap.
 */

const CHOICES = [
  {
    href: "/laser-tag",
    eyebrow: "01 / Walk-in games",
    title: "BOOK LASER TAG",
    body: "Games run every 15 minutes. Pick your players, pick your times.",
    meta: "FROM $8.49 / PERSON",
  },
  {
    href: "/parties",
    eyebrow: "02 / Private events",
    title: "BOOK A PARTY",
    body: "Private room, laser tag, food and a VIP host. Ten guests included.",
    meta: "FROM $224.50",
  },
] as const;

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-page flex-1 flex-col px-5 py-10 md:px-8 md:py-16">
      <header className="border-b border-rule pb-8">
        <p className="text-eyebrow uppercase text-accent">Lasertopia · Winnipeg</p>
        <h1 className="mt-4 text-display-1 uppercase md:text-[3.5rem]">
          Where our epic
          <br />
          games await you
        </h1>
        <p className="mt-5 max-w-flow text-body text-text-2">
          Book online for laser tag or a private birthday party. Same building,
          two different bookings — pick the one you need.
        </p>
      </header>

      <nav aria-label="Choose a booking type" className="grid gap-px bg-rule md:grid-cols-2">
        {CHOICES.map((choice) => (
          <Link
            key={choice.href}
            href={choice.href}
            className="group flex flex-col justify-between gap-10 bg-canvas p-6 transition-colors duration-[var(--duration-fast)] hover:bg-raised md:p-8"
          >
            <div>
              <p className="text-label uppercase text-text-3">{choice.eyebrow}</p>
              <h2 className="mt-4 text-display-3 uppercase group-hover:text-accent">
                {choice.title}
              </h2>
              <p className="mt-3 max-w-[38ch] text-body-sm text-text-2">{choice.body}</p>
            </div>
            <p className="text-mono-sm uppercase text-accent" data-numeric>
              {choice.meta}
            </p>
          </Link>
        ))}
      </nav>

      <footer className="mt-auto grid gap-6 border-t border-rule pt-8 text-body-sm text-text-2 md:grid-cols-3">
        <p>
          Unit #5 – 1140 Waverley Street
          <br />
          Winnipeg, MB
        </p>
        <p>
          <a className="hover:text-accent" href="tel:+12044745900">
            <span data-numeric>204-474-5900</span>
          </a>
          <br />
          <Link className="hover:text-accent" href="/manage-booking">
            Manage an existing booking
          </Link>
        </p>
        <p className="text-text-3">
          Nut-free facility. Clean closed-toed shoes required in the arena.
        </p>
      </footer>
    </main>
  );
}
