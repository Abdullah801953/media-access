import { createContext, useContext, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (token) {
      try {
        const decoded = jwtDecode(token);
        setAdmin({ email: decoded.email });
      } catch (error) {
        localStorage.removeItem("adminToken");
      }
    }
    setLoading(false);
  }, []);

  const login = (token) => {
    localStorage.setItem("adminToken", token);
    try {
      const decoded = jwtDecode(token);
      setAdmin({ email: decoded.email });
      navigate("/dashboard"); // ✅ login ke baad dashboard par bhejo
    } catch (error) {
      console.error("Invalid token");
    }
  };

  const logout = () => {
    localStorage.removeItem("adminToken");
    setAdmin(null);
    navigate("/signin");
  };

  const isAuthenticated = () => !!admin;

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout, isAuthenticated }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
