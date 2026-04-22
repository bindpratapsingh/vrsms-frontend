import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const AuthPage = () => {
    const [activeTab, setActiveTab] = useState('Member');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    
    // NEW: States for the Member OTP flow
    const [otpSent, setOtpSent] = useState(false);
    const [otpCode, setOtpCode] = useState('');
    
    const navigate = useNavigate();
    // NEW: Helper function to guarantee the +91 format
    const formatPhone = (num) => {
        const cleaned = num.trim();
        // If they already typed a +, leave it alone. Otherwise, add +91!
        return cleaned.startsWith('+') ? cleaned : `+91${cleaned}`;
    };

    // --- STAFF LOGIN FLOW ---
    const handleStaffLogin = async () => {
        if (!phone || !password) {
            alert("Please enter both phone and password.");
            return;
        }
        try {
            const formattedPhone = formatPhone(phone);
            const response = await api.post('/auth/login-staff', { 
                phone: formattedPhone, 
                password: password 
            });
            
            localStorage.setItem('vrsms_user', JSON.stringify(response.data));
            if (response.data.role === 'MANAGER') navigate('/manager');
            else navigate('/staff');
        } catch (error) {
            console.error(error);
            alert("Login failed: " + (error.response?.data || "Check credentials"));
        }
    };

    // --- MEMBER OTP FLOW (Step 1: Request) ---
    const handleRequestOtp = async () => {
        if (!phone) return alert("Please enter your phone number.");
        try {
            const formattedPhone = formatPhone(phone);
            await api.post('/auth/request-otp', { 
                phone: formattedPhone, 
                purpose: 'LOGIN' 
            });
            setOtpSent(true);
            alert("Access code sent! Please check your messages.");
        } catch (error) {
            console.error(error);
            alert("Failed to send OTP: " + (error.response?.data || "Network Error"));
        }
    };

    // --- MEMBER OTP FLOW (Step 2: Verify) ---
    const handleVerifyOtp = async () => {
        if (!otpCode) return alert("Please enter the access code.");
        try {
            const formattedPhone = formatPhone(phone);
            const response = await api.post('/auth/verify-otp', { 
                phone: formattedPhone, 
                purpose: 'LOGIN',
                code: otpCode.trim()
            });
            
            localStorage.setItem('vrsms_user', JSON.stringify(response.data));
            navigate('/member');
        } catch (error) {
            console.error(error);
            alert("Invalid Access Code: " + (error.response?.data || "Try again"));
        }
    };

    return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'linear-gradient(135deg, #1a1a1a 0%, #363636 100%)', fontFamily: 'sans-serif' }}>
            <div style={{ background: 'white', padding: '40px', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', width: '100%', maxWidth: '400px' }}>
                <h1 style={{ textAlign: 'center', margin: '0 0 5px 0', color: '#1a1a1a', fontSize: '28px' }}>VRSMS Portal</h1>
                <p style={{ textAlign: 'center', color: '#666', margin: '0 0 30px 0', fontSize: '14px' }}>Secure Video Rental Access</p>

                {/* TABS */}
                <div style={{ display: 'flex', marginBottom: '25px', borderRadius: '8px', background: '#f5f5f5', padding: '4px' }}>
                    <button 
                        onClick={() => { setActiveTab('Member'); setPassword(''); setOtpSent(false); }} 
                        style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', background: activeTab === 'Member' ? 'white' : 'transparent', color: activeTab === 'Member' ? '#1a1a1a' : '#888', boxShadow: activeTab === 'Member' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}>
                        Member
                    </button>
                    <button 
                        onClick={() => { setActiveTab('Staff'); setOtpSent(false); }} 
                        style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', background: activeTab === 'Staff' ? 'white' : 'transparent', color: activeTab === 'Staff' ? '#1a1a1a' : '#888', boxShadow: activeTab === 'Staff' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none' }}>
                        Staff
                    </button>
                </div>

                {/* PHONE INPUT */}
                <div style={{ marginBottom: (activeTab === 'Staff' || otpSent) ? '15px' : '25px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Registered Phone</label>
                    <input 
                        type="text" 
                        placeholder="10-digit mobile number" 
                        value={phone}
                        disabled={otpSent}
                        onChange={(e) => setPhone(e.target.value)}
                        onKeyDown={(e) => { 
                            if (e.key === 'Enter') {
                                if (activeTab === 'Staff') handleStaffLogin();
                                else handleRequestOtp();
                            } 
                        }}
                        style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box', outline: 'none', backgroundColor: otpSent ? '#f5f5f5' : 'white' }} 
                    />
                </div>

                {/* STAFF PASSWORD INPUT */}
                {activeTab === 'Staff' && (
                    <div style={{ marginBottom: '25px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Secure Password</label>
                        <input 
                            type="password" 
                            placeholder="Enter your password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleStaffLogin(); }}
                            style={{ width: '100%', padding: '12px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box', outline: 'none' }} 
                        />
                    </div>
                )}

                {/* MEMBER OTP INPUT */}
                {activeTab === 'Member' && otpSent && (
                    <div style={{ marginBottom: '25px' }}>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', color: '#333' }}>Access Code (OTP)</label>
                        <input 
                            type="text" 
                            placeholder="Enter the code" 
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleVerifyOtp(); }}
                            style={{ width: '100%', padding: '12px', border: '1px solid #1976d2', borderRadius: '6px', fontSize: '16px', boxSizing: 'border-box', outline: 'none' }} 
                        />
                    </div>
                )}

                {/* DYNAMIC SUBMIT BUTTON */}
                <button 
                    onClick={activeTab === 'Staff' ? handleStaffLogin : (otpSent ? handleVerifyOtp : handleRequestOtp)}
                    style={{ width: '100%', padding: '14px', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}>
                    {activeTab === 'Staff' ? 'Secure Login' : (otpSent ? 'Verify & Enter' : 'Send Access Code')}
                </button>
            </div>
        </div>
    );
};

export default AuthPage;