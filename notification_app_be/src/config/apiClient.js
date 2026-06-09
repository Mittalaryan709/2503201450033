require('dotenv').config();
const axios = require('axios');

const apiClient = axios.create({
  baseURL: process.env.API_BASE_URL || 'http://4.224.186.213/evaluation-service',
  timeout: 8000,
  headers: {
    Authorization: `Bearer ${process.env.API_TOKEN || ''}`,
    'Content-Type': 'application/json',
  },
});

module.exports = apiClient;
