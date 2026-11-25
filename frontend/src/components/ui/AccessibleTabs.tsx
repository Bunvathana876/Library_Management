import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  count?: number | null;
  icon?: ReactNode;
}

interface AccessibleTabsProps<T extends string> {
  ariaLabel: string;
  tabs: ReadonlyArray<TabItem<T>>;
  activeTab: T;
  onChange: (tabId: T) => void;
  idPrefix?: string;
}

export function AccessibleTabs<T extends string>({
  ariaLabel,
  tabs,
  activeTab,
  onChange,
  idPrefix,
}: AccessibleTabsProps<T>) {
  const fallbackId = useId();
  const prefix = idPrefix ?? fallbackId;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let targetIndex: number | null = null;
    if (e.key === 'ArrowRight') {
      targetIndex = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      targetIndex = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      targetIndex = 0;
    } else if (e.key === 'End') {
      targetIndex = tabs.length - 1;
    }

    if (targetIndex !== null) {
      e.preventDefault();
      const targetTab = tabs[targetIndex];
      if (targetTab) {
        onChange(targetTab.id);
        tabRefs.current[targetIndex]?.focus();
      }
    }
  };

  return (
    <div className="accessible-tablist" role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab, index) => {
        const selected = tab.id === activeTab;
        const tabDomId = `${prefix}-tab-${tab.id}`;
        return (
          <button
            key={tab.id}
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            id={tabDomId}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className="accessible-tab-btn"
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
          >
            {tab.icon ? <span className="accessible-tab-icon" aria-hidden="true">{tab.icon}</span> : null}
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count !== null ? (
              <span className="accessible-tab-count tabular-nums">{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
