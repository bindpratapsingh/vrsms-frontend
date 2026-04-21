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
    const [memberHistoryFilter, setMemberHistoryFilter] = useState('ALL');

    const [availableCoupons, setAvailableCoupons] = useState([]);
    const [storeConfig, setStoreConfig] = useState({ lateFeePerDay: 30 });

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentDetails, setPaymentDetails] = useState({ amount: 0, upiLink: '' });

    const [isEditingCustomer, setIsEditingCustomer] = useState(false);
    const [editCustomerForm, setEditCustomerForm] = useState({ fullName: '', phone: '', address: '', photoUrl: '' });
    const [regForm, setRegForm] = useState({ fullName: '', phone: '', address: '', photoUrl: '', depositPaid: false, otp: '' });
    const [otpSent, setOtpSent] = useState(false);
    const [otpVerified, setOtpVerified] = useState(false);
    const webcamRef = useRef(null);

    const [returnModal, setReturnModal] = useState({ show: false, loan: null, title: '', couponInput: '', appliedDiscount: 0, appliedCode: '', error: '' });

    const capturePhoto = useCallback(() => {
        if (webcamRef.current) {
            const imageSrc = webcamRef.current.getScreenshot();
            if (imageSrc) {
                setRegForm(prev => ({...prev, photoUrl: imageSrc}));
                setMessage({ type: 'success', text: 'Photo captured successfully!' });
            }
        }
    }, [webcamRef]);

    // --- FIX: ISOLATED API CALLS SO ONE FAILURE DOESN'T CRASH THE DASHBOARD ---
    const loadInitialData = useCallback(async () => {
        try {
            const resMovies = await api.get('/inventory/available');
            const movies = resMovies.data || [];
            const groupedMovies = movies.reduce((acc, movie) => {
                const key = `${movie.title} - ${movie.format}`;
                if (!acc[key]) acc[key] = { title: movie.title, format: movie.format, count: 0, itemIds: [], dailyRate: movie.dailyRate || 10 };
                acc[key].count += 1;
                acc[key].itemIds.push(movie.itemId); 
                return acc;
            }, {});
            setCatalog(Object.values(groupedMovies));
        } catch (error) { console.error("Catalog load failed", error); }

        try { setAllMembers((await api.get('/staff/members/all')).data || []); } catch(e) { console.error("Members load failed", e); }
        try { setAllTransactions((await api.get('/rentals/all')).data || []); } catch(e) { console.error("Global Tx load failed", e); }
        try { setAvailableCoupons((await api.get('/manager/coupons/all')).data || []); } catch(e){}
        try { setStoreConfig((await api.get('/manager/config')).data || { lateFeePerDay: 30 }); } catch(e){}
    }, []);

    useEffect(() => {
        try {
            const loggedInUser = localStorage.getItem('vrsms_user');
            if (!loggedInUser) { navigate('/'); return; }
            const parsedUser = JSON.parse(loggedInUser);
            const role = (parsedUser?.role || parsedUser?.userType || '').toUpperCase();
            if (['STAFF', 'MANAGER', 'CLERK'].includes(role)) { setUser(parsedUser); loadInitialData(); } 
            else { navigate('/'); }
        } catch (e) { navigate('/'); }
    }, [navigate, loadInitialData]);

    const formatPhone = (num) => {
        const cleaned = (num || '').trim();
        return cleaned ? (cleaned.startsWith('+') ? cleaned : `+91${cleaned}`) : '';
    };

    const selectCustomer = async (memberObj) => {
        setFoundCustomer(memberObj); setSearchTerm(memberObj.fullName); setMessage({ type: '', text: '' }); setIsEditingCustomer(false); setMemberHistoryFilter('ALL');
        try { setActiveRentals((await api.get(`/rentals/my-active/${memberObj.userId}`)).data || []); } catch (e) { setActiveRentals([]); }
        try { setCustomerHistory((await api.get(`/history/${memberObj.userId}`)).data || []); } catch (e) { setCustomerHistory([]); }
    };

    const refreshCustomerData = async (phone) => {
        try {
            const resMembers = await api.get('/staff/members/all');
            setAllMembers(resMembers.data || []);
            const updatedCustomer = resMembers.data.find(m => m.phone === phone || m.phone === `+91${phone.replace('+91','')}`);
            if (updatedCustomer) setFoundCustomer(updatedCustomer);
        } catch (e) { console.error("Refresh failed"); }
    };

    const handleCustomerSearch = async () => {
        if (!searchTerm) return;
        setFoundCustomer(null); setActiveRentals([]); setCustomerHistory([]); setMessage({ type: '', text: '' }); setIsEditingCustomer(false);
        try {
            const res = await api.get(`/staff/lookup-member?phone=${encodeURIComponent(formatPhone(searchTerm))}`);
            if (res.data) selectCustomer(res.data);
        } catch (error) { setMessage({ type: 'error', text: error.response?.data || "Member not found." }); }
    };

    const handleSaveCustomerEdit = async () => {
        try {
            const payload = { ...editCustomerForm, phone: formatPhone(editCustomerForm.phone) };
            await api.put(`/staff/members/edit/${foundCustomer.userId}`, payload);
            setMessage({ type: 'success', text: 'Customer profile updated!' });
            setIsEditingCustomer(false); refreshCustomerData(payload.phone);
        } catch (error) { setMessage({ type: 'error', text: error.response?.data || "Failed to update member." }); }
    };

    const handleEditClick = () => {
        setEditCustomerForm({ fullName: foundCustomer.fullName || '', phone: foundCustomer.phone ? foundCustomer.phone.replace('+91', '') : '', address: foundCustomer.address || '', photoUrl: foundCustomer.photoUrl || '' });
        setIsEditingCustomer(true);
    };

    const handlePayDues = () => {
        const amount = foundCustomer.currentDues || 0;
        setPaymentDetails({ amount: amount, upiLink: `upi://pay?pa=bindpratapsingh@oksbi&pn=VRSMS&am=${amount}&cu=INR` });
        setShowPaymentModal(true);
    };

    const confirmPaymentAndClearDues = async () => {
        setShowPaymentModal(false);
        if (foundCustomer && paymentDetails.amount > 0) {
            try {
                await api.post(`/staff/members/${foundCustomer.userId}/clear-dues`);
                setMessage({ type: 'success', text: "Payment confirmed via UPI and Account Unlocked!" });
                refreshCustomerData(foundCustomer.phone); 
            } catch (e) { console.error("Failed to auto-clear dues", e); }
        }
    };

    const handleClearDues = async () => {
        if (!foundCustomer) return;
        try {
            await api.post(`/staff/members/${foundCustomer.userId}/clear-dues`);
            setMessage({ type: 'success', text: "Account Unlocked: Dues cleared via Cash/Override!" });
            refreshCustomerData(foundCustomer.phone); 
        } catch (error) { setMessage({ type: 'error', text: "Failed to clear dues." }); }
    };

    const handleIssueRental = async () => {
        if (!foundCustomer?.memberId || !selectedMovieId) return;
        try {
            await api.post('/rentals/issue', { memberId: foundCustomer.memberId, itemId: selectedMovieId, clerkId: user.userId });
            setMessage({ type: 'success', text: "Rental Issued Successfully!" });
            loadInitialData(); selectCustomer(foundCustomer); 
        } catch (error) { setMessage({ type: 'error', text: error.response?.data || "Issue failed" }); }
    };

    const getPreviewAmount = () => {
        if (!returnModal.loan) return 0;
        const today = new Date(); today.setHours(0,0,0,0);
        const issue = new Date(returnModal.loan.issueDate || returnModal.loan.checkoutDate); issue.setHours(0,0,0,0);
        let daysKept = Math.floor((today - issue) / 86400000);
        if (daysKept < 1) daysKept = 1;
        
        let dRate = 10; 
        if (returnModal.loan.item?.dailyRate) dRate = returnModal.loan.item.dailyRate;
        else {
            const group = catalog.find(g => g.itemIds.includes(returnModal.loan.itemId));
            if (group && group.dailyRate) dRate = group.dailyRate;
        }
        
        let rent = dRate * daysKept;
        // SANITIZATION: Cap the visual discount at 100%
        let safeDiscount = returnModal.appliedDiscount > 100 ? 100 : (returnModal.appliedDiscount < 0 ? 0 : returnModal.appliedDiscount);
        let discountAmt = rent * (safeDiscount / 100.0);
        
        rent = rent - discountAmt;
        
        let fine = 0;
        const due = new Date(returnModal.loan.dueDate); due.setHours(0,0,0,0);
        if (today > due) {
            let daysLate = Math.floor((today - due) / 86400000);
            fine = daysLate * (storeConfig.lateFeePerDay || 30);
        }
        return rent + fine;
    };

    const handleApplyCoupon = () => {
        const code = returnModal.couponInput.trim().toUpperCase();
        if (!code) return;
        const found = availableCoupons.find(c => c.code.toUpperCase() === code && c.active);
        if (found) {
            setReturnModal(prev => ({...prev, appliedDiscount: found.discountPercentage, appliedCode: code, error: '', couponInput: ''}));
        } else {
            setReturnModal(prev => ({...prev, error: `Invalid or Expired Coupon Code: ${code}`, appliedDiscount: 0, appliedCode: ''}));
        }
    };

    const handleFinalizeReturn = async (markPaid) => {
        setReturnModal(prev => ({...prev, error: ''}));
        try {
            await api.post('/rentals/return', { loanId: returnModal.loan.loanId, clerkId: user.userId, couponCode: returnModal.appliedCode });
            if (markPaid) { await api.post(`/staff/members/${foundCustomer.userId}/clear-dues`); }
            
            setMessage({ type: 'success', text: markPaid ? "Return successful and payment cleared!" : "Return successful, amount added to dues." });
            setReturnModal({ show: false, loan: null, title: '', couponInput: '', appliedDiscount: 0, appliedCode: '', error: '' });
            loadInitialData(); refreshCustomerData(foundCustomer.phone); selectCustomer(foundCustomer);
        } catch (error) { setReturnModal(prev => ({...prev, error: error.response?.data || "Return failed on backend."})); }
    };

    const closeCheckout = () => {
        setReturnModal({ show: false, step: 1, loanId: null, title: '', couponInput: '', appliedDiscount: 0, appliedCode: '', error: '' });
    };

    const handleSendOtp = async () => {
        // 1. CLEAR PREVIOUS ERRORS
        setMessage({ type: '', text: '' });

        // 2. STRICT FRONTEND VALIDATION
        // Checks that it is exactly 10 digits and starts with 6, 7, 8, or 9
        const phoneRegex = /^[6-9]\d{9}$/; 
        
        if (!regForm.phone) {
            setMessage({ type: 'error', text: "Please enter a phone number before sending an OTP." });
            return;
        }
        
        if (!phoneRegex.test(regForm.phone)) {
            setMessage({ type: 'error', text: "Invalid Number. Please enter a valid 10-digit Indian mobile number." });
            return;
        }

        // 3. API CALL
        try {
            await api.post(`/staff/send-registration-otp?phone=${encodeURIComponent('+91' + regForm.phone)}`);
            setOtpSent(true);
            setMessage({ type: 'success', text: "OTP Sent successfully! Please verify it below." });
        } catch (error) {
            // If the backend catches a duplicate or throws an error, display it in red!
            setMessage({ type: 'error', text: error.response?.data || "Failed to send OTP. Please try again." });
        }
    };

    const handleVerifyOtp = async () => {
        if (!regForm.otp || regForm.otp.length !== 6) {
            setMessage({ type: 'error', text: "Please enter the 6-digit OTP." });
            return;
        }

        try {
            await api.post(`/staff/verify-registration-otp?phone=${encodeURIComponent('+91' + regForm.phone)}&otp=${regForm.otp}`);
            setOtpVerified(true);
            setMessage({ type: 'success', text: "Phone verified! You can now complete the registration." });
        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data || "Invalid OTP." });
        }
    };

    const handleRegisterMember = async (e) => {
        e.preventDefault();
        if (!regForm.depositPaid) { setMessage({ type: 'error', text: "Security deposit required." }); return; }
        try {
            const payload = { ...regForm, phone: formatPhone(regForm.phone) };
            await api.post('/staff/register-member', payload);
            setMessage({ type: 'success', text: `Registered ${regForm.fullName}!` });
            setRegForm({ fullName: '', phone: '', address: '', photoUrl: '', depositPaid: false });
            setDashboardTab('COUNTER'); await loadInitialData(); setSearchTerm(payload.phone);
        } catch (error) { setMessage({ type: 'error', text: error.response?.data || "Registration failed." }); }
    };

    // --- FIX: SAFE DATES & SAFE NAMES TO PREVENT BLANK ROWS ---
    const getFilteredTransactions = () => {
        return allTransactions.filter(tx => {
            if (txFilter === 'ALL') return true;
            const txDate = new Date(tx.returnDate || tx.issueDate || new Date()).setHours(0,0,0,0);
            const today = new Date().setHours(0,0,0,0);
            if (txFilter === 'TODAY') return txDate === today;
            if (txFilter === 'YESTERDAY') return txDate === today - 86400000;
            if (txFilter === 'CUSTOM') {
                if (!txStartDate || !txEndDate) return true;
                return txDate >= new Date(txStartDate).setHours(0,0,0,0) && txDate <= new Date(txEndDate).setHours(0,0,0,0);
            }
            return true;
        }).sort((a, b) => new Date(b.issueDate || b.returnDate || 0).getTime() - new Date(a.issueDate || a.returnDate || 0).getTime());
    };

    const getFilteredMemberHistory = () => {
        return customerHistory.filter(tx => {
            if (memberHistoryFilter === 'ALL') return true;
            const txDate = new Date(tx.returnDate || tx.checkoutDate || tx.issueDate || new Date()).setHours(0,0,0,0);
            const today = new Date().setHours(0,0,0,0);
            if (memberHistoryFilter === 'TODAY') return txDate === today;
            if (memberHistoryFilter === 'LAST_7_DAYS') return txDate >= today - (7 * 86400000);
            if (memberHistoryFilter === 'LAST_30_DAYS') return txDate >= today - (30 * 86400000);
            return true;
        }).sort((a, b) => new Date(b.checkoutDate || b.issueDate || 0).getTime() - new Date(a.checkoutDate || a.issueDate || 0).getTime());
    };

    const filteredTransactions = getFilteredTransactions();

    if (!user) return null;

    return (
        <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', fontFamily: '"Inter", sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            
            {returnModal.show && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', borderRadius: '12px', width: '90%', maxWidth: '700px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', position: 'relative' }}>
                        <div style={{ background: '#f8fafc', padding: '20px 30px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, color: '#0f172a', fontSize: '20px' }}>Checkout & Return: <span style={{color: '#0ea5e9'}}>{returnModal.title}</span></h2>
                            <button onClick={closeCheckout} style={{ background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#94a3b8' }}>✖</button>
                        </div>

                        <div style={{ display: 'flex', padding: '30px', gap: '30px' }}>
                            <div style={{ flex: 1, textAlign: 'center', borderRight: '1px solid #e2e8f0', paddingRight: '30px' }}>
                                <p style={{ margin: '0 0 5px 0', color: '#64748b', fontWeight: 'bold', fontSize: '13px', letterSpacing: '1px' }}>TOTAL TO COLLECT</p>
                                <p style={{ margin: '0 0 20px 0', fontSize: '36px', fontWeight: '900', color: '#dc2626' }}>₹{(getPreviewAmount() + (foundCustomer?.currentDues || 0)).toFixed(2)}</p>
                                <div style={{ background: '#f1f5f9', padding: '15px', borderRadius: '12px', display: 'inline-block', marginBottom: '15px', border: '1px solid #e2e8f0' }}>
                                    <QRCodeSVG value={`upi://pay?pa=bindpratapsingh@oksbi&pn=VRSMS&am=${(getPreviewAmount() + (foundCustomer?.currentDues || 0)).toFixed(2)}&cu=INR`} size={160} />
                                </div>
                                <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0 }}>Scan to pay via Any UPI App</p>
                            </div>
                            
                            <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', color: '#334155', marginBottom: '8px' }}>Apply Promo Code</label>
                                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                        <input type="text" value={returnModal.couponInput} onChange={e => setReturnModal(prev=>({...prev, couponInput: e.target.value.toUpperCase(), error: ''}))} placeholder="e.g. MEMBER10" style={{ flex: 1, padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', fontWeight: 'bold' }} disabled={returnModal.appliedDiscount > 0} />
                                        <button onClick={handleApplyCoupon} disabled={returnModal.appliedDiscount > 0} style={{ padding: '10px 20px', background: returnModal.appliedDiscount > 0 ? '#94a3b8' : '#0ea5e9', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: returnModal.appliedDiscount > 0 ? 'default' : 'pointer' }}>Apply</button>
                                    </div>
                                    
                                    {returnModal.error && <p style={{ margin: 0, color: '#dc2626', fontSize: '13px', fontWeight: 'bold' }}>❌ {returnModal.error}</p>}
                                    {returnModal.appliedDiscount > 0 && !returnModal.error && (
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <p style={{ margin: 0, color: '#059669', fontSize: '13px', fontWeight: 'bold' }}>✅ {returnModal.appliedCode} Applied ({returnModal.appliedDiscount}% Off)</p>
                                            <button onClick={() => setReturnModal(prev => ({...prev, appliedDiscount: 0, appliedCode: '', couponInput: ''}))} style={{ background: 'none', border: 'none', color: '#dc2626', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>Remove</button>
                                        </div>
                                    )}
                                    
                                    <div style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '8px', fontSize: '13px', color: '#475569', border: '1px solid #e2e8f0' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontWeight: 'bold' }}><span>New Rent + Fine:</span> <span>₹{getPreviewAmount().toFixed(2)}</span></div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}><span>Previous Dues:</span> <span>₹{(foundCustomer?.currentDues || 0).toFixed(2)}</span></div>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                                    <button onClick={() => handleFinalizeReturn(true)} style={{ width: '100%', padding: '14px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px', boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)' }}>Confirm Return & Mark Paid</button>
                                    <button onClick={() => handleFinalizeReturn(false)} style={{ width: '100%', padding: '12px', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Return & Add to Dues</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: '800', color: '#111827', margin: 0 }}>Staff Dashboard</h1>
                <button onClick={() => { localStorage.removeItem('vrsms_user'); navigate('/'); }} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontWeight: '600' }}>Logout</button>
            </div>
            

            {showPaymentModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', maxWidth: '400px', width: '90%', position: 'relative' }}>
                        <button onClick={() => setShowPaymentModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9ca3af', lineHeight: '1' }}>✖</button>
                        <h2 style={{ margin: '0 0 10px 0', color: '#111827' }}>Clear Outstanding Dues</h2>
                        <p style={{ fontSize: '32px', fontWeight: '800', color: '#dc2626', margin: '10px 0' }}>₹{paymentDetails.amount.toFixed(2)}</p>
                        <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '12px', display: 'inline-block', marginBottom: '20px' }}>
                            <QRCodeSVG value={paymentDetails.upiLink} size={180} />
                        </div>
                        <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>To: bindpratapsingh@oksbi</p>
                        <button onClick={confirmPaymentAndClearDues} style={{ width: '100%', padding: '14px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>Confirm Payment Received</button>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', borderBottom: '2px solid #e5e7eb', paddingBottom: '10px', overflowX: 'auto' }}>
                <button onClick={() => { setDashboardTab('COUNTER'); setMessage({type:'', text:''}); }} style={{ padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap', color: dashboardTab === 'COUNTER' ? '#2563eb' : '#6b7280', borderBottom: dashboardTab === 'COUNTER' ? '3px solid #2563eb' : 'none' }}>Checkout Counter</button>
                <button onClick={() => { setDashboardTab('MEMBERS'); setMessage({type:'', text:''}); }} style={{ padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap', color: dashboardTab === 'MEMBERS' ? '#8b5cf6' : '#6b7280', borderBottom: dashboardTab === 'MEMBERS' ? '3px solid #8b5cf6' : 'none' }}>Members Database</button>
                <button onClick={() => { setDashboardTab('TRANSACTIONS'); setMessage({type:'', text:''}); }} style={{ padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap', color: dashboardTab === 'TRANSACTIONS' ? '#d97706' : '#6b7280', borderBottom: dashboardTab === 'TRANSACTIONS' ? '3px solid #d97706' : 'none' }}>Transactions Ledger</button>
                <button onClick={() => { setDashboardTab('REGISTER'); setMessage({type:'', text:''}); }} style={{ padding: '10px 20px', fontSize: '16px', fontWeight: 'bold', border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap', color: dashboardTab === 'REGISTER' ? '#059669' : '#6b7280', borderBottom: dashboardTab === 'REGISTER' ? '3px solid #059669' : 'none' }}>Register New Member</button>
            </div>

            {message.text && (<div style={{ padding: '16px', marginBottom: '24px', borderRadius: '8px', fontWeight: '500', backgroundColor: message.type === 'error' ? '#fef2f2' : '#f0fdf4', color: message.type === 'error' ? '#991b1b' : '#166534', border: `1px solid ${message.type === 'error' ? '#fee2e2' : '#dcfce7'}` }}>{message.text}</div>)}

            {dashboardTab === 'COUNTER' && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                        <div style={{ padding: '32px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', position: 'relative' }}>
                            <h3 style={{ marginTop: 0, fontSize: '18px', color: '#111827', marginBottom: '20px' }}>1. Find Customer</h3>
                            <input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setFoundCustomer(null); }} placeholder="Type Name or Phone..." style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '16px', outline: 'none', boxSizing: 'border-box' }} />
                            {!foundCustomer && searchTerm && (
                                <div style={{ position: 'absolute', top: '100px', left: '32px', right: '32px', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 50, maxHeight: '200px', overflowY: 'auto' }}>
                                    {allMembers.filter(m => m.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || m.phone.includes(searchTerm)).map(m => (
                                        <div key={m.userId} onClick={() => selectCustomer(m)} style={{ padding: '12px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <img src={m.photoUrl} onError={(e) => { e.target.onerror=null; e.target.src=`https://placehold.co/40x40/0284c7/white?text=${m.fullName.charAt(0)}` }} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                                            <div><div style={{ fontWeight: 'bold', color: '#111827' }}>{m.fullName}</div><div style={{ fontSize: '12px', color: '#6b7280' }}>{m.phone}</div></div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {foundCustomer && !isEditingCustomer && (
                                <div style={{ marginTop: '16px', padding: '16px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #e0f2fe', position: 'relative' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <img src={foundCustomer.photoUrl || `https://placehold.co/80x80/0284c7/white?text=${foundCustomer.fullName.charAt(0)}`} alt="Profile" style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #0284c7' }} />
                                        <div><p style={{ margin: 0, color: '#0369a1', fontWeight: '700', fontSize: '18px' }}>✓ {foundCustomer.fullName}</p><p style={{ margin: '4px 0 0 0', color: '#0284c7', fontSize: '14px', fontFamily: 'monospace' }}>{foundCustomer.phone}</p></div>
                                    </div>
                                    <div style={{ marginTop: '15px', borderTop: '1px solid #bae6fd', paddingTop: '15px' }}>
                                        <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold', color: foundCustomer.currentDues > 0 ? '#dc2626' : '#166534' }}>Account Balance: {foundCustomer.currentDues > 0 ? `₹${foundCustomer.currentDues.toFixed(2)} Due` : 'Clear'}</p>
                                        {foundCustomer.currentDues > 0 && (
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button onClick={handlePayDues} style={{ flex: 1, padding: '8px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>📱 Pay via UPI</button>
                                                <button onClick={handleClearDues} style={{ flex: 1, padding: '8px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}>💵 Cash / Waive</button>
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={handleEditClick} style={{ position: 'absolute', top: '16px', right: '16px', padding: '6px 12px', background: 'white', color: '#0284c7', border: '1px solid #0284c7', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>Edit Profile</button>
                                </div>
                            )}

                            {foundCustomer && isEditingCustomer && (
                                <div style={{ marginTop: '16px', padding: '16px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: '#92400e' }}>Edit Customer</h4>
                                    <input type="text" value={editCustomerForm.fullName} onChange={e => setEditCustomerForm({...editCustomerForm, fullName: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                                    <input type="text" value={editCustomerForm.phone} onChange={e => setEditCustomerForm({...editCustomerForm, phone: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                                    <textarea value={editCustomerForm.address} onChange={e => setEditCustomerForm({...editCustomerForm, address: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                                    <input type="text" value={editCustomerForm.photoUrl} onChange={e => setEditCustomerForm({...editCustomerForm, photoUrl: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} placeholder="https://..." />
                                    <div style={{ display: 'flex', gap: '8px' }}><button onClick={handleSaveCustomerEdit} style={{ flex: 1, padding: '10px', background: '#d97706', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Save Changes</button><button onClick={() => setIsEditingCustomer(false)} style={{ padding: '10px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button></div>
                                </div>
                            )}
                        </div>

                        <div style={{ padding: '32px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', opacity: foundCustomer ? 1 : 0.6 }}>
                            <h3 style={{ marginTop: 0, fontSize: '18px', color: '#111827', marginBottom: '20px' }}>2. Issue Movie</h3>
                            <select value={selectedMovieId} onChange={e => setSelectedMovieId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '16px', marginBottom: '16px', background: 'white' }}>
                                <option value="">-- Select Movie --</option>
                                {catalog.map((group, idx) => (<option key={idx} value={group.itemIds[0]}>{group.title} ({group.format}) - {group.count} Available</option>))}
                            </select>
                            {foundCustomer && foundCustomer.currentDues > 0 && (
                                <div style={{ padding: '10px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '16px', fontWeight: 'bold', fontSize: '14px', textAlign: 'center', border: '1px solid #f87171' }}>⚠️ Customer must clear outstanding dues before renting.</div>
                            )}
                            <button onClick={handleIssueRental} disabled={!foundCustomer || foundCustomer.currentDues > 0} style={{ width: '100%', padding: '14px', background: (!foundCustomer || foundCustomer.currentDues > 0) ? '#9ca3af' : '#059669', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '16px', cursor: (!foundCustomer || foundCustomer.currentDues > 0) ? 'not-allowed' : 'pointer' }}>Complete Checkout</button>
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
                                                <th style={{ padding: '12px 8px', color: '#4b5563' }}>Receipt</th><th style={{ padding: '12px 8px', color: '#4b5563' }}>Movie Title</th><th style={{ padding: '12px 8px', color: '#4b5563' }}>Due Date</th><th style={{ padding: '12px 8px', textAlign: 'right' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activeRentals.map(r => {
                                                const title = r.itemTitle || r.item?.title || r.inventoryItem?.title || (catalog.find(g => g.itemIds.includes(r.itemId))?.title) || 'Unknown Title';
                                                return (
                                                <tr key={r.loanId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '16px 8px', fontWeight: '600', fontFamily: 'monospace' }}>{r.loanId.substring(0, 8)}</td><td style={{ padding: '16px 8px', fontWeight: 'bold', color: '#111827' }}>{title}</td><td style={{ padding: '16px 8px' }}>{new Date(r.dueDate).toLocaleDateString()}</td>
                                                    <td style={{ padding: '16px 8px', textAlign: 'right' }}><button onClick={() => setReturnModal({ show: true, loan: r, title: title, couponInput: '', appliedDiscount: 0, appliedCode: '', error: '' })} style={{ backgroundColor: '#f97316', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Return & Checkout</button></td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            <div style={{ padding: '32px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h3 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>4. Complete Rental History</h3>
                                    <select value={memberHistoryFilter} onChange={(e) => setMemberHistoryFilter(e.target.value)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none', fontWeight: 'bold', color: '#374151' }}>
                                        <option value="ALL">All Time</option><option value="TODAY">Today</option><option value="LAST_7_DAYS">Last 7 Days</option><option value="LAST_30_DAYS">Last 30 Days</option>
                                    </select>
                                </div>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                                                <th style={{ padding: '12px' }}>Receipt ID</th><th style={{ padding: '12px' }}>Movie Title</th><th style={{ padding: '12px' }}>Checkout Time</th><th style={{ padding: '12px' }}>Return Time</th><th style={{ padding: '12px' }}>Status</th><th style={{ padding: '12px' }}>Rent Paid</th><th style={{ padding: '12px' }}>Late Fines</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {getFilteredMemberHistory().map(loan => {
                                                const title = loan.itemTitle || loan.item?.title || loan.inventoryItem?.title || 'Unknown Title';
                                                return (
                                                <tr key={loan.loanId} style={{ borderBottom: '1px solid #eee' }}>
                                                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>{loan.loanId.substring(0, 8)}</td>
                                                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#111827' }}>{title}</td>
                                                    <td style={{ padding: '12px', color: '#4b5563' }}>{new Date(loan.issueDate || loan.checkoutDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                                    <td style={{ padding: '12px', color: '#4b5563' }}>{loan.returnDate ? new Date(loan.returnDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Pending...'}</td>
                                                    <td style={{ padding: '12px' }}><span style={{ background: loan.status === 'RETURNED' ? '#e8f5e9' : '#fff3e0', color: loan.status === 'RETURNED' ? '#2e7d32' : '#e65100', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>{loan.status}</span></td>
                                                    <td style={{ padding: '12px', fontWeight: 'bold', color: loan.status === 'ACTIVE' ? '#94a3b8' : '#166534' }}>
                                                        {loan.status === 'ACTIVE' ? 'Pending...' : `₹${loan.rentAmount || '0.00'}`}
                                                    </td>
                                                    <td style={{ padding: '12px', fontWeight: 'bold', color: loan.status === 'ACTIVE' ? '#94a3b8' : '#dc2626' }}>
                                                        {loan.status === 'ACTIVE' ? 'Pending...' : `₹${loan.fineAmount || '0.00'}`}
                                                    </td>
                                                </tr>
                                            )})}
                                            {getFilteredMemberHistory().length === 0 && (
                                                <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No rentals match this filter.</td></tr>
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
                                <th style={{ padding: '12px', width: '60px' }}>Photo</th><th style={{ padding: '12px' }}>Full Name</th><th style={{ padding: '12px' }}>Phone Number</th><th style={{ padding: '12px' }}>Dues</th><th style={{ padding: '12px' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allMembers.map(member => (
                                <tr key={member.memberId} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '12px' }}><img src={member.photoUrl} onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/40x40/8b5cf6/white?text=${member.fullName.charAt(0)}`; }} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #ccc' }} /></td>
                                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#111827' }}>{member.fullName}</td>
                                    <td style={{ padding: '12px', color: '#4b5563', fontFamily: 'monospace' }}>{member.phone}</td>
                                    <td style={{ padding: '12px', color: member.currentDues > 0 ? '#dc2626' : '#166534', fontWeight: 'bold' }}>{member.currentDues > 0 ? `₹${member.currentDues.toFixed(2)}` : '₹0'}</td>
                                    <td style={{ padding: '12px' }}><button onClick={() => { setDashboardTab('COUNTER'); selectCustomer(member); }} style={{ padding: '6px 12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Go to Checkout →</button></td>
                                </tr>
                            ))}
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
                                <option value="ALL">All Time</option><option value="TODAY">Today</option><option value="YESTERDAY">Yesterday</option><option value="CUSTOM">Custom Date Range</option>
                            </select>
                            {txFilter === 'CUSTOM' && (
                                <><input type="date" value={txStartDate} onChange={e => setTxStartDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} /><span style={{ color: '#6b7280', fontWeight: 'bold' }}>to</span><input type="date" value={txEndDate} onChange={e => setTxEndDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db' }} /></>
                            )}
                        </div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: '#fffbeb', borderBottom: '2px solid #fde68a' }}>
                                    <th style={{ padding: '12px', color: '#92400e' }}>Receipt ID</th><th style={{ padding: '12px', color: '#92400e' }}>Member Name</th><th style={{ padding: '12px', color: '#92400e' }}>Movie Title</th><th style={{ padding: '12px', color: '#92400e' }}>Checkout Time</th><th style={{ padding: '12px', color: '#92400e' }}>Return Time</th><th style={{ padding: '12px', color: '#92400e' }}>Status</th><th style={{ padding: '12px', color: '#92400e', textAlign: 'right' }}>Rent Collected</th><th style={{ padding: '12px', color: '#92400e', textAlign: 'right' }}>Fines Collected</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* --- FIX: SAFE NAMES & TITLES IN GLOBAL LEDGER --- */}
                                {filteredTransactions.map(tx => {
                                    const title = tx.itemTitle || tx.item?.title || tx.inventoryItem?.title || 'Unknown Title';
                                    const memberName = tx.memberName || tx.member?.fullName || 'Unknown Member';
                                    return (
                                    <tr key={tx.loanId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                        <td style={{ padding: '12px', fontFamily: 'monospace', color: '#6b7280' }}>{tx.loanId.substring(0, 8)}</td>
                                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#111827' }}>{memberName}</td>
                                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#374151' }}>{title}</td>
                                        <td style={{ padding: '12px', color: '#4b5563' }}>{new Date(tx.issueDate || tx.checkoutDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                        <td style={{ padding: '12px', color: '#4b5563' }}>{tx.returnDate ? new Date(tx.returnDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'Pending...'}</td>
                                        <td style={{ padding: '12px' }}><span style={{ background: tx.status === 'RETURNED' ? '#dcfce7' : '#fef3c7', color: tx.status === 'RETURNED' ? '#166534' : '#92400e', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>{tx.status}</span></td>
                                        <td style={{ padding: '12px', fontWeight: 'bold', color: tx.status === 'ACTIVE' ? '#9ca3af' : '#166534', textAlign: 'right' }}>{tx.status === 'ACTIVE' ? 'Pending...' : `₹${tx.rentAmount || '0.00'}`}</td>
                                        <td style={{ padding: '12px', fontWeight: 'bold', color: tx.status === 'ACTIVE' ? '#9ca3af' : '#dc2626', textAlign: 'right' }}>{tx.status === 'ACTIVE' ? 'Pending...' : `₹${tx.fineAmount || '0.00'}`}</td>
                                    </tr>
                                )})}
                                {filteredTransactions.length === 0 && (
                                    <tr><td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>No global transactions found.</td></tr>
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
    <div style={{ marginBottom: '16px' }}><label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>Full Name</label><input type="text" required disabled={otpSent} value={regForm.fullName} onChange={e => setRegForm({...regForm, fullName: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} placeholder="John Doe" /></div>
    
    <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>Mobile Number</label>
        <div style={{ display: 'flex', gap: '10px' }}>
            <span style={{ padding: '12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: 'bold' }}>+91</span>
            <input type="text" required disabled={otpSent} value={regForm.phone} onChange={e => setRegForm({...regForm, phone: e.target.value})} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} placeholder="10-digit mobile number" />
            {!otpSent && <button type="button" onClick={handleSendOtp} style={{ padding: '0 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>Send OTP</button>}
        </div>
    </div>

    {/* EXPLICIT VERIFICATION STEP */}
    {otpSent && !otpVerified && (
        <div style={{ marginBottom: '16px', padding: '16px', background: '#eff6ff', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#1d4ed8' }}>Enter 6-Digit Verification Code</label>
            <input type="text" required value={regForm.otp} onChange={e => setRegForm({...regForm, otp: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #93c5fd', fontSize: '18px', letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold', outline: 'none', marginBottom: '12px' }} placeholder="000000" maxLength="6" />
            <button type="button" onClick={handleVerifyOtp} style={{ width: '100%', padding: '12px', background: '#1d4ed8', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '16px' }}>Verify OTP</button>
        </div>
    )}

    {/* SUCCESS INDICATOR */}
    {otpVerified && (
        <div style={{ marginBottom: '16px', padding: '12px', background: '#dcfce7', borderRadius: '8px', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            ✅ Phone Number Verified Successfully
        </div>
    )}

    {/* REST OF FORM UNLOCKS ONLY AFTER VERIFICATION */}
    <div style={{ opacity: otpVerified ? 1 : 0.4, pointerEvents: otpVerified ? 'auto' : 'none', transition: 'opacity 0.3s' }}>
        <div style={{ marginBottom: '16px' }}><label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>Physical Address</label><textarea required disabled={!otpVerified} value={regForm.address} onChange={e => setRegForm({...regForm, address: e.target.value})} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', boxSizing: 'border-box', minHeight: '80px' }} placeholder="Full residential address" /></div>
        
        <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>Member Live Photo</label>
            {regForm.photoUrl ? (
                <div style={{ textAlign: 'center' }}>
                    <img src={regForm.photoUrl} alt="Captured" style={{ width: '100%', maxWidth: '300px', borderRadius: '8px', border: '2px solid #059669', marginBottom: '10px' }} />
                    <button type="button" onClick={() => setRegForm({...regForm, photoUrl: ''})} style={{ display: 'block', width: '100%', padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Retake Photo</button>
                </div>
            ) : (
                <div style={{ textAlign: 'center', background: '#111', padding: '15px', borderRadius: '8px' }}>
                    <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "user" }} style={{ width: '100%', maxWidth: '300px', borderRadius: '4px', marginBottom: '10px' }} />
                    <button type="button" onClick={capturePhoto} disabled={!otpVerified} style={{ display: 'block', width: '100%', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', marginBottom: '10px' }}>📸 Capture Photo</button>
                </div>
            )}
        </div>
        
        <div style={{ marginBottom: '24px', padding: '16px', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <input type="checkbox" id="deposit" disabled={!otpVerified} checked={regForm.depositPaid} onChange={e => setRegForm({...regForm, depositPaid: e.target.checked})} style={{ width: '20px', height: '20px', cursor: 'pointer' }} />
            <label htmlFor="deposit" style={{ fontWeight: '700', color: '#92400e', cursor: 'pointer' }}>I confirm that the ₹1000 Security Deposit has been collected.</label>
        </div>
        
        <button type="submit" disabled={!otpVerified} style={{ width: '100%', padding: '14px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '900', fontSize: '18px', cursor: 'pointer' }}>Complete Registration</button>
    </div>
</form>
                </div>
            )}
        </div>
    );
};

export default StaffDashboard;
