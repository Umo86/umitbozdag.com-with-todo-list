import type { Metadata } from "next";
import QRCode from "qrcode";
import { SiteFooter, SiteNav } from "@/components/SiteChrome";
import { APK_URL } from "@/lib/app-download";

export const metadata: Metadata = {
  title: "Backstage app for Android",
  description: "Download the Backstage planner app for Android: to-dos, a shared calendar, chat and reminders.",
  alternates: { canonical: "/app" },
  robots: { index: false, follow: true },
};

const STEPS: Array<[string, React.ReactNode]> = [
  ["Download", <>On your Android phone, tap <strong>Download for Android</strong>. (On a computer? Scan the code with your phone&rsquo;s camera.)</>],
  ["Open the file", <>When it finishes, tap the notification or open <strong>Files › Downloads › Backstage.apk</strong>.</>],
  ["Allow the install", <>Android asks once to allow installs from your browser: tap <strong>Settings</strong>, switch on <strong>Allow from this source</strong>, then go back.</>],
  ["Install", <>Tap <strong>Install</strong>. If Play Protect warns that the app is unknown, tap <strong>More details › Install anyway</strong> (it isn&rsquo;t on the Play Store, that&rsquo;s all).</>],
  ["Sign in", <>Open Backstage, tap your name and enter your password. Allow the <strong>microphone</strong> and <strong>notifications</strong> when asked, so you can speak tasks and get reminders.</>],
];

const FIXES: Array<[string, React.ReactNode]> = [
  ["“App not installed” or “conflicts with an existing package”", <>An older version is on the phone. Long-press the Backstage icon › <strong>App info › Uninstall</strong>, then install again. Your tasks are safe: they live online, not on the phone.</>],
  ["Nothing happens when I tap the file", <>Open <strong>Settings › Apps › Special app access › Install unknown apps</strong>, pick your browser (Chrome) and allow it.</>],
  ["It says “No connection”", <>Backstage needs the internet to load. Check Wi-Fi or mobile data and tap <strong>Try again</strong>. Reminders already set still go off offline.</>],
  ["No reminders arrive", <>Settings › Apps › Backstage › <strong>Notifications</strong>: on. On Android 12+, also allow <strong>Alarms &amp; reminders</strong> so they arrive on time. Some phones (Samsung, Xiaomi) also need <strong>Battery › Unrestricted</strong> for Backstage.</>],
  ["The mic doesn&rsquo;t work", <>Settings › Apps › Backstage › Permissions › <strong>Microphone: Allow</strong>. Speech uses the Google app, so make sure it&rsquo;s installed and up to date.</>],
  ["I have an iPhone", <>The app is Android only. On iPhone, open <a href="/backstage">umitbozdag.com/backstage</a> in Safari, tap Share › <strong>Add to Home Screen</strong>: it works the same, but reminders only appear while it&rsquo;s open.</>],
];

export default async function AppPage() {
  const qr = await QRCode.toString(APK_URL, { type: "svg", margin: 0, color: { dark: "#0b0b0c", light: "#ffffff" } });
  return (
    <>
      <SiteNav />
      <main id="top" className="appdl">
        <section className="appdl__hero">
          <div className="wrap appdl__grid">
            <div>
              <span className="kicker">Backstage for Android</span>
              <h1>Our planner, in your pocket.</h1>
              <p className="lead">
                The private planner Umit and Dilfiraz share: speak your to-dos, keep a joint list and calendar, chat,
                and get reminders even when the app is closed. You need a Backstage name and password to sign in.
              </p>
              <div className="appdl__cta">
                <a className="appdl__btn" href={APK_URL} download>
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
                  </svg>
                  Download for Android
                </a>
                <a className="appdl__alt" href="/backstage">
                  Open in the browser instead
                </a>
              </div>
              <p className="appdl__small">Android 6 or newer · about 3 MB · updates: download again from this page.</p>
            </div>
            <figure className="appdl__qr">
              <div dangerouslySetInnerHTML={{ __html: qr }} />
              <figcaption>On a computer? Scan with your phone&rsquo;s camera.</figcaption>
            </figure>
          </div>
        </section>

        <section className="wrap appdl__section">
          <h2>Install it in a minute</h2>
          <ol className="appdl__steps">
            {STEPS.map(([t, d], i) => (
              <li key={t}>
                <span className="n">{i + 1}</span>
                <div>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="wrap appdl__section">
          <h2>If something goes wrong</h2>
          <div className="appdl__faq">
            {FIXES.map(([q, a]) => (
              <details key={q}>
                <summary dangerouslySetInnerHTML={{ __html: q }} />
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
