import { Icon, type IconName } from './Icon';

interface IconButtonProps {
  icon: IconName;
  label: string;
  on?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function IconButton({ icon, label, on, danger, disabled, onClick }: IconButtonProps) {
  return (
    <button
      className={'ibtn' + (on ? ' on' : '') + (danger ? ' danger' : '')}
      title={label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  );
}
