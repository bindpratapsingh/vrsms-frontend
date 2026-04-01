import axios from 'axios';

const api = axios.create({
    // Temporarily switch back to your local Java server!
    //baseURL: 'http://localhost:8080/api', 
    
    // (Keep your Render URL commented out below so you don't lose it)
     baseURL: 'https://vrsms-backend.onrender.com/api', 
});

export default api;
