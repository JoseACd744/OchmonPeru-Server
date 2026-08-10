const { refreshKommoSession } = require('../services/kommoSessionService');

class SessionController {
  // POST /api/session/refresh
  // Fuerza un login con Puppeteer en Kommo y devuelve las cookies de sesión.
  // Pensado para ser llamado por n8n (u otro caller externo), que cachea el
  // resultado por su cuenta y solo pega aquí cuando su cache está vencido.
  async refresh(req, res) {
    const token = req.header('X-Internal-Token');
    if (!process.env.INTERNAL_TOKEN || token !== process.env.INTERNAL_TOKEN) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    try {
      const { sessionId, csrfToken, cookieHeader } = await refreshKommoSession(process.env.SUBDOMINIO);
      res.status(200).json({
        success: true,
        sessionId,
        csrfToken,
        cookieHeader,
        obtainedAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[SessionController] Error refrescando sesión de Kommo:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
}

module.exports = SessionController;
