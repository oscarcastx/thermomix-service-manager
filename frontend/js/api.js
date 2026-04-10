const API_URL = 'https://thermomix-service-manager-production.up.railway.app/api';

/**
 * Utility to make API calls with automatic JWT injection
 */
const fetchApi = async (endpoint, options = {}) => {
    const token = localStorage.getItem('tmx_token');
    
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || 'Error de conexión con el servidor');
        }

        return data;
    } catch (error) {
        console.error(`[API Error] ${endpoint}:`, error);
        throw error;
    }
};

const logout = () => {
    localStorage.removeItem('tmx_token');
    localStorage.removeItem('tmx_user');
    window.location.href = '/index.html';
};

const getUser = () => {
    const user = localStorage.getItem('tmx_user');
    return user ? JSON.parse(user) : null;
};

window.fetchApi = fetchApi;
window.logout = logout;
window.getUser = getUser;
