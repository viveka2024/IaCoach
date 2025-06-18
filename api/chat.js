import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Se obtiene de las variables de entorno en Vercel
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Solo se permiten solicitudes POST" });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "El mensaje es requerido" });
  }

  try {
    // Crear hilo de conversación
    const thread = await openai.beta.threads.create();

    // Añadir el mensaje del usuario al hilo
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: message,
    });

    // Ejecutar el asistente
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: process.env.ASSISTANT_ID,
    });

    // Esperar a que el asistente termine la ejecución
    let status = "queued";
    while (status !== "completed") {
      const runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      status = runStatus.status;
      if (status !== "completed") {
        await new Promise((r) => setTimeout(r, 1000)); // Esperar 1 segundo
      }
    }

    // Obtener las respuestas
    const messages = await openai.beta.threads.messages.list(thread.id);
    const firstMessage = messages.data?.[0]?.content?.[0]?.text?.value;

    if (!firstMessage) {
      return res.status(500).json({ error: "El asistente no devolvió una respuesta." });
    }

    // Éxito
    return res.status(200).json({ reply: firstMessage });

  } catch (error) {
    console.error("❌ Error en el servidor:", error);

    // Manejo avanzado de errores si OpenAI devuelve detalles
    if (error.response) {
      const msg = await error.response.text();
      return res.status(error.response.status || 500).json({ error: msg });
    }

    return res.status(500).json({ error: error.message || "Error inesperado del servidor." });
  }
}
