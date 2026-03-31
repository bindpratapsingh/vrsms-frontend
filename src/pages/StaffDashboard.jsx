import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const StaffDashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [catalog, setCatalog] = useState([]);
    const [message, setMessage] = useState({ type: '', text: '' });
    
    // UI Navigation State
    const [dashboardTab, setDashboardTab] = useState('COUNTER'); 

    // Checkout State
    const [phoneInput, setPhoneInput] = useState('');
    const [foundCustomer, setFoundCustomer] = useState(null);
    const [selectedMovieId, setSelectedMovieId] = useState('');
    const [activeRentals, setActiveRentals] = useState([]);

    // Registration State (UPDATED TO photoUrl)
    const [regForm, setRegForm] = useState({
        fullName: '', phone: '', address: '', photoUrl: '', depositPaid: false
    });

    const fetchAvailableMovies = useCallback(async () => {
        try {
            const res = await api.get('/inventory/available');
            const movies = res.data || [];
            setCatalog(movies);
            if (movies.length > 0 && movies[0]?.itemId) setSelectedMovieId(movies[0].itemId);
        } catch (error) {
            console.error("Catalog load failed", error);
        }
    }, []);

    useEffect(() => {
        try {
            const loggedInUser = localStorage.getItem('vrsms_user');
            if (!loggedInUser) { navigate('/'); return; }
            
            const parsedUser = JSON.parse(loggedInUser);
            const role = (parsedUser?.role || parsedUser?.userType || '').toUpperCase();
            
            if (['STAFF', 'MANAGER', 'CLERK'].includes(role)) {
                setUser(parsedUser);
                fetchAvailableMovies();
            } else { navigate('/'); }
        } catch (e) {
            localStorage.removeItem('vrsms_user');
            navigate('/');
        }
    }, [navigate, fetchAvailableMovies]);

    const formatPhone = (num) => {
        const cleaned = (num || '').trim();
        if (!cleaned) return '';
        return cleaned.startsWith('+') ? cleaned : `+91${cleaned}`;
    };

    const handleCustomerSearch = async () => {
        if (!phoneInput) return;
        setFoundCustomer(null); setActiveRentals([]); setMessage({ type: '', text: '' });
        try {
            const res = await api.get(`/staff/lookup-member?phone=${encodeURIComponent(formatPhone(phoneInput))}`);
            if (res.data) {
                setFoundCustomer(res.data);
                fetchCustomerRentals(res.data.userId); 
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data || "Member not found." });
        }
    };

    const fetchCustomerRentals = async (id) => {
        try {
            const res = await api.get(`/rentals/my-active/${id}`);
            setActiveRentals(res.data || []);
        } catch (error) { console.error("Rental fetch failed", error); }
    };

    const handleIssueRental = async () => {
        if (!foundCustomer?.memberId || !selectedMovieId) return;
        try {
            await api.post('/rentals/issue', { memberId: foundCustomer.memberId, itemId: selectedMovieId, clerkId: user.userId });
            setMessage({ type: 'success', text: "Rental Issued Successfully!" });
            fetchAvailableMovies(); fetchCustomerRentals(foundCustomer.userId);
        } catch (error) { setMessage({ type: 'error', text: error.response?.data || "Issue failed" }); }
    };

    const handleProcessReturn = async (loanId) => {
        try {
            const res = await api.post('/rentals/return', { loanId, clerkId: user.userId });
            const fine = res.data?.fineAmount || 0;
            setMessage({ type: fine > 0 ? 'error' : 'success', text: fine > 0 ? `Return Success. COLLECT FINE: ₹${fine}` : "Return Success!" });
            fetchAvailableMovies(); fetchCustomerRentals(foundCustomer.userId);
        } catch (error) { setMessage({ type: 'error', text: "Return failed" }); }
    };

    // --- REGISTRATION LOGIC ---
    const handleRegisterMember = async (e) => {
        e.preventDefault();
        if (!regForm.depositPaid) {
            setMessage({ type: 'error', text: "Cannot register member without collecting ₹1000 security deposit." });
            return;
        }
        try {
            const payload = { ...regForm, phone: formatPhone(regForm.phone) };
            await api.post('/staff/register-member', payload);
            setMessage({ type: 'success', text: `Successfully registered ${regForm.fullName}!` });
            
            // Clear form and switch to counter
            setRegForm({ fullName: '', phone: '', address: '', photoUrl: '', depositPaid: false });
            setDashboardTab('COUNTER'); 
            setPhoneInput(regForm.phone); // Auto-fill the search box with the new member!
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data || "Registration failed." });
        }
    };

    if (!user) return null;

    return (
        <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', fontFamily: '"Inter", sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#111827', margin: 0 }}>Staff Dashboard</h1>
                <button onClick={() => { localStorage.removeItem('vrsms_user'); navigate('/'); }} 
                    style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontWeight: '600' }}>
                    Logout
                </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px' }}>
                <button onClick={() => { setDashboardTab('COUNTER'); setMessage({type:'', text:''}); }}
                    style={{ padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', border: 'none', background: 'transparent', cursor: 'pointer',
                    color: dashboardTab === 'COUNTER' ? '#2563eb' : '#6b7280', borderBottom: dashboardTab === 'COUNTER' ? '3px solid #2563eb' : 'none' }}>
                    Checkout Counter
                </button>
                <button onClick={() => { setDashboardTab('REGISTER'); setMessage({type:'', text:''}); }}
                    style={{ padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', border: 'none', background: 'transparent', cursor: 'pointer',
                    color: dashboardTab === 'REGISTER' ? '#059669' : '#6b7280', borderBottom: dashboardTab === 'REGISTER' ? '3px solid #059669' : 'none' }}>
                    Register New Member
                </button>
            </div>

            {message.text && (
                <div style={{ padding: '16px', marginBottom: '24px', borderRadius: '8px', fontWeight: '500', 
                    backgroundColor: message.type === 'error' ? '#fef2f2' : '#f0fdf4', color: message.type === 'error' ? '#991b1b' : '#166534', border: `1px solid ${message.type === 'error' ? '#fee2e2' : '#dcfce7'}` }}>
                    {message.text}
                </div>
            )}

            {dashboardTab === 'COUNTER' && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                        <div style={{ padding: '32px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <h3 style={{ marginTop: 0, fontSize: '18px', color: '#111827', marginBottom: '20px' }}>1. Find Customer</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input type="text" value={phoneInput} onChange={e => setPhoneInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCustomerSearch()} placeholder="Phone number" style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '16px', outline: 'none' }} />
                                <button onClick={handleCustomerSearch} style={{ padding: '12px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Search</button>
                            </div>
                            {foundCustomer && (
                                <div style={{ marginTop: '16px', padding: '12px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #e0f2fe' }}>
                                    <p style={{ margin: 0, color: '#0369a1', fontWeight: '700' }}>✓ {foundCustomer.fullName}</p>
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '32px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', opacity: foundCustomer ? 1 : 0.6 }}>
                            <h3 style={{ marginTop: 0, fontSize: '18px', color: '#111827', marginBottom: '20px' }}>2. Issue Movie</h3>
                            <select value={selectedMovieId} onChange={e => setSelectedMovieId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '16px', marginBottom: '16px', background: 'white' }}>
                                <option value="">-- Select Movie --</option>
                                {catalog.map(m => <option key={m.itemId} value={m.itemId}>{m.title}</option>)}
                            </select>
                            <button onClick={handleIssueRental} disabled={!foundCustomer} style={{ width: '100%', padding: '14px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '16px', cursor: foundCustomer ? 'pointer' : 'not-allowed' }}>Complete Checkout</button>
                        </div>
                    </div>

                    {foundCustomer && (
                        <div style={{ padding: '32px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <h3 style={{ marginTop: 0, fontSize: '18px', color: '#111827', marginBottom: '20px' }}>3. Active Rentals</h3>
                            {activeRentals.length === 0 ? <p style={{ color: '#6b7280' }}>No active rentals for this member.</p> : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ textAlign: 'left', borderBottom: '2px solid #f3f4f6' }}>
                                            <th style={{ padding: '12px 8px', color: '#4b5563' }}>Receipt</th>
                                            <th style={{ padding: '12px 8px', color: '#4b5563' }}>Due Date</th>
                                            <th style={{ padding: '12px 8px', textAlign: 'right' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeRentals.map(r => (
                                            <tr key={r.loanId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                <td style={{ padding: '16px 8px', fontWeight: '600', fontFamily: 'monospace' }}>{r.loanId.substring(0, 8)}</td>
                                                <td style={{ padding: '16px 8px' }}>{new Date(r.dueDate).toLocaleDateString()}</td>
                                                <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                                                    <button onClick={() => handleProcessReturn(r.loanId)} style={{ backgroundColor: '#f97316', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Return Item</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    )}
                </>
            )}

            {dashboardTab === 'REGISTER' && (
                <div style={{ padding: '32px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', maxWidth: '600px', margin: '0 auto' }}>
                    <h2 style={{ marginTop: 0, color: '#111827', marginBottom: '24px' }}>New Member Registration</h2>
                    <form onSubmit={handleRegisterMember}>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>Full Name</label>
                            <input type="text" required value={regForm.fullName} onChange={e => setRegForm({...regForm, fullName: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} placeholder="John Doe" />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>Mobile Number</label>
                            <input type="text" required value={regForm.phone} onChange={e => setRegForm({...regForm, phone: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} placeholder="10-digit mobile number" />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>Physical Address</label>
                            <textarea required value={regForm.address} onChange={e => setRegForm({...regForm, address: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', minHeight: '80px' }} placeholder="Full residential address" />
                        </div>
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>Photo/ID URL</label>
                            <input type="text" required value={regForm.photoUrl} onChange={e => setRegForm({...regForm, photoUrl: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} placeholder="https://..." />
                        </div>
                        
                        <div style={{ marginBottom: '24px', padding: '16px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <input type="checkbox" id="deposit" checked={regForm.depositPaid} onChange={e => setRegForm({...regForm, depositPaid: e.target.checked})} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
                            <label htmlFor="deposit" style={{ fontWeight: '700', color: '#92400e', cursor: 'pointer' }}>
                                I confirm that the ₹1000 Security Deposit has been collected from the customer.
                            </label>
                        </div>

                        <button type="submit" style={{ width: '100%', padding: '14px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '16px', cursor: 'pointer' }}>
                            Register & Activate Member
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
};

export default StaffDashboard;