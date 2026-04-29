import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAuth } from '../../app/auth/useAuth'
import { supabase } from '../../app/supabaseClient'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'

const Schema = z.object({
  email: z.string().email('Informe um e-mail válido'),
  password: z.string().min(6, 'Mínimo de 6 caracteres'),
})

type FormValues = z.infer<typeof Schema>

export function LoginPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(Schema) })

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
      const { error } = await supabase.auth.signUp(values)
      if (error) {
        setErrorMsg(error.message)
        return
      }
    }
    navigate(from ?? '/app/products', { replace: true })
  }

  return (
    <div className="min-h-screen grid place-items-center px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">ControleFinan</h1>
          <p className="mt-1 text-sm text-slate-600">
            Entre para controlar preços, margens e folha salarial.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700">E-mail</label>
            <div className="mt-1">
              <Input type="email" autoComplete="email" {...register('email')} />
            </div>
            {errors.email ? (
              <div className="mt-1 text-xs text-rose-600">{errors.email.message}</div>
            ) : null}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Senha</label>
            <div className="mt-1">
              <Input type="password" autoComplete="current-password" {...register('password')} />
            </div>
            {errors.password ? (
              <div className="mt-1 text-xs text-rose-600">{errors.password.message}</div>
            ) : null}
          </div>

          {errorMsg ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
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
            className="text-sm text-slate-700 hover:underline"
            onClick={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
          >
            {mode === 'signin' ? 'Não tem conta? Criar' : 'Já tem conta? Entrar'}
          </button>
        </div>
      </div>
    </div>
  )
}

