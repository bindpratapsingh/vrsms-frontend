import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const MemberPortal = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // States for our data
    const [catalog, setCatalog] = useState([]);
    const [activeRentals, setActiveRentals] = useState([]);
    const [wishlistItems, setWishlistItems] = useState([]);
    const [rentalHistory, setRentalHistory] = useState([]); // NEW: History State

    // UI Tab State
    const [activeTab, setActiveTab] = useState('CATALOG'); // 'CATALOG' or 'HISTORY'

    useEffect(() => {
        const loggedInUser = localStorage.getItem('vrsms_user');
        if (!loggedInUser) {
            navigate('/');
        } else {
            const parsedUser = JSON.parse(loggedInUser);
            setUser(parsedUser);
            fetchMemberData(parsedUser.userId);
        }
    }, [navigate]);

    const fetchMemberData = async (userId) => {
        try {
            // 1. Fetch available movies
            const catalogResponse = await api.get('/inventory/available');
            setCatalog(catalogResponse.data);

            // 2. Fetch active currently rented movies
            const rentalsResponse = await api.get(`/rentals/my-active/${userId}`);
            setActiveRentals(rentalsResponse.data);

            // 3. Fetch wishlist
            const wishlistResponse = await api.get(`/wishlist/${userId}`);
            const savedItemIds = wishlistResponse.data.map(item => item.itemId);
            setWishlistItems(savedItemIds);

            // 4. NEW: Fetch complete rental history
            const historyResponse = await api.get(`/history/${userId}`);
            setRentalHistory(historyResponse.data);

        } catch (error) {
            console.error("Failed to fetch data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleWishlistToggle = async (itemId) => {
        try {
            const response = await api.post('/wishlist/toggle', {
                userId: user.userId,
                itemId: itemId
            });

            if (response.data === 'ADDED') {
                setWishlistItems([...wishlistItems, itemId]);
            } else {
                setWishlistItems(wishlistItems.filter(id => id !== itemId));
            }
        } catch (error) {
            console.error("Failed to toggle wishlist", error);
            alert("Error saving movie: " + (error.response?.data || error.message));
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('vrsms_user');
        navigate('/');
    };

    if (loading) return <div style={{ textAlign: 'center', padding: '50px', fontFamily: 'sans-serif' }}>Loading Portal...</div>;

    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '30px' }}>
                <div>
                    <h1 style={{ fontSize: '28px', color: '#1a1a1a', margin: 0 }}>Member Storefront</h1>
                    <p style={{ color: '#666', margin: '5px 0 0 0' }}>Welcome back, <strong>{user?.fullName}</strong></p>
                </div>
                <button onClick={handleLogout} style={{ backgroundColor: '#1a1a1a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Logout</button>
            </div>

            {/* ACTIVE RENTALS BANNER */}
            {activeRentals.length > 0 && (
                <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
                    <h3 style={{ marginTop: 0, color: '#2e7d32' }}>Currently Renting ({activeRentals.length})</h3>
                    <div style={{ display: 'flex', gap: '15px', overflowX: 'auto' }}>
                        {activeRentals.map(rental => (
                            <div key={rental.loanId} style={{ background: 'white', padding: '15px', borderRadius: '6px', minWidth: '200px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                                <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>Receipt: {rental.loanId.substring(0,8)}</p>
                                <p style={{ margin: 0, fontSize: '14px', color: '#d32f2f' }}>Due: {new Date(rental.dueDate).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* NAVIGATION TABS */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #eee' }}>
                <button 
                    onClick={() => setActiveTab('CATALOG')}
                    style={{ padding: '10px 20px', border: 'none', background: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', color: activeTab === 'CATALOG' ? '#1976d2' : '#666', borderBottom: activeTab === 'CATALOG' ? '3px solid #1976d2' : '3px solid transparent' }}>
                    Browse Movies
                </button>
                <button 
                    onClick={() => setActiveTab('HISTORY')}
                    style={{ padding: '10px 20px', border: 'none', background: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', color: activeTab === 'HISTORY' ? '#1976d2' : '#666', borderBottom: activeTab === 'HISTORY' ? '3px solid #1976d2' : '3px solid transparent' }}>
                    My Rental History
                </button>
            </div>

            {/* VIEW 1: CATALOG */}
            {activeTab === 'CATALOG' && (
                <div>
                    <h2 style={{ marginBottom: '20px' }}>Available Catalog</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                        {catalog.map(item => (
                            <div key={item.itemId} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '15px', background: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                                {/* THE MOVIE POSTER */}
                                <img 
                                    src={item.imageUrl || 'https://via.placeholder.com/300x450?text=No+Poster'} 
                                    alt={item.title} 
                                    style={{ width: '100%', height: '350px', objectFit: 'cover', borderRadius: '4px', marginBottom: '15px' }} 
                                />
                                <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', textAlign: 'center' }}>{item.title}</h3>
                                <p style={{ margin: '0 0 15px 0', color: '#666', fontSize: '14px', textAlign: 'center' }}>{item.category} • {item.format}</p>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '16px' }}>₹{item.dailyRate}/day</span>
                                    
                                    {/* WISHLIST BUTTON */}
                                    {(() => {
                                        const isSaved = wishlistItems.includes(item.itemId);
                                        return (
                                            <button 
                                                onClick={() => handleWishlistToggle(item.itemId)}
                                                style={{ 
                                                    padding: '8px 16px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold',
                                                    backgroundColor: isSaved ? '#d32f2f' : '#f5f5f5', 
                                                    color: isSaved ? 'white' : '#333', 
                                                    border: isSaved ? 'none' : '1px solid #ccc', borderRadius: '4px',
                                                    transition: 'all 0.2s'
                                                }}>
                                                {isSaved ? '♥ Saved' : 'Wishlist'}
                                            </button>
                                        );
                                    })()}
                                </div>
                            </div>
                        ))}
                        {catalog.length === 0 && <p>No movies available right now.</p>}
                    </div>
                </div>
            )}

            {/* VIEW 2: RENTAL HISTORY */}
            {activeTab === 'HISTORY' && (
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '20px', overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
                                <th style={{ padding: '12px' }}>Receipt ID</th>
                                <th style={{ padding: '12px' }}>Checkout Date</th>
                                <th style={{ padding: '12px' }}>Return Date</th>
                                <th style={{ padding: '12px' }}>Status</th>
                                <th style={{ padding: '12px' }}>Rent Paid</th>
                                <th style={{ padding: '12px' }}>Late Fines</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rentalHistory.map(loan => (
                                <tr key={loan.loanId} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>{loan.loanId.substring(0, 8)}</td>
                                    <td style={{ padding: '12px' }}>{new Date(loan.issueDate).toLocaleDateString()}</td>
                                    <td style={{ padding: '12px' }}>{loan.returnDate ? new Date(loan.returnDate).toLocaleDateString() : '---'}</td>
                                    <td style={{ padding: '12px' }}>
                                        <span style={{ 
                                            background: loan.status === 'RETURNED' ? '#e8f5e9' : '#fff3e0', 
                                            color: loan.status === 'RETURNED' ? '#2e7d32' : '#e65100', 
                                            padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold' 
                                        }}>
                                            {loan.status}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px', fontWeight: 'bold' }}>₹{loan.rentAmount || '0.00'}</td>
                                    <td style={{ padding: '12px', color: '#d32f2f', fontWeight: 'bold' }}>₹{loan.fineAmount || '0.00'}</td>
                                </tr>
                            ))}
                            {rentalHistory.length === 0 && (
                                <tr><td colSpan="6" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>You have no past rentals.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default MemberPortal;