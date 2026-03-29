const { DataTypes } = require('sequelize');
const sequelize = require('../db');

const KommoSession = sequelize.define('KommoSession', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  domain: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  session_id: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  csrf_token: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  obtained_at: {
    type: DataTypes.DATE,
    allowNull: false
  }
}, {
  tableName: 'kommo_sessions',
  timestamps: false
});

KommoSession.sync(); // Crea la tabla si no existe

module.exports = KommoSession;
