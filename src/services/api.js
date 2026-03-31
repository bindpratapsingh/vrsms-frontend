import axios from 'axios';

// This points React directly to your Spring Boot server!
const api = axios.create({
   // baseURL: 'http://localhost:8080/api', 
      baseURL: 'https://vrsms-backend.onrender.com/api',
    headers: {
        'Content-Type': 'application/json',
    }
});

export default api;
