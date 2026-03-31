import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Import all your pages
import AuthPage from './pages/AuthPage';
import StaffDashboard from './pages/StaffDashboard';
import ManagerDashboard from './pages/ManagerDashboard'; 
import MemberPortal from './pages/MemberPortal';

import './App.css';

function App() {
    return (
        <Router>
            <Routes>
                {/* When someone goes to localhost:5173/, show them the AuthPage */}
                <Route path="/" element={<AuthPage />} />
                <Route path="/member" element={<MemberPortal />} />
                <Route path="/staff" element={<StaffDashboard />} />
                <Route path="/manager" element={<ManagerDashboard />} />
            </Routes>
        </Router>
    );
}

export default App;