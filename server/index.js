import express from 'express'
import logger from 'morgan'
import dotenv from 'dotenv'
import { createClient } from '@libsql/client'

import { Server } from 'socket.io'
import { createServer } from 'node:http'

dotenv.config()

const port = process.env.PORT ?? 3000

const app = express()
const server = createServer(app)
const io = new Server(server, {
  connectionStateRecovery: {}
})

const db = createClient({
  url: process.env.DB_URL,
  authToken: process.env.DB_TOKEN
})


await db.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        Content TEXT
      )
    `)


io.on('connection', async (socket) => {
  console.log('A user connected')

  socket.on('disconnect', () => {
    console.log('User disconnected')
  })

  socket.on('chat message', async (msg) => {
    let result
    try {
      result = await db.execute({
        sql: `INSERT INTO messages (Content) VALUES (:msg)`,
        args: { msg }
      })
      io.emit('chat message', msg, result.lastInsertRowid.toString())
    } catch (e) {
      console.error("Error inserting message:", e)
      return
    }
  })

  console.log('auth')
  console.log(socket.handshake.auth)

  if (!socket.recovered) {
    try {
      const results = await db.execute({
        sql: `SELECT id, Content FROM messages WHERE id > ?`,
        args: [socket.handshake.auth.serverOffset ?? 0]
      })

      results.rows.forEach(row => {
        socket.emit('chat message', row.Content, row.id.toString())
      })
    } catch (e) {
      console.error("Error fetching messages:", e)
    }
  }
})

app.use(logger('dev'))

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(port, () => {
  console.log(`Server running on port ${port}`)
})

