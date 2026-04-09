const OpenAIService = require('../services/openaiService');
const FormService = require('../services/formService'); // Importar FormService

/**
 * Clase OpenAIController que maneja las solicitudes relacionadas con OpenAI.
 */
class OpenAIController {
  constructor() {
    this.openAIService = new OpenAIService();
    this.formService = new FormService(); // Crear una instancia de FormService
  }

  respondAccepted(res) {
    if (!res.headersSent) {
      res.status(200).json({ ok: true });
    }
  }

  runInBackground(taskName, task) {
    setImmediate(() => {
      Promise.resolve(task()).catch(error => {
        console.error(`Error en ${taskName}:`, error);
      });
    });
  }

  /**
   * Maneja la solicitud para procesar un mensaje de cliente.
   * @param {Object} req - El objeto de solicitud.
   * @param {Object} res - El objeto de respuesta.
   */
  async handleClientMessage(req, res) {
    try {
      const { thread_id, lead_id, msj_client } = req.body.data;

      // Crear un nuevo hilo si no se proporciona uno
      let threadId = thread_id || await this.openAIService.createdConversation();

      // Procesar el mensaje y obtener la respuesta de OpenAI
      const responseAI = await this.openAIService.main(msj_client, threadId, lead_id);

      // Enviar la respuesta al cliente
      res.status(200).json({ msj: responseAI, threadId: threadId });
    } catch (error) {
      console.error("Error en handleClientMessage:", error);
      res.status(500).json({ message: 'Error al procesar la solicitud' });
    }
  }

  /**
   * Maneja la solicitud para la ruta base_ia.
   * @param {Object} req - El objeto de solicitud.
   * @param {Object} res - El objeto de respuesta.
   */
  async handleBaseIA(req, res) {
    try {
      const payload = req.body;
      this.respondAccepted(res);

      this.runInBackground('handleBaseIA', async () => {
        const requestData = await this.openAIService.processRequestData({ body: payload });
        if (!requestData) {
          return;
        }

        const { msj_client, lead_id, conversation_id } = requestData;

        // Crear un nuevo hilo si no se proporciona uno
        const threadId = conversation_id || await this.openAIService.createdConversation();

        // Procesar el mensaje y obtener la respuesta de OpenAI
        await this.openAIService.main(msj_client, threadId, lead_id);
      });
    } catch (error) {
      console.error("Error en handleBaseIA:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error al procesar la solicitud' });
      }
    }
  }

  /**
   * Maneja la solicitud para procesar datos del formulario.
   * @param {Object} req - El objeto de solicitud.
   * @param {Object} res - El objeto de respuesta.
   */
  async handleFormData(req, res) {
    try {
      const payload = req.body;
      this.respondAccepted(res);

      this.runInBackground('handleFormData', async () => {
        await this.formService.processRequestData({ body: payload }); // Usar formService
      });
    } catch (error) {
      console.error("Error en handleFormData:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error al procesar la solicitud' });
      }
    }
  }

  /**
   * Maneja la solicitud de prueba sin Kommo
   * @param {Object} req - El objeto de solicitud.
   * @param {Object} res - El objeto de respuesta.
   */
  async handleTestChat(req, res) {
    try {
      const { message, conversation_id } = req.body;

      if (!message || message.trim() === '') {
        return res.status(400).json({ 
          error: 'El mensaje no puede estar vacío' 
        });
      }

      console.log('Test Chat - Mensaje recibido:', message);
      console.log('Test Chat - Conversation ID:', conversation_id || 'nuevo');

      // Crear una nueva conversación si no se proporciona una
      let conversationId = conversation_id;
      if (!conversationId) {
        console.log('Creando nueva conversación...');
        conversationId = await this.openAIService.createdConversation();
        console.log('Nueva conversación creada:', conversationId);
      }

      // Procesar el mensaje con el servicio de OpenAI
      // Usamos null como lead_id ya que no estamos conectados a Kommo
      const responseAI = await this.openAIService.main(message, conversationId, null);

      console.log('Test Chat - Respuesta generada:', responseAI);

      // Enviar la respuesta al cliente
      res.status(200).json({ 
        response: responseAI, 
        conversation_id: conversationId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error en handleTestChat:", error);
      res.status(500).json({ 
        error: 'Error al procesar la solicitud',
        details: error.message 
      });
    }
  }
}

module.exports = OpenAIController;