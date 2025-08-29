import Fastify from 'fastify'
import dotenv from 'dotenv'
dotenv.config()

import pkg from 'pg'
const { Pool } = pkg

import bcrypt from 'bcrypt'
import fastifyCors from '@fastify/cors'

const api = Fastify({ logger: true })

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true }
})

await api.register(fastifyCors, {
  origin: '*',
  methods: ['POST', 'GET']
});

api.get('/', async (request, reply) => {
  reply.send({ message: 'Servidor funcionando!' })
});

api.get('/status', async (request, reply) => {
  try {
    const result = await pool.query('SELECT NOW()')
    reply.send({ serverTime: result.rows[0].now })
  } catch (err) {
    reply.code(500).send({ error: 'Erro ao conectar ao banco de dados' })
  }
})

api.get('/users', async (request, reply) => {
  try {
    const result = await pool.query('SELECT * FROM usuarios')
    reply.send(result.rows)
  } catch (err) {
    reply.code(500).send({ error: 'Erro ao buscar usuários' })
  }
})

api.post('/users', async (request, reply) => {
  const { nome, data_nascimento, cpf, email, telefone, endereco, username, senha } = request.body;

  if (!nome || !cpf || !email || !username || !senha) {
    return reply.code(400).send({ error: 'Campos obrigatórios ausentes' })
  }

  try {
    const existe = await pool.query(
      'SELECT * FROM usuarios WHERE cpf = $1 OR username = $2',
      [cpf, username]
    )

    if (existe.rows.length > 0) {
      return reply.code(409).send({ error: 'Usuário já cadastrado' })
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10)

    const result = await pool.query(
      `INSERT INTO usuarios (nome, data_nascimento, cpf, email, telefone, endereco, username, senha_hash)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [nome, data_nascimento, cpf, email, telefone, endereco, username, senhaCriptografada]
    )

    reply.code(201).send(result.rows[0])
  } catch (err) {
    reply.code(500).send({ error: 'Erro ao criar usuário' })
  }
})

api.post('/login', async (request, reply) => {
  const { email, senha } = request.body;

  if (!email || !senha) {
    return reply.code(400).send({ error: 'Email e senha são obrigatórios' });
  }

  try {
    const result = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: 'Usuário não encontrado' });
    }

    const usuario = result.rows[0];
    const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);

    if (!senhaValida) {
      return reply.code(401).send({ error: 'Senha incorreta' });
    }

    const { senha_hash, ...usuarioSemSenha } = usuario;

    reply.send({
      mensagem: 'Login realizado com sucesso',
      usuario: usuarioSemSenha
    });
  } catch (err) {
    request.log.error(err);
    reply.code(500).send({ error: 'Erro ao realizar login' });
  }
});

api.put('/users/:id', async (request, reply) => {
  const { id } = request.params
  const { nome, data_nascimento, cpf, email, telefone, endereco, username, senha } = request.body

  if (!nome || !cpf || !email || !username || !senha) {
    return reply.code(400).send({ error: 'Campos obrigatórios ausentes' })
  }

  const senhaCriptografada = await bcrypt.hash(senha, 10);

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
      [nome, data_nascimento, cpf, email, telefone, endereco, username, senhaCriptografada, id]
    )

    if (result.rowCount === 0) {
      reply.code(404).send({ error: 'Usuário não encontrado' })
    } else {
      reply.send(result.rows[0])
    }
  } catch (err) {
    reply.code(500).send({ error: 'Erro ao atualizar usuário' })
  }
})

// const port = process.env.PORT || 3000;

// api.listen({ port }, (err, address) => {
//   if (err) {
//     api.log.error(err);
//     process.exit(1);
//   }
//   api.log.info(`Servidor rodando em ${address}`);
// });

const port = process.env.PORT || 3000;

api.listen({ port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    api.log.error(err);
    process.exit(1);
  }
  api.log.info(`Servidor rodando em ${address}`);
});



