import { Link, useSearch } from '@tanstack/react-router'
import { UserPlus } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <AuthLayout>
      <Card className='max-w-md gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Sign in to Edupro
          </CardTitle>
          <CardDescription>
            Enter your finance office email and password to access{' '}
            <br className='max-sm:hidden' /> the school dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <UserAuthForm redirectTo={redirect} />
          <p className='text-center text-sm text-muted-foreground'>
            <Link
              to='/forgot-password'
              className='underline underline-offset-4 hover:text-primary'
            >
              Forgot your password?
            </Link>
          </p>
          <div className='relative'>
            <div className='absolute inset-0 flex items-center'>
              <span className='w-full border-t' />
            </div>
            <div className='relative flex justify-center text-xs uppercase'>
              <span className='bg-card px-2 text-muted-foreground'>New family?</span>
            </div>
          </div>
          <Button variant='outline' className='w-full' asChild>
            <Link to='/apply'>
              <UserPlus className='h-4 w-4' />
              Apply for a place
            </Link>
          </Button>
        </CardContent>
        <CardFooter>
          <p className='px-8 text-center text-sm text-muted-foreground'>
            By clicking sign in, you agree to our{' '}
            <a
              href='/terms'
              className='underline underline-offset-4 hover:text-primary'
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href='/privacy'
              className='underline underline-offset-4 hover:text-primary'
            >
              Privacy Policy
            </a>
            .
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
