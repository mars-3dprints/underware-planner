import type { ReactNode } from 'react';
import { useStore } from '../../store/store';
import { Icon } from '../../ui/Icon';

/** A sidebar section whose title collapses it. `aside` sits at the right of the title and stays visible. */
export function Section({
  id,
  title,
  aside,
  children,
}: {
  id: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const collapsed = useStore((s) => s.collapsed.includes(id));
  const toggleSection = useStore((s) => s.toggleSection);
  return (
    <section className={collapsed ? 'collapsed' : undefined}>
      <h3>
        <button className="sechead" aria-expanded={!collapsed} onClick={() => toggleSection(id)}>
          <Icon name="chevron" size={14} />
          {title}
        </button>
        {aside}
      </h3>
      {!collapsed && children}
    </section>
  );
}
