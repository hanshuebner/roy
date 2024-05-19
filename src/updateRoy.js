require('dotenv').config()

const fs = require('fs')
const path = require('path')
const OpenAI = require('openai')
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const instructionsPath = path.join(__dirname, '..', 'model-instructions.txt');

async function updateAssistant() {
  const instructions = fs.readFileSync(instructionsPath, 'utf8')
  const assistant = await client.beta.assistants.update(
    process.env.OPENAI_ASSISTANT_ID,
    {
      name: 'Roy',
      instructions,
      model: 'gpt-4o',
      tools: []
    })
  console.log(`Assistant updated`)
}

updateAssistant()
