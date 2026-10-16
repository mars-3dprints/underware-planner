import { Icon, type IconName } from './Icon';

interface IconButtonProps {
  icon: IconName;
  label: string;
  on?: boolean;
  danger?: boolean;
  disabled?: boolean;
  /** Flips the icon horizontally, for the opposite direction of a rotation. */
  mirrored?: boolean;
  onClick: () => void;
}

export function IconButton({ icon, label, on, danger, disabled, mirrored, onClick }: IconButtonProps) {
  return (
    <button
      className={'ibtn' + (on ? ' on' : '') + (danger ? ' danger' : '')}
      title={label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} mirrored={mirrored} />
    </button>
  );
}
