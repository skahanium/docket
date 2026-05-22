import { installTheme } from './theme'
import { installNavigation } from './navigation'
import { installFiltersSort } from './filtersSort'
import { installCalendarUi } from './calendarUi'
import { installToast } from './toast'
import { installAppChrome } from './appChrome'
import { installResources } from './resources'
import { installInvalidate } from './invalidate'

export function installAppStore(): void {
  installTheme()
  installNavigation()
  installFiltersSort()
  installCalendarUi()
  installToast()
  installInvalidate()
  installAppChrome()
  installResources()
}
