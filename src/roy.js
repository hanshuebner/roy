require('dotenv').config()

const fs = require('node:fs')
const Expect = require('node-expect')
const OpenAI = require('openai')
const net = require('net')
const wrapText = require('wrap-text')

const USER_THREADS_FILE = "user-threads.json"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})
const socket = new net.Socket()
const parser = new Expect()

parser.debug = 0

const sleep = ms => new Promise(r => setTimeout(r, ms))

const execDCL = command => {
  console.log(`execDCL: ${command}`)
  socket.write(`${command}\r`, 'utf-8')
}

const handleAuditServerMessage = async (date, time, message) => {
  if (message.match(/Auditable event:.*nteractive login/)) {
    const [_1, user] = message.match(/^Username:\s*(\S+)/m)
    const [_2, terminal] = message.match(/^Terminal name:\s*(\S+)/m)
    await sleep(2000)
    execDCL(`reply/terminal=${terminal} "Hello ${user}.  Your operator Roy is on duty, use SEND or REQUEST to send requests or questions!"`)
  }
}

const handleDecnetMessage = (_date, _time, _message) => {
}

const readUserThreadIds = () => {
  if (fs.existsSync(USER_THREADS_FILE)) {
    return JSON.parse(fs.readFileSync(USER_THREADS_FILE, { encoding: 'utf-8' }))
  } else {
    return {}
  }
}

const writeUserThreadIds = (threads) =>
  fs.writeFileSync(USER_THREADS_FILE, JSON.stringify(threads), { encoding: 'utf-8' })

const USER_THREADS = readUserThreadIds()

const findUserThreadId = async (user) => {
  if (!USER_THREADS[user]) {
    const thread = await openai.beta.threads.create()
    USER_THREADS[user] = thread.id
    writeUserThreadIds(USER_THREADS)
  }
  return USER_THREADS[user]
}

const createResponse = async (user, content, lineLength) => {
  const threadId = await findUserThreadId(user)
  await openai.beta.threads.messages.create(
    threadId,
    {
      role: 'user',
      content
    }
  )
  const run = await openai.beta.threads.runs.createAndPoll(
    threadId,
    {
      assistant_id: process.env.OPENAI_ASSISTANT_ID
    }
  )
  if (run.status !== 'completed') {
    console.log(`run status ${run.status}`)
    return 'I\'m sorry, but I\'m unable to respond at this point.  Try later or call x2342.'
  }
  const messagesPage = await openai.beta.threads.messages.list(
    run.thread_id
  )
  const response = messagesPage.data[0].content[0].text.value.replace(/[\u{0080}-\u{FFFFF}]/gu, '')
  return wrapText(response, lineLength)
    .split(/\n/)
    .filter(s => s.length > 0)
}

const handleUserMessage = async (date, time, user, type, message) => {
  const [terminal, userMessage] = message.split(/, /, 2)
  console.log('terminal', terminal, 'userMessage', userMessage)
  const response = await createResponse(user, userMessage, 79)
  response.forEach(line => execDCL(`reply/bell/terminal=${terminal} "${line}"`))
}

const handleSendMessage = async (match, user, terminal, message) => {
  console.log('user', user, 'terminal', terminal, 'messsage', message)
  const response = await createResponse(user, message, 58)
  response.forEach(line => execDCL(`send ${user} "${line}"`))
}

const handleOpcomMessage = (match, date, time, type, user, host, message) => {
  console.log(date, time, type, user, host, `message: [${message}]`)
  switch (user) {
    case 'AUDIT$SERVER':
      handleAuditServerMessage(date, time, message).then(() => null)
      break
    case 'DECNET':
      handleDecnetMessage(date, time, message)
      break
    default:
      handleUserMessage(date, time, user, type, message).then(() => null)
  }
  return ''
}

const handleOpcomMessages = () => {
  console.log('logged in')
  let data = ''
  socket.on('data', buffer => {
    data = data + buffer.toString().replaceAll(/[\r\x00]/g, '')
    if (data.endsWith('OPERATOR: ')) {
      data.replaceAll(
        /%%%%%%%%%%% +OPCOM +(.*) (.*) +%%%%%%%%%%%\n(Message|Request \d+,) from user (.*) on (.*)\n((.+\n)+)/g,
        handleOpcomMessage)
      data.replaceAll(
        /^(\S+)\((\S+)\)[- \x07]+(.*)\n/gm,
        handleSendMessage)
      console.log(`>>>${data}<<<`)
      data = ''
    }
  })
  setInterval(() => socket.write('\r'), 30000)
}

parser
  .conversation(/./)
  .sync()
  .expect(/Username: /)
  .send(`${process.env.ROY_VAX_USERNAME}\r`)
  .expect(/Password: /)
  .send(`${process.env.ROY_VAX_PASSWORD}\r`)
  .expect(/Last interactive login/)
  .handler(handleOpcomMessages)
  .end()
  .monitor(socket)

process.on('unhandledRejection', error => {
  throw error
})

socket.connect(process.env.ROY_VAX_TELNET_PORT, process.env.ROY_VAX_TELNET_HOST)
