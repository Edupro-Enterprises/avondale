import { ContentSection } from '../components/content-section'
import { AccountForm } from './account-form'

export function SettingsAccount() {
  return (
    <ContentSection
      title='Account'
      desc='Manage your administrator account, term calendar, and
          preferred language.'
    >
      <AccountForm />
    </ContentSection>
  )
}
