const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const https = require('https');
const Token = require('../models/Token');

const domain = process.env.SUBDOMINIO;

// Leer token desde la base de datos por dominio
async function readTokenFromDB(domain) {
    let token = await Token.findOne({ where: { domain } });
    if (!token) {
        token = await Token.create({ domain, access_token: '', refresh_token: '' });
    }
    return token;
}

// Escribir token en la base de datos por dominio
async function writeTokenToDB(domain, tokenData) {
    let token = await Token.findOne({ where: { domain } });
    if (token) {
        await token.update(tokenData);
    } else {
        await Token.create({ domain, ...tokenData });
    }
}

async function refreshToken() {
    console.log("REFRESH TOKEN *** ");

    const tokenData = await readTokenFromDB(domain);

    const data = {
        client_id: process.env.KOMMO_CLIENT_ID,
        client_secret: process.env.KOMMO_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: tokenData.refresh_token,
        redirect_uri: process.env.KOMMO_REDIRECT_URI,
    };

    const link = `https://${domain}.kommo.com/oauth2/access_token`;

    const agent = new https.Agent({  
        rejectUnauthorized: false
    });

    try {
        const response = await axios.post(link, data, {
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            httpsAgent: agent
        });

        const code = response.status;
        const responseData = response.data;
        console.log('RESPONSE DATA *** ', responseData);

        if (code < 200 || code > 204) {
            const error = responseData.error || 'Undefined error';
            throw new Error(`Error: ${error}\nError code: ${code}`);
        }

        const access_token = responseData.access_token;
        const refresh_token = responseData.refresh_token;

        await writeTokenToDB(domain, { access_token, refresh_token });

        process.env.TOKEN_API_KOMMO = access_token;

        console.log('Tokens actualizados.');
    } catch (error) {
        if (error.response) {
            console.error('Response error:', error.response.data);
            console.error('Status code:', error.response.status);
        } else if (error.request) {
            console.error('No response received:', error.request);
        } else {
            console.error('Request setup error:', error.message);
        }
    }
}

async function authenticate() {
    try {
        const isValid = await verifyToken();
        if (!isValid) {
            await refreshToken();
        }
    } catch (error) {
        console.error('Error during authentication:', error);
    }
}

async function verifyToken() {
    try {
        const tokenData = await readTokenFromDB(domain);
        console.log(`Verificando token en el dominio: ${domain}`);
        const response = await axios.get(`https://${domain}.kommo.com/api/v4/account`, {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
            httpsAgent: new https.Agent({  
                rejectUnauthorized: false
            })
        });
        console.log('Respuesta de verificación del token:', response.status);
        return response.status === 200;
    } catch (error) {
        if (error.response) {
            console.error('Error en la respuesta de verificación del token:', error.response.data);
            if (error.response.status === 401) {
                return false;
            }
        } else {
            console.error('Error en la solicitud de verificación del token:', error.message);
        }
        throw error;
    }
}

// Inicializar tokens desde variables de entorno a la BD
async function initializeTokensFromEnv() {
    try {
        const tokenData = await readTokenFromDB(domain);
        
        // Si no hay tokens en la BD o están vacíos, cargar desde .env
        if (!tokenData.access_token || !tokenData.refresh_token) {
            console.log('Inicializando tokens desde variables de entorno...');
            
            const envAccessToken = process.env.ACCESS_TOKEN_KOMMO;
            const envRefreshToken = process.env.REFRESH_TOKEN_KOMMO;
            
            if (!envAccessToken || !envRefreshToken) {
                throw new Error('No se encontraron ACCESS_TOKEN_KOMMO o REFRESH_TOKEN_KOMMO en las variables de entorno');
            }
            
            await writeTokenToDB(domain, {
                access_token: envAccessToken,
                refresh_token: envRefreshToken
            });
            
            console.log('Tokens inicializados correctamente en la BD desde .env');
            return { access_token: envAccessToken, refresh_token: envRefreshToken };
        }
        
        console.log('Tokens ya existen en la BD');
        return tokenData;
    } catch (error) {
        console.error('Error al inicializar tokens desde .env:', error);
        throw error;
    }
}

module.exports = { refreshToken, verifyToken, authenticate, readTokenFromDB, writeTokenToDB, initializeTokensFromEnv };