const axios = require('axios');

const BASE_URL = 'http://4.224.186.213/evaluation-service';

// API key is expected in the environment; set it before running
const AUTH_TOKEN = process.env.API_TOKEN || '';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    Authorization: `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

async function fetchDepots() {
  const response = await client.get('/depots');
  return response.data.depots;
}

async function fetchVehicles() {
  const response = await client.get('/vehicles');
  return response.data.vehicles;
}

module.exports = { fetchDepots, fetchVehicles };
