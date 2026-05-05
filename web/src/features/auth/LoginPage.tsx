import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../../app/auth/useAuth'
import { supabase } from '../../app/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { cn } from '../../lib/cn'

const SigninSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
})

const SignupSchema = z
  .object({
    email: z.string().email('Informe um e-mail válido'),
    password: z.string().min(6, 'Mínimo de 6 caracteres'),
    password_confirm: z.string().min(6, 'Confirme a senha'),
  })
  .refine((d) => d.password === d.password_confirm, {
    message: 'As senhas precisam ser iguais',
    path: ['password_confirm'],
  })

type FormValues = z.infer<typeof SignupSchema>

function buildSchema(signup: boolean) {
  return signup ? SignupSchema : SigninSchema
}

export function LoginPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)

  const schema = useMemo(() => buildSchema(mode === 'signup'), [mode])

  const {
    register,
    handleSubmit,
    unregister,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<FormValues>,
    defaultValues: { email: '', password: '', password_confirm: '' },
  })

  useEffect(() => {
    if (mode === 'signin') {
      unregister('password_confirm')
    }
  }, [mode, unregister])

  if (user) return <Navigate to="/app/products" replace />

  const from = (location.state as { from?: string } | null)?.from

  async function onSubmit(values: FormValues) {
    setErrorMsg(null)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword(values)
      if (error) {
        setErrorMsg(error.message)
        return
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      })
      if (error) {
        setErrorMsg(error.message)
        return
      }
    }
    navigate(from ?? '/app/products', { replace: true })
  }

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>ControleFinan</CardTitle>
          <CardDescription>Entre para controlar preços, vendas e folha salarial.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground">E-mail</label>
              <div className="mt-1">
                <Input type="email" autoComplete="email" {...register('email')} />
              </div>
              {errors.email ? (
                <div className="mt-1 text-xs text-destructive">{errors.email.message}</div>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-muted-foreground">Senha</label>
              <div className="relative mt-1">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
              {errors.password ? (
                <div className="mt-1 text-xs text-destructive">{errors.password.message}</div>
              ) : null}
            </div>

            {mode === 'signup' ? (
              <div>
                <label className="block text-sm font-medium text-muted-foreground">Confirmar senha</label>
                <div className="relative mt-1">
                  <Input
                    type={showPasswordConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="pr-10"
                    {...register('password_confirm')}
                  />
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => setShowPasswordConfirm((v) => !v)}
                    aria-label={showPasswordConfirm ? 'Ocultar confirmação' : 'Mostrar confirmação'}
                  >
                    {showPasswordConfirm ? (
                      <EyeOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                </div>
                {errors.password_confirm ? (
                  <div className="mt-1 text-xs text-destructive">{errors.password_confirm.message}</div>
                ) : null}
              </div>
            ) : null}

            {errorMsg ? (
              <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMsg}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {mode === 'signin' ? 'Entrar' : 'Criar conta'}
            </Button>
          </form>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              className={cn('text-sm text-muted-foreground hover:text-foreground hover:underline')}
              onClick={() => {
                setErrorMsg(null)
                setShowPassword(false)
                setShowPasswordConfirm(false)
                setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
              }}
            >
              {mode === 'signin' ? 'Não tem conta? Criar' : 'Já tem conta? Entrar'}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

