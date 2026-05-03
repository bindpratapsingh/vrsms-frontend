import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const ManagerDashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });

    //For Coupons adding extra
    const [coupons, setCoupons] = useState([]);
    const [newCoupon, setNewCoupon] = useState({ code: '', discountPercentage: '' });
    
    // Stats & Config State
    const [stats, setStats] = useState({ totalRevenue: 0, totalCost: 0, netProfit: 0, totalInventoryCount: 0, inventory: [], loans: [], members: [] });
    const [config, setConfig] = useState({ maxRentalDays: '', lateFeePerDay: '' });

    // --- NEW: TRANSACTION FILTER STATE ---
    const [txFilter, setTxFilter] = useState('ALL'); 
    const [txStartDate, setTxStartDate] = useState('');
    const [txEndDate, setTxEndDate] = useState('');

    // Inventory Form State
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [format, setFormat] = useState('Blu-Ray');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [dailyRate, setDailyRate] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [quantity, setQuantity] = useState(1); 

    const [editingId, setEditingId] = useState(null); 
    const [activeView, setActiveView] = useState(null); 
    const [selectedMemberHistory, setSelectedMemberHistory] = useState(null); // Added for Audit Modal

    useEffect(() => {
        const loggedInUser = localStorage.getItem('vrsms_user');
        if (!loggedInUser) navigate('/');
        else {
            setUser(JSON.parse(loggedInUser));
            fetchDashboardData();
        }
    }, [navigate]);

    const fetchDashboardData = async () => {
        try {
            const statsRes = await api.get('/manager/stats');
            
            let detailedLoans = [];
            try {
                const txRes = await api.get('/rentals/all');
                detailedLoans = txRes.data || [];
            } catch (txError) {
                console.error("TRANSACTIONS FETCH ERROR:", txError);
            }

            let fetchedMembers = [];
            try {
                const membersRes = await api.get('/staff/members/all'); 
                fetchedMembers = membersRes.data || [];
            } catch (memberError) {
                console.error("MEMBER FETCH ERROR:", memberError.response?.data || memberError.message);
            }

            setStats({
                ...statsRes.data,
                inventory: statsRes.data.inventory || [],
                loans: detailedLoans, // Injecting the detailed list with names and titles
                members: fetchedMembers
            });

            const couponRes = await api.get('/manager/coupons/all');
            setCoupons(couponRes.data || []);

            const configRes = await api.get('/manager/config');
            setConfig({ maxRentalDays: configRes.data.maxRentalDays, lateFeePerDay: configRes.data.lateFeePerDay });
        } catch (error) {
            console.error("Failed to load dashboard data", error);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('vrsms_user');
        navigate('/');
    };

    const handleInventorySubmit = async (e) => {
        e.preventDefault();
        
        const payload = { 
            title, category, format, 
            purchasePrice: parseFloat(purchasePrice), 
            dailyRate: parseFloat(dailyRate),
            imageUrl: imageUrl,
            quantity: parseInt(quantity) 
        };

        try {
            if (editingId) {
                await api.put(`/inventory/edit/${editingId}`, payload);
                setMessage({ type: 'success', text: `Successfully updated "${title}"!` });
            } else {
                await api.post('/inventory/add', payload);
                setMessage({ type: 'success', text: `Added "${title}" to inventory!` });
            }
            
            resetForm();
            setQuantity(1);
            fetchDashboardData(); 
        } catch (error) {
            console.error("EDIT ERROR:", error); 
            setMessage({ type: 'error', text: error.response?.data || 'Failed to save. Check F12 Console.' });
        }
    };

    const handleEditClick = (item) => {
        setTitle(item.title);
        setCategory(item.category || '');
        setFormat(item.format);
        setPurchasePrice(item.purchasePrice);
        setDailyRate(item.dailyRate);
        setImageUrl(item.imageUrl || '');
        setEditingId(item.itemId); 
        
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    const resetForm = () => {
        setTitle(''); setCategory(''); setFormat('Blu-Ray'); 
        setPurchasePrice(''); setDailyRate(''); setImageUrl('');
        setEditingId(null);
    };

    const handleUpdateConfig = async (e) => {
        e.preventDefault();
        try {
            await api.post('/manager/config', config);
            setMessage({ type: 'success', text: 'System Configuration updated successfully!' });
            setTimeout(() => setMessage({ type: '', text: '' }), 3000);
            fetchDashboardData();
        } catch (error) {
            setMessage({ type: 'error', text: 'Failed to update configuration.' });
        }
    };

    const handleCreateCoupon = async (e) => {
        e.preventDefault();

        const discountNum = Number(newCoupon.discountPercentage);

        if (discountNum < 0 || discountNum > 100) {
            alert(`❌ INVALID DISCOUNT: You cannot set a discount of ${discountNum}%. It must be exactly between 0 and 100.`);
            return; 
        }

        try {
            await api.post('/manager/coupons/add', newCoupon);
            fetchDashboardData();
            setNewCoupon({code:'', discountPercentage:''});
            setMessage({ type: 'success', text: `Successfully created coupon ${newCoupon.code.toUpperCase()}!` });
        } catch (error) {
            alert(typeof error.response?.data === 'string' ? error.response.data : "Failed to create coupon.");
        }
    };

    // --- NEW: TOGGLE MEMBERSHIP FUNCTION ---
    const handleToggleMembership = async (memberId, currentStatus) => {
        const action = currentStatus === false ? "RESTORE" : "CANCEL";
        
        const userInput = window.prompt(
            `🛑 SECURITY WARNING 🛑\n\nYou are about to ${action} this membership.\n\nTo confirm, please type the word ${action} exactly:`
        );

        if (userInput !== action) {
            alert(`Action aborted. You must type "${action}" exactly to proceed.`);
            return;
        }
        
        try {
            await api.put(`/manager/members/${memberId}/toggle-status`);
            fetchDashboardData(); 
            alert(`Success: Membership has been successfully ${action.toLowerCase()}ed.`);
        } catch (error) {
            alert(error.response?.data || "Failed to change membership status.");
        }
    };

    const getFilteredTransactions = () => {
        return (stats.loans || []).filter(tx => {
            if (txFilter === 'ALL') return true;
            const txDate = new Date(tx.returnDate || tx.issueDate);
            txDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (txFilter === 'TODAY') { return txDate.getTime() === today.getTime(); }
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
        }).sort((a, b) => new Date(b.issueDate || b.returnDate) - new Date(a.issueDate || a.returnDate)); // Added Sorting
    };

    const filteredTransactions = getFilteredTransactions();

    const StatCard = ({ title, value, color, onClickTarget }) => (
        <div onClick={() => setActiveView(onClickTarget === activeView ? null : onClickTarget)} style={{ background: activeView === onClickTarget ? '#e3f2fd' : '#fff', padding: '24px', borderRadius: '12px', border: activeView === onClickTarget ? '2px solid #1976d2' : '1px solid #e5e7eb', textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s', boxShadow: activeView === onClickTarget ? '0 4px 12px rgba(25, 118, 210, 0.2)' : '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h3 style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h3>
            <p style={{ fontSize: '28px', fontWeight: '900', margin: '0 0 12px 0', color: color }}>{value}</p>
            <div style={{ display: 'inline-block', background: activeView === onClickTarget ? '#1976d2' : '#f3f4f6', color: activeView === onClickTarget ? 'white' : '#4b5563', padding: '6px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold', transition: 'all 0.2s' }}>{activeView === onClickTarget ? 'Close Details ✖' : 'View Details ➔'}</div>
        </div>
    );

    const groupedInventory = Object.values(stats.inventory.reduce((acc, item) => {
        const key = `${item.title.trim()}-${item.format}`;
        if (!acc[key]) { acc[key] = { ...item, totalCount: 0, availableCount: 0, itemIds: [] }; }
        acc[key].totalCount += 1;
        if (item.status === 'AVAILABLE') acc[key].availableCount += 1;
        acc[key].itemIds.push(item.itemId);
        return acc;
    }, {}));

    if (!user) return <div>Loading...</div>;

    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: '"Inter", sans-serif' }}>
            
            {/* --- ADDED: MEMBER AUDIT MODAL --- */}
            {selectedMemberHistory && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '30px', borderRadius: '12px', maxWidth: '800px', width: '90%', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
                        <button onClick={() => setSelectedMemberHistory(null)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'transparent', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9ca3af' }}>✖</button>
                        <h2 style={{ margin: '0 0 20px 0', color: '#111827' }}>Auditing: {selectedMemberHistory}</h2>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                                    <th style={{ padding: '12px' }}>Movie</th><th style={{ padding: '12px' }}>Date & Time</th><th style={{ padding: '12px' }}>Status</th><th style={{ padding: '12px' }}>Rent</th><th style={{ padding: '12px' }}>Fines</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[...stats.loans].filter(l => l.memberName === selectedMemberHistory).sort((a,b) => new Date(b.issueDate || b.returnDate) - new Date(a.issueDate || a.returnDate)).map(tx => (
                                    <tr key={tx.loanId} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{tx.itemTitle}</td>
                                        <td style={{ padding: '12px' }}>{new Date(tx.returnDate || tx.issueDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                        <td style={{ padding: '12px' }}><span style={{ background: tx.status === 'RETURNED' ? '#dcfce7' : '#fef3c7', color: tx.status === 'RETURNED' ? '#166534' : '#92400e', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' }}>{tx.status}</span></td>
                                        <td style={{ padding: '12px', color: '#059669', fontWeight: 'bold' }}>₹{tx.rentAmount || '0.00'}</td>
                                        <td style={{ padding: '12px', color: '#dc2626', fontWeight: 'bold' }}>₹{tx.fineAmount || '0.00'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '30px' }}>
                <div><h1 style={{ fontSize: '28px', color: '#1a1a1a', margin: 0, fontWeight: '800' }}>Admin Control Center</h1></div>
                <button onClick={handleLogout} style={{ backgroundColor: '#1a1a1a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Logout</button>
            </div>

            {message.text && (<div style={{ marginBottom: '20px', padding: '15px', background: message.type === 'error' ? '#fef2f2' : '#f0fdf4', color: message.type === 'error' ? '#991b1b' : '#166534', border: `1px solid ${message.type === 'error' ? '#fee2e2' : '#dcfce7'}`, borderRadius: '8px', fontWeight: '500' }}>{message.text}</div>)}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '30px' }}>
                <StatCard title="Total Revenue" value={`₹${stats.totalRevenue.toFixed(2)}`} color="#059669" onClickTarget="REVENUE" />
                <StatCard title="Total Asset Cost" value={`₹${stats.totalCost.toFixed(2)}`} color="#dc2626" onClickTarget="CATALOG" />
                <StatCard title="Registered Members" value={stats.members.length} color="#2563eb" onClickTarget="MEMBERS" />
                <StatCard title="Active Coupons" value={coupons.length} color="#7c3aed" onClickTarget="MARKETING" />
                <div style={{ background: '#111827', padding: '24px', borderRadius: '12px', textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ color: '#9ca3af', fontSize: '14px', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Net Profit / Loss</h3>
                    <p style={{ fontSize: '28px', fontWeight: '900', margin: 0, color: stats.netProfit >= 0 ? '#10b981' : '#ef4444' }}>{stats.netProfit >= 0 ? '+' : ''}₹{stats.netProfit.toFixed(2)}</p>
                </div>
                <StatCard title="Items in Catalog" value={stats.totalInventoryCount} color="#4b5563" onClickTarget="CATALOG" />
            </div>

            {activeView === 'CATALOG' && (
                <div style={{ background: '#fff', border: '1px solid #3b82f6', borderRadius: '12px', padding: '24px', marginBottom: '40px', overflowX: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ marginTop: 0, color: '#2563eb', fontSize: '20px' }}>Inventory Ledger (Grouped)</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#eff6ff', borderBottom: '2px solid #bfdbfe' }}>
                                <th style={{ padding: '12px', color: '#1d4ed8' }}>Title</th><th style={{ padding: '12px', color: '#1d4ed8' }}>Format</th><th style={{ padding: '12px', color: '#1d4ed8' }}>Total Copies</th><th style={{ padding: '12px', color: '#1d4ed8' }}>Available</th><th style={{ padding: '12px', color: '#1d4ed8' }}>Purchase Cost</th><th style={{ padding: '12px', color: '#1d4ed8' }}>Daily Rate</th><th style={{ padding: '12px', color: '#1d4ed8', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedInventory.map(group => (
                                <tr key={group.itemIds[0]} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#111827' }}>{group.title}</td><td style={{ padding: '12px', color: '#4b5563' }}>{group.format}</td><td style={{ padding: '12px', fontWeight: 'bold', color: '#374151' }}>{group.totalCount}</td>
                                    <td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: group.availableCount > 0 ? '#dcfce7' : '#fef3c7', color: group.availableCount > 0 ? '#166534' : '#92400e' }}>{group.availableCount} Available</span></td>
                                    <td style={{ padding: '12px', color: '#dc2626', fontWeight: '500' }}>₹{group.purchasePrice}</td><td style={{ padding: '12px', color: '#059669', fontWeight: '500' }}>₹{group.dailyRate}/day</td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}><button onClick={() => handleEditClick(group)} style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Edit</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeView === 'REVENUE' && (
                <div style={{ background: '#fff', border: '1px solid #10b981', borderRadius: '12px', padding: '24px', marginBottom: '40px', overflowX: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #dcfce7', paddingBottom: '16px' }}>
                        <h3 style={{ marginTop: 0, color: '#059669', margin: 0, fontSize: '20px' }}>Financial Transactions Ledger</h3>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <select value={txFilter} onChange={(e) => setTxFilter(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontWeight: 'bold', color: '#374151', outline: 'none' }}>
                                <option value="ALL">All History</option><option value="TODAY">Today</option><option value="YESTERDAY">Yesterday</option><option value="CUSTOM">Custom Range</option>
                            </select>
                            {txFilter === 'CUSTOM' && (
                                <><input type="date" value={txStartDate} onChange={e => setTxStartDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' }} /><span style={{color: '#6b7280', fontWeight: 'bold'}}>to</span><input type="date" value={txEndDate} onChange={e => setTxEndDate(e.target.value)} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', outline: 'none' }} /></>
                            )}
                        </div>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f0fdf4', borderBottom: '2px solid #bbf7d0' }}>
                                <th style={{ padding: '12px', color: '#15803d' }}>Receipt ID</th><th style={{ padding: '12px', color: '#15803d' }}>Customer</th><th style={{ padding: '12px', color: '#15803d' }}>Movie</th><th style={{ padding: '12px', color: '#15803d' }}>Date & Time</th><th style={{ padding: '12px', color: '#15803d' }}>Status</th><th style={{ padding: '12px', color: '#15803d', textAlign: 'right' }}>Rent Collected</th><th style={{ padding: '12px', color: '#15803d', textAlign: 'right' }}>Fines Collected</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.map(loan => (
                                <tr key={loan.loanId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '12px', fontFamily: 'monospace', color: '#6b7280' }}>{loan.loanId.substring(0, 8)}...</td>
                                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#111827' }}>{loan.memberName || 'Unknown'}</td>
                                    <td style={{ padding: '12px', color: '#4b5563', fontWeight: '500' }}>{loan.itemTitle || 'Unknown'}</td>
                                    {/* FIX: Formatted string to timestamp format */}
                                    <td style={{ padding: '12px', color: '#6b7280' }}>{new Date(loan.returnDate || loan.issueDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                    <td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', background: loan.status === 'RETURNED' ? '#dcfce7' : '#fef3c7', color: loan.status === 'RETURNED' ? '#166534' : '#92400e' }}>{loan.status}</span></td>
                                    <td style={{ padding: '12px', color: '#059669', fontWeight: 'bold', textAlign: 'right' }}>₹{loan.rentAmount || '0.00'}</td><td style={{ padding: '12px', color: '#dc2626', fontWeight: 'bold', textAlign: 'right' }}>₹{loan.fineAmount || '0.00'}</td>
                                </tr>
                            ))}
                            {filteredTransactions.length === 0 && <tr><td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>No rental transactions match this filter.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {activeView === 'MEMBERS' && (
                <div style={{ background: '#fff', border: '1px solid #3b82f6', borderRadius: '12px', padding: '24px', marginBottom: '40px', overflowX: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ marginTop: 0, color: '#2563eb', fontSize: '20px' }}>Registered Members Database</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#eff6ff', borderBottom: '2px solid #bfdbfe' }}>
                                <th style={{ padding: '12px', width: '60px', color: '#1d4ed8' }}>Photo</th><th style={{ padding: '12px', color: '#1d4ed8' }}>Full Name</th><th style={{ padding: '12px', color: '#1d4ed8' }}>Phone Number</th><th style={{ padding: '12px', color: '#1d4ed8' }}>Address</th><th style={{ padding: '12px', color: '#1d4ed8' }}>Deposit</th>
                                {/* ADDED AUDIT HEADER */}
                                <th style={{ padding: '12px', color: '#1d4ed8', textAlign: 'right' }}>Audit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.members.map(member => (
                                <tr key={member.memberId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '12px' }}><img src={member.photoUrl} alt={member.fullName} onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/40x40/3b82f6/white?text=${member.fullName.charAt(0)}`; }} style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #e5e7eb' }} /></td>
                                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#111827' }}>{member.fullName}</td>
                                    <td style={{ padding: '12px', color: '#4b5563', fontFamily: 'monospace' }}>{member.phone}</td><td style={{ padding: '12px', color: '#6b7280', fontSize: '14px' }}>{member.address}</td>
                                    <td style={{ padding: '12px' }}><span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: member.depositPaid ? '#dcfce7' : '#fee2e2', color: member.depositPaid ? '#166534' : '#991b1b' }}>{member.depositPaid ? '₹1000 Paid' : 'Pending'}</span></td>
                                    {/* ADDED VIEW RENTALS BUTTON */}
                                    <td style={{ padding: '12px', textAlign: 'right' }}>
    <button onClick={() => setSelectedMemberHistory(member.fullName)} style={{ padding: '6px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', marginRight: '8px' }}>View Rentals</button>
    
    {/* ADDED: KILL SWITCH BUTTON */}
    <button onClick={() => handleToggleMembership(member.memberId, member.isActive)} style={{ padding: '6px 12px', background: member.isActive === false ? '#10b981' : '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
        {member.isActive === false ? 'Restore' : 'Cancel'}
    </button>
</td>
                                </tr>
                            ))}
                            {stats.members.length === 0 && <tr><td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>No members registered yet.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            {activeView === 'MARKETING' && (
                <div style={{ background: '#fff', border: '1px solid #8b5cf6', padding: '24px', borderRadius: '12px', marginBottom: '40px', overflowX: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ color: '#7c3aed', marginTop: 0, fontSize: '20px' }}>Coupon Management</h3>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', background: '#f5f3ff', padding: '16px', borderRadius: '8px', border: '1px dashed #c4b5fd' }}>
                        <input type="text" placeholder="CODE (e.g. SUMMER50)" value={newCoupon.code} onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})} style={{ flex: 1, padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', outline: 'none', fontWeight: 'bold' }} />
                        <input type="number" min="0" max="100" placeholder="Discount %" value={newCoupon.discountPercentage} onChange={e => setNewCoupon({...newCoupon, discountPercentage: e.target.value})} style={{ padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '6px', width: '120px', outline: 'none' }} />
                        <button onClick={handleCreateCoupon} style={{ background: '#8b5cf6', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Create Coupon</button>
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead><tr style={{ textAlign: 'left', background: '#f5f3ff', borderBottom: '2px solid #ddd6fe' }}><th style={{ padding: '12px', color: '#6d28d9' }}>Promo Code</th><th style={{ padding: '12px', color: '#6d28d9' }}>Discount Applied</th><th style={{ padding: '12px', color: '#6d28d9', textAlign: 'right' }}>Action</th></tr></thead>
                        <tbody>
                            {coupons.map(c => (
                                <tr key={c.couponId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '12px', fontWeight: '900', color: '#111827', fontFamily: 'monospace', fontSize: '16px' }}>{c.code}</td><td style={{ padding: '12px', color: '#059669', fontWeight: 'bold' }}>{c.discountPercentage}% Off</td>
                                    <td style={{ padding: '12px', textAlign: 'right' }}><button onClick={async () => { await api.delete(`/manager/coupons/${c.couponId}`); fetchDashboardData(); }} style={{ color: '#ef4444', background: '#fee2e2', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Delete</button></td>
                                </tr>
                            ))}
                            {coupons.length === 0 && <tr><td colSpan="3" style={{ padding: '30px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>No active coupons available.</td></tr>}
                        </tbody>
                    </table>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                <div style={{ background: '#fff', padding: '32px', borderRadius: '12px', borderTop: `6px solid ${editingId ? '#f59e0b' : '#059669'}`, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ marginTop: 0, color: editingId ? '#d97706' : '#111827', fontSize: '20px', marginBottom: '24px' }}>{editingId ? `Editing: ${title}` : 'Add New Inventory'}</h3>
                    <form onSubmit={handleInventorySubmit}>
                        <div style={{ marginBottom: '16px' }}><label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>Title</label><input type="text" value={title} onChange={e => setTitle(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }} /></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div><label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>Category</label><input type="text" value={category} onChange={e => setCategory(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }} /></div>
                            <div><label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>Format</label><select value={format} onChange={e => setFormat(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box', outline: 'none', background: 'white' }}><option value="Blu-Ray">Blu-Ray</option><option value="DVD">DVD</option><option value="VHS">VHS</option></select></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                            <div><label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>Purchase Cost (₹)</label><input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }} /></div>
                            <div><label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>Daily Rate (₹)</label><input type="number" step="0.01" value={dailyRate} onChange={e => setDailyRate(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }} /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: editingId ? '1fr' : '2fr 1fr', gap: '16px', marginBottom: '30px' }}>
                            <div><label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>Poster Image URL</label><input type="text" placeholder="https://..." value={imageUrl} onChange={e => setImageUrl(e.target.value)} style={{ width: '100%', padding: '12px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box', outline: 'none' }} /></div>
                            {!editingId && <div><label style={{ display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: 'bold', color: '#374151' }}>Quantity</label><input type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} required style={{ width: '100%', padding: '12px', border: '1px solid #10b981', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#ecfdf5', outline: 'none', fontWeight: 'bold' }} /></div>}
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button type="submit" style={{ flex: 1, backgroundColor: editingId ? '#f59e0b' : '#059669', color: 'white', padding: '14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>{editingId ? 'Save Updates' : 'Add to Catalog'}</button>
                            {editingId && <button type="button" onClick={resetForm} style={{ backgroundColor: '#ef4444', color: 'white', padding: '14px 24px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>Cancel</button>}
                        </div>
                    </form>
                </div>
                <div style={{ background: '#111827', padding: '32px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                    <h3 style={{ marginTop: 0, color: 'white', fontSize: '20px', marginBottom: '8px' }}>System Rules</h3>
                    <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '24px' }}>These rules apply globally to all future rentals.</p>
                    <form onSubmit={handleUpdateConfig}>
                        <div style={{ marginBottom: '20px' }}><label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', color: '#e5e7eb' }}>Max Rental Duration (Days)</label><input type="number" value={config.maxRentalDays} onChange={e => setConfig({...config, maxRentalDays: e.target.value})} required style={{ width: '100%', padding: '12px', border: '1px solid #4b5563', borderRadius: '6px', boxSizing: 'border-box', background: '#374151', color: 'white', outline: 'none' }} /></div>
                        <div style={{ marginBottom: '30px' }}><label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold', color: '#e5e7eb' }}>Late Fine (₹ per day)</label><input type="number" step="0.01" value={config.lateFeePerDay} onChange={e => setConfig({...config, lateFeePerDay: e.target.value})} required style={{ width: '100%', padding: '12px', border: '1px solid #4b5563', borderRadius: '6px', boxSizing: 'border-box', background: '#374151', color: 'white', outline: 'none' }} /></div>
                        <button type="submit" style={{ width: '100%', backgroundColor: '#3b82f6', color: 'white', padding: '14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px' }}>Save Store Rules</button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ManagerDashboard;
