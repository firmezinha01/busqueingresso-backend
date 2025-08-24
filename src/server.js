import Fastify from 'fastify'
import dotenv from 'dotenv'
dotenv.config()
import pkg from 'pg'
const { Pool } = pkg

const api = Fastify({ logger: true })

import cors from '@fastify/cors'
await api.register(cors, { origin: true })

// Variáveis esperadas
const DATABASE_URL = process.env.DATABASE_URL
const PORT = process.env.PORT || 3000

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
})

// Rota raiz - apenas para testar o servidor
api.get('/', async (request, reply) => {
  reply.send({ message: 'Servidor funcionando!' })
})

// Rota de status - verifica a conexão com o banco
api.get('/status', async (request, reply) => {
  try {
    const result = await pool.query('SELECT NOW()')
    reply.send({ serverTime: result.rows[0].now })
  } catch (err) {
    api.log.error(err)
    reply.code(500).send({ error: 'Erro ao conectar ao banco de dados' })
  }
})

// Rota de listagem de usuários
api.get('/users', async (request, reply) => {
  try {
    const result = await pool.query('SELECT * FROM usuarios')
    reply.send(result.rows)
  } catch (err) {
    api.log.error(err)
    reply.code(500).send({ error: 'Erro ao buscar usuários no banco de dados' })
  }
})

import bcrypt from 'bcrypt'

api.post('/users', async (request, reply) => {
  const { nome, data_nascimento, cpf, email, telefone, endereco, username, senha_hash } = request.body

  //  Validação de campos obrigatórios
  if (!nome || !cpf || !email || !username || !senha_hash) {
    return reply.code(400).send({ error: 'Campos obrigatórios ausentes' })
  }

  try {
    // Verifica se já existe um usuário com o mesmo CPF ou username
    const existe = await pool.query(
      'SELECT * FROM usuarios WHERE cpf = $1 OR username = $2',
      [cpf, username]
    )

    if (existe.rows.length > 0) {
      return reply.code(409).send({ error: 'Usuário já cadastrado' })
    }

    const senha_hash = await bcrypt.hash(request.body.senha_hash, 10)

    // Se não existir, insere o novo usuário
    const result = await pool.query(
      `INSERT INTO usuarios (nome, data_nascimento, cpf, email, telefone, endereco, username, senha_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [nome, data_nascimento, cpf, email, telefone, endereco, username, senha_hash]
    )

    reply.code(201).send(result.rows[0])
  } catch (err) {
    api.log.error(err)
    reply.code(500).send({ error: 'Erro ao criar usuário' })
  }
})


api.post('/login', async (request, reply) => {
  const { email, senha } = request.body

  // Validação básica
  if (!email || !senha) {
    return reply.code(400).send({ error: 'Email e senha são obrigatórios' })
  }

  try {
    // Busca o usuário pelo email
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email])

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Usuário não encontrado' })
    }

    const usuario = result.rows[0]

    // Verifica a senha usando bcrypt
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash)

    if (!senhaValida) {
      return reply.code(401).send({ error: 'Senha incorreta' })
    }

    // Remove o hash da resposta
    const { senha_hash, ...usuarioSemSenha } = usuario

    reply.send({
      mensagem: 'Login realizado com sucesso',
      usuario: usuarioSemSenha
    })

  } catch (err) {
    api.log.error(err)
    reply.code(500).send({ error: 'Erro ao realizar login' })
  }
})

api.put('/users/:id', async (request, reply) => {
  const { id } = request.params
  const {
    nome, data_nascimento, cpf, email, telefone, endereco, username, senha_hash } = request.body

  // Validação dos campos obrigatórios
  if (!nome || !cpf || !email || !username || !senha_hash) {
    return reply.code(400).send({ error: 'Campos obrigatórios ausentes' })
  }

  try {
    const result = await pool.query(
      `UPDATE usuarios SET
         nome = $1,
         data_nascimento = $2,
         cpf = $3,
         email = $4,
         telefone = $5,
         endereco = $6,
         username = $7,
         senha_hash = $8
       WHERE id = $9 RETURNING *`,
      [nome, data_nascimento, cpf, email, telefone, endereco, username, senha_hash, id]
    )

    if (result.rowCount === 0) {
      reply.code(404).send({ error: 'Usuário não encontrado' })
    } else {
      reply.send(result.rows[0])
    }
  } catch (err) {
    api.log.error(err)
    reply.code(500).send({ error: 'Erro ao atualizar usuário' })
  }
})

// Inicialização do servidor
const start = async () => {
  try {
    await api.listen({ port: 3000 })
    console.log('Servidor rodando em http://localhost:3000')
  } catch (err) {
    api.log.error(err)
    process.exit(1)
  }
}

start()
