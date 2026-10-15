import { ContentSection } from '../components/content-section'
import { ProfileForm } from './profile-form'

export function SettingsProfile() {
  return (
    <ContentSection
      title='School Profile'
      desc='Update your school details as they appear across the parent portal and receipts.'
    >
      <ProfileForm />
    </ContentSection>
  )
}
