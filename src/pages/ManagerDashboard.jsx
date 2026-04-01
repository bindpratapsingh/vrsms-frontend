import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const ManagerDashboard = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [message, setMessage] = useState({ type: '', text: '' });
    
    // Stats & Config State
    const [stats, setStats] = useState({ totalRevenue: 0, totalCost: 0, netProfit: 0, totalInventoryCount: 0, inventory: [], loans: [], members: [] });
    const [config, setConfig] = useState({ maxRentalDays: '', lateFeePerDay: '' });

    // Inventory Form State
    const [title, setTitle] = useState('');
    const [category, setCategory] = useState('');
    const [format, setFormat] = useState('Blu-Ray');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [dailyRate, setDailyRate] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [quantity, setQuantity] = useState(1); // Tracker for quantity!

    const [editingId, setEditingId] = useState(null); // Tracks which item is being edited
    
    // Toggle State for Ledgers
    const [activeView, setActiveView] = useState(null); // 'CATALOG' or 'REVENUE'

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
            // 1. Fetch normal stats
            const statsRes = await api.get('/manager/stats');
            
            // 2. Safely fetch members separately!
            let fetchedMembers = [];
            try {
                const membersRes = await api.get('/staff/members/all'); 
                fetchedMembers = membersRes.data || [];
            } catch (memberError) {
                console.error("MEMBER FETCH ERROR:", memberError.response?.data || memberError.message);
                // If it fails, it will now print the exact reason to your F12 console!
            }

            setStats({
                ...statsRes.data,
                inventory: statsRes.data.inventory || [],
                loans: statsRes.data.loans || [],
                members: fetchedMembers // <-- Inject the safe array here
            });

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

    // --- NEW COMBINED SUBMIT HANDLER (Handles both Add and Edit) ---
    const handleInventorySubmit = async (e) => {
        e.preventDefault();
        
        const payload = { 
            title, category, format, 
            purchasePrice: parseFloat(purchasePrice), 
            dailyRate: parseFloat(dailyRate),
            imageUrl: imageUrl,
            quantity: parseInt(quantity) // Send quantity to Java!
        };

        try {
            if (editingId) {
                // If we are editing, send a PUT request to the edit endpoint
                await api.put(`/inventory/edit/${editingId}`, payload);
                setMessage({ type: 'success', text: `Successfully updated "${title}"!` });
            } else {
                // If not editing, create a new item
                await api.post('/inventory/add', payload);
                setMessage({ type: 'success', text: `Added "${title}" to inventory!` });
            }
            
            // Clear the form and reset the editing state
            resetForm();
            setQuantity(1);
            fetchDashboardData(); 
        } catch (error) {
            console.error("EDIT ERROR:", error); 
            setMessage({ type: 'error', text: error.response?.data || 'Failed to save. Check F12 Console.' });
        }
    };

    // --- NEW EDIT BUTTON CLICK HANDLER ---
    const handleEditClick = (item) => {
        setTitle(item.title);
        setCategory(item.category || '');
        setFormat(item.format);
        setPurchasePrice(item.purchasePrice);
        setDailyRate(item.dailyRate);
        setImageUrl(item.imageUrl || '');
        setEditingId(item.itemId); // Set the tracker!
        
        // Smoothly scroll down to the form
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

    // --- HELPER COMPONENT FOR THE CARDS ---
    const StatCard = ({ title, value, color, onClickTarget }) => (
        <div 
            onClick={() => setActiveView(onClickTarget === activeView ? null : onClickTarget)}
            style={{ 
                background: activeView === onClickTarget ? '#e3f2fd' : '#fff', 
                padding: '20px', borderRadius: '8px', border: activeView === onClickTarget ? '2px solid #1976d2' : '1px solid #e0e0e0', 
                textAlign: 'center', cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: activeView === onClickTarget ? '0 4px 12px rgba(25, 118, 210, 0.2)' : 'none'
            }}
        >
            <h3 style={{ color: '#666', fontSize: '14px', margin: '0 0 10px 0' }}>{title}</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: color }}>{value}</p>
            <small style={{ color: '#1976d2', display: 'block', marginTop: '10px', fontSize: '12px' }}>Click to view details</small>
        </div>
    );

    if (!user) return <div>Loading...</div>;

    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', color: '#1a1a1a', margin: 0 }}>Admin Control Center</h1>
                </div>
                <button onClick={handleLogout} style={{ backgroundColor: '#1a1a1a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer' }}>Logout</button>
            </div>

            {message.text && (
                <div style={{ marginBottom: '20px', padding: '15px', background: message.type === 'error' ? '#ffebee' : '#e8f5e9', color: message.type === 'error' ? '#c62828' : '#2e7d32', border: '1px solid', borderRadius: '4px' }}>
                    {message.text}
                </div>
            )}

            {/* FINANCIAL STATS BANNER */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '20px' }}>
                <StatCard title="Total Revenue" value={`₹${stats.totalRevenue.toFixed(2)}`} color="#2e7d32" onClickTarget="REVENUE" />
                <StatCard title="Total Asset Cost" value={`₹${stats.totalCost.toFixed(2)}`} color="#d32f2f" onClickTarget="CATALOG" />
                <StatCard title="Registered Members" value={stats.members.length} color="#0284c7" onClickTarget="MEMBERS" />

                <div style={{ background: '#1a1a1a', padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                    <h3 style={{ color: '#aaa', fontSize: '14px', margin: '0 0 10px 0' }}>Net Profit / Loss</h3>
                    <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: stats.netProfit >= 0 ? '#4caf50' : '#ef5350' }}>
                        {stats.netProfit >= 0 ? '+' : ''}₹{stats.netProfit.toFixed(2)}
                    </p>
                </div>
                
                <StatCard title="Items in Catalog" value={stats.totalInventoryCount} color="#1a1a1a" onClickTarget="CATALOG" />
            </div>

            {/* EXPANDABLE LEDGER VIEW */}
            {activeView === 'CATALOG' && (
                <div style={{ background: '#fff', border: '1px solid #1976d2', borderRadius: '8px', padding: '20px', marginBottom: '40px', overflowX: 'auto' }}>
                    <h3 style={{ marginTop: 0, color: '#1976d2' }}>Inventory Ledger (Costs)</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                                <th style={{ padding: '12px' }}>Title</th>
                                <th style={{ padding: '12px' }}>Format</th>
                                <th style={{ padding: '12px' }}>Status</th>
                                <th style={{ padding: '12px' }}>Purchase Cost</th>
                                <th style={{ padding: '12px' }}>Daily Rate</th>
                                {/* ADDED ACTION COLUMN HEADER */}
                                <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.inventory.map(item => (
                                <tr key={item.itemId} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{item.title}</td>
                                    <td style={{ padding: '12px' }}>{item.format}</td>
                                    <td style={{ padding: '12px' }}>
                                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', backgroundColor: item.status === 'AVAILABLE' ? '#e8f5e9' : '#fff3e0', color: item.status === 'AVAILABLE' ? '#2e7d32' : '#e65100' }}>
                                            {item.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', color: '#d32f2f' }}>₹{item.purchasePrice}</td>
                                    <td style={{ padding: '12px', color: '#2e7d32' }}>₹{item.dailyRate}/day</td>
                                    {/* ADDED THE EDIT BUTTON */}
                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                        <button 
                                            onClick={() => handleEditClick(item)} 
                                            style={{ backgroundColor: '#f59e0b', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {activeView === 'REVENUE' && (
                <div style={{ background: '#fff', border: '1px solid #1976d2', borderRadius: '8px', padding: '20px', marginBottom: '40px', overflowX: 'auto' }}>
                    <h3 style={{ marginTop: 0, color: '#1976d2' }}>Revenue Ledger (Loans & Fines)</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                                <th style={{ padding: '12px' }}>Receipt ID</th>
                                <th style={{ padding: '12px' }}>Issue Date</th>
                                <th style={{ padding: '12px' }}>Status</th>
                                <th style={{ padding: '12px' }}>Rent Collected</th>
                                <th style={{ padding: '12px' }}>Fines Collected</th>
                            </tr>
                        </thead>
                        <tbody>
                            {stats.loans.map(loan => (
                                <tr key={loan.loanId} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>{loan.loanId.substring(0, 8)}...</td>
                                    <td style={{ padding: '12px' }}>{new Date(loan.issueDate).toLocaleDateString()}</td>
                                    <td style={{ padding: '12px' }}>{loan.status}</td>
                                    <td style={{ padding: '12px', color: '#2e7d32', fontWeight: 'bold' }}>₹{loan.rentAmount || '0.00'}</td>
                                    <td style={{ padding: '12px', color: '#d32f2f', fontWeight: 'bold' }}>₹{loan.fineAmount || '0.00'}</td>
                                </tr>
                            ))}
                            {stats.loans.length === 0 && (
                                <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>No rental transactions recorded yet.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
                {/* NEW: EXPANDABLE MEMBERS LEDGER */}
    {activeView === 'MEMBERS' && (
        <div style={{ background: '#fff', border: '1px solid #0284c7', borderRadius: '8px', padding: '20px', marginBottom: '40px', overflowX: 'auto' }}>
            <h3 style={{ marginTop: 0, color: '#0284c7' }}>Registered Members Database</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                    <tr style={{ background: '#f0f9ff', borderBottom: '2px solid #bae6fd' }}>
                        <th style={{ padding: '12px', width: '60px' }}>Photo</th>
                        <th style={{ padding: '12px' }}>Full Name</th>
                        <th style={{ padding: '12px' }}>Phone Number</th>
                        <th style={{ padding: '12px' }}>Address</th>
                        <th style={{ padding: '12px' }}>Deposit</th>
                    </tr>
                </thead>
                <tbody>
                    {stats.members.map(member => (
                        <tr key={member.memberId} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '12px' }}>
                                <img 
                                    src={member.photoUrl} 
                                    alt={member.fullName}
                                    onError={(e) => { e.target.onerror = null; e.target.src = 'https://placehold.co/40x40?text=No+Pic'; }}
                                    style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1px solid #ccc' }}
                                />
                            </td>
                            <td style={{ padding: '12px', fontWeight: 'bold', color: '#111827' }}>{member.fullName}</td>
                            <td style={{ padding: '12px', color: '#4b5563', fontFamily: 'monospace' }}>{member.phone}</td>
                            <td style={{ padding: '12px', color: '#6b7280', fontSize: '14px' }}>{member.address}</td>
                            <td style={{ padding: '12px' }}>
                                <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: member.depositPaid ? '#dcfce7' : '#fee2e2', color: member.depositPaid ? '#166534' : '#991b1b' }}>
                                    {member.depositPaid ? '₹1000 Paid' : 'Pending'}
                                </span>
                            </td>
                        </tr>
                    ))}
                    {stats.members.length === 0 && (
                        <tr><td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>No members registered yet.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    )}

            {/* LOWER FORMS (INVENTORY & CONFIGURATION) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
                
                {/* Inventory Card (Now dynamically updates color based on Edit mode!) */}
                <div style={{ background: '#fff', padding: '30px', borderRadius: '8px', borderTop: `4px solid ${editingId ? '#f59e0b' : '#2e7d32'}`, boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ marginTop: 0, color: editingId ? '#d97706' : '#1a1a1a' }}>
                        {editingId ? `Editing: ${title}` : 'Add New Inventory'}
                    </h3>
                    
                    {/* UPDATED FORM TAG */}
                    <form onSubmit={handleInventorySubmit}>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Title</label>
                            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Category</label>
                                <input type="text" value={category} onChange={e => setCategory(e.target.value)} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Format</label>
                                <select value={format} onChange={e => setFormat(e.target.value)} style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }}>
                                    <option value="Blu-Ray">Blu-Ray</option>
                                    <option value="DVD">DVD</option>
                                    <option value="VHS">VHS</option>
                                </select>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Purchase Cost (₹)</label>
                                <input type="number" step="0.01" value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Daily Rate (₹)</label>
                                <input type="number" step="0.01" value={dailyRate} onChange={e => setDailyRate(e.target.value)} required style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} />
                            </div>
                        </div>
                        
                        {/* --- THE NEW SAFELY MOUNTED QUANTITY BLOCK --- */}
                        <div style={{ display: 'grid', gridTemplateColumns: editingId ? '1fr' : '2fr 1fr', gap: '15px', marginBottom: '25px' }}>
                            <div>
                                <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Poster Image URL</label>
                                <input 
                                    type="text" 
                                    placeholder="https://..."
                                    value={imageUrl} 
                                    onChange={e => setImageUrl(e.target.value)} 
                                    style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} 
                                />
                            </div>
                            
                            {/* ONLY SHOW QUANTITY IF WE ARE ADDING NEW ITEMS, NOT EDITING! */}
                            {!editingId && (
                                <div>
                                    <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Quantity</label>
                                    <input 
                                        type="number" 
                                        min="1" 
                                        value={quantity} 
                                        onChange={e => setQuantity(e.target.value)} 
                                        required 
                                        style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box', backgroundColor: '#e8f5e9' }} 
                                    />
                                </div>
                            )}
                        </div>

                        {/* UPDATED BUTTONS BLOCK */}
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button type="submit" style={{ flex: 1, backgroundColor: editingId ? '#f59e0b' : '#2e7d32', color: 'white', padding: '12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                {editingId ? 'Save Updates' : 'Add to Catalog'}
                            </button>
                            
                            {/* Cancel Button only shows up if we are editing! */}
                            {editingId && (
                                <button type="button" onClick={resetForm} style={{ backgroundColor: '#ef4444', color: 'white', padding: '12px 20px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>
                </div>

                {/* System Configuration Card */}
                <div style={{ background: '#fff', padding: '30px', borderRadius: '8px', borderTop: '4px solid #1a1a1a', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ marginTop: 0 }}>System Rules</h3>
                    <p style={{ fontSize: '14px', color: '#666', marginBottom: '20px' }}>These rules apply to all new rentals store-wide.</p>
                    <form onSubmit={handleUpdateConfig}>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Max Rental Duration (Days)</label>
                            <input 
                                type="number" 
                                value={config.maxRentalDays} 
                                onChange={e => setConfig({...config, maxRentalDays: e.target.value})} 
                                required 
                                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} 
                            />
                        </div>
                        <div style={{ marginBottom: '25px' }}>
                            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', fontWeight: 'bold' }}>Late Fine (₹ per day)</label>
                            <input 
                                type="number" 
                                step="0.01"
                                value={config.lateFeePerDay} 
                                onChange={e => setConfig({...config, lateFeePerDay: e.target.value})} 
                                required 
                                style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px', boxSizing: 'border-box' }} 
                            />
                        </div>
                        <button type="submit" style={{ width: '100%', backgroundColor: '#1a1a1a', color: 'white', padding: '12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Save Store Rules</button>
                    </form>
                </div>

            </div>
        </div>
    );
};

export default ManagerDashboard;