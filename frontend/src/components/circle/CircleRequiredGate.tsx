import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Icon from '../ui/Icon';
import { circleOnboarding } from '../../routes';

interface CircleRequiredGateProps {
  feature: 'quests' | 'activity';
}

const COPY = {
  quests: {
    title: 'Challenges are locked',
    description:
      'Create or join a running or cycling circle first to send and receive Bomb Challenges with your friends.',
  },
  activity: {
    title: 'Activity tracking is locked',
    description:
      'Create or join a circle first so your runs or rides match your circle and count toward circle goals and challenges.',
  },
} as const;

/**
 * Tampilan pengganti tab Quests & Activity saat pengguna belum tergabung dalam Circle mana pun.
 * Mengajak pengguna untuk membuat atau bergabung ke Circle terlebih dahulu.
 */
export default function CircleRequiredGate({ feature }: CircleRequiredGateProps) {
  const navigate = useNavigate();
  const { title, description } = COPY[feature];

  return (
    <Card className="mt-10 p-6 text-center">
      <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary">
        <Icon name={feature === 'quests' ? 'quest' : 'activity'} size={26} />
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-muted shadow-sm ring-1 ring-line">
          <Icon name="lock" size={13} strokeWidth={2.2} />
        </span>
      </div>
      <h2 className="mb-1.5 text-lg font-extrabold tracking-tight">{title}</h2>
      <p className="mb-6 text-sm text-muted">{description}</p>
      <Button fullWidth onClick={() => navigate(circleOnboarding)}>
        <Icon name="users" size={16} /> Create or join a circle
      </Button>
    </Card>
  );
}
