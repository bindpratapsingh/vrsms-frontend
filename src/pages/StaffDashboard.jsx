import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Webcam from "react-webcam";
import { QRCodeSVG } from 'qrcode.react'; 

const StaffDashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [catalog, setCatalog] = useState([]);
    const [message, setMessage] = useState({ type: '', text: '' });
    
    const [dashboardTab, setDashboardTab] = useState('COUNTER'); 
    const [allMembers, setAllMembers] = useState([]);
    
    const [allTransactions, setAllTransactions] = useState([]);
    const [txFilter, setTxFilter] = useState('ALL'); 
    const [txStartDate, setTxStartDate] = useState('');
    const [txEndDate, setTxEndDate] = useState('');

    const [searchTerm, setSearchTerm] = useState(''); 
    const [foundCustomer, setFoundCustomer] = useState(null);
    const [selectedMovieId, setSelectedMovieId] = useState('');
    const [activeRentals, setActiveRentals] = useState([]);
    const [customerHistory, setCustomerHistory] = useState([]); 

    // --- NEW: PRE-RETURN CONFIRMATION MODAL & COUPON STATE ---
    const [preReturnModal, setPreReturnModal] = useState({ show: false, loanId: null, title: '' });
    const [couponInput, setCouponInput] = useState('');
    const [couponApplied, setCouponApplied] = useState(false);

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentDetails, setPaymentDetails] = useState({ amount: 0, upiLink: '' });

    const [isEditingCustomer, setIsEditingCustomer] = useState(false);
    const [editCustomerForm, setEditCustomerForm] = useState({ fullName: '', phone: '', address: '', photoUrl: '' });

    const [regForm, setRegForm] = useState({ fullName: '', phone: '', address: '', photoUrl: '', depositPaid: false });
    const webcamRef = useRef(null);

    const capturePhoto = useCallback(() => {
        if (webcamRef.current) {
            const imageSrc = webcamRef.current.getScreenshot();
            if (imageSrc) {
                setRegForm(prev => ({...prev, photoUrl: imageSrc}));
                setMessage({ type: 'success', text: 'Photo captured successfully!' });
            }
        }
    }, [webcamRef]);

    const loadInitialData = useCallback(async () => {
        try {
            const resMovies = await api.get('/inventory/available');
            const movies = resMovies.data || [];
            const groupedMovies = movies.reduce((acc, movie) => {
                const key = `${movie.title} - ${movie.format}`;
                if (!acc[key]) acc[key] = { title: movie.title, format: movie.format, count: 0, itemIds: [] };
                acc[key].count += 1;
                acc[key].itemIds.push(movie.itemId); 
                return acc;
            }, {});
            const groupedArray = Object.values(groupedMovies);
            setCatalog(groupedArray);
            if (groupedArray.length > 0) setSelectedMovieId(groupedArray[0].itemIds[0]);

            const resMembers = await api.get('/staff/members/all');
            setAllMembers(resMembers.data || []);
            
            const resTx = await api.get('/rentals/all');
            setAllTransactions(resTx.data || []);

        } catch (error) {
            console.error("Dashboard data load failed", error);
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
                loadInitialData();
            } else { navigate('/'); }
        } catch (e) {
            localStorage.removeItem('vrsms_user');
            navigate('/');
        }
    }, [navigate, loadInitialData]);

    const formatPhone = (num) => {
        const cleaned = (num || '').trim();
        if (!cleaned) return '';
        return cleaned.startsWith('+') ? cleaned : `+91${cleaned}`;
    };

    const selectCustomer = async (memberObj) => {
        setFoundCustomer(memberObj);
        setSearchTerm(memberObj.fullName); 
        setMessage({ type: '', text: '' });
        setIsEditingCustomer(false);
        
        try {
            const rentalsRes = await api.get(`/rentals/my-active/${memberObj.userId}`);
            setActiveRentals(rentalsRes.data || []);
        } catch (e) { setActiveRentals([]); }

        try {
            const historyRes = await api.get(`/history/${memberObj.userId}`);
            setCustomerHistory(historyRes.data || []);
        } catch (e) { setCustomerHistory([]); }
    };

    const refreshCustomerData = async (phone) => {
        try {
            const resMembers = await api.get('/staff/members/all');
            setAllMembers(resMembers.data || []);
            
            const updatedCustomer = resMembers.data.find(m => m.phone === phone || m.phone === `+91${phone.replace('+91','')}`);
            if (updatedCustomer) setFoundCustomer(updatedCustomer);
        } catch (e) { console.error("Could not refresh customer"); }
    };

    const handleCustomerSearch = async () => {
        if (!searchTerm) return;
        setFoundCustomer(null); setActiveRentals([]); setCustomerHistory([]); setMessage({ type: '', text: '' });
        setIsEditingCustomer(false);
        try {
            const formattedPhone = formatPhone(searchTerm);
            const res = await api.get(`/staff/lookup-member?phone=${encodeURIComponent(formattedPhone)}`);
            if (res.data) {
                selectCustomer(res.data);
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data || "Member not found." });
        }
    };

    const handleSaveCustomerEdit = async () => {
        try {
            const payload = { ...editCustomerForm, phone: formatPhone(editCustomerForm.phone) };
            await api.put(`/staff/members/edit/${foundCustomer.userId}`, payload);
            setMessage({ type: 'success', text: 'Customer profile updated!' });
            setIsEditingCustomer(false);
            refreshCustomerData(payload.phone);
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data || "Failed to update member." });
        }
    };

    const handleEditClick = () => {
        setEditCustomerForm({
            fullName: foundCustomer.fullName || '',
            phone: foundCustomer.phone ? foundCustomer.phone.replace('+91', '') : '',
            address: foundCustomer.address || '',
            photoUrl: foundCustomer.photoUrl || ''
        });
        setIsEditingCustomer(true);
    };

    const handlePayDues = () => {
        const amount = foundCustomer.currentDues || 0;
        const upiUrl = `upi://pay?pa=bindpratapsingh@oksbi&pn=VRSMS&am=${amount}&cu=INR`;
        setPaymentDetails({ amount: amount, upiLink: upiUrl });
        setShowPaymentModal(true);
    };

    const handleClearDues = async () => {
        if (!foundCustomer) return;
        try {
            await api.post(`/staff/members/${foundCustomer.userId}/clear-dues`);
            setMessage({ type: 'success', text: "Account Unlocked: Dues cleared via Cash/Override!" });
            refreshCustomerData(foundCustomer.phone); 
        } catch (error) {
            setMessage({ type: 'error', text: "Failed to clear dues." });
        }
    };

    const confirmPaymentAndClearDues = async () => {
        setShowPaymentModal(false);
        if (foundCustomer && paymentDetails.amount > 0) {
            try {
                await api.post(`/staff/members/${foundCustomer.userId}/clear-dues`);
                setMessage({ type: 'success', text: "Payment confirmed via UPI and Account Unlocked!" });
                refreshCustomerData(foundCustomer.phone); 
            } catch (e) {
                console.error("Failed to auto-clear dues", e);
            }
        }
    };

    const handleIssueRental = async () => {
        if (!foundCustomer?.memberId || !selectedMovieId) return;
        try {
            await api.post('/rentals/issue', { memberId: foundCustomer.memberId, itemId: selectedMovieId, clerkId: user.userId });
            setMessage({ type: 'success', text: "Rental Issued Successfully!" });
            loadInitialData(); 
            selectCustomer(foundCustomer); 
        } catch (error) { setMessage({ type: 'error', text: error.response?.data || "Issue failed" }); }
    };

    // --- UPDATED: ACTUAL BACKEND CALL RUNS ONLY AFTER MODAL CONFIRMATION ---
    const handleProcessReturn = async (loanId) => {
        setPreReturnModal({ show: false, loanId: null, title: '' }); // Close the modal
        
        try {
            const res = await api.post('/rentals/return', { 
                loanId, 
                clerkId: user.userId,
                couponCode: couponInput 
            });
            
            const rentDue = res.data?.rentAmount || 0;
            const fineDue = res.data?.fineAmount || 0;
            const totalToCollect = rentDue + fineDue;
            
            const upiUrl = `upi://pay?pa=bindpratapsingh@oksbi&pn=VRSMS&am=${totalToCollect}&cu=INR`;
            setPaymentDetails({ amount: totalToCollect, upiLink: upiUrl });
            
            if (totalToCollect > 0) {
                setShowPaymentModal(true); 
            } else {
                setMessage({ type: 'success', text: "Return Success! No payment due." });
            }

            setCouponInput(''); 
            setCouponApplied(false);
            loadInitialData();
            refreshCustomerData(foundCustomer.phone); 
            selectCustomer(foundCustomer);
        } catch (error) { setMessage({ type: 'error', text: error.response?.data || "Return failed" }); }
    };

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
            
            setRegForm({ fullName: '', phone: '', address: '', photoUrl: '', depositPaid: false });
            setDashboardTab('COUNTER'); 
            
            await loadInitialData();
            setSearchTerm(payload.phone);
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data || "Registration failed." });
        }
    };

    const getFilteredTransactions = () => {
        return allTransactions.filter(tx => {
            if (txFilter === 'ALL') return true;
            
            const txDate = new Date(tx.returnDate || tx.issueDate);
            txDate.setHours(0, 0, 0, 0);
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (txFilter === 'TODAY') {
                return txDate.getTime() === today.getTime();
            }
            if (txFilter === 'YESTERDAY') {
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                return txDate.getTime() === yesterday.getTime();
            }
            if (txFilter === 'CUSTOM') {
                if (!txStartDate || !txEndDate) return true;
                const start = new Date(txStartDate); start.setHours(0, 0, 0, 0);
                const end = new Date(txEndDate); end.setHours(0, 0, 0, 0);
                return txDate >= start && txDate <= end;
            }
            return true;
        });
    };

    const filteredTransactions = getFilteredTransactions();

    if (!user) return null;

    return (
        <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', fontFamily: '"Inter", sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            
            {/* --- NEW: PRE-RETURN CONFIRMATION MODAL WITH CUT (X) SYMBOL --- */}
            {preReturnModal.show && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '12px', maxWidth: '400px', width: '90%', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        {/* The Cut / Cancel Button */}
                        <button onClick={() => setPreReturnModal({show: false, loanId: null, title: ''})} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9ca3af', lineHeight: '1' }}>
                            ✖
                        </button>
                        
                        <h2 style={{ margin: '0 0 10px 0', color: '#111827' }}>Confirm Return</h2>
                        <p style={{ margin: '0 0 20px 0', color: '#4b5563', fontSize: '15px' }}>
                            Are you ready to check in <strong style={{color: '#111827'}}>{preReturnModal.title}</strong>?
                        </p>

                        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', border: '1px dashed #cbd5e1', marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', color: '#374151', marginBottom: '8px' }}>Apply Promo Code:</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input 
                                    type="text" 
                                    value={couponInput} 
                                    onChange={e => {setCouponInput(e.target.value.toUpperCase()); setCouponApplied(false);}} 
                                    placeholder="e.g. MEMBER10" 
                                    style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontWeight: 'bold' }} 
                                />
                                {/* Explicit Apply Button */}
                                <button 
                                    onClick={() => couponInput && setCouponApplied(true)} 
                                    style={{ padding: '8px 16px', background: couponApplied ? '#10b981' : '#0ea5e9', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
                                >
                                    {couponApplied ? 'Applied!' : 'Apply'}
                                </button>
                            </div>
                            {couponApplied && couponInput && <span style={{ fontSize: '12px', color: '#059669', fontWeight: 'bold', display: 'block', marginTop: '8px' }}>✓ Discount will be applied to bill</span>}
                        </div>

                        <button onClick={() => handleProcessReturn(preReturnModal.loanId)} style={{ width: '100%', padding: '14px', background: '#f97316', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>
                            Confirm Return & Generate Bill
                        </button>
                    </div>
                </div>
            )}

            {/* QR CODE PAYMENT MODAL */}
            {showPaymentModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
                        <h2 style={{ margin: '0 0 10px 0', color: '#111827' }}>Payment Due</h2>
                        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 5px 0' }}>(Rent + Late Fines)</p>
                        <p style={{ fontSize: '32px', fontWeight: '800', color: '#dc2626', margin: '10px 0' }}>₹{paymentDetails.amount.toFixed(2)}</p>
                        <p style={{ color: '#6b7280', marginBottom: '20px' }}>Scan to pay via Any UPI App</p>
                        
                        <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '12px', display: 'inline-block', marginBottom: '20px' }}>
                            <QRCodeSVG value={paymentDetails.upiLink} size={200} />
                        </div>

                        <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>To: bindpratapsingh@oksbi</p>
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => setShowPaymentModal(false)} style={{ flex: 1, padding: '12px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                                Cancel / Pay Later
                            </button>
                            <button onClick={confirmPaymentAndClearDues} style={{ flex: 1, padding: '12px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                                Payment Confirmed
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#111827', margin: 0 }}>Staff Dashboard</h1>
                <button onClick={() => { localStorage.removeItem('vrsms_user'); navigate('/'); }} 
                    style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontWeight: '600' }}>
                    Logout
                </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', overflowX: 'auto' }}>
                <button onClick={() => { setDashboardTab('COUNTER'); setMessage({type:'', text:''}); }}
                    style={{ padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
                    color: dashboardTab === 'COUNTER' ? '#2563eb' : '#6b7280', borderBottom: dashboardTab === 'COUNTER' ? '3px solid #2563eb' : 'none' }}>
                    Checkout Counter
                </button>
                <button onClick={() => { setDashboardTab('MEMBERS'); setMessage({type:'', text:''}); }}
                    style={{ padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
                    color: dashboardTab === 'MEMBERS' ? '#8b5cf6' : '#6b7280', borderBottom: dashboardTab === 'MEMBERS' ? '3px solid #8b5cf6' : 'none' }}>
                    Members Database
                </button>
                <button onClick={() => { setDashboardTab('TRANSACTIONS'); setMessage({type:'', text:''}); }}
                    style={{ padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
                    color: dashboardTab === 'TRANSACTIONS' ? '#d97706' : '#6b7280', borderBottom: dashboardTab === 'TRANSACTIONS' ? '3px solid #d97706' : 'none' }}>
                    Transactions Ledger
                </button>
                <button onClick={() => { setDashboardTab('REGISTER'); setMessage({type:'', text:''}); }}
                    style={{ padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
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
                        
                        <div style={{ padding: '32px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', position: 'relative' }}>
                            <h3 style={{ marginTop: 0, fontSize: '18px', color: '#111827', marginBottom: '20px' }}>1. Find Customer</h3>
                            
                            <input 
                                type="text" 
                                value={searchTerm} 
                                onChange={e => { setSearchTerm(e.target.value); setFoundCustomer(null); }} 
                                placeholder="Type Name or Phone..." 
                                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} 
                            />
                            
                            {!foundCustomer && searchTerm && (
                                <div style={{ position: 'absolute', top: '100px', left: '32px', right: '32px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
                                    {allMembers.filter(m => m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || m.phone.includes(searchTerm)).map(m => (
                                        <div key={m.userId} onClick={() => selectCustomer(m)} style={{ padding: '12px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <img src={m.photoUrl} onError={(e) => { e.target.onerror=null; e.target.src=`https://placehold.co/40x40/0284c7/white?text=${m.fullName.charAt(0)}` }} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                                            <div>
                                                <div style={{ fontWeight: 'bold', color: '#111827' }}>{m.fullName}</div>
                                                <div style={{ fontSize: '12px', color: '#6b7280' }}>{m.phone}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {foundCustomer && !isEditingCustomer && (
                                <div style={{ marginTop: '16px', padding: '16px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #e0f2fe', position: 'relative' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        {foundCustomer.photoUrl && foundCustomer.photoUrl.trim() !== '' ? (
                                            <img 
                                                src={foundCustomer.photoUrl} 
                                                alt={foundCustomer.fullName} 
                                                onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/80x80/0284c7/white?text=${foundCustomer.fullName.charAt(0)}`; }}
                                                style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #0284c7' }} 
                                            />
                                        ) : (
                                            <div style={{ width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#0284c7', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px', fontWeight: 'bold', border: '2px solid #0284c7' }}>
                                                {foundCustomer.fullName.charAt(0).toUpperCase()}
                                            </div>
                                        )}
                                        <div>
                                            <p style={{ margin: 0, color: '#0369a1', fontWeight: '700', fontSize: '18px' }}>✓ {foundCustomer.fullName}</p>
                                            <p style={{ margin: '4px 0 0 0', color: '#0284c7', fontSize: '14px', fontFamily: 'monospace' }}>{foundCustomer.phone}</p>
                                        </div>
                                    </div>
                                    
                                    <div style={{ marginTop: '15px', borderTop: '1px solid #bae6fd', paddingTop: '15px' }}>
                                        <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold', color: foundCustomer.currentDues > 0 ? '#dc2626' : '#166534' }}>
                                            Account Balance: {foundCustomer.currentDues > 0 ? `₹${foundCustomer.currentDues.toFixed(2)} Due` : 'Clear'}
                                        </p>
                                        
                                        {foundCustomer.currentDues > 0 && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={handlePayDues} style={{ flex: 1, padding: '8px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                                                    📱 Pay via UPI
                                                </button>
                                                <button onClick={handleClearDues} style={{ flex: 1, padding: '8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>
                                                    💵 Cash / Waive
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <button onClick={handleEditClick} style={{ position: 'absolute', top: '16px', right: '16px', padding: '6px 12px', background: 'white', color: '#0284c7', border: '1px solid #0284c7', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                        Edit Profile
                                    </button>
                                </div>
                            )}

                            {foundCustomer && isEditingCustomer && (
                                <div style={{ marginTop: '16px', padding: '16px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: '#92400e' }}>Edit Customer Details</h4>
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#52525b' }}>Full Name</label>
                                    <input type="text" value={editCustomerForm.fullName} onChange={e => setEditCustomerForm({...editCustomerForm, fullName: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#52525b' }}>Phone Number</label>
                                    <input type="text" value={editCustomerForm.phone} onChange={e => setEditCustomerForm({...editCustomerForm, phone: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#52525b' }}>Address</label>
                                    <textarea value={editCustomerForm.address} onChange={e => setEditCustomerForm({...editCustomerForm, address: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#52525b' }}>Photo URL (Optional)</label>
                                    <input type="text" value={editCustomerForm.photoUrl} onChange={e => setEditCustomerForm({...editCustomerForm, photoUrl: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} placeholder="https://..." />
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={handleSaveCustomerEdit} style={{ flex: 1, padding: '10px', background: '#d97706', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Save Changes</button>
                                        <button onClick={() => setIsEditingCustomer(false)} style={{ padding: '10px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '32px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', opacity: foundCustomer ? 1 : 0.6 }}>
                            <h3 style={{ marginTop: 0, fontSize: '18px', color: '#111827', marginBottom: '20px' }}>2. Issue Movie</h3>
                            <select value={selectedMovieId} onChange={e => setSelectedMovieId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '16px', marginBottom: '16px', background: 'white' }}>
                                <option value="">-- Select Movie --</option>
                                {catalog.map((group, idx) => (
                                    <option key={idx} value={group.itemIds[0]}>
                                        {group.title} ({group.format}) - {group.count} Available
                                    </option>
                                ))}
                            </select>
                            <button onClick={handleIssueRental} disabled={!foundCustomer} style={{ width: '100%', padding: '14px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '16px', cursor: foundCustomer ? 'pointer' : 'not-allowed' }}>Complete Checkout</button>
                        </div>
                    </div>

                    {foundCustomer && (
                        <>
                            <div style={{ padding: '32px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
                                <h3 style={{ margin: '0 0 20px 0', fontSize: '18px', color: '#111827' }}>3. Active Rentals</h3>

                                {activeRentals.length === 0 ? <p style={{ color: '#6b7280' }}>No active rentals for this member.</p> : (
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ textAlign: 'left', borderBottom: '2px solid #f3f4f6' }}>
                                                <th style={{ padding: '12px 8px', color: '#4b5563' }}>Receipt</th>
                                                <th style={{ padding: '12px 8px', color: '#4b5563' }}>Movie Title</th>
                                                <th style={{ padding: '12px 8px', color: '#4b5563' }}>Due Date</th>
                                                <th style={{ padding: '12px 8px', textAlign: 'right' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeRentals.map(r => {
                                                const title = r.itemTitle || r.item?.title || r.inventoryItem?.title || (catalog.find(g => g.itemIds.includes(r.itemId))?.title) || 'Unknown Title';
                                                return (
                                                <tr key={r.loanId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '16px 8px', fontWeight: '600', fontFamily: 'monospace' }}>{r.loanId.substring(0, 8)}</td>
                                                    <td style={{ padding: '16px 8px', fontWeight: 'bold', color: '#111827' }}>{title}</td>
                                                    <td style={{ padding: '16px 8px' }}>{new Date(r.dueDate).toLocaleDateString()}</td>
                                                    <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                                                        {/* TRIGGER THE CONFIRMATION MODAL INSTEAD OF DIRECT API CALL */}
                                                        <button 
                                                            onClick={() => setPreReturnModal({ show: true, loanId: r.loanId, title: title })} 
                                                            style={{ backgroundColor: '#f97316', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                                                            Return & Pay
                                                        </button>
                                                    </td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            <div style={{ padding: '32px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <h3 style={{ marginTop: 0, fontSize: '18px', color: '#111827', marginBottom: '20px' }}>4. Complete Rental History</h3>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                                                <th style={{ padding: '12px' }}>Receipt ID</th>
                                                <th style={{ padding: '12px' }}>Movie Title</th> 
                                                <th style={{ padding: '12px' }}>Checkout Date</th>
                                                <th style={{ padding: '12px' }}>Return Date</th>
                                                <th style={{ padding: '12px' }}>Status</th>
                                                <th style={{ padding: '12px' }}>Rent Paid</th>
                                                <th style={{ padding: '12px' }}>Late Fines</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {customerHistory.map(loan => {
                                                const title = loan.itemTitle || loan.item?.title || loan.inventoryItem?.title || 'Unknown Title';
                                                return (
                                                <tr key={loan.loanId} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>{loan.loanId.substring(0, 8)}</td>
                                                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#111827' }}>{title}</td>
                                                    <td style={{ padding: '12px' }}>{new Date(loan.issueDate || loan.checkoutDate).toLocaleDateString()}</td>
                                                    <td style={{ padding: '12px' }}>{loan.returnDate ? new Date(loan.returnDate).toLocaleDateString() : '---'}</td>
                                                    <td style={{ padding: '12px' }}>
                                                        <span style={{ background: loan.status === 'RETURNED' ? '#e8f5e9' : '#fff3e0', color: loan.status === 'RETURNED' ? '#2e7d32' : '#e65100', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                                                            {loan.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '12px', fontWeight: 'bold' }}>₹{loan.rentAmount || '0.00'}</td>
                                                    <td style={{ padding: '12px', color: '#d32f2f', fontWeight: 'bold' }}>₹{loan.fineAmount || '0.00'}</td>
                                                </tr>
                                            )})}
                                            {customerHistory.length === 0 && (
                                                <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No past rentals found for this member.</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </>
            )}

            {dashboardTab === 'MEMBERS' && (
                <div style={{ background: '#fff', border: '1px solid #8b5cf6', borderRadius: '8px', padding: '20px', marginBottom: '40px', overflowX: 'auto' }}>
                    <h3 style={{ marginTop: 0, color: '#8b5cf6' }}>Registered Members Database</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f5f3ff', borderBottom: '2px solid #ddd6fe' }}>
                                <th style={{ padding: '12px', width: '60px' }}>Photo</th>
                                <th style={{ padding: '12px' }}>Full Name</th>
                                <th style={{ padding: '12px' }}>Phone Number</th>
                                <th style={{ padding: '12px' }}>Dues</th>
                                <th style={{ padding: '12px' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allMembers.map(member => (
                                <tr key={member.memberId} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '12px' }}>
                                        <img 
                                            src={member.photoUrl} 
                                            onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/40x40/8b5cf6/white?text=${member.fullName.charAt(0)}`; }}
                                            style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #ccc' }}
                                        />
                                    </td>
                                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#111827' }}>{member.fullName}</td>
                                    <td style={{ padding: '12px', color: '#4b5563', fontFamily: 'monospace' }}>{member.phone}</td>
                                    <td style={{ padding: '12px', color: member.currentDues > 0 ? '#dc2626' : '#166534', fontWeight: 'bold' }}>
                                        {member.currentDues > 0 ? `₹${member.currentDues.toFixed(2)}` : '₹0'}
                                    </td>
                                    <td style={{ padding: '12px' }}>
                                        <button onClick={() => { setDashboardTab('COUNTER'); selectCustomer(member); }} style={{ padding: '6px 12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
                                            Go to Checkout →
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {allMembers.length === 0 && (
                                <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>No members registered yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {dashboardTab === 'TRANSACTIONS' && (
                <div style={{ background: '#fff', border: '1px solid #d97706', borderRadius: '8px', padding: '24px', marginBottom: '40px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #fef3c7', paddingBottom: '16px', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, color: '#d97706', fontSize: '20px' }}>Global Transactions Ledger</h3>
                        
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <select value={txFilter} onChange={(e) => setTxFilter(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontWeight: 'bold', color: '#374151' }}>
                                <option value="ALL">All Time</option>
                                <option value="TODAY">Today</option>
                                <option value="YESTERDAY">Yesterday</option>
                                <option value="CUSTOM">Custom Date Range</option>
                            </select>
                            
                            {txFilter === 'CUSTOM' && (
                                <>
                                    <input type="date" value={txStartDate} onChange={e => setTxStartDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                                    <span style={{ color: '#6b7280', fontWeight: 'bold' }}>to</span>
                                    <input type="date" value={txEndDate} onChange={e => setTxEndDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} />
                                </>
                            )}
                        </div>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: '#fffbeb', borderBottom: '2px solid #fde68a' }}>
                                    <th style={{ padding: '12px', color: '#92400e' }}>Receipt ID</th>
                                    <th style={{ padding: '12px', color: '#92400e' }}>Member Name</th>
                                    <th style={{ padding: '12px', color: '#92400e' }}>Movie Title</th>
                                    <th style={{ padding: '12px', color: '#92400e' }}>Transaction Date</th>
                                    <th style={{ padding: '12px', color: '#92400e' }}>Status</th>
                                    <th style={{ padding: '12px', color: '#92400e', textAlign: 'right' }}>Rent Collected</th>
                                    <th style={{ padding: '12px', color: '#92400e', textAlign: 'right' }}>Fines Collected</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.map(tx => (
                                    <tr key={tx.loanId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '12px', fontFamily: 'monospace', color: '#6b7280' }}>{tx.loanId.substring(0, 8)}</td>
                                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#111827' }}>{tx.memberName}</td>
                                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#374151' }}>{tx.itemTitle}</td>
                                        <td style={{ padding: '12px', color: '#4b5563' }}>
                                            {new Date(tx.returnDate || tx.issueDate).toLocaleDateString()}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <span style={{ background: tx.status === 'RETURNED' ? '#dcfce7' : '#fef3c7', color: tx.status === 'RETURNED' ? '#166534' : '#92400e', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>
                                                {tx.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#166534', textAlign: 'right' }}>₹{tx.rentAmount || '0.00'}</td>
                                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#dc2626', textAlign: 'right' }}>₹{tx.fineAmount || '0.00'}</td>
                                    </tr>
                                ))}
                                {filteredTransactions.length === 0 && (
                                    <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>No transactions match your selected date filter.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
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
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>Member Live Photo</label>
                            {regForm.photoUrl ? (
                                <div style={{ textAlign: 'center' }}>
                                    <img src={regForm.photoUrl} alt="Captured" style={{ width: '100%', maxWidth: '300px', borderRadius: '8px', border: '2px solid #059669', marginBottom: '10px' }} />
                                    <input type="text" value={regForm.photoUrl} onChange={e => setRegForm({...regForm, photoUrl: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box', marginBottom: '10px' }} placeholder="Edit URL if needed..." />
                                    <button type="button" onClick={() => setRegForm({...regForm, photoUrl: ''})} style={{ display: 'block', width: '100%', padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Retake / Clear Photo</button>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', background: '#111', padding: '15px', borderRadius: '8px' }}>
                                    <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "user" }} style={{ width: '100%', maxWidth: '300px', borderRadius: '4px', marginBottom: '10px' }} />
                                    <button type="button" onClick={capturePhoto} style={{ display: 'block', width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>📸 Capture Photo</button>
                                    <p style={{color: '#aaa', fontSize: '12px', margin: '10px 0'}}>OR paste URL below if camera is blocked by browser:</p>
                                    <input type="text" value={regForm.photoUrl} onChange={e => setRegForm({...regForm, photoUrl: e.target.value})} style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', boxSizing: 'border-box', background: '#222', color: 'white' }} placeholder="https://..." />
                                </div>
                            )}
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
