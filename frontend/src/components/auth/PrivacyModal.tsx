import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';

interface PrivacyModalProps {
  /** Dipanggil setelah user menekan Agree (modal sudah memainkan animasi tutup). */
  onAgree: () => void;
  onClose: () => void;
}

/** Toleransi (px) agar dianggap sudah sampai paling bawah; scrollTop bisa berupa pecahan di layar beresolusi tinggi. */
const BOTTOM_TOLERANCE_PX = 12;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="text-sm font-bold">{title}</h4>
      <div className="space-y-1.5 text-[13px] leading-relaxed text-muted">{children}</div>
    </section>
  );
}

/**
 * Privacy & Security. Tombol Agree tetap nonaktif sampai isi digulir hingga paling bawah. Bila isinya cukup pendek
 * sehingga tidak perlu digulir (layar besar), tombol langsung aktif.
 */
export default function PrivacyModal({ onAgree, onClose }: PrivacyModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);

  const check = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - BOTTOM_TOLERANCE_PX) setReachedEnd(true);
  }, []);

  useEffect(() => {
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [check]);

  return (
    <Modal title="Privacy & Security" onClose={onClose}>
      {(close) => (
        <div className="space-y-4">
          <div
            ref={scrollRef}
            onScroll={check}
            tabIndex={0}
            aria-label="Privacy and security terms. Scroll to the end to enable Agree."
            className="max-h-[52dvh] space-y-4 overflow-y-auto rounded-2xl bg-inset p-4 pr-3"
          >
            <p className="rounded-xl bg-warning/15 px-3 py-2 text-[13px] font-semibold leading-relaxed text-warning">
              Every version of Cidash is a demo / prototype. Features can change, and data can be reset or removed at any
              time without notice. Please do not rely on it for anything sensitive.
            </p>

            <Section title="What we collect">
              <p>
                <b>Account:</b> your email address, username and a password. The password is stored only as a salted hash,
                never as plain text.
              </p>
              <p>
                <b>Activity:</b> the runs and rides you record, including distance, duration, pace, elevation, calories
                and the route you travelled.
              </p>
              <p>
                <b>Location:</b> your GPS position, only while you are recording an activity or checking that GPS is
                ready.
              </p>
              <p>
                <b>Circle data:</b> the circles you join, your Rank Points, coins, Shield Tickets, missions and
                notifications.
              </p>
            </Section>

            <Section title="What other people can see">
              <p>
                Cidash is built around private, invite-only circles. Members of a circle you join can see your username,
                Rank Points, ranking, availability status and mission results.
              </p>
              <p>
                <b>Your email address</b> is used to sign you in and is not shown to other circle members.
              </p>
              <p>
                <b>Your activities</b> (including the route) are visible to you. They are shared with other people only
                when you choose to share a card.
              </p>
              <p>
                <b>Live location</b> is off by default. If you turn it on in Settings, or join a Group Run, your current
                position is broadcast to members of that circle while you record. Live positions are relayed in real time
                and are not saved.
              </p>
            </Section>

            <Section title="How we use your data">
              <p>
                We use it to run the app: sign you in, record and verify activities, calculate rankings and rewards,
                deliver missions and notifications, and keep your circle in sync.
              </p>
              <p>
                Activities are checked automatically for impossible speeds or jumps so rankings stay fair. This check is
                done by the server and does not involve a person reading your data.
              </p>
            </Section>

            <Section title="We do not sell your data">
              <p>
                Cidash does not sell your personal information, and does not share it with third parties for advertising
                or marketing.
              </p>
              <p>
                To run the app we rely on service providers that process data on our behalf: web hosting, a database,
                real-time messaging for live circles, map tiles, and a place-name lookup that receives approximate
                coordinates (rounded) when an activity finishes. They only receive what is needed for that purpose.
              </p>
              <p>Information is disclosed otherwise only if the law requires it.</p>
            </Section>

            <Section title="Security">
              <p>
                Data is sent over encrypted connections, circle data is limited to circle members, and access to the
                database is restricted. No system is perfectly secure, and a prototype has had less review than a
                production service.
              </p>
            </Section>

            <Section title="Your choices">
              <p>
                You can leave a circle, turn off live location and notifications in Settings, and stop using the app at any
                time. Self-service account deletion is not available yet. To ask for your data to be removed, contact the
                project maintainers through the project's GitHub page.
              </p>
            </Section>

            <p className="pb-1 text-center text-[11px] font-semibold text-subtle">— End of Privacy & Security —</p>
          </div>

          {!reachedEnd && (
            <p className="flex items-center justify-center gap-1.5 text-xs font-medium text-subtle" aria-live="polite">
              <Icon name="chevronRight" size={14} className="rotate-90" /> Scroll to the end to enable Agree
            </p>
          )}

          <div className="space-y-2">
            <Button fullWidth disabled={!reachedEnd} onClick={() => close(onAgree)}>
              I agree
            </Button>
            <Button fullWidth variant="secondary" onClick={() => close()}>
              Not now
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
