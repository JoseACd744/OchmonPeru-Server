const express = require('express');
const SessionController = require('../controllers/sessionController');

const router = express.Router();
const sessionController = new SessionController();

router.post('/refresh', sessionController.refresh.bind(sessionController));

module.exports = router;
