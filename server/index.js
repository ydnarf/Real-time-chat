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

async function initializeDatabase() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        Content TEXT
      )
    `)
    console.log("Database initialized.")
  } catch (e) {
    console.error("Error initializing database:", e)
  }
}


initializeDatabase()

io.on('connection', (socket) => {
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
    }
  })
})

app.use(logger('dev'))

app.get('/', (req, res) => {
  res.sendFile(process.cwd() + '/client/index.html')
})

server.listen(port, () => {
  console.log(`Server running on port ${port}`)
})

