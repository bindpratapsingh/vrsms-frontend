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
    const [rentalHistory, setRentalHistory] = useState([]); 
    const [memberProfile, setMemberProfile] = useState(null); // NEW: Holds the photo!

    // UI Tab State
    const [activeTab, setActiveTab] = useState('CATALOG');

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
            setActiveRentals(rentalsResponse.data || []);

            // 3. Fetch wishlist
            const wishlistResponse = await api.get(`/wishlist/${userId}`);
            const savedItemIds = wishlistResponse.data.map(item => item.itemId);
            setWishlistItems(savedItemIds);

            // 4. Fetch complete rental history
            const historyResponse = await api.get(`/history/${userId}`);
            setRentalHistory(historyResponse.data || []);

            // 5. NEW: Fetch member profile photo securely
            try {
                const membersRes = await api.get('/staff/members/all');
                const myProfile = membersRes.data.find(m => m.userId === userId);
                if (myProfile) setMemberProfile(myProfile);
            } catch (photoError) {
                console.log("Could not load profile photo");
            }

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

    const groupedCatalog = Object.values(catalog.reduce((acc, item) => {
        const key = `${item.title}-${item.format}`;
        if (!acc[key]) {
            acc[key] = { ...item, count: 0, itemIds: [] };
        }
        acc[key].count += 1;
        acc[key].itemIds.push(item.itemId);
        return acc;
    }, {}));

    return (
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'sans-serif' }}>
            
            {/* --- UPDATED HEADER WITH PHOTO --- */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #eee', paddingBottom: '20px', marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    {/* The Profile Picture Bubble */}
                    {memberProfile?.photoUrl ? (
                        <img 
                            src={memberProfile.photoUrl} 
                            alt="Profile" 
                            style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #1976d2', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} 
                        />
                    ) : (
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#1976d2', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                            {user?.fullName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                    )}
                    <div>
                        <h1 style={{ fontSize: '28px', color: '#1a1a1a', margin: 0 }}>Member Storefront</h1>
                        <p style={{ color: '#666', margin: '5px 0 0 0' }}>Welcome back, <strong>{user?.fullName}</strong></p>
                    </div>
                </div>
                <button onClick={handleLogout} style={{ backgroundColor: '#1a1a1a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>Logout</button>
            </div>

            {/* --- UPDATED ACTIVE RENTALS BANNER (Always visible) --- */}
            <div style={{ background: '#e8f5e9', border: '1px solid #c8e6c9', padding: '20px', borderRadius: '8px', marginBottom: '30px' }}>
                <h3 style={{ marginTop: 0, color: '#2e7d32', marginBottom: '15px' }}>
                    Currently Renting ({activeRentals?.length || 0})
                </h3>
                
                {activeRentals?.length > 0 ? (
                    <div style={{ display: 'flex', gap: '15px', overflowX: 'auto', paddingBottom: '10px' }}>
                        {activeRentals.map(rental => {
                            const title = rental.itemTitle || rental.item?.title || rental.inventoryItem?.title || 'Unknown Title';
                            return (
                                <div key={rental.loanId} style={{ background: 'white', padding: '15px', borderRadius: '6px', minWidth: '220px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: '1px solid #e0e0e0' }}>
                                    <h4 style={{ margin: '0 0 10px 0', color: '#111827', fontSize: '16px' }}>{title}</h4>
                                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '14px' }}>Receipt: {rental.loanId.substring(0,8)}</p>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#d32f2f', fontWeight: '600' }}>Due: {new Date(rental.dueDate).toLocaleDateString()}</p>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p style={{ margin: 0, color: '#4caf50', fontStyle: 'italic' }}>You have no active rentals at the moment.</p>
                )}
            </div>

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
                        {groupedCatalog.map(group => (
                            <div key={group.itemIds[0]} style={{ border: '1px solid #e0e0e0', borderRadius: '8px', padding: '15px', background: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
                                <img 
                                     src={group.imageUrl} 
                                      alt={group.title} 
                                       onError={(e) => { e.target.src = 'https://placehold.co/150x225?text=No+Poster'; }} 
                                       style={{ width: '100%', height: 'auto', borderRadius: '4px' }}
                                />
                                <h3 style={{ margin: '10px 0 5px 0', fontSize: '18px', textAlign: 'center' }}>{group.title}</h3>
                                <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '14px', textAlign: 'center' }}>{group.category} • {group.format}</p>
                                
                                <p style={{ margin: '0 0 15px 0', fontSize: '12px', fontWeight: 'bold', color: '#2e7d32', textAlign: 'center' }}>
                                    {group.count} Available
                                </p>
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '16px' }}>₹{group.dailyRate}/day</span>
                                    
                                    {(() => {
                                        const isSaved = wishlistItems.includes(group.itemIds[0]);
                                        return (
                                            <button 
                                                onClick={() => handleWishlistToggle(group.itemIds[0])}
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
                                <th style={{ padding: '12px' }}>Movie Title</th> 
                                <th style={{ padding: '12px' }}>Checkout Date</th>
                                <th style={{ padding: '12px' }}>Return Date</th>
                                <th style={{ padding: '12px' }}>Status</th>
                                <th style={{ padding: '12px' }}>Rent Paid</th>
                                <th style={{ padding: '12px' }}>Late Fines</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rentalHistory.map(loan => {
                                const title = loan.itemTitle || loan.item?.title || loan.inventoryItem?.title || 'Unknown Title';
                                return (
                                <tr key={loan.loanId} style={{ borderBottom: '1px solid #eee' }}>
                                    <td style={{ padding: '12px', fontFamily: 'monospace' }}>{loan.loanId.substring(0, 8)}</td>
                                    <td style={{ padding: '12px', fontWeight: 'bold', color: '#111827' }}>{title}</td>
                                    <td style={{ padding: '12px' }}>{new Date(loan.issueDate || loan.checkoutDate).toLocaleDateString()}</td>
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
                            )})}
                            {rentalHistory.length === 0 && (
                                <tr><td colSpan="7" style={{ padding: '20px', textAlign: 'center', color: '#666' }}>You have no past rentals.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default MemberPortal;
