import { useSearch } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UpdatePasswordForm } from './components/update-password-form'

export function UpdatePassword() {
  const { key } = useSearch({ from: '/(auth)/update-password' })

  return (
    <AuthLayout>
      <Card className='max-w-sm gap-4 sm:min-w-sm'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Set a new password
          </CardTitle>
          <CardDescription>
            Choose a new password for your account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {key ? (
            <UpdatePasswordForm resetKey={key} />
          ) : (
            <p className='text-sm text-destructive'>
              This link is missing its reset code. Please use the link from your password reset email.
            </p>
          )}
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
