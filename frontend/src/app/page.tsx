import type { Metadata } from "next";
import Link from "next/link";
import {
  Accessibility,
  CalendarCheck,
  CheckCircle2,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

import { Logo } from "@/components/logo";

export const metadata: Metadata = {
  title: "KakiMETch | Daily MET scheduling for Loving Heart",
  description:
    "KakiMETch helps Loving Heart allocate daily MET trips across vehicles, with explainable escort matching layered into a human-reviewed schedule.",
};

const steps = [
  {
    icon: CalendarCheck,
    title: "Enter the day's appointments",
    body: "Add the actual pickup, hospital, appointment time and estimated return-ready time for each accepted patient.",
  },
  {
    icon: Users,
    title: "See the fastest allocation",
    body: "KakiMETch proposes a travel-time-minimised plan across both vehicles while protecting every outbound arrival window.",
  },
  {
    icon: CheckCircle2,
    title: "Adjust and match escorts",
    body: "Drag appointments between vehicle lanes, reorder the day, and review escort matching before the final schedule is used.",
  },
];

const principles = [
  {
    icon: UserCheck,
    title: "You're always the decision-maker",
    body: "KakiMETch automates the administrative burden, never the judgment call. It proposes; you review and confirm.",
  },
  {
    icon: ShieldCheck,
    title: "No numeric scores, no NRIC",
    body: "Match reasoning is written in plain language, and NRIC never appears anywhere in the interface.",
  },
  {
    icon: Accessibility,
    title: "Comfortable to read, easy to use",
    body: "16px+ type, large touch targets, full keyboard access and no hover-only or color-only meaning — built to WCAG 2.2 AA.",
  },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-header">
        <Link href="/" className="header-logo">
          <Logo />
        </Link>
        <nav className="landing-nav" aria-label="Landing page sections">
          <a href="#how-it-works">How it works</a>
          <a href="#who-its-for">Who it&apos;s for</a>
        </nav>
        <Link href="/app/schedule" className="primary-button header-cta">
          Open the tool
        </Link>
      </header>

      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="eyebrow">For Loving Heart MET coordinators</p>
            <h1>Plan the day, then keep the final say</h1>
            <p className="hero-lede">
              KakiMETch allocates patient appointments across Loving Heart&apos;s
              vehicles to minimise travel time and protect hospital arrival
              deadlines. Escort matching remains visible on the same schedule,
              and every allocation stays editable.
            </p>
            <div className="hero-actions">
              <Link href="/app/schedule" className="primary-button">
                Open the tool
              </Link>
              <a href="#how-it-works" className="secondary-button">
                See how it works
              </a>
            </div>
            <p className="prototype-note">
              Prototype built with dummy data — not yet approved for real client
              information.
            </p>
          </div>
          <div className="hero-illustration" aria-hidden="true">
            <img
              src="/illustrations/co-driver.svg"
              alt=""
              width={699}
              height={699}
            />
          </div>
        </section>

        <section id="how-it-works" className="landing-section">
          <div className="section-intro">
            <p className="eyebrow">How it works</p>
            <h2>Three steps, one decision that&apos;s still yours</h2>
          </div>
          <div className="step-grid">
            {steps.map(({ icon: Icon, title, body }, index) => (
              <div className="step-card" key={title}>
                <span className="step-number" aria-hidden="true">
                  {index + 1}
                </span>
                <span className="step-icon">
                  <Icon size={24} aria-hidden="true" />
                </span>
                <h3>{title}</h3>
                <p>{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="who-its-for" className="landing-section-alt">
          <div className="landing-section">
            <div className="section-intro">
              <p className="eyebrow">Built for Loving Heart</p>
              <h2>Made for the way Rose already works</h2>
              <p className="section-copy">
                Loving Heart&apos;s coordinators are experienced staff who work
                daily in Excel and printed timetables. KakiMETch is designed to
                feel familiar, not to replace their judgment with a black box.
              </p>
            </div>
            <div className="principles-layout">
              <div className="principles-grid">
                {principles.map(({ icon: Icon, title, body }) => (
                  <div className="principle-card" key={title}>
                    <span className="principle-icon">
                      <Icon size={22} aria-hidden="true" />
                    </span>
                    <div>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="principles-illustration" aria-hidden="true">
                <img
                  src="/illustrations/rollin.svg"
                  alt=""
                  width={1307}
                  height={787}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="closing-banner">
          <div className="closing-banner-inner">
            <div className="closing-illustration" aria-hidden="true">
              <img
                src="/illustrations/all-good.svg"
                alt=""
                width={728}
                height={852}
              />
            </div>
            <div className="closing-copy">
              <h2>Ready to plan today&apos;s trips?</h2>
              <p>Open the daily schedule to allocate vehicles and review escorts.</p>
              <div className="hero-actions">
                <Link href="/app/schedule" className="primary-button">
                  Open the tool
                </Link>
                <Link href="/app/registry" className="secondary-button">
                  Browse the patient registry
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <Logo />
        <p>
          KakiMETch is an internal scheduling and escort-matching tool for
          Loving Heart&apos;s medical transport coordinators.
        </p>
        <nav className="footer-links" aria-label="Footer">
          <Link href="/app/schedule">Daily schedule</Link>
          <Link href="/app/matching">Escort matching</Link>
          <Link href="/app/registry">Patient registry</Link>
        </nav>
        <p className="footer-note">
          Built for Build For Good 2026 (OGP). Prototype — dummy data only.
        </p>
      </footer>
    </div>
  );
}
