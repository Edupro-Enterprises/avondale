import { z } from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { UpdatePassword } from '@/features/auth/update-password'

const searchSchema = z.object({
  key: z.string().optional(),
})

export const Route = createFileRoute('/(auth)/update-password')({
  component: UpdatePassword,
  validateSearch: searchSchema,
})
