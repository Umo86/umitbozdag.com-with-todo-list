import { SiteFooter, SiteNav } from "@/components/SiteChrome";

// What strangers see on /app: a password box, and a slightly unsettling
// reply when they get it wrong.
const CREEPY = [
  "We see you.",
  "Nice try. We have your IP address… and your browser’s favourite colour.",
  "That’s not it. And somebody just got a notification about you.",
  "The door is locked for a reason.",
  "You’re not on the list.",
  "Wrong. Turn around slowly.",
];

export default function AppLock({ next, nope }: { next: "/app" | "/app/updates"; nope?: string }) {
  const n = Number(nope);
  const wrong = !!nope;
  const line =
    nope === "locked"
      ? "Too many guesses. Come back in fifteen minutes… if you dare."
      : nope === "down"
        ? "Something’s not right on our side. Try again in a minute."
        : CREEPY[(Number.isFinite(n) && n > 0 ? n - 1 : 0) % CREEPY.length];
  return (
    <>
      <SiteNav />
      <main id="top" className={`applock${wrong ? " wrong" : ""}`}>
        <div className="applock__card">
          <span className="applock__eye" aria-hidden="true">
            {wrong ? "👁️" : "🔒"}
          </span>
          {wrong ? (
            <>
              <h1>Hey… you shouldn&rsquo;t be here.</h1>
              <p className="applock__creepy" role="alert">
                {line}
              </p>
            </>
          ) : (
            <>
              <h1>Private</h1>
              <p>This page is for family only. Enter the password to continue.</p>
            </>
          )}
          <form method="post" action="/api/app-unlock" className="applock__form">
            <input type="hidden" name="next" value={next} />
            <label htmlFor="app-pw" className="sr-only">
              Password
            </label>
            <input id="app-pw" name="password" type="password" placeholder="Password" autoComplete="current-password" required autoFocus />
            <button type="submit">Enter</button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
