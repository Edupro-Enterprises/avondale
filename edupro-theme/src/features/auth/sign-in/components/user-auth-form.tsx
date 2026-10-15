import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, LogIn } from 'lucide-react'
import { toast } from 'sonner'
import {
  CURRENT_USER_QUERY_KEY,
  fetchCurrentUser,
  login,
  submitTwoFactorOtp,
  type TwoFactorChallenge,
} from '@/lib/frappe/auth'
import { FrappeApiError } from '@/lib/frappe/client'
import { primaryRole, ROLE_HOME } from '@/lib/frappe/roles'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'

const formSchema = z.object({
  email: z.email({
    error: (iss) => (iss.input === '' ? 'Please enter your email.' : undefined),
  }),
  password: z.string().min(1, 'Please enter your password.'),
})

const otpSchema = z.object({
  otp: z.string().min(1, 'Please enter the code from your email.'),
})

interface UserAuthFormProps extends React.HTMLAttributes<HTMLFormElement> {
  redirectTo?: string
}

/** Real Frappe login, including the 2FA challenge step privileged roles
 * currently have enforced (see lib/frappe/auth.ts's doc comment -- 2FA is
 * temporarily disabled site-wide on production right now, but this still
 * has to handle the challenge branch for when that's fixed). */
export function UserAuthForm({
  className,
  redirectTo,
  ...props
}: UserAuthFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [challenge, setChallenge] = useState<{
    usr: string
    tmpId: string
    prompt?: string
  } | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '' },
  })

  const otpForm = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  })

  async function afterLogin() {
    queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY })
    const user = await queryClient.fetchQuery({
      queryKey: CURRENT_USER_QUERY_KEY,
      queryFn: fetchCurrentUser,
    })
    const role = user ? primaryRole(user.roles) : null
    const home = role ? ROLE_HOME[role] : null
    navigate({ to: redirectTo || home || '/sign-in', replace: true })
  }

  function onChallenge(c: TwoFactorChallenge, usr: string) {
    setChallenge({ usr, tmpId: c.tmp_id, prompt: c.prompt })
  }

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      const result = await login(data.email, data.password)
      if (result.done) {
        toast.success(`Welcome back, ${data.email}!`)
        await afterLogin()
      } else {
        onChallenge(result.challenge, data.email)
      }
    } catch (err) {
      toast.error(
        err instanceof FrappeApiError
          ? 'Incorrect email or password.'
          : 'Sign in failed. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function onSubmitOtp(data: z.infer<typeof otpSchema>) {
    if (!challenge) return
    setIsLoading(true)
    try {
      await submitTwoFactorOtp(challenge.usr, data.otp, challenge.tmpId)
      toast.success(`Welcome back, ${challenge.usr}!`)
      await afterLogin()
    } catch {
      toast.error('That code was incorrect or has expired.')
    } finally {
      setIsLoading(false)
    }
  }

  if (challenge) {
    return (
      <Form {...otpForm}>
        <form
          onSubmit={otpForm.handleSubmit(onSubmitOtp)}
          className={cn('grid gap-3', className)}
          {...props}
        >
          <p className='text-sm text-muted-foreground'>
            {challenge.prompt ||
              'Enter the verification code sent to your email.'}
          </p>
          <FormField
            control={otpForm.control}
            name='otp'
            render={({ field }) => (
              <FormItem>
                <FormLabel>Verification code</FormLabel>
                <FormControl>
                  <Input placeholder='123456' autoFocus {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button className='mt-2' disabled={isLoading}>
            {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
            Verify
          </Button>
        </form>
      </Form>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder='bursar@avondaleprimary.ac.zw' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem className='relative'>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <LogIn />}
          Sign in
        </Button>
      </form>
    </Form>
  )
}
