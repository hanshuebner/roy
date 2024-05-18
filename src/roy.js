require('dotenv').config()

const Expect = require('node-expect')
const axios = require('axios')

const socket = new require('net').Socket({ type: 'tcp4' })
const parser = new Expect()

parser.debug = 0

const handleAuditServerMessage = (date, time, message) => {
  if (message.match(/Auditable event:.*nteractive login/)) {
    const [_1, user] = message.match(/^Username:\s*(\S+)/m)
    const [_2, terminal] = message.match(/^Terminal name:\s*(\S+)/m)
    setTimeout(
      () => socket.write(`reply/terminal=${terminal} "Hello ${user}.  Your operator Roy is on duty, use REQUEST send requests or questions!"\r`, 'utf-8'),
      2000)
  }
}

const handleDecnetMessage = (date, time, message) => {
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

const createResponse = async (user, message) => {
  await sleep(1500)
  return "I'm still too dumb to really respond, sadly"
}

const handleUserMessage = async (date, time, user, type, message) => {
  const [terminal, userMessage] = message.split(/, /, 2)
  console.log('terminal', terminal, 'userMessage', userMessage)
  const response = await createResponse(user, userMessage)
  socket.write(`reply/bell/terminal=${terminal} "${response}"\r`)
}

const handleSendMessage = async (match, user, terminal, message) => {
  console.log('user', user, 'terminal', terminal, 'messsage', message)
  const response = await createResponse(user, message)
  socket.write(`send ${user} "${response}\r`)
}

const handleOpcomMessage = (match, date, time, type, user, host, message) => {
  console.log(date, time, type, user, host, `message: [${message}]`)
  switch (user) {
    case 'AUDIT$SERVER':
      handleAuditServerMessage(date, time, message)
      break
    case 'DECNET':
      handleDecnetMessage(date, time, message)
      break
    default:
      handleUserMessage(date, time, user, type, message)
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
        /%%%%%%%%%%%  OPCOM  (.*) (.*)  %%%%%%%%%%%\n(Message|Request \d+,) from user (.*) on (.*)\n((.+\n)+)/g,
        handleOpcomMessage)
      data.replaceAll(
        /^(\S+)\((\S+)\)[- \x07]+(.*)\n/gm,
        handleSendMessage)
      console.log(`>>>${data}<<<`)
      data = ''
    }
  })
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
