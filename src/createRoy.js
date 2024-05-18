require('dotenv').config()

const fs = require('fs')
const path = require('path')
const OpenAI = require('openai')
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const instructionsPath = path.join(__dirname, '..', 'model-instructions.txt');

async function createAssistant() {
  const instructions = fs.readFileSync(instructionsPath, 'utf8')
  const assistant = await client.beta.assistants.create({
    name: 'Roy',
    instructions,
    model: 'gpt-4o',
    tools: [
      // Define any tools or functions your assistant needs
    ]
  })
  console.log(`Assistant created with ID: ${assistant.id}`)
}

createAssistant()
