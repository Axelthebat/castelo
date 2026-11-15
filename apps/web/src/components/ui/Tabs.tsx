import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

interface TabsContextValue {
  value: string;
  select: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

export interface TabItem {
  id: string;
  label: ReactNode;
  /** Conteudo do painel. */
  content?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  /** Aba controlada. Sem este valor, a aba e interna. */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  ariaLabel?: string;
  className?: string;
  /** Abas escritas como `<Tabs.Tab value="...">`. */
  children?: ReactNode;
  /** Alternativa ao uso de filhos: lista de abas, com painel proprio. */
  items?: TabItem[];
}

export interface TabProps {
  value: string;
  children?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * Uma aba. Fica dentro de `Tabs`, que cuida do estado e do foco.
 */
export function Tab({ value, children, disabled, className }: TabProps) {
  const context = useContext(TabsContext);
  if (!context) return null;
  const selected = context.value === value;

  return (
    <button
      type="button"
      role="tab"
      id={`tab-${value}`}
      data-tab-value={value}
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      disabled={disabled}
      className={className ? `tabs-tab ${className}` : 'tabs-tab'}
      onClick={() => context.select(value)}
    >
      {children}
    </button>
  );
}

interface CollectedTab {
  value: string;
  disabled: boolean;
}

function collectTabs(children: ReactNode): CollectedTab[] {
  const collected: CollectedTab[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement<TabProps>(child) && child.type === Tab) {
      collected.push({ value: child.props.value, disabled: child.props.disabled ?? false });
    }
  });
  return collected;
}

/**
 * Abas acessiveis.
 *
 * Navegacao por setas com foco unico (roving tabindex) e `aria-selected`
 * na aba ativa.
 */
export function Tabs({
  value,
  defaultValue,
  onChange,
  ariaLabel,
  className,
  items,
  children,
}: TabsProps) {
  const collected = useMemo<CollectedTab[]>(() => {
    const fromChildren = collectTabs(children);
    if (fromChildren.length > 0) return fromChildren;
    return (items ?? []).map((item) => ({ value: item.id, disabled: item.disabled ?? false }));
  }, [children, items]);

  const [internal, setInternal] = useState<string>(defaultValue ?? collected[0]?.value ?? '');
  const active = value ?? internal;
  const listRef = useRef<HTMLDivElement>(null);

  const select = useCallback(
    (id: string) => {
      if (value === undefined) setInternal(id);
      onChange?.(id);
    },
    [value, onChange],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const enabled = collected.filter((tab) => !tab.disabled);
    if (enabled.length === 0) return;
    const currentIndex = enabled.findIndex((tab) => tab.value === active);
    if (currentIndex < 0) return;

    let nextIndex: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % enabled.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + enabled.length) % enabled.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = enabled.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    const next = enabled[nextIndex];
    select(next.value);
    const node = listRef.current?.querySelector<HTMLButtonElement>(
      `[data-tab-value="${CSS.escape(next.value)}"]`,
    );
    node?.focus();
  };

  const contextValue = useMemo<TabsContextValue>(
    () => ({ value: active, select }),
    [active, select],
  );

  return (
    <div className={className ? `tabs ${className}` : 'tabs'}>
      <TabsContext.Provider value={contextValue}>
        <div
          ref={listRef}
          role="tablist"
          aria-label={ariaLabel}
          className="tabs-list"
          onKeyDown={handleKeyDown}
        >
          {children}
          {items
            ? items.map((item) => (
                <Tab key={item.id} value={item.id} disabled={item.disabled}>
                  {item.label}
                </Tab>
              ))
            : null}
        </div>
      </TabsContext.Provider>
      {items
        ? items.map((item) => (
            <div
              key={item.id}
              role="tabpanel"
              id={`tabpanel-${item.id}`}
              aria-labelledby={`tab-${item.id}`}
              hidden={item.id !== active}
              tabIndex={0}
              className="tabs-panel"
            >
              {item.id === active ? item.content : null}
            </div>
          ))
        : null}
    </div>
  );
}

Tabs.Tab = Tab;
