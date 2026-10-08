import { useState } from 'react'
import { loginAccount, registerAccount, type Session } from '../domain/account'

interface Props {
  session: Session | null
  server: 'unknown' | 'up' | 'down'
  onSession: (session: Session | null) => void
  onNotice: (text: string) => void
}

export function Account({ session, server, onSession, onNotice }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(kind: 'login' | 'register') {
    setBusy(true)
    try {
      const next = kind === 'login' ? await loginAccount(name, password) : await registerAccount(name, password)
      onSession({ token: next.token, name: next.name })
      setPassword('')
      setOpen(false)
      onNotice(kind === 'login' ? `Вошли как ${next.name}` : `Аккаунт ${next.name} создан, наработки теперь на сервере`)
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Не вышло')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="account">
      {session ? (
        <>
          <span className="account-name">{session.name}</span>
          <button type="button" onClick={() => onSession(null)}>
            Выйти
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setOpen((value) => !value)}>
          Войти
        </button>
      )}
      {open && !session && (
        <form
          className="account-pop"
          onSubmit={(event) => {
            event.preventDefault()
            void submit('login')
          }}
        >
          <p>{server === 'down' ? 'Сервер аккаунтов не запущен. Пока трубки живут только в этом браузере.' : 'Имя и пароль. Наработки уйдут на сервер и не пропадут при очистке браузера.'}</p>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Имя" aria-label="Имя" autoComplete="username" />
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Пароль"
            aria-label="Пароль"
            type="password"
            autoComplete="current-password"
          />
          <div className="row">
            <button type="submit" className="primary" disabled={busy || server === 'down'}>
              Войти
            </button>
            <button type="button" disabled={busy || server === 'down'} onClick={() => void submit('register')}>
              Создать
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
