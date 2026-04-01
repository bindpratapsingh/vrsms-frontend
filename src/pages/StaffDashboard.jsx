import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Webcam from "react-webcam";
import { QRCodeSVG } from 'qrcode.react'; // <-- ADDED: QR Code library

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

    // <-- ADDED: Payment/QR Modal State -->
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentDetails, setPaymentDetails] = useState({ amount: 0, upiLink: '' });

    // NEW: Customer Editing State
    const [isEditingCustomer, setIsEditingCustomer] = useState(false);
    const [editCustomerForm, setEditCustomerForm] = useState({ fullName: '', phone: '', address: '', photoUrl: '' });

    // Registration State & Webcam
    const [regForm, setRegForm] = useState({ fullName: '', phone: '', address: '', photoUrl: '', depositPaid: false });
    const webcamRef = useRef(null);

    const capturePhoto = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        setRegForm({...regForm, photoUrl: imageSrc});
        setMessage({ type: 'success', text: 'Photo captured successfully!' });
    }, [webcamRef, regForm]);

    // Added logic for capturing a new photo during EDIT mode
    const captureEditPhoto = useCallback(() => {
        const imageSrc = webcamRef.current.getScreenshot();
        setEditCustomerForm({...editCustomerForm, photoUrl: imageSrc});
        setMessage({ type: 'success', text: 'New photo captured!' });
    }, [webcamRef, editCustomerForm]);

    const fetchAvailableMovies = useCallback(async () => {
        try {
            const res = await api.get('/inventory/available');
            const movies = res.data || [];
            
            // GROUP IDENTICAL MOVIES TOGETHER!
            const groupedMovies = movies.reduce((acc, movie) => {
                const key = `${movie.title} - ${movie.format}`;
                if (!acc[key]) {
                    // Create a new group and store an array of physical IDs
                    acc[key] = { title: movie.title, format: movie.format, count: 0, itemIds: [] };
                }
                acc[key].count += 1;
                acc[key].itemIds.push(movie.itemId); // Save the physical barcode ID
                return acc;
            }, {});

            const groupedArray = Object.values(groupedMovies);
            setCatalog(groupedArray);
            
            // Set the dropdown to the first group's FIRST available physical ID
            if (groupedArray.length > 0) setSelectedMovieId(groupedArray[0].itemIds[0]);
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
        setIsEditingCustomer(false); // Reset edit mode on new search
        try {
            const formattedPhone = formatPhone(phoneInput);
            const res = await api.get(`/staff/lookup-member?phone=${encodeURIComponent(formattedPhone)}`);
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

    // NEW: Handle saving the edited customer details
    const handleSaveCustomerEdit = async () => {
        try {
            const payload = { ...editCustomerForm, phone: formatPhone(editCustomerForm.phone) };
            await api.put(`/staff/members/edit/${foundCustomer.userId}`, payload);
            setMessage({ type: 'success', text: 'Customer profile updated!' });
            setIsEditingCustomer(false);
            
            // Re-fetch the customer to show updated details
            setPhoneInput(payload.phone.replace('+91', '')); // Update search box just in case
            
            // Manually update the foundCustomer object so the screen refreshes instantly
            setFoundCustomer({ ...foundCustomer, fullName: payload.fullName, phone: payload.phone, address: payload.address, photoUrl: payload.photoUrl || foundCustomer.photoUrl });
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
            
            // <-- ADDED: Generate UPI Link and Trigger Modal -->
            const upiUrl = `upi://pay?pa=bindpratapsingh@oksbi&pn=VRSMS&am=${fine}&cu=INR`;
            setPaymentDetails({ amount: fine, upiLink: upiUrl });
            setShowPaymentModal(true);

            setMessage({ type: fine > 0 ? 'error' : 'success', text: fine > 0 ? `Return Success. COLLECT FINE: ₹${fine}` : "Return Success!" });
            fetchAvailableMovies(); fetchCustomerRentals(foundCustomer.userId);
        } catch (error) { setMessage({ type: 'error', text: "Return failed" }); }
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
            setPhoneInput(regForm.phone); // Put their raw number in the box
            
            // Automatically search for them so they pop up on the screen!
            setTimeout(() => {
                const searchBtn = document.getElementById('search-btn');
                if(searchBtn) searchBtn.click();
            }, 500);

        } catch (error) {
            setMessage({ type: 'error', text: error.response?.data || "Registration failed." });
        }
    };

    if (!user) return null;

    return (
        <div style={{ padding: '40px', maxWidth: '1000px', margin: '0 auto', fontFamily: '"Inter", sans-serif', backgroundColor: '#f9fafb', minHeight: '100vh' }}>
            
            {/* <-- ADDED: THE PAYMENT MODAL --> */}
            {showPaymentModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '40px', borderRadius: '16px', textAlign: 'center', maxWidth: '400px', width: '90%' }}>
                        <h2 style={{ margin: '0 0 10px 0', color: '#111827' }}>Payment Due</h2>
                        <p style={{ fontSize: '32px', fontWeight: '800', color: '#dc2626', margin: '10px 0' }}>₹{paymentDetails.amount}</p>
                        <p style={{ color: '#6b7280', marginBottom: '20px' }}>Scan to pay via Any UPI App</p>
                        
                        <div style={{ background: '#f3f4f6', padding: '20px', borderRadius: '12px', display: 'inline-block', marginBottom: '20px' }}>
                            <QRCodeSVG value={paymentDetails.upiLink} size={200} />
                        </div>

                        <p style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '20px' }}>To: bindpratapsingh@oksbi</p>
                        
                        <button onClick={() => setShowPaymentModal(false)} style={{ width: '100%', padding: '12px', background: '#059669', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                            Payment Confirmed
                        </button>
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
                        
                        {/* 1. FIND CUSTOMER CARD */}
                        <div style={{ padding: '32px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <h3 style={{ marginTop: 0, fontSize: '18px', color: '#111827', marginBottom: '20px' }}>1. Find Customer</h3>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input type="text" value={phoneInput} onChange={e => setPhoneInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCustomerSearch()} placeholder="Phone number" style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '16px', outline: 'none' }} />
                                <button id="search-btn" onClick={handleCustomerSearch} style={{ padding: '12px 24px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>Search</button>
                            </div>
                            
                            {foundCustomer && !isEditingCustomer && (
                                <div style={{ marginTop: '16px', padding: '16px', background: '#f0f9ff', borderRadius: '8px', border: '1px solid #e0f2fe', position: 'relative' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <img 
                                            src={foundCustomer.photoUrl} 
                                            alt={foundCustomer.fullName} 
                                            onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/80x80?text=No+Photo'; }}
                                            style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #0284c7' }} 
                                        />
                                        <div>
                                            <p style={{ margin: 0, color: '#0369a1', fontWeight: '700', fontSize: '18px' }}>✓ {foundCustomer.fullName}</p>
                                            <p style={{ margin: '4px 0 0 0', color: '#0284c7', fontSize: '14px', fontFamily: 'monospace' }}>{foundCustomer.phone}</p>
                                        </div>
                                    </div>
                                    <button onClick={handleEditClick} style={{ position: 'absolute', top: '16px', right: '16px', padding: '6px 12px', background: 'white', color: '#0284c7', border: '1px solid #0284c7', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                        Edit Profile
                                    </button>
                                </div>
                            )}

                            {/* THE NEW EDIT FORM */}
                            {foundCustomer && isEditingCustomer && (
                                <div style={{ marginTop: '16px', padding: '16px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                                    <h4 style={{ margin: '0 0 12px 0', color: '#92400e' }}>Edit Customer Details</h4>
                                    
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#52525b' }}>Full Name</label>
                                    <input type="text" value={editCustomerForm.fullName} onChange={e => setEditCustomerForm({...editCustomerForm, fullName: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                                    
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#52525b' }}>Phone Number</label>
                                    <input type="text" value={editCustomerForm.phone} onChange={e => setEditCustomerForm({...editCustomerForm, phone: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />
                                    
                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#52525b' }}>Address</label>
                                    <textarea value={editCustomerForm.address} onChange={e => setEditCustomerForm({...editCustomerForm, address: e.target.value})} style={{ width: '100%', padding: '8px', marginBottom: '12px', borderRadius: '4px', border: '1px solid #d1d5db', boxSizing: 'border-box' }} />

                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={handleSaveCustomerEdit} style={{ flex: 1, padding: '10px', background: '#d97706', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Save Changes</button>
                                        <button onClick={() => setIsEditingCustomer(false)} style={{ padding: '10px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Cancel</button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 2. ISSUE MOVIE CARD */}
                        <div style={{ padding: '32px', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', opacity: foundCustomer ? 1 : 0.6 }}>
                            <h3 style={{ marginTop: 0, fontSize: '18px', color: '#111827', marginBottom: '20px' }}>2. Issue Movie</h3>
                            <select value={selectedMovieId} onChange={e => setSelectedMovieId(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '16px', marginBottom: '16px', background: 'white' }}>
        <option value="">-- Select Movie --</option>
        {catalog.map((group, idx) => (
            // We set the value to the FIRST available physical ID in the array
            <option key={idx} value={group.itemIds[0]}>
                {group.title} ({group.format}) - {group.count} Available
            </option>
        ))}
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
            {/* NEW COLUMN */}
            <th style={{ padding: '12px 8px', color: '#4b5563' }}>Movie Title</th> 
            <th style={{ padding: '12px 8px', color: '#4b5563' }}>Due Date</th>
            <th style={{ padding: '12px 8px', textAlign: 'right' }}>Action</th>
        </tr>
    </thead>
    <tbody>
        {activeRentals.map(r => {
            // Smart Lookup: Tries to grab the title from Java, or looks it up in the Clerk's local catalog
            const title = r.itemTitle || r.item?.title || r.inventoryItem?.title || (catalog.find(g => g.itemIds.includes(r.itemId))?.title) || 'Unknown Title';
            
            return (
            <tr key={r.loanId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '16px 8px', fontWeight: '600', fontFamily: 'monospace' }}>{r.loanId.substring(0, 8)}</td>
                
                {/* NEW DATA ROW */}
                <td style={{ padding: '16px 8px', fontWeight: 'bold', color: '#111827' }}>{title}</td>
                
                <td style={{ padding: '16px 8px' }}>{new Date(r.dueDate).toLocaleDateString()}</td>
                <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                    <button onClick={() => handleProcessReturn(r.loanId)} style={{ backgroundColor: '#f97316', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Return Item</button>
                </td>
            </tr>
        )})}
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
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>Member Live Photo</label>
                            {regForm.photoUrl ? (
                                <div style={{ textAlign: 'center' }}>
                                    <img src={regForm.photoUrl} alt="Captured" style={{ width: '100%', maxWidth: '300px', borderRadius: '8px', border: '2px solid #059669' }} />
                                    <button type="button" onClick={() => setRegForm({...regForm, photoUrl: ''})} style={{ display: 'block', margin: '10px auto', padding: '8px 16px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Retake Photo</button>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', background: '#111', padding: '10px', borderRadius: '8px' }}>
                                    <Webcam audio={false} ref={webcamRef} screenshotFormat="image/jpeg" videoConstraints={{ facingMode: "user" }} style={{ width: '100%', maxWidth: '300px', borderRadius: '4px' }} />
                                    <button type="button" onClick={capturePhoto} style={{ display: 'block', width: '100%', marginTop: '10px', padding: '12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>📸 Capture Photo</button>
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