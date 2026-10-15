import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, type RenderResult } from 'vitest-browser-react'
import { type Locator, userEvent } from 'vitest/browser'
import { UserAuthForm } from './user-auth-form'

const FORM_MESSAGES = {
  emailEmpty: 'Please enter your email.',
  passwordEmpty: 'Please enter your password.',
} as const

const { navigate, loginMock, submitTwoFactorOtpMock, fetchQueryMock, removeQueriesMock } = vi.hoisted(() => ({
  navigate: vi.fn(),
  loginMock: vi.fn(),
  submitTwoFactorOtpMock: vi.fn(),
  fetchQueryMock: vi.fn(),
  removeQueriesMock: vi.fn(),
}))

vi.mock('@/lib/frappe/auth', () => ({
  login: loginMock,
  submitTwoFactorOtp: submitTwoFactorOtpMock,
  fetchCurrentUser: vi.fn(),
  CURRENT_USER_QUERY_KEY: ['current-user'],
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueryClient: () => ({ fetchQuery: fetchQueryMock, removeQueries: removeQueriesMock }),
  }
})

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()
  return {
    ...actual,
    useNavigate: () => navigate,
  }
})

describe('UserAuthForm', () => {
  describe('Rendering without redirectTo', () => {
    let screen: RenderResult
    let emailInput: Locator
    let passwordInput: Locator
    let signInButton: Locator

    beforeEach(async () => {
      vi.clearAllMocks()
      screen = await render(<UserAuthForm />)
      emailInput = screen.getByRole('textbox', { name: /^Email$/i })
      passwordInput = screen.getByLabelText(/^Password$/i)
      signInButton = screen.getByRole('button', { name: /^Sign in$/i })
    })

    it('renders fields and submit button', async () => {
      await expect.element(emailInput).toBeInTheDocument()
      await expect.element(passwordInput).toBeInTheDocument()
      await expect.element(signInButton).toBeInTheDocument()
    })

    it('shows validation messages when submitting empty form', async () => {
      await userEvent.click(signInButton)

      await expect.element(screen.getByText(FORM_MESSAGES.emailEmpty)).toBeInTheDocument()
      await expect.element(screen.getByText(FORM_MESSAGES.passwordEmpty)).toBeInTheDocument()
    })

    it('logs in and navigates to the role home on success', async () => {
      loginMock.mockResolvedValue({ done: true })
      fetchQueryMock.mockResolvedValue({ name: 'bursar@mbarehigh.edu.zw', full_name: 'Tendai Marufu', roles: ['Bursar'] })

      await userEvent.fill(emailInput, 'bursar@mbarehigh.edu.zw')
      await userEvent.fill(passwordInput, 'correct-password')
      await userEvent.click(signInButton)

      await vi.waitFor(() => expect(loginMock).toHaveBeenCalledWith('bursar@mbarehigh.edu.zw', 'correct-password'))
      await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/bursar', replace: true }))
    })

    it('shows an OTP step when login returns a 2FA challenge', async () => {
      loginMock.mockResolvedValue({ done: false, challenge: { tmp_id: 'tmp-123', prompt: 'Check your email' } })

      await userEvent.fill(emailInput, 'bursar@mbarehigh.edu.zw')
      await userEvent.fill(passwordInput, 'correct-password')
      await userEvent.click(signInButton)

      await expect.element(screen.getByText('Check your email')).toBeInTheDocument()
      await expect.element(screen.getByRole('button', { name: /^Verify$/i })).toBeInTheDocument()
    })
  })

  it('navigates to redirectTo when provided, instead of the role home', async () => {
    vi.clearAllMocks()
    loginMock.mockResolvedValue({ done: true })
    fetchQueryMock.mockResolvedValue({ name: 'bursar@mbarehigh.edu.zw', full_name: 'Tendai Marufu', roles: ['Bursar'] })

    const { getByRole, getByLabelText } = await render(<UserAuthForm redirectTo='/bursar/students' />)

    await userEvent.fill(getByRole('textbox', { name: /Email/i }), 'bursar@mbarehigh.edu.zw')
    await userEvent.fill(getByLabelText('Password'), 'correct-password')
    await userEvent.click(getByRole('button', { name: /Sign in/i }))

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/bursar/students', replace: true }))
  })
})
