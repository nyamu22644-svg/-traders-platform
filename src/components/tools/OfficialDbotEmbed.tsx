import React from 'react';

type OfficialDbotView = 'dashboard' | 'bot_builder' | 'charts' | 'tutorials';

interface Props {
  view: OfficialDbotView;
  suppressNativeChrome?: boolean;
}

const VIEW_HASH: Record<OfficialDbotView, string> = {
  dashboard: 'dashboard',
  bot_builder: 'bot_builder',
  charts: 'charts',
  tutorials: 'tutorials',
};

type ExternalModuleTab = {
  id: string;
  label: string;
};

const EXTERNAL_MODULE_TABS: ExternalModuleTab[] = [
  { id: 'free-bots', label: 'Free Bots' },
  { id: 'analysis-tool', label: 'Analysis Tool' },
  { id: 'd-trader', label: 'D-Trader' },
  { id: 'signal-center', label: 'Signal Center' },
  { id: 'money-management', label: 'Money Management' },
  { id: 'copy-trader', label: 'Copy Trader' },
  { id: 'fast-trader', label: 'Fast Trader' },
];

const CUSTOM_STYLE_ID = 'custom-shell-overrides';
const CUSTOM_TAB_ATTR = 'data-custom-shell-tab';
const CUSTOM_TAB_ACTIVE_CLASS = 'custom-shell-tab--active';

export function OfficialDbotEmbed({ view, suppressNativeChrome = true }: Props) {
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const src = React.useMemo(() => `/official-dbot/official-dbot.html#${VIEW_HASH[view]}`, [view]);

  const ensureStyleOverrides = React.useCallback((frameDocument: Document) => {
    let styleTag = frameDocument.getElementById(CUSTOM_STYLE_ID) as HTMLStyleElement | null;

    if (!styleTag) {
      styleTag = frameDocument.createElement('style');
      styleTag.id = CUSTOM_STYLE_ID;
      frameDocument.head.appendChild(styleTag);
    }

    styleTag.textContent = `
      .app-header,
      .deriv-header {
        display: none !important;
      }

      .main {
        height: 100vh !important;
        padding: 0.8rem 1rem 1.2rem !important;
      }

      .main__tabs .dc-tabs__list--header--main__tabs,
      .main__tabs .dc-tabs__list {
        overflow: hidden !important;
      }

      .main__tabs .dc-tabs__list {
        display: flex !important;
        flex-wrap: nowrap !important;
        gap: 0.35rem !important;
        white-space: nowrap !important;
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }

      .main__tabs .dc-tabs__list::-webkit-scrollbar {
        display: none !important;
      }

      .main__tabs .dc-tabs__item {
        flex: 1 1 0 !important;
        min-width: 0 !important;
        height: 4.2rem !important;
        padding: 0 0.45rem !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 0.35rem !important;
      }

      .main__tabs .dc-tabs__item .dc-text {
        font-size: 1.05rem !important;
        line-height: 1.2 !important;
      }

      .main__tabs .dc-tabs__item svg {
        width: 1.25rem !important;
        height: 1.25rem !important;
        margin-inline-end: 0.25rem !important;
      }

      .main__tabs .dc-tabs__item .dc-text,
      .main__tabs .dc-tabs__item .custom-shell-tab__label {
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      .main__tabs .dc-tabs__item.custom-shell-tab {
        border-top-left-radius: 1rem !important;
        border-top-right-radius: 1rem !important;
        color: var(--text-general) !important;
      }

      .main__tabs .dc-tabs__item.custom-shell-tab .custom-shell-tab__label {
        font-size: 1.05rem !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.02em !important;
      }

      .main__tabs .dc-tabs__item.custom-shell-tab.${CUSTOM_TAB_ACTIVE_CLASS} {
        background: var(--general-main-1) !important;
        color: #fff !important;
      }
    `;
  }, []);

  const injectExternalModuleTabs = React.useCallback((frameDocument: Document) => {
    const tabList = frameDocument.querySelector('.main__tabs .dc-tabs__list') as HTMLElement | null;
    const tutorialsTab = frameDocument.getElementById('id-tutorials') as HTMLElement | null;
    if (!tabList || !tutorialsTab) return;

    tabList.querySelectorAll(`li[${CUSTOM_TAB_ATTR}="true"]`).forEach(node => node.remove());

    const clearExternalActive = () => {
      tabList.querySelectorAll(`li[${CUSTOM_TAB_ATTR}="true"]`).forEach(node => {
        node.classList.remove(CUSTOM_TAB_ACTIVE_CLASS);
      });
    };

    const fragment = frameDocument.createDocumentFragment();

    EXTERNAL_MODULE_TABS.forEach((tab) => {
      const tabItem = frameDocument.createElement('li');
      tabItem.className = 'dc-tabs__item dc-tabs__item--top dc-tabs__item--main__tabs custom-shell-tab';
      tabItem.id = `id-${tab.id}`;
      tabItem.setAttribute(CUSTOM_TAB_ATTR, 'true');
      tabItem.setAttribute('role', 'button');
      tabItem.setAttribute('tabindex', '0');

      const label = frameDocument.createElement('span');
      label.className = 'custom-shell-tab__label';
      label.textContent = tab.label;
      tabItem.appendChild(label);

      const activate = () => {
        clearExternalActive();
        tabItem.classList.add(CUSTOM_TAB_ACTIVE_CLASS);
      };

      tabItem.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        activate();
      });

      tabItem.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });

      fragment.appendChild(tabItem);
    });

    const tutorialsNextSibling = tutorialsTab.nextSibling;
    tabList.insertBefore(fragment, tutorialsNextSibling);
  }, []);

  const applyNativeChromeOverrides = React.useCallback(() => {
    const frame = iframeRef.current;
    if (!frame) return;

    try {
      const frameDocument = frame.contentDocument;
      if (!frameDocument) return;

      ensureStyleOverrides(frameDocument);
      injectExternalModuleTabs(frameDocument);

      const tabsRoot = frameDocument.querySelector('.main__tabs');
      if (tabsRoot) {
        const frameWithObserver = frame as HTMLIFrameElement & {
          __customTabsObserver?: MutationObserver;
        };

        if (frameWithObserver.__customTabsObserver) {
          frameWithObserver.__customTabsObserver.disconnect();
        }

        const observer = new MutationObserver(() => {
          ensureStyleOverrides(frameDocument);
          injectExternalModuleTabs(frameDocument);
        });

        observer.observe(tabsRoot, {
          childList: true,
          subtree: true,
        });

        frameWithObserver.__customTabsObserver = observer;
      }

      [150, 400, 800].forEach((delay) => {
        window.setTimeout(() => {
          ensureStyleOverrides(frameDocument);
          injectExternalModuleTabs(frameDocument);
        }, delay);
      });
    } catch {
      // Ignore cross-origin access errors in non-local deployments.
    }
  }, [ensureStyleOverrides, injectExternalModuleTabs]);

  return (
    <div className="h-full w-full overflow-hidden bg-white">
      <iframe
        ref={iframeRef}
        key={src}
        src={src}
        title="Official Deriv DBot"
        className="h-full w-full border-0"
        loading="eager"
        referrerPolicy="no-referrer"
        onLoad={suppressNativeChrome ? applyNativeChromeOverrides : undefined}
      />
    </div>
  );
}
