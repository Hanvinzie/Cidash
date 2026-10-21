import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { isStandalone, platform, type LocationIssue } from '../../lib/location';

interface LocationPromptProps {
  issue: Exclude<LocationIssue, 'timeout'>;
  busy: boolean;
  onRetry: () => void;
  onSimulate: () => void;
  onClose: () => void;
}

/** Langkah mengizinkan lokasi yang sudah ditolak — browser tidak bisa memunculkan prompt lagi sendiri. */
function deniedSteps(): string[] {
  const os = platform();
  if (os === 'ios') {
    return isStandalone()
      ? ['Open Settings → Privacy & Security → Location Services.', 'Make sure Location Services is on.', 'Open Safari Websites and choose "While Using the App".']
      : ['Tap "aA" in the Safari address bar → Website Settings.', 'Set Location to "Allow".', 'Come back and tap Try again.'];
  }
  if (os === 'android') {
    return isStandalone()
      ? ['Long-press the Cidash icon → App info → Permissions.', 'Set Location to "Allow only while using the app".', 'Come back and tap Try again.']
      : ['Tap the icon left of the address bar → Permissions.', 'Turn Location on.', 'Come back and tap Try again.'];
  }
  return ['Click the icon left of the address bar.', 'Allow Location for this site.', 'Come back and click Try again.'];
}

const CONTENT: Record<LocationIssue, { title: string; text: string; steps?: () => string[] }> = {
  denied: { title: 'Allow location access', text: 'Cidash needs your location to track distance and verify your run.', steps: deniedSteps },
  unavailable: {
    title: 'Turn on location',
    text: "We can't get a GPS signal. Your phone's location may be turned off.",
    steps: () =>
      platform() === 'ios'
        ? ['Open Settings → Privacy & Security.', 'Turn on Location Services.', 'Go outside or near a window, then try again.']
        : ['Swipe down from the top of the screen.', 'Tap Location to turn it on.', 'Go outside or near a window, then try again.'],
  },
  insecure: {
    title: 'Location needs HTTPS',
    text: 'Browsers only share GPS on secure (https://) pages. Open Cidash from its https link instead of a local IP address.',
  },
  unsupported: { title: 'GPS not available', text: "This browser doesn't support location. You can still try Cidash with simulation mode." },
  timeout: { title: 'Weak GPS signal', text: "We couldn't find you in time." },
};

export default function LocationPrompt({ issue, busy, onRetry, onSimulate, onClose }: LocationPromptProps) {
  const c = CONTENT[issue];
  const canRetry = issue === 'denied' || issue === 'unavailable';

  return (
    <Modal title={c.title} onClose={onClose}>
      {(close) => (
        <div>
          <span className="mx-auto -mt-1 mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary">
            <Icon name="pin" size={26} />
          </span>
          <p className="mb-4 text-center text-sm text-muted">{c.text}</p>

          {c.steps && (
            <ol className="mb-5 space-y-2 rounded-2xl bg-inset p-4 text-sm">
              {c.steps().map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface text-[11px] font-bold text-cidash-primary">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}

          <div className="space-y-2">
            {canRetry && (
              <Button fullWidth size="lg" disabled={busy} onClick={onRetry}>
                {busy ? 'Finding you…' : 'Try again'}
              </Button>
            )}
            <Button variant={canRetry ? 'ghost' : 'primary'} fullWidth onClick={() => close(onSimulate)}>
              Use simulation mode
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
