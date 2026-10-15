import { Link } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { ForgotPasswordForm } from './components/forgot-password-form'

export function ForgotPassword() {
  return (
    <AuthLayout>
      <Card className='max-w-sm gap-4 sm:min-w-sm'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Reset your password
          </CardTitle>
          <CardDescription>
            Enter the email on file with your school's finance office{' '}
            <br /> and we'll send a link to reset your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
        <CardFooter>
          <p className='mx-auto px-8 text-center text-sm text-balance text-muted-foreground'>
            <Link
              to='/sign-in'
              className='underline underline-offset-4 hover:text-primary'
            >
              Back to sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
