import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { Loader2, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import {
  CURRENT_USER_QUERY_KEY,
  fetchCurrentUser,
  updatePassword,
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
import { PasswordInput } from '@/components/password-input'

const formSchema = z
  .object({
    password: z.string().min(7, 'Password must be at least 7 characters long.'),
    confirmPassword: z.string().min(1, 'Please confirm your password.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  })

interface UpdatePasswordFormProps extends React.HTMLAttributes<HTMLFormElement> {
  resetKey: string
}

export function UpdatePasswordForm({ className, resetKey, ...props }: UpdatePasswordFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)
    try {
      await updatePassword(data.password, resetKey)
      toast.success('Password updated -- signing you in…')

      queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY })
      const user = await queryClient.fetchQuery({
        queryKey: CURRENT_USER_QUERY_KEY,
        queryFn: fetchCurrentUser,
      })
      const role = user ? primaryRole(user.roles) : null
      const home = role ? ROLE_HOME[role] : null
      navigate({ to: home || '/sign-in', replace: true })
    } catch (err) {
      toast.error(
        err instanceof FrappeApiError
          ? err.message
          : 'Could not update your password. Please try again.'
      )
    } finally {
      setIsLoading(false)
    }
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
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>New password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirm password</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button className='mt-2' disabled={isLoading}>
          {isLoading ? <Loader2 className='animate-spin' /> : <KeyRound />}
          Update password
        </Button>
      </form>
    </Form>
  )
}
