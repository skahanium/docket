import { type Component, For, Show, createSignal, onMount } from 'solid-js'
import overlayStyles from './SettingsOverlay.module.css'
import navStyles from '../Sidebar/Sidebar.module.css'
import SettingsPanel, { type SettingsPage } from '../SettingsPanel/SettingsPanel'
import CategoryManager from '../CategoryManager/CategoryManager'
import TagManager from '../TagManager/TagManager'
import PlaybookPage from '../PlaybookPage/PlaybookPage'
import domainStyles from '../DomainPage/DomainPage.module.css'

const PAGES: { key: SettingsPage; label: string }[] = [
  { key: 'general', label: '常规' },
  { key: 'runtime', label: '提醒与面板' },
  { key: 'categories', label: '分类' },
  { key: 'tags', label: '标签' },
  { key: 'playbooks', label: '模板' },
  { key: 'data', label: '数据' },
]

const MANAGER_PAGES = new Set<SettingsPage>(['categories', 'tags', 'playbooks'])

interface Props {
  onClose: () => void
}

const SettingsOverlay: Component<Props> = (props) => {
  const [page, setPage] = createSignal<SettingsPage>('general')
  let panelRef: HTMLDivElement | undefined

  onMount(() => {
    panelRef?.focus()
  })

  const managerPage = () => MANAGER_PAGES.has(page())

  return (
    <div
      class={overlayStyles.overlay}
      onClick={props.onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        class={overlayStyles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <nav class={overlayStyles.nav}>
          <p class={navStyles.sectionLabel}>设置</p>
          <div class={navStyles.nav}>
            <For each={PAGES}>
              {(item) => (
                <button
                  type="button"
                  class={`${navStyles.item} ${page() === item.key ? navStyles.itemActive : ''}`}
                  aria-current={page() === item.key ? 'page' : undefined}
                  onClick={() => setPage(item.key)}
                >
                  {item.label}
                </button>
              )}
            </For>
          </div>
        </nav>
        <div class={overlayStyles.body}>
          <div hidden={managerPage()}>
            <SettingsPanel page={page()} />
          </div>
          <Show when={page() === 'categories'}>
            <div class={`${domainStyles.container} ${domainStyles.stacked}`}>
              <h2 class={domainStyles.title}>分类</h2>
              <p class={domainStyles.lead}>用于侧栏筛选今日、任务与事项。</p>
              <CategoryManager />
            </div>
          </Show>
          <Show when={page() === 'tags'}>
            <div class={`${domainStyles.container} ${domainStyles.stacked}`}>
              <h2 class={domainStyles.title}>标签</h2>
              <p class={domainStyles.lead}>用于侧栏筛选，可多标签命中事项指标。</p>
              <TagManager />
            </div>
          </Show>
          <Show when={page() === 'playbooks'}>
            <PlaybookPage embedded />
          </Show>
        </div>
      </div>
    </div>
  )
}

export default SettingsOverlay
