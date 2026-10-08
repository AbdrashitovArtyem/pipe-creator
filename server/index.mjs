import { createServer } from 'node:http'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const port = Number(process.env.PORT || 8787)
const root = dirname(fileURLToPath(import.meta.url))
const dataDir = join(root, 'data')
const dbPath = join(dataDir, 'db.json')

function load() {
  if (!existsSync(dbPath)) return { users: [] }
  return JSON.parse(readFileSync(dbPath, 'utf8'))
}

function save(db) {
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(dbPath, JSON.stringify(db))
}

function hashPassword(password, salt) {
  return scryptSync(password, salt, 32).toString('hex')
}

function sameHash(left, right) {
  const a = Buffer.from(left, 'hex')
  const b = Buffer.from(right, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try {
        resolve(JSON.parse(raw))
      } catch {
        reject(new Error('Не разобрать запрос'))
      }
    })
    req.on('error', reject)
  })
}

function send(res, status, body) {
  const raw = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(raw),
  })
  res.end(raw)
}

function userFrom(req, db) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null
  return db.users.find((user) => user.token === token) ?? null
}

function checkName(name) {
  const clean = String(name || '').trim()
  if (clean.length < 2 || clean.length > 32) return null
  return clean
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1')
    const db = load()
    if (req.method === 'POST' && (url.pathname === '/api/register' || url.pathname === '/api/login')) {
      const body = await readBody(req)
      const name = checkName(body.name)
      const password = String(body.password || '')
      if (!name) return send(res, 400, { error: 'Имя от 2 до 32 знаков' })
      if (password.length < 6) return send(res, 400, { error: 'Пароль хотя бы 6 знаков' })
      const key = name.toLocaleLowerCase('ru-RU')
      const existing = db.users.find((user) => user.key === key)
      if (url.pathname === '/api/register') {
        if (existing) return send(res, 409, { error: 'Такое имя уже есть' })
        const salt = randomBytes(16).toString('hex')
        const user = {
          id: randomBytes(8).toString('hex'),
          key,
          name,
          salt,
          hash: hashPassword(password, salt),
          token: randomBytes(24).toString('hex'),
          workshop: null,
        }
        db.users.push(user)
        save(db)
        return send(res, 200, { token: user.token, name: user.name })
      }
      if (!existing || !sameHash(existing.hash, hashPassword(password, existing.salt))) {
        return send(res, 401, { error: 'Имя или пароль не сходятся' })
      }
      existing.token = randomBytes(24).toString('hex')
      save(db)
      return send(res, 200, { token: existing.token, name: existing.name })
    }
    if (url.pathname === '/api/workshop') {
      const user = userFrom(req, db)
      if (!user) return send(res, 401, { error: 'Нужно войти' })
      if (req.method === 'GET') return send(res, 200, { name: user.name, workshop: user.workshop })
      if (req.method === 'PUT') {
        const workshop = await readBody(req)
        if (!workshop?.projects?.length) return send(res, 400, { error: 'Пустую мастерскую не сохраняю' })
        user.workshop = workshop
        save(db)
        return send(res, 200, { ok: true })
      }
    }
    send(res, 404, { error: 'Нет такого пути' })
  } catch (error) {
    send(res, 400, { error: error instanceof Error ? error.message : 'Ошибка' })
  }
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Аккаунты: http://127.0.0.1:${port}`)
})
