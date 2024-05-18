const Expect = require('node-expect')
const axios = require('axios')

const socket = new require('net').Socket({ type: 'tcp4' })
const parser = new Expect()

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

const handleUserMessage = (date, time, user, type, message) => {
  const [terminal, userMessage] = message.split(/, /, 2)
  console.log('terminal', terminal, 'userMessage', userMessage)
  setTimeout(
    () => socket.write(`reply/terminal=${terminal} "I'm still too dumb to really respond"\r`),
    1500
  )
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
      console.log(`>>>${data}<<<`)
      data = ''
    }
  })
}

parser
  .conversation(/User Access Verification/)
  .sync()
  .expect(/Password:/)
  .send('cisco\r')
  .expect(/cisco.netmbx.org>/)
  .send('lat eugene\r')
  .expect(/Username:/)
  .send('operator\r')
  .expect(/Password:/)
  .send('dke3nrkjcn\r')
  .expect(/Last interactive login/)
  .handler(handleOpcomMessages)
  .end()
  .monitor(socket)

process.on('unhandledRejection', error => {
  throw error
})

socket.connect(23, 'cisco.netmbx.org')
